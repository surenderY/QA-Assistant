"""
Celery background tasks.
Task implementations are added incrementally per phase:
  - Phase 2: import_jira_story
  - Phase 3: generate_test_plan, generate_scripts
  - Phase 4: commit_to_git
  - Phase 5: execute_scripts
"""

import logging
import uuid

from celery import Task
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_sync_session() -> Session:
    engine = create_engine(settings.database_url_sync)
    return Session(engine)


# ── Phase 1 ───────────────────────────────────────────────────────────────
@celery_app.task(name="tasks.ping")
def ping():
    return "pong"


# ── Phase 2: JIRA import ──────────────────────────────────────────────────
@celery_app.task(
    name="tasks.import_jira_story",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def import_jira_story(self: Task, story_db_id: str, story_key: str):
    """
    Background task: runs JiraFetchAgent, then persists enriched data to DB.
    Called after a placeholder JiraStory row is created by the API endpoint.
    """
    from app.agents.jira_fetch_agent import JiraFetchAgent
    from app.services.jira_service import get_jira_service
    from app.models.models import JiraStory, StoryStatus

    logger.info(f"Starting JIRA import task for {story_key} (db_id={story_db_id})")
    db = get_sync_session()
    try:
        agent = JiraFetchAgent(jira_service=get_jira_service())
        story_data = agent.run(story_key)

        story = db.get(JiraStory, uuid.UUID(story_db_id))
        if not story:
            return {"status": "error", "message": "Story record not found"}

        story.title = story_data.title
        story.description = story_data.description
        story.acceptance_criteria = story_data.acceptance_criteria
        story.story_type = story_data.story_type
        story.priority = story_data.priority
        story.assignee = story_data.assignee
        story.reporter = story_data.reporter
        story.jira_status = story_data.jira_status
        story.raw_data = story_data.raw_data
        story.status = StoryStatus.NEW

        db.commit()
        logger.info(f"Successfully imported {story_key}")
        return {"status": "success", "story_id": story_key}

    except Exception as exc:
        db.rollback()
        logger.error(f"Import failed for {story_key}: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)
    finally:
        db.close()

# ── Phase 3: Test Plan generation ─────────────────────────────────────────

@celery_app.task(
    name="tasks.generate_test_plan",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def generate_test_plan(self, story_db_id: str):
    """
    Runs TestPlanAgent for the given story and persists the plan to DB.
    """
    import uuid
    from app.agents.test_plan_agent import TestPlanAgent
    from app.models.models import JiraStory, TestPlan, StoryStatus

    logger.info(f"Starting test plan generation for story {story_db_id}")
    db = get_sync_session()
    try:
        story = db.get(JiraStory, uuid.UUID(story_db_id))
        if not story:
            return {"status": "error", "message": "Story not found"}

        story_data = {
            "story_id": story.story_id,
            "title": story.title,
            "description": story.description,
            "acceptance_criteria": story.acceptance_criteria,
            "priority": story.priority,
            "story_type": story.story_type,
        }

        agent = TestPlanAgent()
        plan_doc = agent.run(story_data)

        # Persist to DB
        plan = TestPlan(
            story_id=story.id,
            title=plan_doc.title,
            scope=plan_doc.scope,
            objectives=plan_doc.objectives,
            test_types=plan_doc.test_types,
            test_scenarios=[s.model_dump() for s in plan_doc.scenarios],
            risk_areas=plan_doc.risk_areas,
            out_of_scope=plan_doc.out_of_scope,
            agent_model=settings.anthropic_model,
            plan_document=plan_doc.model_dump(),
        )
        db.add(plan)

        # Update story status
        story.status = StoryStatus.PLANNED
        db.commit()

        logger.info(f"Test plan created for story {story_db_id}, plan_id={plan.id}")
        return {"status": "success", "plan_id": str(plan.id), "scenario_count": len(plan_doc.scenarios)}

    except Exception as exc:
        db.rollback()
        logger.error(f"Test plan generation failed for {story_db_id}: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()


# ── Phase 3: Script generation ─────────────────────────────────────────────

@celery_app.task(
    name="tasks.generate_scripts",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def generate_scripts(self, plan_db_id: str, scenario_ids: list | None = None):
    """
    Runs ScriptGenAgent for each scenario in the test plan.
    Optionally filter to specific scenario_ids only.
    """
    import uuid
    from app.agents.script_gen_agent import ScriptGenAgent
    from app.models.models import TestPlan, TestScript, JiraStory, StoryStatus
    from app.schemas.testplan import TestScenario

    logger.info(f"Starting script generation for plan {plan_db_id}")
    db = get_sync_session()
    try:
        plan = db.get(TestPlan, uuid.UUID(plan_db_id))
        if not plan:
            return {"status": "error", "message": "Test plan not found"}

        story = db.get(JiraStory, plan.story_id)
        story_context = {
            "story_id": story.story_id if story else "N/A",
            "title": story.title if story else "N/A",
            "description": story.description if story else "",
        }

        # Build scenario objects from stored JSON
        all_scenarios = [
            TestScenario(**sc) for sc in (plan.test_scenarios or [])
        ]

        # Filter if specific scenario_ids requested
        scenarios = (
            [s for s in all_scenarios if s.id in scenario_ids]
            if scenario_ids else all_scenarios
        )

        if not scenarios:
            return {"status": "error", "message": "No scenarios found to generate scripts for"}

        agent = ScriptGenAgent()
        results = agent.run_batch(scenarios, story_context)

        # Persist scripts
        created = []
        for item in results:
            scenario = item["scenario"]
            script_data = item["script"]
            script = TestScript(
                plan_id=plan.id,
                script_name=script_data["script_name"],
                script_content=script_data["script_content"],
                scenario_name=scenario.name,
            )
            db.add(script)
            created.append(script_data["script_name"])

        # Update story status
        if story:
            story.status = StoryStatus.SCRIPTED

        db.commit()
        logger.info(f"Generated {len(created)} scripts for plan {plan_db_id}: {created}")
        return {"status": "success", "scripts_created": created}

    except Exception as exc:
        db.rollback()
        logger.error(f"Script generation failed for plan {plan_db_id}: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()
        

# ── Phase 4: Git commit ───────────────────────────────────────────────────
@celery_app.task(name="tasks.commit_scripts_to_git", bind=True, max_retries=2, default_retry_delay=15)
def commit_scripts_to_git(self: Task, script_ids: list, story_db_id: str):
    from app.agents.git_agent import GitAgent
    from app.services.git_service import get_git_service
    from app.models.models import TestScript, JiraStory, TestPlan

    logger.info(f"[git] Starting commit for {len(script_ids)} scripts, story={story_db_id}")
    db = get_sync_session()
    try:
        # Load scripts
        scripts_data = []
        script_objs = []
        for sid in script_ids:
            script = db.get(TestScript, uuid.UUID(sid))
            if not script:
                logger.warning(f"[git] Script {sid} not found — skipping")
                continue
            scripts_data.append({
                "script_name": script.script_name,
                "script_content": script.script_content,
                "scenario_name": script.scenario_name or "",
            })
            script_objs.append(script)

        if not scripts_data:
            return {"status": "error", "message": "No valid scripts found"}

        # Load context
        story = db.get(JiraStory, uuid.UUID(story_db_id))
        plan = db.get(TestPlan, script_objs[0].plan_id) if script_objs else None
        story_id = story.story_id if story else "UNKNOWN"
        story_title = story.title if story else "Unknown Story"
        plan_title = plan.title if plan else None

        # Run agent
        agent = GitAgent(git_service=get_git_service())
        result = agent.commit_scripts(
            scripts=scripts_data,
            story_id=story_id,
            story_title=story_title,
            plan_title=plan_title,
        )

        # Update DB
        git_paths = result.get("git_paths", [])
        for i, script in enumerate(script_objs):
            script.branch_name = result["branch_name"]
            script.commit_sha = result["commit_sha"]
            script.git_path = git_paths[i] if i < len(git_paths) else None
            script.is_committed = True
        db.commit()

        logger.info(
            f"[git] Done: branch={result['branch_name']}, "
            f"sha={result['commit_sha'][:8] if result['commit_sha'] else 'N/A'}, "
            f"pushed={result.get('pushed')}"
        )
        return {
            "status": "success",
            "branch_name": result["branch_name"],
            "commit_sha": result["commit_sha"],
            "git_paths": result["git_paths"],
            "pushed": result.get("pushed", False),
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"[git] Commit failed: {exc}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 15)
    finally:
        db.close()

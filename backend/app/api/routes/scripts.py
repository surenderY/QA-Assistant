import uuid, logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models import TestScript, TestPlan

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request schemas ────────────────────────────────────────────────────────

class GenerateScriptsRequest(BaseModel):
    scenario_ids: list[str] | None = None  # None = generate for all scenarios

class CommitScriptRequest(BaseModel):
    """Commit a single script."""
    story_db_id: str

class CommitBatchRequest(BaseModel):
    """Commit multiple scripts from a plan at once."""
    script_ids: list[str]
    story_db_id: str


# ── Phase 3: Generate ──────────────────────────────────────────────────────

@router.post(
    "/generate/{plan_id}",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate pytest scripts for a test plan",
)
async def generate_scripts(
    plan_id: uuid.UUID,
    request: GenerateScriptsRequest = GenerateScriptsRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches ScriptGenAgent as a Celery task for each scenario in the plan.
    Optionally filter to specific scenario_ids.
    """
    plan = await db.get(TestPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")

    if not plan.test_scenarios:
        raise HTTPException(
            status_code=400,
            detail="Test plan has no scenarios. Regenerate the test plan first."
        )

    from app.services.tasks import generate_scripts as gen_scripts_task
    task = gen_scripts_task.delay(str(plan_id), request.scenario_ids)
    logger.info(f"Dispatched script generation for plan {plan_id}, task_id={task.id}")

    scenario_count = (
        len(request.scenario_ids) if request.scenario_ids
        else len(plan.test_scenarios)
    )

    return {
        "message": f"Script generation started for {scenario_count} scenario(s).",
        "plan_id": str(plan_id),
        "task_id": task.id,
        "scenario_count": scenario_count,
        "status": "generating",
        "poll_url": f"/api/v1/scripts/{plan_id}",
    }


@router.get("/{plan_id}", summary="List scripts for a test plan")
async def list_scripts(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestScript)
        .where(TestScript.plan_id == plan_id)
        .order_by(TestScript.created_at)
    )
    scripts = result.scalars().all()
    return {
        "plan_id": str(plan_id),
        "total": len(scripts),
        "scripts": [
            {
                "id": str(s.id),
                "script_name": s.script_name,
                "scenario_name": s.scenario_name,
                "language": s.language,
                "is_committed": s.is_committed,
                "branch_name": s.branch_name,
                "commit_sha": s.commit_sha,
                "created_at": s.created_at.isoformat(),
            }
            for s in scripts
        ],
    }


@router.get("/{plan_id}/{script_id}/content", summary="Get full script source code")
async def get_script_content(
    plan_id: uuid.UUID,
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    script = await db.get(TestScript, script_id)
    if not script or script.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Script not found")
    return {
        "id": str(script.id),
        "script_name": script.script_name,
        "scenario_name": script.scenario_name,
        "content": script.script_content,
        "language": script.language,
        "is_committed": script.is_committed,
        "branch_name": script.branch_name,
        "commit_sha": script.commit_sha,
        "git_path": script.git_path,
    }

# ── Phase 4: Commit single ─────────────────────────────────────────────────

@router.post(
    "/{script_id}/commit",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Commit a single script to Git via GitAgent",
)
async def commit_script(
    script_id: uuid.UUID,
    request: CommitScriptRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches GitAgent as a Celery task to commit the script to a feature branch.
    Returns 202 — poll GET /{plan_id} to check is_committed status.
    """
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    if script.is_committed:
        raise HTTPException(
            status_code=409,
            detail=f"Script already committed to branch '{script.branch_name}' ({script.commit_sha[:8] if script.commit_sha else 'N/A'})"
        )

    from app.services.tasks import commit_scripts_to_git
    task = commit_scripts_to_git.delay([str(script_id)], request.story_db_id)
    logger.info(f"Dispatched git commit for script {script_id}, task_id={task.id}")

    return {
        "message": f"Git commit queued for {script.script_name}",
        "script_id": str(script_id),
        "task_id": task.id,
        "status": "committing",
    }


# ── Phase 4: Commit batch ──────────────────────────────────────────────────

@router.post(
    "/commit-batch/{plan_id}",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Commit multiple scripts to a single feature branch",
)
async def commit_batch(
    plan_id: uuid.UUID,
    request: CommitBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Commits all provided script IDs together under a single feature branch.
    GitAgent decides branch name and commit message from story context.
    """
    plan = await db.get(TestPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")

    # Validate all scripts belong to this plan and are not yet committed
    scripts_result = await db.execute(
        select(TestScript).where(TestScript.plan_id == plan_id)
    )
    all_scripts = {str(s.id): s for s in scripts_result.scalars().all()}

    # Filter to requested IDs, or use all uncommitted scripts
    target_ids = request.script_ids if request.script_ids else list(all_scripts.keys())
    invalid = [sid for sid in target_ids if sid not in all_scripts]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Scripts not found in this plan: {invalid}")

    already_committed = [sid for sid in target_ids if all_scripts[sid].is_committed]
    if already_committed:
        already_detail = [f"{all_scripts[sid].script_name} (branch: {all_scripts[sid].branch_name})" for sid in already_committed]
        raise HTTPException(
            status_code=409,
            detail=f"Some scripts already committed: {already_detail}"
        )

    from app.services.tasks import commit_scripts_to_git
    task = commit_scripts_to_git.delay(target_ids, request.story_db_id)
    logger.info(f"Dispatched batch git commit for {len(target_ids)} scripts, task_id={task.id}")

    return {
        "message": f"Git commit queued for {len(target_ids)} script(s). GitAgent will create a feature branch.",
        "plan_id": str(plan_id),
        "script_count": len(target_ids),
        "task_id": task.id,
        "status": "committing",
        "poll_url": f"/api/v1/scripts/{plan_id}",
    }


# ── Phase 4: Branch info ───────────────────────────────────────────────────

@router.get(
    "/branch/{branch_name:path}",
    summary="Get Git branch info",
)
async def get_branch_info(branch_name: str):
    """Returns commit info for a given branch from the local repo."""
    try:
        from app.services.git_service import get_git_service
        svc = get_git_service()
        info = svc.get_branch_info(branch_name)
        if not info:
            raise HTTPException(status_code=404, detail=f"Branch '{branch_name}' not found")
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/repo/status",
    summary="Get Git repo status",
)
async def get_repo_status():
    """Returns current repo path, active branch, and remote info."""
    try:
        from app.services.git_service import get_git_service
        svc = get_git_service()
        return svc.repo_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Repo error: {str(e)}")

# ── Helpers ────────────────────────────────────────────────────────────────

def _script_summary(s: TestScript) -> dict:
    return {
        "id": str(s.id),
        "plan_id": str(s.plan_id),
        "script_name": s.script_name,
        "scenario_name": s.scenario_name,
        "language": s.language,
        "is_committed": s.is_committed,
        "branch_name": s.branch_name,
        "commit_sha": s.commit_sha[:8] if s.commit_sha else None,
        "commit_sha_full": s.commit_sha,
        "git_path": s.git_path,
        "created_at": s.created_at.isoformat(),
    }

# ── Phase 3: Delete ────────────────────────────────────────────────────────

@router.delete("/{script_id}", status_code=204, summary="Delete a script")
async def delete_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    await db.delete(script)

"""
GitAgent — Anthropic Claude agent that handles the Git commit flow.

Responsibilities:
  1. Receives script(s) + story context
  2. Claude generates:
     - A meaningful feature branch name
     - A structured commit message following conventional commits
     - The correct subdirectory path for the file
  3. GitService executes the actual Git operations
  4. Returns branch name, commit SHA, and file path
"""

import json
import logging

from anthropic import Anthropic

from app.core.config import settings
from app.services.git_service import GitService

logger = logging.getLogger(__name__)

# ── Tools ──────────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "create_git_commit_plan",
        "description": (
            "Output the Git commit plan — branch name, commit message, and "
            "subdirectory for the test scripts. Call this as your only action."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "branch_name": {
                    "type": "string",
                    "description": (
                        "Feature branch name. Format: feature/{story_id_lowercase}-{short_description}. "
                        "Use lowercase, hyphens only. E.g. feature/scrum-7-user-login-tests"
                    ),
                },
                "commit_message": {
                    "type": "string",
                    "description": (
                        "Conventional commit message. Format: test({story_id}): {description}. "
                        "E.g. 'test(SCRUM-7): add user login authentication test scenarios'"
                    ),
                },
                "subdirectory": {
                    "type": "string",
                    "description": (
                        "Subdirectory within tests/ to store the scripts. "
                        "Use the story_id in lowercase. E.g. 'scrum-7' → files go in tests/scrum-7/"
                    ),
                },
                "pr_description": {
                    "type": "string",
                    "description": "Short pull request description summarising what tests were added and why.",
                },
            },
            "required": ["branch_name", "commit_message", "subdirectory"],
        },
    }
]

SYSTEM_PROMPT = """You are a senior QA engineer managing a Git repository of automated tests.

Given information about a JIRA story and its generated test scripts, you must:
1. Create a meaningful feature branch name following the convention: feature/{story_id_lowercase}-{short_description}
2. Write a conventional commit message: test({STORY_ID}): {clear description of what tests were added}
3. Suggest an appropriate subdirectory under tests/ based on the story ID
4. Write a brief PR description

Rules:
- Branch names: lowercase, hyphens only, max 60 chars, always starts with feature/
- Commit messages: follow Conventional Commits spec, clear and descriptive
- Never use spaces in branch names
- The subdirectory should be the lowercase story ID (e.g. scrum-7, proj-42)"""


class GitAgent:
    """
    Claude-powered agent that generates Git metadata (branch, commit message)
    then delegates actual Git operations to GitService.
    """

    def __init__(self, git_service: GitService):
        self.git = git_service
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    def commit_scripts(
        self,
        scripts: list[dict],
        story_id: str,
        story_title: str,
        plan_title: str | None = None,
    ) -> dict:
        """
        Main entry point. Generates commit plan via Claude, then executes Git operations.

        Args:
            scripts: list of dicts with keys: script_name, script_content, scenario_name
            story_id: JIRA story key e.g. SCRUM-7
            story_title: Story title for context
            plan_title: Test plan title for context

        Returns:
            dict with branch_name, commit_sha, git_paths, pushed, pr_description
        """
        logger.info(f"GitAgent starting for story {story_id} — {len(scripts)} scripts")

        # ── Step 1: Ask Claude for commit plan ────────────────────────────
        commit_plan = self._get_commit_plan(scripts, story_id, story_title, plan_title)
        logger.info(
            f"Commit plan: branch={commit_plan['branch_name']}, "
            f"msg='{commit_plan['commit_message']}'"
        )

        # ── Step 2: Create the branch ─────────────────────────────────────
        branch_name = self.git.create_branch(commit_plan["branch_name"])

        # ── Step 3: Commit each script ────────────────────────────────────
        git_paths = []
        last_sha = None
        subdir = commit_plan.get("subdirectory", story_id.lower().replace(" ", "-"))

        for i, script in enumerate(scripts):
            try:
                result = self.git.commit_script(
                    script_name=script["script_name"],
                    script_content=script["script_content"],
                    story_id=subdir,
                    branch_name=branch_name,
                    commit_message=(
                        commit_plan["commit_message"]
                        if i == 0
                        else f"test({story_id}): add {script['script_name']}"
                    ),
                )
                git_paths.append(result["git_path"])
                last_sha = result["commit_sha"]
                logger.info(f"Committed script {i+1}/{len(scripts)}: {script['script_name']}")
            except Exception as e:
                logger.error(f"Failed to commit {script['script_name']}: {e}")
                raise

        return {
            "branch_name": branch_name,
            "commit_sha": last_sha,
            "git_paths": git_paths,
            "pushed": result.get("pushed", False),
            "pr_description": commit_plan.get("pr_description", ""),
            "commit_message": commit_plan["commit_message"],
        }

    # ── Claude interaction ─────────────────────────────────────────────────

    def _get_commit_plan(
        self,
        scripts: list[dict],
        story_id: str,
        story_title: str,
        plan_title: str | None,
    ) -> dict:
        script_summary = "\n".join(
            f"  - {s['script_name']} ({s.get('scenario_name', 'scenario')})"
            for s in scripts
        )

        user_message = f"""Please create a Git commit plan for the following test scripts.

**Story:** {story_id} — {story_title}
**Test Plan:** {plan_title or 'N/A'}
**Scripts to commit ({len(scripts)}):**
{script_summary}

Generate an appropriate branch name, commit message, and subdirectory."""

        messages = [{"role": "user", "content": user_message}]
        commit_plan: dict | None = None

        for iteration in range(3):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                tool_choice={"type": "any"},
                messages=messages,
            )

            logger.debug(f"GitAgent iteration {iteration + 1}, stop_reason={response.stop_reason}")
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                if block.name == "create_git_commit_plan":
                    commit_plan = block.input
                    logger.info(f"Git commit plan received: {commit_plan}")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps({"status": "ok"}),
                })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})
            if commit_plan:
                break

        if not commit_plan:
            # Fallback: generate deterministically without Claude
            logger.warning("GitAgent Claude call failed — using deterministic fallback")
            commit_plan = self._fallback_commit_plan(story_id, story_title, scripts)

        return commit_plan

    def _fallback_commit_plan(
        self,
        story_id: str,
        story_title: str,
        scripts: list[dict],
    ) -> dict:
        """Deterministic fallback if Claude doesn't respond."""
        safe_title = re.sub(r"[^\w\s-]", "", story_title.lower())[:40].strip().replace(" ", "-")
        story_lower = story_id.lower().replace(" ", "-")
        return {
            "branch_name": f"feature/{story_lower}-tests",
            "commit_message": f"test({story_id}): add automated test scripts",
            "subdirectory": story_lower,
            "pr_description": f"Adds {len(scripts)} automated test script(s) for {story_id}.",
        }


import re  # noqa: E402 (needed for fallback)

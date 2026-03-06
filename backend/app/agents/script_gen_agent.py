"""
ScriptGenAgent — Anthropic Claude agent that generates executable pytest
test scripts from test plan scenarios.

Flow:
  1. Receives a TestScenario + story context
  2. Claude generates a complete pytest file
  3. Validates the output is syntactically correct Python
  4. Returns script name + content
"""

import ast
import json
import logging
import re

from anthropic import Anthropic

from app.core.config import settings
from app.schemas.testplan import TestScenario

logger = logging.getLogger(__name__)


# ── Tool definition ────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "output_test_script",
        "description": (
            "Output the complete pytest test script. "
            "Must be valid, executable Python. Call this as your final action."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "script_name": {
                    "type": "string",
                    "description": "Filename, e.g. test_user_login_happy_path.py"
                },
                "script_content": {
                    "type": "string",
                    "description": "Complete pytest Python script content"
                },
                "description": {
                    "type": "string",
                    "description": "One-line summary of what this script tests"
                },
            },
            "required": ["script_name", "script_content", "description"],
        },
    }
]

SYSTEM_PROMPT = """You are a senior Python test engineer. Your job is to write clean, 
executable pytest test scripts based on test scenarios.

Rules for generated scripts:
1. Always start with module docstring explaining what is being tested
2. Import pytest and any required standard library modules
3. Use pytest fixtures for setup/teardown (conftest pattern)
4. Mock all external dependencies (HTTP calls, DB, third-party APIs) using unittest.mock
5. Each test function must have a clear docstring
6. Test function names must follow: test_<scenario>_<condition>
7. Include both positive (happy path) and the specific scenario being tested
8. Use pytest.mark for categorisation: @pytest.mark.unit, @pytest.mark.integration, etc.
9. Add assert messages so failures are self-explanatory
10. The script must be completely self-contained — no imports from the app under test
    (use mocks to simulate app behaviour since we don't have the actual implementation)

Structure:
- Module docstring
- Imports  
- Constants / test data
- Fixtures (if needed)
- Test class or functions
- Each test: Arrange → Act → Assert pattern with comments"""


class ScriptGenAgent:
    """
    Claude-powered agent that generates a pytest script for a single test scenario.
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    def run(self, scenario: TestScenario, story_context: dict) -> dict:
        """
        Generate a pytest script for a single scenario.

        Args:
            scenario: TestScenario object from the test plan
            story_context: dict with story_id, title, description

        Returns:
            dict with keys: script_name, script_content, description
        """
        logger.info(f"ScriptGenAgent generating script for scenario: {scenario.id} - {scenario.name}")

        user_message = self._build_prompt(scenario, story_context)
        messages = [{"role": "user", "content": user_message}]

        result: dict | None = None
        max_iterations = 4

        for iteration in range(max_iterations):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=8096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            logger.debug(f"ScriptGenAgent iteration {iteration + 1}, stop_reason={response.stop_reason}")
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                break

            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                if block.name == "output_test_script":
                    script_content = block.input.get("script_content", "")

                    # ── Validate Python syntax ─────────────────────────────
                    validation_result = self._validate_python(script_content)
                    if not validation_result["valid"]:
                        logger.warning(f"Syntax error in generated script: {validation_result['error']}")
                        # Ask Claude to fix it
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps({
                                "status": "error",
                                "message": f"Syntax error: {validation_result['error']}. Please fix and call output_test_script again."
                            }),
                            "is_error": True,
                        })
                        continue

                    result = {
                        "script_name": self._sanitise_filename(block.input.get("script_name", "")),
                        "script_content": script_content,
                        "description": block.input.get("description", ""),
                    }
                    logger.info(f"Script generated: {result['script_name']}")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps({"status": "ok"}),
                })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

            if result:
                break

        if not result:
            raise RuntimeError(
                f"ScriptGenAgent failed to generate a valid script for scenario {scenario.id}"
            )

        return result

    def run_batch(self, scenarios: list[TestScenario], story_context: dict) -> list[dict]:
        """
        Generate scripts for multiple scenarios.
        Returns list of script dicts, skipping any that fail.
        """
        scripts = []
        for scenario in scenarios:
            try:
                script = self.run(scenario, story_context)
                scripts.append({"scenario": scenario, "script": script})
            except Exception as e:
                logger.error(f"Failed to generate script for scenario {scenario.id}: {e}")
        return scripts

    # ── Helpers ────────────────────────────────────────────────────────────

    def _build_prompt(self, scenario: TestScenario, story: dict) -> str:
        steps_text = "\n".join(f"  {i+1}. {step}" for i, step in enumerate(scenario.steps))
        expected_text = "\n".join(f"  - {r}" for r in scenario.expected_results)
        edge_text = "\n".join(f"  - {e}" for e in scenario.edge_cases) if scenario.edge_cases else "  None specified"
        precond_text = "\n".join(f"  - {p}" for p in scenario.preconditions) if scenario.preconditions else "  None"

        return f"""Generate a pytest test script for the following test scenario.

**Story Context:**
- Story ID: {story.get("story_id", "N/A")}
- Story Title: {story.get("title", "N/A")}
- Description: {story.get("description", "N/A")[:500] if story.get("description") else "N/A"}

**Test Scenario:**
- ID: {scenario.id}
- Name: {scenario.name}
- Description: {scenario.description}
- Type: {scenario.test_type}
- Priority: {scenario.priority}

**Preconditions:**
{precond_text}

**Test Steps:**
{steps_text}

**Expected Results:**
{expected_text}

**Edge Cases to Cover:**
{edge_text}

Generate a complete, self-contained pytest script that tests this scenario thoroughly.
Use mocks for all external dependencies. The script must be syntactically valid Python."""

    def _validate_python(self, code: str) -> dict:
        """Check if generated code is syntactically valid Python."""
        try:
            ast.parse(code)
            return {"valid": True, "error": None}
        except SyntaxError as e:
            return {"valid": False, "error": f"Line {e.lineno}: {e.msg}"}

    def _sanitise_filename(self, name: str) -> str:
        """Ensure the script filename is safe and ends with .py"""
        # Remove any path components
        name = name.split("/")[-1].split("\\")[-1]
        # Replace spaces and special chars
        name = re.sub(r"[^\w\-.]", "_", name)
        # Ensure it starts with test_
        if not name.startswith("test_"):
            name = f"test_{name}"
        # Ensure .py extension
        if not name.endswith(".py"):
            name = f"{name}.py"
        return name.lower()

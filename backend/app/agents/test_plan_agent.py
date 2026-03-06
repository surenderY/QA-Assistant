"""
TestPlanAgent — Anthropic Claude agent that generates a structured test plan
from an imported JIRA user story.

Flow:
  1. Receives a JiraStory ORM object
  2. Claude analyses title, description, and acceptance criteria
  3. Claude calls structure_test_plan tool with the full plan
  4. Returns a validated TestPlanDocument
"""

import json
import logging

from anthropic import Anthropic

from app.core.config import settings
from app.schemas.testplan import TestPlanDocument, TestScenario

logger = logging.getLogger(__name__)

# ── Tool definition ────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "structure_test_plan",
        "description": (
            "Call this tool to output the complete structured test plan including ALL scenarios. "
            "The scenarios array MUST NOT be empty — include one scenario per acceptance criterion minimum."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "scope": {"type": "string"},
                "objectives": {"type": "string"},
                "test_types": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["unit", "integration", "e2e", "api", "performance", "security"]},
                },
                "scenarios": {
                    "type": "array",
                    "description": "REQUIRED — must contain at least one scenario. Include ALL scenarios here.",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "properties": {
                            "id":               {"type": "string", "description": "e.g. TC-001"},
                            "name":             {"type": "string"},
                            "description":      {"type": "string"},
                            "test_type":        {"type": "string", "enum": ["unit", "integration", "e2e", "api", "performance", "security"]},
                            "priority":         {"type": "string", "enum": ["high", "medium", "low"]},
                            "preconditions":    {"type": "array", "items": {"type": "string"}},
                            "steps":            {"type": "array", "items": {"type": "string"}},
                            "expected_results": {"type": "array", "items": {"type": "string"}},
                            "edge_cases":       {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["id", "name", "description", "test_type", "priority", "steps", "expected_results"],
                    },
                },
                "risk_areas":       {"type": "string"},
                "out_of_scope":     {"type": "string"},
                "estimated_effort": {"type": "string"},
                "notes":            {"type": "string"},
            },
            "required": ["title", "scope", "objectives", "test_types", "scenarios"],
        },
    }
]

SYSTEM_PROMPT = """You are a senior QA engineer creating a comprehensive test plan for a software user story.

Given a JIRA user story, you MUST:
1. Carefully analyse the title, description, and ALL acceptance criteria
2. Identify every testable behaviour — happy paths, edge cases, error conditions
3. Determine the right mix of test types (unit, integration, api, e2e)
4. Create detailed test scenarios — AT LEAST ONE per acceptance criterion
5. Call structure_test_plan with the COMPLETE plan including ALL scenarios in a single call

CRITICAL: The scenarios array must NEVER be empty. Always populate it fully before calling the tool.

Guidelines:
- Always include at least one negative/error scenario
- Keep scenario steps concrete and implementation-agnostic
- Mark boundary conditions and edge cases explicitly
- Prioritise: high = core AC, medium = edge cases, low = nice-to-have"""

class TestPlanAgent:
    """
    Claude-powered agent that generates a structured test plan from a JIRA story.
    Uses a single tool call pattern — Claude analyses and outputs in one shot.
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model
        #  can switch to openai client with same interface if needed, just change the import and init above
        # self.client = OpenAI(api_key=settings.openai_api_key)
        # self.model = settings.openai_model

    def run(self, story_data: dict) -> TestPlanDocument:
        logger.info(f"TestPlanAgent starting for story: {story_data.get('story_id')}")

        messages = [{"role": "user", "content": self._build_prompt(story_data)}]
        structured_plan: dict | None = None
        max_iterations = 6

        for iteration in range(max_iterations):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=8096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                tool_choice={"type": "any"},   # force tool use every turn
                messages=messages,
            )

            logger.info(
                f"TestPlanAgent iteration {iteration + 1} — "
                f"stop_reason={response.stop_reason} "
                f"input_tokens={response.usage.input_tokens} "
                f"output_tokens={response.usage.output_tokens}"
            )

            # ── Token budget hit — nudge Claude to continue ────────────────
            if response.stop_reason == "max_tokens":
                logger.warning("Hit max_tokens — nudging Claude to complete the tool call")
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": (
                        "You ran out of tokens. Please call structure_test_plan again "
                        "with the COMPLETE plan including all scenarios."
                    )
                })
                continue

            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "end_turn":
                logger.warning("Claude returned end_turn without calling the tool")
                messages.append({
                    "role": "user",
                    "content": "You must call the structure_test_plan tool with the complete plan and all scenarios."
                })
                continue

            # ── Process tool calls ─────────────────────────────────────────
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                if block.name == "structure_test_plan":
                    scenario_count = len(block.input.get("scenarios") or [])
                    logger.info(f"structure_test_plan called with {scenario_count} scenarios")

                    if scenario_count == 0:
                        logger.warning("Scenarios empty — asking Claude to retry with scenarios")
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "is_error": True,
                            "content": json.dumps({
                                "error": (
                                    "The scenarios array is empty. You MUST include at least one "
                                    "scenario per acceptance criterion. Call structure_test_plan "
                                    "again with the full scenarios list populated."
                                )
                            }),
                        })
                        continue

                    # Valid plan with scenarios
                    structured_plan = block.input
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({"status": "ok", "scenarios_received": scenario_count}),
                    })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

            if structured_plan and structured_plan.get("scenarios"):
                logger.info(f"TestPlanAgent complete — {len(structured_plan['scenarios'])} scenarios")
                break

        if not structured_plan or not structured_plan.get("scenarios"):
            raise RuntimeError(
                f"TestPlanAgent failed to generate scenarios for story "
                f"{story_data.get('story_id')}. "
                f"Keys returned: {list(structured_plan.keys()) if structured_plan else 'none'}"
            )

        return self._build_plan_document(structured_plan)

    def _build_prompt(self, story: dict) -> str:
        ac = story.get("acceptance_criteria") or {}
        ac_items = ac.get("items", []) if isinstance(ac, dict) else []
        ac_text = (
            "\n".join(f"  - {item}" for item in ac_items)
            if ac_items
            else (ac.get("raw") or "Not provided")
        )

        return f"""Please create a comprehensive test plan for the following JIRA user story.

**Story ID:** {story.get("story_id", "N/A")}
**Title:** {story.get("title", "N/A")}
**Type:** {story.get("story_type", "Story")}
**Priority:** {story.get("priority", "Medium")}

**Description:**
{story.get("description") or "No description provided."}

**Acceptance Criteria:**
{ac_text}

Generate a thorough test plan. You MUST include at least one test scenario per acceptance criterion.
Call structure_test_plan with the complete plan including ALL scenarios populated."""

    def _build_plan_document(self, plan: dict) -> TestPlanDocument:
        scenarios = []
        for sc in plan.get("scenarios") or []:
            scenarios.append(TestScenario(
                id=sc.get("id", f"TC-{len(scenarios)+1:03d}"),
                name=sc.get("name", ""),
                description=sc.get("description", ""),
                test_type=sc.get("test_type", "integration"),
                priority=sc.get("priority", "medium"),
                preconditions=sc.get("preconditions") or [],
                steps=sc.get("steps") or [],
                expected_results=sc.get("expected_results") or [],
                edge_cases=sc.get("edge_cases") or [],
            ))

        return TestPlanDocument(
            title=plan.get("title", "Test Plan"),
            scope=plan.get("scope", ""),
            objectives=plan.get("objectives", ""),
            test_types=plan.get("test_types") or ["integration"],
            scenarios=scenarios,
            risk_areas=plan.get("risk_areas") or "No specific risk areas identified.",
            out_of_scope=plan.get("out_of_scope") or "Not specified.",
            estimated_effort=plan.get("estimated_effort"),
            notes=plan.get("notes"),
        )

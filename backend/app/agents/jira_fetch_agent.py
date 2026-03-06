"""
JiraFetchAgent — LangChain agent powered by Anthropic Claude.

Responsibilities:
  1. Fetch raw story data from JIRA via JiraService
  2. Use Claude to intelligently parse and enrich the story:
     - Clean up description formatting
     - Extract and structure acceptance criteria
     - Identify test-relevant details (edge cases, constraints)
  3. Return a validated JiraStoryData object ready for DB persistence

The agent uses Claude's tool-use capability so it can call the JIRA
fetch tool and then reason over the result before returning structured output.
"""

import json
import logging
from typing import Any

from anthropic import Anthropic

from app.core.config import settings
from app.schemas.story import JiraStoryData
from app.services.jira_service import JiraService

logger = logging.getLogger(__name__)


# ── Tool definitions for Claude ────────────────────────────────────────────

TOOLS = [
    {
        "name": "fetch_jira_story",
        "description": (
            "Fetches a JIRA issue by its key (e.g. PROJ-123). "
            "Returns the story title, description, acceptance criteria, "
            "priority, assignee, and current status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "story_id": {
                    "type": "string",
                    "description": "The JIRA issue key, e.g. PROJ-123",
                }
            },
            "required": ["story_id"],
        },
    },
    {
        "name": "structure_story_data",
        "description": (
            "After analysing the raw JIRA story, call this tool to return "
            "the final structured and enriched story data. This must always "
            "be the last tool call."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "story_id":             {"type": "string"},
                "project_key":          {"type": "string"},
                "title":                {"type": "string"},
                "description":          {"type": "string"},
                "acceptance_criteria": {
                    "type": "object",
                    "description": "Structured AC with 'items' list and optional 'raw' text",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of individual acceptance criteria statements"
                        },
                        "raw": {"type": "string"}
                    }
                },
                "story_type":   {"type": "string"},
                "priority":     {"type": "string"},
                "assignee":     {"type": "string"},
                "reporter":     {"type": "string"},
                "jira_status":  {"type": "string"},
                "test_notes":   {
                    "type": "string",
                    "description": "Claude's observations about edge cases, constraints, or test complexity"
                },
            },
            "required": ["story_id", "project_key", "title"],
        },
    },
]

SYSTEM_PROMPT = """You are a senior QA engineer assistant specialised in analysing JIRA user stories.

Your job when given a JIRA story ID:
1. Call fetch_jira_story to retrieve the raw story data
2. Carefully read the title, description, and acceptance criteria
3. Clean up any formatting artefacts (Atlassian markup, ADF remnants)
4. Extract ALL acceptance criteria — even if they are embedded in the description
5. Note any edge cases, constraints, or testing complexity in test_notes
6. Call structure_story_data with the clean, enriched result

Be thorough — quality of the test plan generated later depends on how well you parse this story."""


class JiraFetchAgent:
    """
    Multi-step agent that fetches and enriches a JIRA story using Claude.
    Uses an agentic loop: Claude decides when to call tools and when it's done.
    """

    def __init__(self, jira_service: JiraService):
        self.jira = jira_service
        # self.client = Anthropic(api_key=settings.anthropic_api_key)
        # self.model = settings.anthropic_model

    def run(self, story_id: str) -> JiraStoryData:
        """
        Main entry point. Runs the agentic loop until Claude calls
        structure_story_data, then returns the validated result.
        """
        logger.info(f"JiraFetchAgent starting for story: {story_id}")
        messages = [{"role": "user", "content": f"Please fetch and analyse JIRA story: {story_id}"}]

        structured_result: dict | None = None
        raw_jira_data: dict | None = None
        max_iterations = 6  # safety cap
        story_data = self.jira.fetch_story(story_id)
        structured_result = {
                "story_id": story_data.story_id,
                "project_key": story_data.project_key,
                "title": story_data.title,
                "description": story_data.description or "",
                "acceptance_criteria": story_data.acceptance_criteria,
                "story_type": story_data.story_type,
                "priority": story_data.priority,
                "assignee": story_data.assignee,
                "reporter": story_data.reporter,
                "jira_status": story_data.jira_status,
                "raw_data": story_data.raw_data
            }
    
        # for iteration in range(max_iterations):
        #     response = self.client.messages.create(
        #         model=self.model,
        #         max_tokens=2048,
        #         system=SYSTEM_PROMPT,
        #         tools=TOOLS,
        #         messages=messages,
        #     )

        #     logger.debug(f"Agent iteration {iteration + 1}, stop_reason={response.stop_reason}")

        #     # ── Append assistant message ───────────────────────────────────
        #     messages.append({"role": "assistant", "content": response.content})

        #     # ── Check if Claude is done (no more tool calls) ───────────────
        #     if response.stop_reason == "end_turn":
        #         break

        #     # ── Process tool calls ─────────────────────────────────────────
        #     tool_results = []
        #     for block in response.content:
        #         if block.type != "tool_use":
        #             continue

        #         tool_name = block.name
        #         tool_input = block.input
        #         tool_use_id = block.id

        #         logger.info(f"Claude calling tool: {tool_name} with input: {tool_input}")

        #         result = self._handle_tool_call(tool_name, tool_input)

        #         # Capture the structured result when Claude finalises it
        #         if tool_name == "structure_story_data":
        #             structured_result = tool_input
        #             if raw_jira_data:
        #                 structured_result["raw_data"] = raw_jira_data

        #         if tool_name == "fetch_jira_story":
        #             raw_jira_data = result if isinstance(result, dict) else {}

        #         tool_results.append({
        #             "type": "tool_result",
        #             "tool_use_id": tool_use_id,
        #             "content": json.dumps(result) if not isinstance(result, str) else result,
        #         })

        #     if tool_results:
        #         messages.append({"role": "user", "content": tool_results})

        #     # Stop early once structured result is captured
        #     if structured_result:
        #         break

        # if not structured_result:
        #     raise RuntimeError(f"Agent did not return structured data for story {story_id}")

        return self._build_story_data(structured_result)

    # ── Tool handlers ──────────────────────────────────────────────────────

    def _handle_tool_call(self, tool_name: str, tool_input: dict) -> Any:
        if tool_name == "fetch_jira_story":
            return self._tool_fetch_jira(tool_input["story_id"])
        if tool_name == "structure_story_data":
            return {"status": "ok", "message": "Story data structured successfully"}
        return {"error": f"Unknown tool: {tool_name}"}

    def _tool_fetch_jira(self, story_id: str) -> dict:
        """Calls JiraService and returns raw data as a dict for Claude."""
        try:
            story_data = self.jira.fetch_story(story_id)
            return {
                "story_id": story_data.story_id,
                "project_key": story_data.project_key,
                "title": story_data.title,
                "description": story_data.description or "",
                "acceptance_criteria": story_data.acceptance_criteria,
                "story_type": story_data.story_type,
                "priority": story_data.priority,
                "assignee": story_data.assignee,
                "reporter": story_data.reporter,
                "jira_status": story_data.jira_status,
                "raw_data": story_data.raw_data
            }
        except ValueError as e:
            logger.error(f"JIRA fetch error: {e}")
            return {"error": str(e)}

    # ── Result builder ─────────────────────────────────────────────────────

    def _build_story_data(self, result: dict) -> JiraStoryData:
        """Convert Claude's structured output to a validated JiraStoryData."""
        ac = result.get("acceptance_criteria")
        if isinstance(ac, str):
            ac = {"items": [ac], "raw": ac}

        return JiraStoryData(
            story_id=result["story_id"],
            project_key=result["project_key"],
            title=result["title"],
            description=result.get("description"),
            acceptance_criteria=ac,
            story_type=result.get("story_type"),
            priority=result.get("priority"),
            assignee=result.get("assignee"),
            reporter=result.get("reporter"),
            jira_status=result.get("jira_status"),
            raw_data=result.get("raw_data"),
        )

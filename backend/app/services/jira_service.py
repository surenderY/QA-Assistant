"""
JiraService — thin wrapper around the jira-python client.
Handles connection, story fetching, and acceptance criteria parsing.
"""

import re
import logging
from functools import lru_cache

from jira import JIRA, JIRAError

from app.core.config import settings
from app.schemas.story import JiraStoryData

logger = logging.getLogger(__name__)


class JiraService:
    def __init__(self):
        self._client: JIRA | None = None

    @property
    def client(self) -> JIRA:
        if self._client is None:
            self._client = JIRA(
                server=settings.jira_server_url,
                basic_auth=(settings.jira_email, settings.jira_api_token),
                options={"verify": True},
            )
        return self._client

    def fetch_story(self, story_id: str) -> JiraStoryData:
        """
        Fetch a JIRA issue by key (e.g. PROJ-123) and return structured data.
        Raises JIRAError if the issue doesn't exist or credentials fail.
        """
        try:
            issue = self.client.issue(story_id.upper())            
        except JIRAError as e:
            logger.error(f"JIRA fetch failed for {story_id}: {e.text}")
            raise ValueError(f"Could not fetch JIRA story '{story_id}': {e.text}") from e

        fields = issue.fields

        # ── Extract acceptance criteria ────────────────────────────────────
        # Try custom field first (common in many JIRA setups), then parse
        # from description if not found.
        acceptance_criteria = self._extract_acceptance_criteria(fields)

        # ── Build structured response ──────────────────────────────────────
        return JiraStoryData(
            story_id=issue.key,
            project_key=issue.key.split("-")[0],
            title=fields.summary or "",
            description=self._clean_text(fields.description),
            acceptance_criteria=acceptance_criteria,
            story_type=getattr(fields.issuetype, "name", None),
            priority=getattr(fields.priority, "name", None),
            assignee=getattr(fields.assignee, "displayName", None),
            reporter=getattr(fields.reporter, "displayName", None),
            jira_status=getattr(fields.status, "name", None),
            raw_data={
                "fields": str(fields),
                "key": issue.key,
                "summary": fields.summary,
                "description": fields.description,
                "issuetype": getattr(fields.issuetype, "name", None),
                "priority": getattr(fields.priority, "name", None),
                "status": getattr(fields.status, "name", None),
                "assignee": getattr(fields.assignee, "displayName", None),
                "reporter": getattr(fields.reporter, "displayName", None),
                "labels": getattr(fields, "labels", []),
                "components": [c.name for c in getattr(fields, "components", [])],
            },
        )

    def _extract_acceptance_criteria(self, fields) -> dict | None:
        """
        Try to extract acceptance criteria from:
        1. A custom field named 'Acceptance Criteria' (customfield_10014 is common)
        2. A section in the description starting with 'Acceptance Criteria'
        """
        # Try common custom field names
        for field_name in ["customfield_10014", "customfield_10016", "customfield_10028"]:
            value = getattr(fields, field_name, None)
            if value:
                return {"source": "custom_field", "content": str(value)}

        # Parse from description
        description = getattr(fields, "description", "") or ""
        return self._parse_ac_from_description(description)

    def _parse_ac_from_description(self, description: str) -> dict | None:
        """
        Look for an 'Acceptance Criteria' section in the description text.
        Supports both plain text and Atlassian Document Format (ADF).
        """
        if not description:
            return None

        # Handle ADF (dict) format
        if isinstance(description, dict):
            description = self._adf_to_text(description)

        # Find AC section using regex
        pattern = r"(?i)(?:acceptance criteria|ac)[:\s]*\n(.*?)(?=\n[A-Z][^\n]*:|$)"
        match = re.search(pattern, description, re.DOTALL)
        if match:
            ac_text = match.group(1).strip()
            # Parse bullet points into a list
            items = [
                line.lstrip("-•* ").strip()
                for line in ac_text.split("\n")
                if line.strip() and line.strip() not in ["-", "•", "*"]
            ]
            return {"source": "description", "items": items, "raw": ac_text}

        return None

    def _adf_to_text(self, adf: dict) -> str:
        """Recursively extract plain text from Atlassian Document Format."""
        if not isinstance(adf, dict):
            return str(adf)
        if adf.get("type") == "text":
            return adf.get("text", "")
        content = adf.get("content", [])
        return "\n".join(self._adf_to_text(node) for node in content)

    def _clean_text(self, text) -> str | None:
        """Convert ADF to plain text if needed."""
        if text is None:
            return None
        if isinstance(text, dict):
            return self._adf_to_text(text)
        return str(text)

    def test_connection(self) -> bool:
        """Verify JIRA credentials are valid."""
        try:
            self.client.myself()
            return True
        except JIRAError:
            return False


@lru_cache(maxsize=1)
def get_jira_service() -> JiraService:
    return JiraService()

"""
Pydantic schemas for JIRA story import and responses.
These are the shapes used in API request/response bodies.
"""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ── Request schemas ────────────────────────────────────────────────────────

class StoryImportRequest(BaseModel):
    story_id: str = Field(..., example="PROJ-123", description="JIRA issue key")


# ── JIRA raw data (what the agent fetches) ─────────────────────────────────

class JiraStoryData(BaseModel):
    """Structured story data returned by the JIRA Fetch Agent."""
    story_id: str
    project_key: str
    title: str
    description: str | None = None
    acceptance_criteria: dict | None = None   # parsed from description or custom field
    story_type: str | None = None
    priority: str | None = None
    assignee: str | None = None
    reporter: str | None = None
    jira_status: str | None = None
    raw_data: dict | None = None


# ── Response schemas ───────────────────────────────────────────────────────

class StoryResponse(BaseModel):
    id: UUID
    story_id: str
    project_key: str
    title: str
    description: str | None
    acceptance_criteria: dict | None
    story_type: str | None
    priority: str | None
    assignee: str | None
    reporter: str | None
    jira_status: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StoryListResponse(BaseModel):
    total: int
    stories: list[StoryResponse]


class ImportResponse(BaseModel):
    message: str
    story_db_id: str
    story_id: str
    status: str

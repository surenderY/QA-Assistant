import uuid
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models import JiraStory, StoryStatus

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────

class StoryImportRequest(BaseModel):
    story_id: str  # e.g. "PROJ-123"


class StoryResponse(BaseModel):
    id: str
    story_id: str
    project_key: str
    title: str
    description: str | None
    acceptance_criteria: dict | None
    priority: str | None
    jira_status: str | None
    status: str
    created_at: str

    class Config:
        from_attributes = True


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/import/{story_id}", status_code=status.HTTP_202_ACCEPTED, summary="Import a JIRA story")
async def import_story(
    story_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers the JIRA Fetch Agent to pull story details and persist them.
    Returns immediately; agent runs as a background task.
    (Full agent implementation in Phase 2)
    """
    # Check if already imported
    existing = await db.scalar(
        select(JiraStory).where(JiraStory.story_id == story_id.upper())
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Story {story_id} already imported. Use GET /jira/stories to view it.",
        )

    # TODO Phase 2: background_tasks.add_task(jira_fetch_agent.run, story_id, db)
    # For now, create a placeholder record
    story = JiraStory(
        story_id=story_id.upper(),
        project_key=story_id.split("-")[0].upper() if "-" in story_id else "UNKNOWN",
        title=f"[Pending import] {story_id}",
        status=StoryStatus.NEW,
    )
    db.add(story)
    await db.flush()

    return {
        "message": f"Import of {story_id} queued.",
        "story_db_id": str(story.id),
        "status": "pending",
    }


@router.get("/stories", summary="List all imported stories")
async def list_stories(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JiraStory).order_by(JiraStory.created_at.desc()).offset(skip).limit(limit)
    )
    stories = result.scalars().all()
    total = await db.scalar(select(JiraStory).count() if False else __import__("sqlalchemy").func.count(JiraStory.id))

    return {
        "total": total,
        "stories": [
            {
                "id": str(s.id),
                "story_id": s.story_id,
                "project_key": s.project_key,
                "title": s.title,
                "priority": s.priority,
                "jira_status": s.jira_status,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
            }
            for s in stories
        ],
    }


@router.get("/stories/{story_db_id}", summary="Get a single story with full details")
async def get_story(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return {
        "id": str(story.id),
        "story_id": story.story_id,
        "project_key": story.project_key,
        "title": story.title,
        "description": story.description,
        "acceptance_criteria": story.acceptance_criteria,
        "story_type": story.story_type,
        "priority": story.priority,
        "assignee": story.assignee,
        "reporter": story.reporter,
        "jira_status": story.jira_status,
        "status": story.status,
        "created_at": story.created_at.isoformat(),
        "updated_at": story.updated_at.isoformat(),
    }


@router.delete("/stories/{story_db_id}", status_code=204, summary="Delete an imported story")
async def delete_story(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.delete(story)

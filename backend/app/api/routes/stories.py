"""
JIRA Stories router.
Phase 2: import endpoint now triggers JiraFetchAgent via Celery.
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import JiraStory, StoryStatus
from app.schemas.story import StoryResponse, ImportResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/import/{story_id}",
    response_model=ImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import a JIRA story via AI agent",
)
async def import_story(
    story_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a placeholder DB record, then dispatches the JiraFetchAgent
    as a Celery background task to fetch and enrich the story from JIRA.

    Returns immediately with 202 Accepted — poll GET /jira/stories/{id}
    to check when the story is fully populated.
    """
    story_key = story_id.upper().strip()

    # Check for duplicate
    existing = await db.scalar(
        select(JiraStory).where(JiraStory.story_id == story_key)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Story {story_key} already imported (db_id={existing.id}). "
                   f"Use GET /api/v1/jira/stories/{existing.id} to view it.",
        )

    # Create placeholder row — agent fills in the real data
    story = JiraStory(
        story_id=story_key,
        project_key=story_key.split("-")[0] if "-" in story_key else "UNKNOWN",
        title=f"[Importing...] {story_key}",
        status=StoryStatus.NEW,
    )
    db.add(story)
    await db.flush()  # get the UUID before committing
    story_db_id = str(story.id)
    await db.commit()

    # Dispatch Celery task
    try:
        from app.services.tasks import import_jira_story
        import_jira_story.delay(story_db_id, story_key)
        logger.info(f"Dispatched import task for {story_key} (db_id={story_db_id})")
    except Exception as e:
        logger.error(f"Failed to dispatch Celery task: {e}")
        # Don't fail the request — the placeholder row exists, can retry manually

    return ImportResponse(
        message=f"Import of {story_key} queued. Poll GET /api/v1/jira/stories/{story_db_id} for status.",
        story_db_id=story_db_id,
        story_id=story_key,
        status="importing",
    )


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
    total = await db.scalar(select(func.count(JiraStory.id)))

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


@router.delete("/stories/{story_db_id}", status_code=204, summary="Delete a story")
async def delete_story(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.delete(story)


@router.post("/stories/{story_db_id}/retry-import", status_code=202, summary="Retry a failed import")
async def retry_import(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Re-dispatch the import agent for a story stuck in [Importing...] state."""
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    from app.services.tasks import import_jira_story
    import_jira_story.delay(str(story_db_id), story.story_id)
    return {"message": f"Retrying import for {story.story_id}"}

# ── Manual story creation ──────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel

class ManualStoryRequest(_BaseModel):
    story_id: str
    title: str
    description: str | None = None
    acceptance_criteria_items: list[str] = []
    story_type: str | None = "Story"
    priority: str | None = "Medium"
    assignee: str | None = None
    reporter: str | None = None
    jira_status: str | None = "Open"
    project_key: str | None = None


@router.post(
    "/stories/manual",
    status_code=status.HTTP_201_CREATED,
    summary="Manually create a user story without JIRA",
)
async def create_manual_story(
    request: ManualStoryRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a fully-populated JiraStory record directly from form data.
    No JIRA connection required — ready immediately for test plan generation.
    """
    story_key = request.story_id.upper().strip()

    # Check duplicate
    existing = await db.scalar(
        select(JiraStory).where(JiraStory.story_id == story_key)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Story {story_key} already exists (db_id={existing.id}).",
        )

    project_key = (
        request.project_key.upper()
        if request.project_key
        else (story_key.split("-")[0] if "-" in story_key else story_key)
    )

    # Build acceptance criteria structure
    ac = None
    if request.acceptance_criteria_items:
        ac = {
            "source": "manual",
            "items": [item.strip() for item in request.acceptance_criteria_items if item.strip()],
        }

    story = JiraStory(
        story_id=story_key,
        project_key=project_key,
        title=request.title.strip(),
        description=request.description,
        acceptance_criteria=ac,
        story_type=request.story_type,
        priority=request.priority,
        assignee=request.assignee,
        reporter=request.reporter,
        jira_status=request.jira_status,
        status=StoryStatus.NEW,
        raw_data={"source": "manual"},
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)

    logger.info(f"Manual story created: {story_key} (db_id={story.id})")

    return {
        "message": f"Story {story_key} created successfully.",
        "story_db_id": str(story.id),
        "story_id": story_key,
        "status": "new",
    }
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import TestPlan, JiraStory

router = APIRouter()


@router.post("/generate/{story_db_id}", status_code=202, summary="Generate a test plan for a story")
async def generate_test_plan(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Invokes the Test Plan Agent to generate a structured test plan.
    Full agent implementation in Phase 3.
    """
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # TODO Phase 3: await test_plan_agent.run(story, db)
    return {
        "message": f"Test plan generation queued for story {story.story_id}",
        "story_id": str(story_db_id),
        "status": "queued — agent wired in Phase 3",
    }


@router.get("/{story_db_id}", summary="Get test plan for a story")
async def get_test_plan(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestPlan).where(TestPlan.story_id == story_db_id).order_by(TestPlan.created_at.desc())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="No test plan found for this story")
    return {
        "id": str(plan.id),
        "story_id": str(plan.story_id),
        "title": plan.title,
        "scope": plan.scope,
        "objectives": plan.objectives,
        "test_types": plan.test_types,
        "test_scenarios": plan.test_scenarios,
        "risk_areas": plan.risk_areas,
        "plan_document": plan.plan_document,
        "created_at": plan.created_at.isoformat(),
    }

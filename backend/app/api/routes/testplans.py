import uuid, logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import TestPlan, JiraStory

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/generate/{story_db_id}",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate a test plan for a story via AI agent",
)
async def generate_test_plan(
    story_db_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches the TestPlanAgent as a Celery background task.
    Returns 202 immediately — poll GET /testplan/{story_db_id} for the result.
    """
    story = await db.get(JiraStory, story_db_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    if story.title.startswith("[Importing...]"):
        raise HTTPException(
            status_code=400,
            detail="Story is still being imported. Wait for import to complete first."
        )

    # Check if plan already exists
    existing = await db.scalar(
        select(TestPlan).where(TestPlan.story_id == story_db_id)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Test plan already exists for this story (plan_id={existing.id}). "
                   f"Use GET /api/v1/testplan/{story_db_id} to view it."
        )

    # Dispatch Celery task
    from app.services.tasks import generate_test_plan as generate_plan_task
    task = generate_plan_task.delay(str(story_db_id))
    logger.info(f"Dispatched test plan generation for story {story_db_id}, task_id={task.id}")

    return {
        "message": f"Test plan generation started for story {story.story_id}.",
        "story_db_id": str(story_db_id),
        "task_id": task.id,
        "status": "generating",
        "poll_url": f"/api/v1/testplan/{story_db_id}",
    }


@router.get("/{story_db_id}", summary="Get test plan for a story")
async def get_test_plan(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Returns the most recent test plan for the given story."""
    result = await db.execute(
        select(TestPlan)
        .where(TestPlan.story_id == story_db_id)
        .order_by(TestPlan.created_at.desc())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="No test plan found. Use POST /api/v1/testplan/generate/{story_db_id} to generate one."
        )

    return {
        "id": str(plan.id),
        "story_id": str(plan.story_id),
        "title": plan.title,
        "scope": plan.scope,
        "objectives": plan.objectives,
        "test_types": plan.test_types,
        "scenarios": plan.test_scenarios,
        "risk_areas": plan.risk_areas,
        "out_of_scope": plan.out_of_scope,
        "agent_model": plan.agent_model,
        "scenario_count": len(plan.test_scenarios or []),
        "created_at": plan.created_at.isoformat(),
    }


@router.get("/{story_db_id}/scenarios", summary="List scenarios from the test plan")
async def list_scenarios(story_db_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Returns just the scenarios list — useful for the script generation UI."""
    result = await db.execute(
        select(TestPlan)
        .where(TestPlan.story_id == story_db_id)
        .order_by(TestPlan.created_at.desc())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="No test plan found for this story")

    return {
        "plan_id": str(plan.id),
        "scenarios": plan.test_scenarios or [],
        "total": len(plan.test_scenarios or []),
    }


@router.delete("/{plan_id}", status_code=204, summary="Delete a test plan")
async def delete_plan(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    plan = await db.get(TestPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")
    await db.delete(plan)


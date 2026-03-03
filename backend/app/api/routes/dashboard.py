from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import JiraStory, TestPlan, TestScript, Execution, ExecutionStatus

router = APIRouter()


@router.get("/stats", summary="Dashboard summary statistics")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Returns counts and summary data for the dashboard view."""

    total_stories = await db.scalar(select(func.count(JiraStory.id)))
    total_plans = await db.scalar(select(func.count(TestPlan.id)))
    total_scripts = await db.scalar(select(func.count(TestScript.id)))
    total_executions = await db.scalar(select(func.count(Execution.id)))

    passed = await db.scalar(
        select(func.count(Execution.id)).where(Execution.status == ExecutionStatus.PASSED)
    )
    failed = await db.scalar(
        select(func.count(Execution.id)).where(Execution.status == ExecutionStatus.FAILED)
    )

    # Recent stories (last 5)
    recent_result = await db.execute(
        select(JiraStory).order_by(JiraStory.created_at.desc()).limit(5)
    )
    recent_stories = recent_result.scalars().all()

    return {
        "totals": {
            "stories": total_stories,
            "test_plans": total_plans,
            "test_scripts": total_scripts,
            "executions": total_executions,
        },
        "execution_summary": {
            "passed": passed or 0,
            "failed": failed or 0,
        },
        "recent_stories": [
            {
                "id": str(s.id),
                "story_id": s.story_id,
                "title": s.title,
                "status": s.status,
                "created_at": s.created_at.isoformat(),
            }
            for s in recent_stories
        ],
    }

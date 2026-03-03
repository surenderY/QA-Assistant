import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import TestScript, TestPlan

router = APIRouter()


@router.post("/generate/{plan_id}", status_code=202, summary="Generate test scripts from a plan")
async def generate_scripts(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Invokes Script Gen Agent. Full implementation in Phase 3."""
    plan = await db.get(TestPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")

    # TODO Phase 3: await script_gen_agent.run(plan, db)
    return {"message": "Script generation queued", "plan_id": str(plan_id), "status": "queued"}


@router.get("/{plan_id}", summary="List scripts for a test plan")
async def list_scripts(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestScript).where(TestScript.plan_id == plan_id).order_by(TestScript.created_at)
    )
    scripts = result.scalars().all()
    return {
        "scripts": [
            {
                "id": str(s.id),
                "script_name": s.script_name,
                "scenario_name": s.scenario_name,
                "language": s.language,
                "is_committed": s.is_committed,
                "branch_name": s.branch_name,
                "commit_sha": s.commit_sha,
                "created_at": s.created_at.isoformat(),
            }
            for s in scripts
        ]
    }


@router.get("/{script_id}/content", summary="Get full script source code")
async def get_script_content(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return {"id": str(script.id), "script_name": script.script_name, "content": script.script_content}


@router.post("/{script_id}/commit", status_code=202, summary="Commit script to Git via Git Agent")
async def commit_script(script_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Invokes Git Agent to create branch and commit. Full implementation in Phase 4."""
    script = await db.get(TestScript, script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    # TODO Phase 4: await git_agent.run(script, db)
    return {"message": "Git commit queued", "script_id": str(script_id), "status": "queued"}

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Execution, ExecutionResult

router = APIRouter()


@router.post("/run", status_code=202, summary="Run selected test scripts")
async def run_scripts(script_ids: list[uuid.UUID], db: AsyncSession = Depends(get_db)):
    """Triggers the Execution Agent. Full implementation in Phase 5."""
    # TODO Phase 5: await execution_agent.run(script_ids, db)
    return {"message": f"Execution queued for {len(script_ids)} script(s)", "status": "queued"}


@router.get("/{execution_id}", summary="Get execution status and metadata")
async def get_execution(execution_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    execution = await db.get(Execution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {
        "id": str(execution.id),
        "script_id": str(execution.script_id),
        "status": execution.status,
        "triggered_by": execution.triggered_by,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "finished_at": execution.finished_at.isoformat() if execution.finished_at else None,
        "exit_code": execution.exit_code,
    }


@router.get("/{execution_id}/results", summary="Get per-test results")
async def get_execution_results(execution_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExecutionResult).where(ExecutionResult.execution_id == execution_id)
    )
    results = result.scalars().all()
    return {
        "execution_id": str(execution_id),
        "results": [
            {
                "id": str(r.id),
                "test_name": r.test_name,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "error_message": r.error_message,
            }
            for r in results
        ],
    }

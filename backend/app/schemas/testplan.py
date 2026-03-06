"""
Pydantic schemas for test plans and test scripts.
"""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ── Test Plan schemas ──────────────────────────────────────────────────────

class TestScenario(BaseModel):
    id: str
    name: str
    description: str
    test_type: str                    # unit | integration | e2e | api
    priority: str                     # high | medium | low
    preconditions: list[str] = []
    steps: list[str] = []
    expected_results: list[str] = []
    edge_cases: list[str] = []


class TestPlanDocument(BaseModel):
    title: str
    scope: str
    objectives: str
    test_types: list[str]
    scenarios: list[TestScenario]
    risk_areas: str
    out_of_scope: str
    estimated_effort: str | None = None
    notes: str | None = None


class TestPlanResponse(BaseModel):
    id: UUID
    story_id: UUID
    title: str
    scope: str | None
    objectives: str | None
    test_types: list | None
    test_scenarios: list | None
    risk_areas: str | None
    out_of_scope: str | None
    agent_model: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class GeneratePlanRequest(BaseModel):
    story_id: UUID = Field(..., description="DB UUID of the imported JIRA story")


# ── Test Script schemas ────────────────────────────────────────────────────

class ScriptResponse(BaseModel):
    id: UUID
    plan_id: UUID
    script_name: str
    scenario_name: str | None
    language: str
    is_committed: bool
    branch_name: str | None
    commit_sha: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ScriptContentResponse(BaseModel):
    id: UUID
    script_name: str
    scenario_name: str | None
    content: str
    language: str


class GenerateScriptsRequest(BaseModel):
    plan_id: UUID = Field(..., description="DB UUID of the test plan")
    scenario_ids: list[str] | None = Field(
        None, description="Specific scenario IDs to generate. None = generate all."
    )

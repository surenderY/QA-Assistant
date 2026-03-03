"""
SQLAlchemy ORM models for TestGen AI Platform.
All tables use UUID primary keys and include audit timestamps.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class StoryStatus(str, PyEnum):
    NEW = "new"
    PLANNED = "planned"       # test plan generated
    SCRIPTED = "scripted"     # scripts generated + committed
    EXECUTED = "executed"     # at least one execution done


class ExecutionStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class TestResultStatus(str, PyEnum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


class ScriptLanguage(str, PyEnum):
    PYTHON = "python"


# ── Mixins ─────────────────────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ── Models ─────────────────────────────────────────────────────────────────

class JiraStory(Base, TimestampMixin):
    """Imported JIRA user stories."""

    __tablename__ = "jira_stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    story_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    project_key: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    acceptance_criteria: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    story_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assignee: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reporter: Mapped[str | None] = mapped_column(String(200), nullable=True)
    jira_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[StoryStatus] = mapped_column(
        Enum(StoryStatus), default=StoryStatus.NEW, nullable=False
    )
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    test_plans: Mapped[list["TestPlan"]] = relationship(back_populates="story", cascade="all, delete-orphan")


class TestPlan(Base, TimestampMixin):
    """AI-generated test plan documents."""

    __tablename__ = "test_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jira_stories.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    test_types: Mapped[list | None] = mapped_column(JSON, nullable=True)       # ["unit", "integration", "e2e"]
    test_scenarios: Mapped[list | None] = mapped_column(JSON, nullable=True)   # structured scenario list
    risk_areas: Mapped[str | None] = mapped_column(Text, nullable=True)
    out_of_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    plan_document: Mapped[dict | None] = mapped_column(JSON, nullable=True)    # full structured doc

    # Relationships
    story: Mapped["JiraStory"] = relationship(back_populates="test_plans")
    scripts: Mapped[list["TestScript"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class TestScript(Base, TimestampMixin):
    """AI-generated pytest test scripts."""

    __tablename__ = "test_scripts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False
    )
    script_name: Mapped[str] = mapped_column(String(255), nullable=False)
    script_content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[ScriptLanguage] = mapped_column(
        Enum(ScriptLanguage), default=ScriptLanguage.PYTHON, nullable=False
    )
    scenario_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    git_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_committed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    plan: Mapped["TestPlan"] = relationship(back_populates="scripts")
    executions: Mapped[list["Execution"]] = relationship(back_populates="script", cascade="all, delete-orphan")


class Execution(Base, TimestampMixin):
    """A single test execution run."""

    __tablename__ = "executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    script_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_scripts.id", ondelete="CASCADE"), nullable=False
    )
    triggered_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[ExecutionStatus] = mapped_column(
        Enum(ExecutionStatus), default=ExecutionStatus.PENDING, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    log_output: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    script: Mapped["TestScript"] = relationship(back_populates="executions")
    results: Mapped[list["ExecutionResult"]] = relationship(
        back_populates="execution", cascade="all, delete-orphan"
    )


class ExecutionResult(Base, TimestampMixin):
    """Per-test-case results from an execution."""

    __tablename__ = "execution_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False
    )
    test_name: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[TestResultStatus] = mapped_column(
        Enum(TestResultStatus), nullable=False
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    execution: Mapped["Execution"] = relationship(back_populates="results")

"""Initial schema - create all tables

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────
    story_status = postgresql.ENUM(
        "new", "planned", "scripted", "executed", name="storystatus", create_type=True
    )
    execution_status = postgresql.ENUM(
        "pending", "running", "passed", "failed", "error", name="executionstatus", create_type=True
    )
    result_status = postgresql.ENUM(
        "passed", "failed", "skipped", "error", name="testresultstatus", create_type=True
    )
    script_language = postgresql.ENUM("python", name="scriptlanguage", create_type=True)

    story_status.create(op.get_bind(), checkfirst=True)
    execution_status.create(op.get_bind(), checkfirst=True)
    result_status.create(op.get_bind(), checkfirst=True)
    script_language.create(op.get_bind(), checkfirst=True)

    # ── jira_stories ───────────────────────────────────────────────────────
    op.create_table(
        "jira_stories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("story_id", sa.String(50), unique=True, nullable=False),
        sa.Column("project_key", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("acceptance_criteria", postgresql.JSON, nullable=True),
        sa.Column("story_type", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(50), nullable=True),
        sa.Column("assignee", sa.String(200), nullable=True),
        sa.Column("reporter", sa.String(200), nullable=True),
        sa.Column("jira_status", sa.String(100), nullable=True),
        sa.Column("status", sa.Enum("new", "planned", "scripted", "executed", name="storystatus"), nullable=False, server_default="new"),
        sa.Column("raw_data", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_jira_stories_story_id", "jira_stories", ["story_id"])

    # ── test_plans ─────────────────────────────────────────────────────────
    op.create_table(
        "test_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("story_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jira_stories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("scope", sa.Text, nullable=True),
        sa.Column("objectives", sa.Text, nullable=True),
        sa.Column("test_types", postgresql.JSON, nullable=True),
        sa.Column("test_scenarios", postgresql.JSON, nullable=True),
        sa.Column("risk_areas", sa.Text, nullable=True),
        sa.Column("out_of_scope", sa.Text, nullable=True),
        sa.Column("agent_model", sa.String(100), nullable=True),
        sa.Column("plan_document", postgresql.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── test_scripts ───────────────────────────────────────────────────────
    op.create_table(
        "test_scripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("test_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("script_name", sa.String(255), nullable=False),
        sa.Column("script_content", sa.Text, nullable=False),
        sa.Column("language", sa.Enum("python", name="scriptlanguage"), nullable=False, server_default="python"),
        sa.Column("scenario_name", sa.String(500), nullable=True),
        sa.Column("branch_name", sa.String(255), nullable=True),
        sa.Column("commit_sha", sa.String(40), nullable=True),
        sa.Column("git_path", sa.String(500), nullable=True),
        sa.Column("is_committed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── executions ─────────────────────────────────────────────────────────
    op.create_table(
        "executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("script_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("test_scripts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("triggered_by", sa.String(200), nullable=True),
        sa.Column("status", sa.Enum("pending", "running", "passed", "failed", "error", name="executionstatus"), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("exit_code", sa.Integer, nullable=True),
        sa.Column("log_output", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── execution_results ──────────────────────────────────────────────────
    op.create_table(
        "execution_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("executions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_name", sa.String(500), nullable=False),
        sa.Column("status", sa.Enum("passed", "failed", "skipped", "error", name="testresultstatus"), nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("stdout", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("stack_trace", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("execution_results")
    op.drop_table("executions")
    op.drop_table("test_scripts")
    op.drop_table("test_plans")
    op.drop_table("jira_stories")

    for enum_name in ["storystatus", "executionstatus", "testresultstatus", "scriptlanguage"]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

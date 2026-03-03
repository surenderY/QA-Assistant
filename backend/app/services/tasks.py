"""
Celery background tasks.
Task implementations are added incrementally per phase:
  - Phase 2: import_jira_story
  - Phase 3: generate_test_plan, generate_scripts
  - Phase 4: commit_to_git
  - Phase 5: execute_scripts
"""

from app.core.celery_app import celery_app


@celery_app.task(name="tasks.ping")
def ping():
    """Health check task — confirms worker is running."""
    return "pong"

from celery import Celery
from celery.signals import worker_process_init, worker_init
from app.core.config import settings

celery_app = Celery(
    "testgen",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

celery_app.autodiscover_tasks(["app.services"])


@worker_process_init.connect
def init_worker_process(**kwargs):
    """Called inside each forked worker process — safe to open file handles here."""
    from app.core.logging_config import setup_logging
    setup_logging(service_name="worker")


@worker_init.connect
def init_worker(**kwargs):
    """Called in the main worker process before forking."""
    from app.core.logging_config import setup_logging
    setup_logging(service_name="worker")
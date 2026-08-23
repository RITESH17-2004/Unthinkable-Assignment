import os
from celery import Celery
from app.core.config import settings

broker_url = settings.REDIS_URL
result_backend = settings.REDIS_URL

celery_app = Celery(
    "caresync_worker",
    broker=broker_url,
    backend=result_backend
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["app"])

# Periodic beat scheduler configuration
celery_app.conf.beat_schedule = {
    "cleanup-expired-holds-every-60s": {
        "task": "app.tasks.scheduler.cleanup_expired_holds",
        "schedule": 60.0,
    },
    "send-appointment-reminders-hourly": {
        "task": "app.tasks.scheduler.send_appointment_reminders",
        "schedule": 3600.0,
    }
}

from celery.utils.log import get_task_logger
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.appointment import Appointment
from app.models.google_connection import GoogleCalendarConnection
from app.models.user import User
from app.models.doctor import DoctorProfile
from app.services.google_calendar import (
    get_calendar_client,
    create_calendar_event,
    update_calendar_event,
    delete_calendar_event
)

logger = get_task_logger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_appointment_event_task(self, appointment_id: int):
    """
    Syncs calendar events for an appointment to the doctor's and patient's Google Calendars.
    """
    logger.info(f"Syncing Google Calendar events for Appointment ID: {appointment_id}")
    db = SessionLocal()
    try:
        app = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not app:
            logger.error(f"Appointment {appointment_id} not found for calendar syncing.")
            return

        # Fetch names for summary representation
        patient = db.query(User).filter(User.id == app.patient_id).first()
        doctor_user = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()
        
        patient_name = patient.name if patient else "Patient"
        doctor_name = doctor_user.name if doctor_user else "Doctor"

        # 1. Sync Doctor's Calendar
        if doctor_user:
            doc_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == doctor_user.id).first()
            if doc_conn:
                try:
                    service = get_calendar_client(doc_conn, db)
                    if app.doctor_google_event_id:
                        logger.info(f"Updating doctor's Google Calendar event: {app.doctor_google_event_id}")
                        update_calendar_event(service, app.doctor_google_event_id, app, doctor_name, patient_name)
                    else:
                        logger.info("Creating new doctor's Google Calendar event...")
                        event_id = create_calendar_event(service, app, doctor_name, patient_name)
                        app.doctor_google_event_id = event_id
                        db.commit()
                except Exception as ex:
                    logger.error(f"Failed to sync doctor calendar: {ex}")

        # 2. Sync Patient's Calendar
        if patient:
            pat_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == patient.id).first()
            if pat_conn:
                try:
                    service = get_calendar_client(pat_conn, db)
                    if app.patient_google_event_id:
                        logger.info(f"Updating patient's Google Calendar event: {app.patient_google_event_id}")
                        update_calendar_event(service, app.patient_google_event_id, app, doctor_name, patient_name)
                    else:
                        logger.info("Creating new patient's Google Calendar event...")
                        event_id = create_calendar_event(service, app, doctor_name, patient_name)
                        app.patient_google_event_id = event_id
                        db.commit()
                except Exception as ex:
                    logger.error(f"Failed to sync patient calendar: {ex}")

    except Exception as e:
        logger.error(f"Failed calendar sync task: {e}")
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for sync appointment calendar event task.")
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def delete_appointment_event_task(self, doctor_connection_id: int = None, patient_connection_id: int = None, doctor_event_id: str = None, patient_event_id: str = None):
    """
    Deletes Google Calendar events for cancelled/deleted appointments asynchronously.
    """
    logger.info("Starting Google Calendar event deletion background task...")
    db = SessionLocal()
    try:
        # 1. Delete Doctor's Event
        if doctor_connection_id and doctor_event_id:
            doc_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.id == doctor_connection_id).first()
            if doc_conn:
                try:
                    service = get_calendar_client(doc_conn, db)
                    logger.info(f"Deleting event {doctor_event_id} from doctor calendar.")
                    delete_calendar_event(service, doctor_event_id)
                except Exception as ex:
                    logger.error(f"Failed to delete event from doctor calendar: {ex}")

        # 2. Delete Patient's Event
        if patient_connection_id and patient_event_id:
            pat_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.id == patient_connection_id).first()
            if pat_conn:
                try:
                    service = get_calendar_client(pat_conn, db)
                    logger.info(f"Deleting event {patient_event_id} from patient calendar.")
                    delete_calendar_event(service, patient_event_id)
                except Exception as ex:
                    logger.error(f"Failed to delete event from patient calendar: {ex}")

    except Exception as e:
        logger.error(f"Failed calendar deletion task: {e}")
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for delete calendar event task.")
    finally:
        db.close()

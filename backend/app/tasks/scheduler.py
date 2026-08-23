import re
import logging
from datetime import datetime, timedelta, date, time, timezone
from celery.utils.log import get_task_logger
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.appointment import Appointment, SlotHold, Prescription
from app.models.user import User
from app.models.doctor import DoctorProfile
from app.tasks.notification import send_email_message, send_medication_reminder

logger = get_task_logger(__name__)


@celery_app.task
def cleanup_expired_holds():
    """
    Periodic cleanup task running every minute to release expired slot holds.
    """
    logger.info("Starting expired slot holds cleanup job...")
    db = SessionLocal()
    try:
        now_utc = datetime.now(timezone.utc)
        # Find all holds that have expired and not released yet
        expired_holds = db.query(SlotHold).filter(
            SlotHold.is_released == False,
            SlotHold.expires_at < now_utc
        ).all()

        count = len(expired_holds)
        if count > 0:
            for hold in expired_holds:
                hold.is_released = True
            db.commit()
            logger.info(f"Successfully released {count} expired slot hold reservations.")
        else:
            logger.info("No expired slot holds found.")
    except Exception as e:
        logger.error(f"Error executing expired holds cleanup: {e}")
    finally:
        db.close()


@celery_app.task
def send_appointment_reminders():
    """
    Periodic task running hourly to send reminder emails for appointments occurring in the next 24 hours.
    """
    logger.info("Starting hourly appointment reminder notification check...")
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        time_limit = now + timedelta(hours=24)

        # Get appointments scheduled in the next 24 hours that haven't been reminded
        upcoming_appointments = db.query(Appointment).filter(
            Appointment.status != "CANCELLED",
            Appointment.status != "COMPLETED",
            Appointment.reminder_sent == False,
            Appointment.appointment_date >= now.date(),
            # Make sure it's within 24 hours
        ).all()

        reminded_count = 0
        for app in upcoming_appointments:
            # Verify timing overlap inside the 24 hour range
            app_datetime = datetime.combine(app.appointment_date, app.start_time)
            if now <= app_datetime <= time_limit:
                patient = db.query(User).filter(User.id == app.patient_id).first()
                doctor_user = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()

                if patient and doctor_user:
                    subject = "Reminder: Upcoming CareSync Appointment Tomorrow"
                    body = (
                        f"Hi {patient.name},\n\n"
                        f"This is a friendly reminder that you have an upcoming consultation scheduled with Dr. {doctor_user.name}.\n\n"
                        f"Appointment Details:\n"
                        f"  Date: {app.appointment_date}\n"
                        f"  Time: {app.start_time.strftime('%H:%M')} - {app.end_time.strftime('%H:%M')}\n\n"
                        f"Please join or arrive 10 minutes before the scheduled slot.\n\n"
                        f"Be well,\nCareSync Clinical Support"
                    )
                    send_email_message(patient.email, subject, body, "APPOINTMENT_REMINDER", app.id)
                    app.reminder_sent = True
                    reminded_count += 1

        if reminded_count > 0:
            db.commit()
            logger.info(f"Sent {reminded_count} upcoming appointment reminders.")
        else:
            logger.info("No upcoming appointments requiring reminders within 24 hours.")
    except Exception as e:
        logger.error(f"Error executing appointment reminders job: {e}")
    finally:
        db.close()


@celery_app.task
def schedule_medication_reminders(appointment_id: int):
    """
    Asynchronous task triggered after visit completion.
    Parses prescriptions and schedules daily reminders for their duration using Celery ETA.
    """
    logger.info(f"Scheduling medication reminders for Appointment ID: {appointment_id}")
    db = SessionLocal()
    try:
        app = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not app or not app.prescriptions:
            logger.info(f"No active prescriptions found for appointment {appointment_id}.")
            return

        patient = db.query(User).filter(User.id == app.patient_id).first()
        if not patient:
            logger.error(f"Patient not found for appointment {appointment_id}.")
            return

        for rx in app.prescriptions:
            # 1. Parse duration (default to 3 days if not matched)
            duration_str = rx.duration.lower()
            duration_match = re.search(r'(\d+)', duration_str)
            days = int(duration_match.group(1)) if duration_match else 3

            # 2. Parse frequency (daily intervals)
            freq_str = rx.frequency.lower()
            reminder_hours = [8]  # Default: Morning only
            if "twice" in freq_str or "2" in freq_str or "1-0-1" in freq_str:
                reminder_hours = [8, 20]
            elif "thrice" in freq_str or "3" in freq_str or "1-1-1" in freq_str:
                reminder_hours = [8, 14, 20]

            # 3. Schedule ETA reminders starting tomorrow
            today = date.today()
            scheduled_count = 0
            for d in range(1, days + 1):
                run_date = today + timedelta(days=d)
                for h in reminder_hours:
                    # Construct run datetime in local/UTC format
                    eta_time = datetime.combine(run_date, time(hour=h, minute=0))
                    
                    # Schedule via Celery apply_async with ETA
                    send_medication_reminder.apply_async(
                        args=[app.id, patient.email, patient.name, rx.medicine_name, rx.dosage, rx.frequency],
                        eta=eta_time
                    )
                    scheduled_count += 1
            
            logger.info(f"Successfully scheduled {scheduled_count} ETA medication reminders for {rx.medicine_name}.")
            
    except Exception as e:
        logger.error(f"Failed to schedule medication reminders: {e}")
    finally:
        db.close()

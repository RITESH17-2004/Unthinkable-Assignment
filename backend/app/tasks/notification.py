import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from celery.utils.log import get_task_logger
from app.core.config import settings
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.notification import Notification

logger = get_task_logger(__name__)


def log_notification_db(notif_type: str, recipient: str, appointment_id: int = None, status: str = "PENDING", error_details: str = None):
    db = SessionLocal()
    try:
        notif = Notification(
            notification_type=notif_type,
            recipient=recipient,
            appointment_id=appointment_id,
            status=status,
            error_details=error_details,
            sent_at=datetime.utcnow() if status == "SENT" else None
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log notification to database: {e}")
    finally:
        db.close()


def send_email_message(recipient: str, subject: str, body: str, notif_type: str, appointment_id: int = None):
    """
    Secure SMTP delivery client supporting local logging fallback mode.
    """
    logger.info(f"Preparing to send email to {recipient} with subject: {subject}")
    
    # 1. Local logging fallback mode if SMTP_HOST is not configured
    if not settings.SMTP_HOST:
        log_msg = (
            f"==================================================\n"
            f"TIMESTAMP: {datetime.utcnow().isoformat()}Z\n"
            f"TYPE:      {notif_type}\n"
            f"TO:        {recipient}\n"
            f"FROM:      {settings.EMAILS_FROM_EMAIL}\n"
            f"SUBJECT:   {subject}\n"
            f"BODY:\n{body}\n"
            f"==================================================\n\n"
        )
        try:
            with open("emails.log", "a", encoding="utf-8") as f:
                f.write(log_msg)
            logger.info("SMTP_HOST not configured. Email successfully written to emails.log")
            log_notification_db(notif_type, recipient, appointment_id, "SENT")
            return True
        except Exception as e:
            logger.error(f"Failed to write email log file: {e}")
            log_notification_db(notif_type, recipient, appointment_id, "FAILED", str(e))
            return False

    # 2. Secure SMTP TLS email transmission
    try:
        # Use SMTP_USER as sender for Gmail/Yahoo compatibility if EMAILS_FROM_EMAIL is default
        sender = settings.SMTP_USER if (settings.SMTP_USER and ("caresync.com" in settings.EMAILS_FROM_EMAIL or not settings.EMAILS_FROM_EMAIL)) else settings.EMAILS_FROM_EMAIL

        msg = MIMEMultipart()
        msg["From"] = sender
        msg["To"] = recipient
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        
        server.sendmail(sender, recipient, msg.as_string())
        server.quit()
        
        logger.info(f"Email sent successfully via SMTP to {recipient}")
        log_notification_db(notif_type, recipient, appointment_id, "SENT")
        return True
    except Exception as e:
        logger.error(f"SMTP delivery failed to {recipient}: {e}")
        log_notification_db(notif_type, recipient, appointment_id, "FAILED", str(e))
        raise e


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_booking_confirmation(self, appointment_id: int):
    db = SessionLocal()
    try:
        from app.models.appointment import Appointment
        from app.models.user import User
        from app.models.doctor import DoctorProfile
        
        app = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not app:
            logger.error(f"Appointment {appointment_id} not found for booking confirmation email.")
            return

        patient = db.query(User).filter(User.id == app.patient_id).first()
        doctor_user = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()
        
        if not patient or not doctor_user:
            logger.error("Missing patient or doctor data for booking confirmation.")
            return

        # Send to Patient
        patient_subject = "Appointment Confirmed - MediFlow"
        patient_body = (
            f"Dear {patient.name},\n\n"
            f"Your appointment with Dr. {doctor_user.name} ({doctor_user.doctor_profile.specialization}) has been confirmed.\n\n"
            f"Details:\n"
            f"  Date: {app.appointment_date}\n"
            f"  Time: {app.start_time.strftime('%H:%M')} - {app.end_time.strftime('%H:%M')}\n"
            f"  Symptoms logged: {app.symptoms or 'None'}\n\n"
            f"Thank you for choosing MediFlow!"
        )
        send_email_message(patient.email, patient_subject, patient_body, "BOOKING_CONFIRMATION", app.id)

        # Send to Doctor
        doctor_subject = "New Patient Appointment Booked - MediFlow"
        doctor_body = (
            f"Dear Dr. {doctor_user.name},\n\n"
            f"A new appointment has been booked for you.\n\n"
            f"Patient: {patient.name}\n"
            f"Date: {app.appointment_date}\n"
            f"Time: {app.start_time.strftime('%H:%M')} - {app.end_time.strftime('%H:%M')}\n"
            f"Symptoms: {app.symptoms or 'None'}\n\n"
            f"Please check your dashboard for pre-visit AI diagnostics analysis."
        )
        send_email_message(doctor_user.email, doctor_subject, doctor_body, "BOOKING_CONFIRMATION", app.id)

    except Exception as e:
        logger.error(f"Failed to process booking confirmation task: {e}")
        if hasattr(self, 'request') and self.request and self.request.id:
            try:
                self.retry(exc=e)
            except Exception:
                logger.error("Max retries exceeded for booking confirmation task.")
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_cancellation_email(self, patient_email: str, doctor_email: str, patient_name: str, doctor_name: str, app_date_str: str, app_time_str: str):
    try:
        pat_subject = "Appointment Cancelled - MediFlow"
        pat_body = (
            f"Dear {patient_name},\n\n"
            f"We wanted to inform you that your appointment with Dr. {doctor_name} on {app_date_str} at {app_time_str} has been cancelled.\n\n"
            f"If you have any questions or would like to reschedule, please visit your portal.\n\n"
            f"Best regards,\nMediFlow Clinical Support"
        )
        send_email_message(patient_email, pat_subject, pat_body, "CANCELLATION")

        doc_subject = "Patient Appointment Cancelled - MediFlow"
        doc_body = (
            f"Dear Dr. {doctor_name},\n\n"
            f"Please note that your appointment with patient {patient_name} scheduled on {app_date_str} at {app_time_str} has been cancelled.\n\n"
            f"Your agenda has been updated accordingly."
        )
        send_email_message(doctor_email, doc_subject, doc_body, "CANCELLATION")
    except Exception as e:
        logger.error(f"Failed to send cancellation email: {e}")
        if hasattr(self, 'request') and self.request and self.request.id:
            try:
                self.retry(exc=e)
            except Exception:
                logger.error("Max retries exceeded for cancellation email task.")


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_leave_notifications(self, patient_email: str, patient_name: str, doctor_name: str, app_date_str: str, app_time_str: str):
    try:
        subject = "Urgent: Doctor Leave Cancellation Notification - MediFlow"
        body = (
            f"Dear {patient_name},\n\n"
            f"We regret to inform you that your upcoming appointment with Dr. {doctor_name} on {app_date_str} at {app_time_str} has been cancelled because the doctor will be out of office on leave.\n\n"
            f"Please log in to your MediFlow dashboard to search for another time slot or specialist at your earliest convenience.\n\n"
            f"We apologize for the inconvenience.\n\n"
            f"Warm regards,\nMediFlow Support Team"
        )
        send_email_message(patient_email, subject, body, "LEAVE_ALERT")
    except Exception as e:
        logger.error(f"Failed to send doctor leave alert email: {e}")
        if hasattr(self, 'request') and self.request and self.request.id:
            try:
                self.retry(exc=e)
            except Exception:
                logger.error("Max retries exceeded for leave alert email task.")


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_medication_reminder(self, appointment_id: int, patient_email: str, patient_name: str, medicine_name: str, dosage: str, frequency: str):
    try:
        subject = f"Medication Reminder: Take {medicine_name} - MediFlow"
        body = (
            f"Hi {patient_name},\n\n"
            f"This is a friendly reminder to take your prescribed medication: {medicine_name}.\n\n"
            f"Prescription Details:\n"
            f"  Dosage: {dosage}\n"
            f"  Schedule/Frequency: {frequency}\n\n"
            f"Please take this medication as directed by your physician.\n\n"
            f"Be well,\nMediFlow Patient Support"
        )
        send_email_message(patient_email, subject, body, "MEDICATION_REMINDER", appointment_id)
    except Exception as e:
        logger.error(f"Failed to send medication reminder email: {e}")
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error("Max retries exceeded for medication reminder email task.")

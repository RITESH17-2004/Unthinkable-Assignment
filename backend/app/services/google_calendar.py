import logging
from datetime import datetime, timedelta, timezone
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
import google.auth.transport.requests
from googleapiclient.discovery import build
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_flow(redirect_uri: str = None) -> Flow:
    """
    Construct Flow object dynamically from environment configurations.
    """
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=["https://www.googleapis.com/auth/calendar"]
    )
    flow.redirect_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI
    return flow


def get_auth_url() -> str:
    """
    Generates the Google OAuth login redirect URL requesting calendar access.
    """
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"  # Re-prompt consent to guarantee refresh token is issued
    )
    return auth_url


def exchange_auth_code(code: str, redirect_uri: str = None) -> dict:
    """
    Exchanges authorization code for access and refresh tokens.
    """
    flow = get_flow(redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials
    
    # Calculate timezone naive expires_at
    expiry = creds.expiry
    if expiry:
        if expiry.tzinfo is not None:
            expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        expiry = datetime.utcnow() + timedelta(hours=1)

    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "scopes": " ".join(creds.scopes or []),
        "expires_at": expiry
    }


def get_calendar_client(connection, db):
    """
    Rebuilds OAuth credentials, refreshes tokens if expired, and returns the Google Calendar API Client.
    """
    creds = Credentials(
        token=connection.access_token,
        refresh_token=connection.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=(connection.scopes or "").split(" ")
    )

    now = datetime.utcnow()
    # Check if expired
    if creds.expired or (connection.expires_at and connection.expires_at < now):
        logger.info(f"Google OAuth token expired for connection ID: {connection.id}. Refreshing...")
        request = google.auth.transport.requests.Request()
        try:
            creds.refresh(request)
            connection.access_token = creds.token
            if creds.refresh_token:
                connection.refresh_token = creds.refresh_token
            
            expiry = creds.expiry
            if expiry:
                if expiry.tzinfo is not None:
                    expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
                connection.expires_at = expiry
            else:
                connection.expires_at = datetime.utcnow() + timedelta(hours=1)

            db.commit()
            db.refresh(connection)
            logger.info("Google OAuth token refreshed successfully.")
        except Exception as e:
            logger.error(f"Failed to refresh Google Calendar OAuth token for connection ID {connection.id}: {e}")
            raise e

    return build("calendar", "v3", credentials=creds)


def create_calendar_event(service, appointment, doctor_name: str, patient_name: str) -> str:
    """
    Inserts a calendar event to Google Calendar.
    """
    event = {
        'summary': f'MediFlow Appointment: Dr. {doctor_name} & {patient_name}',
        'description': (
            f'Clinical Consultation scheduled on MediFlow.\n'
            f'Patient Chief Complaint / Symptoms: {appointment.symptoms or "Not provided"}\n'
            f'Urgency Level: {appointment.ai_urgency_level or "Normal"}\n'
        ),
        'start': {
            'dateTime': f"{appointment.appointment_date}T{appointment.start_time}",
            'timeZone': 'UTC',
        },
        'end': {
            'dateTime': f"{appointment.appointment_date}T{appointment.end_time}",
            'timeZone': 'UTC',
        },
    }
    result = service.events().insert(calendarId='primary', body=event).execute()
    return result.get('id')


def update_calendar_event(service, event_id: str, appointment, doctor_name: str, patient_name: str):
    """
    Updates/patches an existing calendar event.
    """
    event = {
        'summary': f'MediFlow Appointment: Dr. {doctor_name} & {patient_name} (RESCHEDULED)',
        'start': {
            'dateTime': f"{appointment.appointment_date}T{appointment.start_time}",
            'timeZone': 'UTC',
        },
        'end': {
            'dateTime': f"{appointment.appointment_date}T{appointment.end_time}",
            'timeZone': 'UTC',
        },
    }
    service.events().patch(calendarId='primary', eventId=event_id, body=event).execute()


def delete_calendar_event(service, event_id: str):
    """
    Removes/deletes a calendar event.
    """
    service.events().delete(calendarId='primary', eventId=event_id).execute()

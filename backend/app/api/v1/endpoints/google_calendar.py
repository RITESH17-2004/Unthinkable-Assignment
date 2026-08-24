from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.google_connection import GoogleCalendarConnection
from app.schemas.google_calendar import GoogleConnectRequest, GoogleStatusResponse
from app.services.google_calendar import get_auth_url, exchange_auth_code

router = APIRouter()


@router.get("/auth-url")
def read_auth_url(current_user: User = Depends(deps.get_current_active_user)):
    """
    Generate Google OAuth redirection URL.
    """
    url = get_auth_url()
    return {"url": url}


@router.post("/connect")
def connect_google_calendar(
    body: GoogleConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Exchange authorization code for access & refresh tokens, and save connection credentials.
    """
    try:
        token_data = exchange_auth_code(body.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to exchange OAuth authorization code: {e}")

    conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == current_user.id).first()
    if conn:
        conn.access_token = token_data["access_token"]
        if token_data["refresh_token"]:
            conn.refresh_token = token_data["refresh_token"]
        conn.scopes = token_data["scopes"]
        conn.expires_at = token_data["expires_at"]
    else:
        conn = GoogleCalendarConnection(
            user_id=current_user.id,
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            scopes=token_data["scopes"],
            expires_at=token_data["expires_at"]
        )
        db.add(conn)

    db.commit()
    db.refresh(conn)
    return {"status": "connected"}


@router.delete("/disconnect")
def disconnect_google_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Disconnect Google Calendar by deleting OAuth connection details.
    """
    conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == current_user.id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Google Calendar connection not found.")
    db.delete(conn)
    db.commit()
    return {"status": "disconnected"}


@router.get("/status", response_model=GoogleStatusResponse)
def get_connection_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Query the connection status of current user.
    """
    from app.core.config import settings
    enabled = bool(
        settings.GOOGLE_CLIENT_ID and 
        settings.GOOGLE_CLIENT_SECRET and 
        "your-google-client-id" not in settings.GOOGLE_CLIENT_ID
    )
    conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == current_user.id).first()
    if conn:
        return {"connected": True, "email": current_user.email, "enabled": enabled}
    return {"connected": False, "enabled": enabled}

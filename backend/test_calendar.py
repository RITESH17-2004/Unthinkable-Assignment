import os
from app.core.config import settings
from app.services.google_calendar import get_auth_url
from app.core.database import SessionLocal
from app.models.google_connection import GoogleCalendarConnection

def test_google_calendar_flow():
    print("--- Starting Google Calendar Integration Verification ---")

    # 1. Verify environment variables are configured
    print("\n1. Verifying environment configurations...")
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        print("[WARNING] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in .env.")
        print("          Google OAuth callback flow will fail without these credentials.")
        print("          Please create a Google Cloud Console project and configure them.")
    else:
        print("[PASS] Google OAuth credentials detected.")

    # 2. Test authorization URL generation
    print("\n2. Testing authorization URL generation...")
    try:
        auth_url = get_auth_url()
        print(f"[PASS] Successfully generated Google Calendar OAuth authorization URL:")
        print(f"       {auth_url}")
    except Exception as e:
        print(f"[FAIL] Authorization URL generation failed: {e}")
        print("       (This usually occurs if GOOGLE_CLIENT_ID/SECRET are missing or malformed).")

    # 3. Verify Pydantic status schema checks
    print("\n3. Verifying Pydantic serialization schemas...")
    try:
        from app.schemas.google_calendar import GoogleStatusResponse
        resp = GoogleStatusResponse(connected=True, email="doctor@caresync.com")
        print(f"[PASS] GoogleStatusResponse parsed successfully: {resp.model_dump()}")
    except Exception as e:
        print(f"[FAIL] Schema verification failed: {e}")

    # 4. Check database connection table logs
    print("\n4. Checking database google_calendar_connections table schema...")
    db = SessionLocal()
    try:
        # Check if table queries succeed
        conn_count = db.query(GoogleCalendarConnection).count()
        print(f"[PASS] Successfully connected to google_calendar_connections table. Connection count: {conn_count}")
    except Exception as e:
        print(f"[FAIL] Failed to query google_calendar_connections: {e}")
    finally:
        db.close()

    print("\n--- Google Calendar Integration Verification Completed ---")

if __name__ == "__main__":
    test_google_calendar_flow()

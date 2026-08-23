import os
import time
from app.tasks.notification import send_booking_confirmation, send_cancellation_email, send_leave_notifications, send_medication_reminder
from app.tasks.scheduler import cleanup_expired_holds, send_appointment_reminders
from app.core.database import SessionLocal
from app.models.notification import Notification

def test_notifications_flow():
    print("--- Starting Notifications & Background Jobs Verification ---")

    # Clear emails.log if it exists
    if os.path.exists("emails.log"):
        os.remove("emails.log")
        print("[INFO] Cleared previous emails.log file.")

    # 1. Test running booking confirmation task synchronously (using Celery's .apply())
    print("\n1. Triggering booking confirmation Celery task (Synchronously via .apply())...")
    # We will trigger it for Appointment ID 3 (which we completed/booked in test_consultation.py)
    try:
        # We use .apply() to run the Celery task in-process for testing
        task_res = send_booking_confirmation.apply(args=[3])
        print(f"Task executed with state: {task_res.state}")
    except Exception as e:
        print(f"[ERROR] Failed to execute booking confirmation task: {e}")

    # 2. Test running cancellation email task
    print("\n2. Triggering cancellation email Celery task...")
    try:
        task_res = send_cancellation_email.apply(args=[
            "patient@test.com", "doctor@test.com", "John Patient", "John House", "2026-08-25", "09:00"
        ])
        print(f"Task executed with state: {task_res.state}")
    except Exception as e:
        print(f"[ERROR] Failed to execute cancellation email task: {e}")

    # 3. Test running doctor leave alert task
    print("\n3. Triggering doctor leave alert Celery task...")
    try:
        task_res = send_leave_notifications.apply(args=[
            "patient@test.com", "John Patient", "John House", "2026-08-25", "09:00"
        ])
        print(f"Task executed with state: {task_res.state}")
    except Exception as e:
        print(f"[ERROR] Failed to execute doctor leave alert: {e}")

    # 4. Test running medication reminder task
    print("\n4. Triggering medication reminder Celery task...")
    try:
        task_res = send_medication_reminder.apply(args=[
            3, "patient@test.com", "John Patient", "Ibuprofen", "400mg", "Twice daily"
        ])
        print(f"Task executed with state: {task_res.state}")
    except Exception as e:
        print(f"[ERROR] Failed to execute medication reminder: {e}")

    # 5. Check if local emails.log was written
    print("\n5. Checking local email transmission logs...")
    if os.path.exists("emails.log"):
        print("[PASS] emails.log exists. File contents summary:")
        with open("emails.log", "r") as f:
            lines = f.readlines()
            # print first 15 lines of logs
            for l in lines[:20]:
                print(f"  {l.rstrip()}")
            if len(lines) > 20:
                print("  ...")
    else:
        print("[FAIL] emails.log was not generated.")

    # 6. Check database status logs
    print("\n6. Checking database notifications tracking table logs...")
    db = SessionLocal()
    try:
        notifs = db.query(Notification).order_by(Notification.id.desc()).limit(5).all()
        if len(notifs) > 0:
            print(f"[PASS] Successfully logged {len(notifs)} notifications in database table:")
            for n in notifs:
                print(f"  ID: {n.id} | Type: {n.notification_type} | To: {n.recipient} | Status: {n.status} | Sent At: {n.sent_at}")
        else:
            print("[FAIL] No notifications found in the database table.")
    except Exception as e:
        print(f"[ERROR] Failed to query database notifications table: {e}")
    finally:
        db.close()

    print("\n--- Notifications & Background Jobs Verification Completed ---")

if __name__ == "__main__":
    test_notifications_flow()

import requests
import datetime

BASE_URL = "http://localhost:8000/api/v1"

def test_complete_consultation():
    print("--- Starting Doctor Portal Consultation Test ---")

    # 1. Login as Doctor
    print("\n1. Logging in Doctor...")
    doc_login = requests.post(f"{BASE_URL}/auth/login", data={
        "username": "doctor@caresync.com",
        "password": "doctor123"
    })
    if doc_login.status_code != 200:
        print("[FAIL] Failed to log in Doctor.")
        return
    doc_token = doc_login.json()["access_token"]
    print("[PASS] Doctor logged in successfully.")

    # 2. Get Doctor Profile ID
    doc_me = requests.get(f"{BASE_URL}/doctor/profile/me", headers={"Authorization": f"Bearer {doc_token}"})
    doc_profile_id = doc_me.json()["doctor_profile"]["id"]
    print(f"Doctor Profile ID: {doc_profile_id}")

    # 3. Register and Login a Patient to book a slot for the test
    print("\n2. Registering and logging in Patient...")
    patient_email = f"patient.consult.{int(datetime.datetime.now().timestamp())}@test.com"
    requests.post(f"{BASE_URL}/auth/register", json={
        "email": patient_email,
        "name": "Consult Patient",
        "password": "password123"
    })
    pat_login = requests.post(f"{BASE_URL}/auth/login", data={
        "username": patient_email,
        "password": "password123"
    })
    pat_token = pat_login.json()["access_token"]
    print("[PASS] Patient registered and logged in.")

    # 4. Find the first date with slots available
    print("\n3. Querying doctor availability for the next 7 days...")
    target_date = datetime.date.today()
    slots = []
    available_slot = None
    booking_date_str = ""
    
    for i in range(1, 8):
        check_date = (target_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        avail_res = requests.get(
            f"{BASE_URL}/appointments/availability?doctor_profile_id={doc_profile_id}&query_date={check_date}",
            headers={"Authorization": f"Bearer {pat_token}"}
        )
        if avail_res.status_code == 200:
            slots = avail_res.json().get("slots", [])
            available_slot = next((s for s in slots if s["is_available"]), None)
            if available_slot:
                booking_date_str = check_date
                break
                
    if not available_slot:
        print("[FAIL] No slots available in the next 7 days to test.")
        return
    print(f"[PASS] Found available slot on {booking_date_str}: {available_slot['start_time']}")

    # 5. Hold the slot
    print("\n4. Holding the slot...")
    hold_res = requests.post(f"{BASE_URL}/appointments/hold", json={
        "doctor_profile_id": doc_profile_id,
        "hold_date": booking_date_str,
        "start_time": available_slot["start_time"],
        "end_time": available_slot["end_time"]
    }, headers={"Authorization": f"Bearer {pat_token}"})
    if hold_res.status_code != 200:
        print(f"[FAIL] Hold failed: {hold_res.text}")
        return
    hold_id = hold_res.json()["id"]
    print(f"[PASS] Slot held. Hold ID: {hold_id}")

    # 6. Book the slot
    print("\n5. Booking the slot...")
    book_res = requests.post(f"{BASE_URL}/appointments/book", json={
        "hold_id": hold_id,
        "symptoms": "Chronic knee swelling and moderate pain when bending for past 3 days."
    }, headers={"Authorization": f"Bearer {pat_token}"})
    if book_res.status_code != 200:
        print(f"[FAIL] Booking failed: {book_res.text}")
        return
    app_id = book_res.json()["id"]
    print(f"[PASS] Appointment booked successfully. Appointment ID: {app_id}")

    # 7. Complete Consultation (Unauthorized access verification)
    print("\n6. Verification: Checking that Patient cannot complete the appointment...")
    unauth_res = requests.put(f"{BASE_URL}/appointments/{app_id}/complete", json={
        "clinical_notes": "Symptom check, knee sprain.",
        "prescriptions": [
            {"medicine_name": "Ibuprofen", "dosage": "400mg", "frequency": "1-0-1", "duration": "7 days", "instructions": "Take after meals"}
        ]
    }, headers={"Authorization": f"Bearer {pat_token}"})
    if unauth_res.status_code == 403:
        print("[PASS] Patient blocked with 403 Forbidden as expected.")
    else:
        print(f"[FAIL] Expected 403 Forbidden, but got {unauth_res.status_code}: {unauth_res.text}")

    # 8. Complete Consultation (Pydantic schema validation checks)
    print("\n7. Verification: Checking that empty fields are rejected...")
    invalid_res = requests.put(f"{BASE_URL}/appointments/{app_id}/complete", json={
        "clinical_notes": "   ",  # Invalid empty notes
        "prescriptions": [
            {"medicine_name": "Ibuprofen", "dosage": "  ", "frequency": "1-0-1", "duration": "7 days"}
        ]
    }, headers={"Authorization": f"Bearer {doc_token}"})
    if invalid_res.status_code == 422:
        print("[PASS] Invalid schemas rejected with 422 Unprocessable Entity as expected.")
    else:
        print(f"[FAIL] Expected 422 Unprocessable Entity, but got {invalid_res.status_code}: {invalid_res.text}")

    # 9. Complete Consultation (Authorized doctor path)
    print("\n8. Completing consultation with structured prescriptions...")
    complete_res = requests.put(f"{BASE_URL}/appointments/{app_id}/complete", json={
        "clinical_notes": "Patient presents with acute mechanical knee strain. No fracture signs. Advise icing and rest.",
        "prescriptions": [
            {"medicine_name": "Ibuprofen", "dosage": "400mg", "frequency": "Twice daily", "duration": "5 days", "instructions": "Take with food"},
            {"medicine_name": "Glucosamine", "dosage": "1500mg", "frequency": "Once daily", "duration": "30 days"}
        ]
    }, headers={"Authorization": f"Bearer {doc_token}"})
    
    if complete_res.status_code != 200:
        print(f"[FAIL] Consultation completion failed: {complete_res.text}")
        return
    
    app_details = complete_res.json()
    print("[PASS] Consultation completed successfully.")
    
    # 10. Verify prescriptions list in response
    print("\n9. Verifying structured prescriptions list in response...")
    rx_list = app_details.get("prescriptions", [])
    if len(rx_list) == 2:
        print(f"[PASS] Found 2 structured prescriptions as expected:")
        for rx in rx_list:
            print(f"  - {rx['medicine_name']} {rx['dosage']} ({rx['frequency']} for {rx['duration']})")
    else:
        print(f"[FAIL] Expected 2 prescriptions, but found: {rx_list}")

    print("\n--- Doctor Portal Consultation Test Completed ---")

if __name__ == "__main__":
    test_complete_consultation()

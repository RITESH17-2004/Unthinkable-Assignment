import threading
import time
import requests

# Backend URL
BASE_URL = "http://localhost:8000/api/v1"

# We will simulate 2 concurrent patients trying to hold the exact same slot.
# Since we need 2 patient logins, we can register 2 test patient users.

def register_and_login(email, name, password):
    # Register
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "name": name,
        "password": password
    })
    
    # Login
    log_res = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email,
        "password": password
    })
    if log_res.status_code == 200:
        return log_res.json()["access_token"]
    else:
        # User might already exist, try login directly
        log_res = requests.post(f"{BASE_URL}/auth/login", data={
            "username": email,
            "password": password
        })
        if log_res.status_code == 200:
            return log_res.json()["access_token"]
        raise Exception(f"Failed to login: {log_res.text}")

def test_concurrency():
    print("--- Starting Concurrency Test ---")
    
    # 1. Login/Register two test patients
    try:
        print("Logging in Patient 1...")
        token1 = register_and_login("patient1@test.com", "Patient One", "password123")
        print("Logging in Patient 2...")
        token2 = register_and_login("patient2@test.com", "Patient Two", "password123")
    except Exception as e:
        print(f"Auth Setup Failed (Make sure backend server is running!): {e}")
        return

    # 2. Retrieve active doctors
    doctors_res = requests.get(f"{BASE_URL}/doctors")
    doctors = doctors_res.json()
    if not doctors:
        print("No active doctors found. Please run seed.py or create a doctor profile first.")
        return
    
    doctor = doctors[0]
    doctor_profile_id = doctor["doctor_profile"]["id"]
    print(f"Testing concurrency with Doctor: {doctor['name']} (Profile ID: {doctor_profile_id})")

    # 3. Find an available slot tomorrow
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    
    avail_res = requests.get(f"{BASE_URL}/appointments/availability", params={
        "doctor_profile_id": doctor_profile_id,
        "query_date": tomorrow
    })
    slots = avail_res.json()["slots"]
    available_slots = [s for s in slots if s["is_available"]]
    
    if not available_slots:
        print(f"No available slots found for tomorrow ({tomorrow}). Please make sure doctor working hours are configured.")
        return
    
    target_slot = available_slots[0]
    print(f"Target slot selected: {target_slot['start_time']} - {target_slot['end_time']} on {tomorrow}")

    # 4. Simulate concurrent hold requests
    results = {}
    barrier = threading.Barrier(2)

    def hold_request(patient_name, token, results_key):
        # Wait for both threads to be ready to execute at the same moment
        barrier.wait()
        
        try:
            res = requests.post(f"{BASE_URL}/appointments/hold", 
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "doctor_profile_id": doctor_profile_id,
                    "hold_date": tomorrow,
                    "start_time": target_slot["start_time"],
                    "end_time": target_slot["end_time"]
                }
            )
            try:
                res_data = res.json()
            except Exception:
                res_data = res.text
            results[results_key] = (res.status_code, res_data)
        except Exception as e:
            results[results_key] = (999, str(e))

    t1 = threading.Thread(target=hold_request, args=("Patient 1", token1, "patient_1_hold"))
    t2 = threading.Thread(target=hold_request, args=("Patient 2", token2, "patient_2_hold"))

    print("Spawning parallel threads to hold the exact same slot...")
    t1.start()
    t2.start()
    
    t1.join()
    t2.join()

    print("\n--- Hold Concurrency Results ---")
    for key, val in results.items():
        status_code, body = val
        status_str = "SUCCESS" if status_code == 200 else "FAILED"
        print(f"{key}: Status {status_code} ({status_str}) -> Response: {body}")
        
    print("\nVerification: Checking if only one patient successfully held the slot...")
    success_count = sum(1 for status_code, _ in results.values() if status_code == 200)
    if success_count == 1:
        print("[PASS] Database transactions and locks successfully prevented double-holding! Only one client succeeded.")
    else:
        print(f"[FAIL] Expected 1 success, but got {success_count} successes.")

if __name__ == "__main__":
    test_concurrency()

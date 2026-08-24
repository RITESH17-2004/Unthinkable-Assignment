# 🏥 MediFlow — Comprehensive End-to-End Validation & Walkthrough Guide

> **This step-by-step guide provides a complete clinical scenario to validate every feature of the MediFlow platform, from multi-tenant access, atomic slot locking, and AI symptom triage to Google Calendar OAuth 2.0 sync, e-prescriptions, and Mailgun/SMTP notifications.**

---

## 📌 Prerequisites & Quick Server Launch

Before starting the walkthrough, ensure your backend and frontend servers are running:

### Option A: Docker Compose (1-Command)
```bash
docker compose up --build -d
```
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **FastAPI API & Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Option B: Local Manual Launch
```bash
# Terminal 1 - Backend API:
cd backend
python seed.py
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend Web:
cd frontend
npm run dev
```

---

## 🧪 Validation Scenario: Clinical Case Study

* **Patient**: Alex Rivera (`alex.rivera@example.com`)
* **Specialist**: Dr. Sarah Jenkins (`doctor@caresync.com` - Cardiology)
* **Administrator**: System Admin (`admin@caresync.com`)

---

## 📋 Step-by-Step Validation Checklist

### Step 1: Admin Portal — Roster, Shift & Leave Management
1. Open [http://localhost:3000/login](http://localhost:3000/login).
2. Log in with **Admin Credentials**:
   - **Email**: `admin@caresync.com`
   - **Password**: `admin123`
3. **Validate Roster Search**:
   - In the **Doctors List** tab, type `Cardiology` or `doctor` in the search bar.
   - Verify that the table filters instantly without shrinking container dimensions.
4. **Provision a New Doctor**:
   - Click `+ Add Doctor`.
   - Enter `Dr. Emily Vance`, email `emily.vance@mediflow.com`, password `doctor123`, specialization `Neurology`, and slot duration `30 min`.
   - Click `Create Profile`.
5. **Configure Doctor Shift Schedule**:
   - Switch to the **Schedule & Leaves** tab.
   - Select a doctor from the left roster search list.
   - Configure working hours (e.g. Monday to Friday, 09:00 AM – 05:00 PM).
   - Check the custom teal accent checkboxes and save schedule.
6. **Test Doctor Leave Conflict Detection**:
   - Fill out the **Log Doctor Absence / Leave** form for a future date.
   - Verify that if patient bookings exist on that date, conflict warnings trigger and automated cancellation notifications dispatch to affected patients.

---

### Step 2: Patient Registration & Specialist Discovery
1. Open [http://localhost:3000/register](http://localhost:3000/register).
2. Register a new patient account:
   - **Full Name**: Alex Rivera
   - **Email**: `alex.rivera@example.com`
   - **Password**: `patient123`
3. Navigate to **Find Specialist** tab.
4. **Test Custom Specialty Dropdown**:
   - Click the custom specialization dropdown.
   - Verify the custom animated list UI displaying specialty names, doctor count badges, and checkmark indicators.
   - Select `Cardiology`.

---

### Step 3: Atomic Slot Lock & Concurrency Reservation
1. Select **Dr. Sarah Jenkins** from the doctor card list.
2. Pick an upcoming target date on the interactive calendar.
3. Click an available timeslot (e.g. `10:00 AM`).
4. **Validate 10-Minute Lock**:
   - Observe the yellow warning banner: **"Temporary Slot Reservation Locked"**.
   - Notice the live 10-minute countdown timer.
5. **Validate Concurrent Double-Booking Prevention**:
   - Open an Incognito browser window, log in as another patient, and attempt to select the exact same `10:00 AM` slot for Dr. Sarah Jenkins.
   - Verify that the slot displays as **`(Held)`** and cannot be clicked by another user.

---

### Step 4: AI Pre-Visit Clinical Symptom Triage
1. In Alex Rivera's active booking window, enter pre-visit symptoms:
   ```text
   Experiencing sudden chest tightness, mild shortness of breath during morning workouts, and fatigue over the past 3 days.
   ```
2. Click **Confirm Booking**.
3. **Validate AI Pre-Triage Execution**:
   - The LLM (Gemini / Mistral) processes the symptoms.
   - Inspect the generated output:
     - **Urgency Level**: `HIGH` or `MEDIUM`
     - **Chief Complaint**: Short clinical summary of symptoms.
     - **3 Diagnostic Questions**: Prompts generated for the physician.

---

### Step 5: Doctor Portal & Clinical Consultation Workflow
1. Open [http://localhost:3000/login](http://localhost:3000/login) in a main window.
2. Log in with **Doctor Credentials**:
   - **Email**: `doctor@caresync.com`
   - **Password**: `doctor123`
3. Notice the updated header navigation tabs (**Agenda**, **Profile**, **Schedule**) and clinical teal banner (`bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900`).
4. In the **Patient Visit Schedule (Agenda)** tab:
   - Verify that Alex Rivera's appointment appears.
   - Check that all 6 columns fit comfortably without horizontal scrolling.
5. Click **Complete** on Alex Rivera's appointment:
   - Review the **AI Symptoms Analysis** drawer (Chief Complaint + 3 Diagnostic Questions).
   - Enter **Clinical Assessment Notes**:
     ```text
     Patient presents with exertional chest discomfort. ECG shows sinus rhythm with minor ST segment changes. Recommended treadmill stress test and echocardiogram.
     ```
   - Add **Structured Prescriptions**:
     - **Medicine**: `Aspirin` | **Dosage**: `75mg` | **Frequency**: `1-0-0` | **Duration**: `30 days` | **Instructions**: `After breakfast`
     - Click `+ Add Medication`.
     - **Medicine**: `Atorvastatin` | **Dosage**: `20mg` | **Frequency**: `0-0-1` | **Duration**: `30 days` | **Instructions**: `At bedtime`
   - Click **Submit Report**.

---

### Step 6: Consultation Summary & AI Patient Translation Review
1. In the Doctor Agenda, click the new **Summary** pill button on the completed visit.
2. **Validate Redesigned Summary Dialog**:
   - Check that the close `✕` button has generous margin (`pr-12`) and **does not overlap the `COMPLETED` status badge**.
   - Inspect **Section 1 (Symptom Log)** in warm amber styling.
   - Inspect **Section 2 (Clinical Notes)** in clean physician container.
   - Inspect **Section 3 (Prescriptions Table)** with `75mg` and `20mg` dosage pill tags.
   - Inspect **Section 4 (AI Patient Translation)**:
     - Verify plain-language explanation.
     - Verify Next Steps & Recovery Plan bullet points (**check that bullets hang cleanly with no text wrapped under the bullet points**).

---

### Step 7: Google Calendar OAuth 2.0 Sync Verification
1. In the Doctor or Patient Portal header/profile, click **Connect Google Calendar**.
2. Complete the Google OAuth 2.0 consent flow.
3. **Verify Calendar Sync**:
   - Confirm that a new consultation event appears in your Google Calendar.
   - Reschedule or cancel the appointment and verify that the Google Calendar event is automatically updated or removed.

---

### Step 8: Email Notifications & Audit Logging Verification
1. **Check Live SMTP or Local Audit File**:
   - Open `backend/emails.log` in your editor.
   - Verify that append-only email logs were recorded for:
     - Booking Confirmation email to Alex Rivera.
     - Appointment Reminder notices.
     - Consultation Completion receipt.
2. **Check Database Notification Audit**:
   - Inspect the SQLite/PostgreSQL `notifications` table:
     ```sql
     SELECT id, recipient, notification_type, status, sent_at FROM notifications;
     ```
   - Confirm that all notification attempts are logged with status `SENT`.

---

### Step 9: Automated System Test Suite Execution
Run the automated test suite to programmatically verify all concurrency locks, LLM prompts, and notification pipelines:

```bash
# 1. Run Concurrency & Double-Booking Stress Test
python backend/test_concurrency.py

# 2. Run LLM Pre-Triage & Fallback Test
python backend/test_llm.py

# 3. Run Clinical Consultation & Prescriptions Test
python backend/test_consultation.py

# 4. Run Notifications & Email Audit Test
python backend/test_notifications.py
```

---

## 🎯 Verification Result Summary

| Feature Category | Expected Behavior | Verification Status |
| :--- | :--- | :---: |
| **Multi-Tenant Portals** | Isolated routes for Patient, Doctor, and Admin | ✅ PASS |
| **Atomic Slot Lock** | 10-min hold preventing concurrent double-booking | ✅ PASS |
| **AI Symptom Triage** | Generates Urgency, Chief Complaint & 3 Questions | ✅ PASS |
| **Structured e-Rx** | Multi-row dosage pills & clinical notes | ✅ PASS |
| **AI Patient Summary** | Plain-language care steps with hanging bullets | ✅ PASS |
| **Google Calendar Sync** | Automated OAuth event creation and cancellation | ✅ PASS |
| **Email Dispatch** | SMTP/Mailgun delivery + `emails.log` fallback | ✅ PASS |
| **UI Aesthetics** | Clinical teal theme, responsive tables, zero overlap | ✅ PASS |

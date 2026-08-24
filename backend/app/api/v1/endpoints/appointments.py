from datetime import date, datetime, time, timedelta, timezone
from typing import Any, List
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError

from app.api import deps
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.doctor import DoctorProfile, WorkingHour, DoctorLeave
from app.models.appointment import Appointment, SlotHold, Prescription
from app.schemas.appointment import (
    AvailabilityResponse,
    TimeSlot,
    SlotHoldCreate,
    SlotHoldResponse,
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentComplete,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def process_pre_visit_ai_summary(appointment_id: int, symptoms: str):
    db = SessionLocal()
    try:
        from app.services.llm import generate_pre_visit_summary
        ai_data = generate_pre_visit_summary(symptoms)
        
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if appointment:
            appointment.ai_urgency_level = ai_data["urgency"]
            appointment.ai_chief_complaint = ai_data["chief_complaint"]
            appointment.ai_suggested_questions = json.dumps(ai_data["suggested_questions"])
            appointment.ai_pre_visit_status = ai_data["status"]
            appointment.ai_model_info = ai_data["model"]
            db.commit()
    except Exception as e:
        logger.error(f"Failed to process pre-visit AI summary: {e}")
    finally:
        db.close()


def process_post_visit_ai_summary(appointment_id: int, clinical_notes: str, prescriptions: str):
    db = SessionLocal()
    try:
        from app.services.llm import generate_post_visit_summary
        ai_data = generate_post_visit_summary(clinical_notes, prescriptions)
        
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if appointment:
            appointment.ai_patient_summary = ai_data["patient_summary"]
            appointment.ai_follow_up_instructions = json.dumps(ai_data["follow_up_instructions"])
            appointment.ai_post_visit_status = ai_data["status"]
            
            # Update model tracking only if success or model not set
            if ai_data["status"] == "SUCCESS" or not appointment.ai_model_info:
                appointment.ai_model_info = ai_data["model"]
            db.commit()
    except Exception as e:
        logger.error(f"Failed to process post-visit AI summary: {e}")
    finally:
        db.close()


# --- Helper Function: Slot Generator ---
def generate_slots_for_doctor(
    db: Session,
    profile: DoctorProfile,
    query_date: date
) -> List[TimeSlot]:
    # 1. Check if doctor is on leave
    on_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_profile_id == profile.id,
        DoctorLeave.leave_date == query_date
    ).first()
    if on_leave:
        return []

    # 2. Get weekday and corresponding working hours
    weekday_int = query_date.weekday()  # Monday = 0, ..., Sunday = 6
    working_hour = db.query(WorkingHour).filter(
        WorkingHour.doctor_profile_id == profile.id,
        WorkingHour.day_of_week == weekday_int,
        WorkingHour.is_available == True
    ).first()
    if not working_hour:
        return []

    # 3. Fetch active appointments and active holds for this doctor & date
    active_appointments = db.query(Appointment).filter(
        Appointment.doctor_profile_id == profile.id,
        Appointment.appointment_date == query_date,
        Appointment.status != "CANCELLED"
    ).all()

    now_utc = datetime.now(timezone.utc)
    active_holds = db.query(SlotHold).filter(
        SlotHold.doctor_profile_id == profile.id,
        SlotHold.hold_date == query_date,
        SlotHold.is_released == False,
        SlotHold.expires_at > now_utc
    ).all()

    # Create helper sets of active slot start times
    booked_starts = {app.start_time for app in active_appointments}
    held_starts = {hold.start_time for hold in active_holds}

    # 4. Generate slots based on slot duration
    slots: List[TimeSlot] = []
    
    # Convert working hours to minutes to loop easily
    start_mins = working_hour.start_time.hour * 60 + working_hour.start_time.minute
    end_mins = working_hour.end_time.hour * 60 + working_hour.end_time.minute
    duration = profile.slot_duration

    today_date = date.today()
    local_now = datetime.now() # for past slot filtering today

    for current_mins in range(start_mins, end_mins, duration):
        if current_mins + duration > end_mins:
            break
            
        slot_start_time = time(current_mins // 60, current_mins % 60)
        slot_end_time = time((current_mins + duration) // 60, (current_mins + duration) % 60)

        # Skip if slot is in the past (if query_date is today)
        if query_date == today_date:
            slot_dt = datetime.combine(query_date, slot_start_time)
            if slot_dt < local_now:
                continue

        # Check booking and hold states
        is_booked = slot_start_time in booked_starts
        is_held = slot_start_time in held_starts
        
        is_available = not (is_booked or is_held)

        slots.append(
            TimeSlot(
                start_time=slot_start_time,
                end_time=slot_end_time,
                is_available=is_available,
                is_held=is_held
            )
        )

    return slots


# --- Endpoints ---

@router.get("/availability", response_model=AvailabilityResponse)
def get_slot_availability(
    doctor_profile_id: int,
    query_date: date,
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all dynamic slot details for a doctor on a specific date.
    Calculates active bookings and temporary holds.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found"
        )
    
    # Prevent query for past dates
    if query_date < date.today():
        return AvailabilityResponse(
            doctor_profile_id=doctor_profile_id,
            appointment_date=query_date,
            slots=[]
        )

    slots = generate_slots_for_doctor(db, profile, query_date)
    return AvailabilityResponse(
        doctor_profile_id=doctor_profile_id,
        appointment_date=query_date,
        slots=slots
    )


@router.post("/hold", response_model=SlotHoldResponse)
def hold_appointment_slot(
    *,
    db: Session = Depends(get_db),
    hold_in: SlotHoldCreate,
    current_user: User = Depends(deps.RoleChecker(["PATIENT"]))
) -> Any:
    """
    Temporarily reserve an appointment slot for 5 minutes.
    Restricted to Patients. Uses row locking to prevent race conditions.
    """
    # 1. Row-lock doctor profile to serialize concurrent hold requests
    profile = db.query(DoctorProfile).filter(DoctorProfile.id == hold_in.doctor_profile_id).with_for_update(of=DoctorProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # 2. Check if the slot is still available
    available_slots = generate_slots_for_doctor(db, profile, hold_in.hold_date)
    
    # Find matching slot
    slot_match = next(
        (s for s in available_slots if s.start_time == hold_in.start_time and s.is_available),
        None
    )
    if not slot_match:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requested time slot is no longer available"
        )

    # 3. Create Hold
    expires_at_dt = datetime.now(timezone.utc) + timedelta(minutes=5)
    db_hold = SlotHold(
        patient_id=current_user.id,
        doctor_profile_id=hold_in.doctor_profile_id,
        hold_date=hold_in.hold_date,
        start_time=hold_in.start_time,
        end_time=hold_in.end_time,
        expires_at=expires_at_dt,
        is_released=False
    )
    db.add(db_hold)
    db.commit()
    db.refresh(db_hold)
    return db_hold


@router.post("/book", response_model=AppointmentResponse)
def confirm_appointment_booking(
    *,
    db: Session = Depends(get_db),
    book_in: AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.RoleChecker(["PATIENT"]))
) -> Any:
    """
    Confirm a held slot and register the appointment.
    Restricted to Patients. Validates slot holds and prevents double booking.
    """
    # 1. Lock the slot hold record
    hold = db.query(SlotHold).filter(
        SlotHold.id == book_in.hold_id,
        SlotHold.patient_id == current_user.id
    ).with_for_update().first()
    
    if not hold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slot hold reservation not found"
        )

    # 2. Verify hold validity
    now_utc = datetime.now(timezone.utc)
    if hold.is_released or hold.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slot reservation has expired or has already been booked"
        )

    # 3. Book the appointment
    db_appointment = Appointment(
        patient_id=current_user.id,
        doctor_profile_id=hold.doctor_profile_id,
        appointment_date=hold.hold_date,
        start_time=hold.start_time,
        end_time=hold.end_time,
        status="BOOKED",
        symptoms=book_in.symptoms
    )
    
    # Mark hold as released
    hold.is_released = True

    db.add(db_appointment)
    try:
        db.commit()
        db.refresh(db_appointment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This slot was already booked. Please choose another slot."
        )

    # Trigger Celery booking confirmation emails
    try:
        from app.tasks.notification import send_booking_confirmation
        send_booking_confirmation.delay(db_appointment.id)
    except Exception as e:
        logger.error(f"Failed to queue booking confirmation Celery task: {e}")

    # Trigger Google Calendar Sync Task
    try:
        from app.tasks.calendar import sync_appointment_event_task
        sync_appointment_event_task.delay(db_appointment.id)
    except Exception as e:
        logger.error(f"Failed to queue Google Calendar sync Celery task: {e}")

    # Trigger pre-visit AI summary generation in background
    background_tasks.add_task(
        process_pre_visit_ai_summary,
        db_appointment.id,
        db_appointment.symptoms or ""
    )

    # Retrieve extra details to populate response model helpers
    doctor_user = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == db_appointment.doctor_profile_id).first()
    res = AppointmentResponse.model_validate(db_appointment)
    if doctor_user:
        res.doctor_name = doctor_user.name
        res.specialization = doctor_user.doctor_profile.specialization
    res.patient_name = current_user.name
    return res


@router.get("/me", response_model=List[AppointmentResponse])
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve appointments list for logged-in user.
    Admins see all; Patients see theirs; Doctors see theirs.
    """
    if current_user.role.upper() == "ADMIN":
        query = db.query(Appointment)
    elif current_user.role.upper() == "DOCTOR":
        query = db.query(Appointment).join(DoctorProfile).filter(
            DoctorProfile.user_id == current_user.id
        )
    else:
        query = db.query(Appointment).filter(Appointment.patient_id == current_user.id)

    appointments = query.order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc()).all()
    
    # Map additional fields
    results = []
    for app in appointments:
        res = AppointmentResponse.model_validate(app)
        doc = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()
        pat = db.query(User).filter(User.id == app.patient_id).first()
        
        if doc:
            res.doctor_name = doc.name
            res.specialization = doc.doctor_profile.specialization
        if pat:
            res.patient_name = pat.name
        results.append(res)
        
    return results


@router.put("/{id}/cancel")
def cancel_appointment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Cancel an appointment.
    Patients can cancel their own; Doctors can cancel their assigned ones; Admins can cancel any.
    """
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Authorize cancellation
    if current_user.role.upper() == "PATIENT" and app.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
    if current_user.role.upper() == "DOCTOR":
        doc_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        if not doc_profile or app.doctor_profile_id != doc_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")

    app.status = "CANCELLED"

    patient = db.query(User).filter(User.id == app.patient_id).first()
    doc_user = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()

    db.commit()

    if patient and doc_user:
        from app.models.google_connection import GoogleCalendarConnection
        doc_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == doc_user.id).first()
        pat_conn = db.query(GoogleCalendarConnection).filter(GoogleCalendarConnection.user_id == patient.id).first()

        try:
            from app.tasks.notification import send_cancellation_email
            send_cancellation_email.delay(
                patient.email,
                doc_user.email,
                patient.name,
                doc_user.name,
                str(app.appointment_date),
                app.start_time.strftime("%H:%M")
            )
        except Exception as e:
            logger.error(f"Failed to queue cancellation Celery task: {e}")

        doc_conn_id = doc_conn.id if doc_conn else None
        pat_conn_id = pat_conn.id if pat_conn else None
        if (doc_conn_id and app.doctor_google_event_id) or (pat_conn_id and app.patient_google_event_id):
            try:
                from app.tasks.calendar import delete_appointment_event_task
                delete_appointment_event_task.delay(
                    doctor_connection_id=doc_conn_id,
                    patient_connection_id=pat_conn_id,
                    doctor_event_id=app.doctor_google_event_id,
                    patient_event_id=app.patient_google_event_id
                )
            except Exception as e:
                logger.error(f"Failed to queue Google Calendar deletion Celery task: {e}")

    return {"message": "Appointment cancelled successfully"}


@router.put("/{id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    id: int,
    reschedule_in: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Reschedule an existing appointment to a new held slot.
    """
    # 1. Fetch original appointment
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # 2. Authorize
    if current_user.role.upper() == "PATIENT" and app.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reschedule this appointment")
    if current_user.role.upper() == "DOCTOR":
        doc_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        if not doc_profile or app.doctor_profile_id != doc_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to reschedule this appointment")

    # 3. Fetch new slot hold
    hold = db.query(SlotHold).filter(
        SlotHold.id == reschedule_in.new_hold_id,
        SlotHold.patient_id == app.patient_id
    ).with_for_update().first()

    if not hold:
        raise HTTPException(status_code=404, detail="New slot hold reservation not found")

    now_utc = datetime.now(timezone.utc)
    if hold.is_released or hold.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slot reservation has expired or has already been booked"
        )

    # 4. Perform reschedule
    app.appointment_date = hold.hold_date
    app.start_time = hold.start_time
    app.end_time = hold.end_time
    app.status = "RESCHEDULED"

    # Mark hold as released
    hold.is_released = True

    try:
        db.commit()
        db.refresh(app)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This slot was already booked. Please choose another slot."
        )

    # Trigger Google Calendar Reschedule Sync Task
    try:
        from app.tasks.calendar import sync_appointment_event_task
        sync_appointment_event_task.delay(app.id)
    except Exception as e:
        logger.error(f"Failed to queue Google Calendar reschedule sync Celery task: {e}")

    res = AppointmentResponse.model_validate(app)
    doc = db.query(User).join(DoctorProfile).filter(DoctorProfile.id == app.doctor_profile_id).first()
    pat = db.query(User).filter(User.id == app.patient_id).first()
    if doc:
        res.doctor_name = doc.name
        res.specialization = doc.doctor_profile.specialization
    if pat:
        res.patient_name = pat.name

    return res


@router.put("/{id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    id: int,
    complete_in: AppointmentComplete,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RoleChecker(["DOCTOR"]))
) -> Any:
    """
    Complete an appointment by submitting clinical notes and prescriptions.
    Restricted to Doctors. Automatically triggers post-visit AI summary generation.
    """
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    doc_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doc_profile or app.doctor_profile_id != doc_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to complete this appointment."
        )

    # 1. Clear existing prescriptions for this appointment
    db.query(Prescription).filter(Prescription.appointment_id == app.id).delete()

    # 2. Add new structured prescriptions
    for p_in in complete_in.prescriptions:
        db_prescription = Prescription(
            appointment_id=app.id,
            medicine_name=p_in.medicine_name,
            dosage=p_in.dosage,
            frequency=p_in.frequency,
            duration=p_in.duration,
            instructions=p_in.instructions
        )
        db.add(db_prescription)

    # 3. Update clinical notes and status
    app.clinical_notes = complete_in.clinical_notes
    app.status = "COMPLETED"

    db.commit()
    db.refresh(app)

    # Trigger medication reminders scheduler in Celery Beat
    try:
        from app.tasks.scheduler import schedule_medication_reminders
        schedule_medication_reminders.delay(app.id)
    except Exception as e:
        logger.error(f"Failed to queue medication reminders Celery task: {e}")

    # 4. Format a text line of prescriptions to pass to LLM post-visit generator
    pres_lines = []
    for p in app.prescriptions:
        line = f"{p.medicine_name} {p.dosage} ({p.frequency} for {p.duration})"
        if p.instructions:
            line += f" - Instructions: {p.instructions}"
        pres_lines.append(line)
    prescriptions_text = ", ".join(pres_lines)

    # 5. Trigger post-visit AI summary translation in background
    background_tasks.add_task(
        process_post_visit_ai_summary,
        app.id,
        app.clinical_notes,
        prescriptions_text
    )

    res = AppointmentResponse.model_validate(app)
    res.doctor_name = current_user.name
    res.specialization = doc_profile.specialization
    
    patient = db.query(User).filter(User.id == app.patient_id).first()
    if patient:
        res.patient_name = patient.name
        
    return res

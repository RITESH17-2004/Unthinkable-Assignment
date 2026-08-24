from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import get_password_hash
from app.core.database import get_db
from app.models.user import User
from app.models.doctor import DoctorProfile, WorkingHour, DoctorLeave
from app.models.appointment import Appointment
from app.schemas.appointment import LeaveConflictResponse, AppointmentConflictInfo
from app.schemas.doctor import (
    DoctorUserCreate,
    DoctorUserUpdate,
    DoctorUserResponse,
    WorkingHourCreate,
    WorkingHourResponse,
    DoctorLeaveCreate,
    DoctorLeaveResponse,
)

router = APIRouter()


@router.post("", response_model=DoctorUserResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(
    *,
    db: Session = Depends(get_db),
    doctor_in: DoctorUserCreate,
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
) -> Any:
    """
    Create a new Doctor user and their associated DoctorProfile.
    Restricted to Admins.
    """
    user = db.query(User).filter(User.email == doctor_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists."
        )

    # 1. Create User
    db_doctor = User(
        email=doctor_in.email,
        name=doctor_in.name,
        hashed_password=get_password_hash(doctor_in.password),
        role="DOCTOR",
        is_active=True
    )
    db.add(db_doctor)
    db.commit()
    db.refresh(db_doctor)

    # 2. Create Profile
    db_profile = DoctorProfile(
        user_id=db_doctor.id,
        specialization=doctor_in.specialization,
        slot_duration=doctor_in.slot_duration,
        bio=doctor_in.bio
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_doctor)  # Reload to populate relationship

    return db_doctor


@router.get("", response_model=List[DoctorUserResponse])
def read_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
) -> Any:
    """
    Retrieve all doctors and their profiles.
    Restricted to Admins.
    """
    doctors = db.query(User).filter(User.role == "DOCTOR").all()
    return doctors


@router.put("/{doctor_id}", response_model=DoctorUserResponse)
def update_doctor(
    *,
    db: Session = Depends(get_db),
    doctor_id: int,
    doctor_in: DoctorUserUpdate,
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
) -> Any:
    """
    Update a Doctor user details and their DoctorProfile.
    Restricted to Admins.
    """
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "DOCTOR").first()
    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Doctor not found"
        )

    # Update User model fields
    if doctor_in.name is not None:
        doctor.name = doctor_in.name
    if doctor_in.email is not None:
        # Check if email is taken
        existing_email = db.query(User).filter(User.email == doctor_in.email, User.id != doctor_id).first()
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="Email already registered to another user."
            )
        doctor.email = doctor_in.email
    if doctor_in.is_active is not None:
        doctor.is_active = doctor_in.is_active

    # Update Profile model fields
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        profile = DoctorProfile(user_id=doctor_id, specialization="General", slot_duration=30)
        db.add(profile)

    if doctor_in.specialization is not None:
        profile.specialization = doctor_in.specialization
    if doctor_in.slot_duration is not None:
        profile.slot_duration = doctor_in.slot_duration
    if doctor_in.bio is not None:
        profile.bio = doctor_in.bio

    db.commit()
    db.refresh(doctor)
    return doctor


# --- Schedule Configuration Endpoints ---

@router.get("/{doctor_id}/schedule", response_model=List[WorkingHourResponse])
def get_doctor_schedule_admin(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RoleChecker(["ADMIN", "DOCTOR"]))
) -> Any:
    """
    Get the schedule (working hours) of a specific doctor.
    Restricted to Admins and the Doctor themselves.
    """
    if current_user.role.upper() == "DOCTOR" and current_user.id != doctor_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view another doctor's schedule"
        )
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    return profile.working_hours


@router.post("/{doctor_id}/schedule", response_model=List[WorkingHourResponse])
def save_doctor_schedule(
    *,
    db: Session = Depends(get_db),
    doctor_id: int,
    schedule_in: List[WorkingHourCreate],
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
) -> Any:
    """
    Configure/replace a doctor's weekly working hours.
    Restricted to Admins.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Clear existing working hours
    db.query(WorkingHour).filter(WorkingHour.doctor_profile_id == profile.id).delete()

    # Add new hours
    db_hours = []
    for hour_in in schedule_in:
        db_hour = WorkingHour(
            doctor_profile_id=profile.id,
            day_of_week=hour_in.day_of_week,
            start_time=hour_in.start_time,
            end_time=hour_in.end_time,
            is_available=hour_in.is_available
        )
        db.add(db_hour)
        db_hours.append(db_hour)

    db.commit()
    return db_hours


# --- Leave Management Endpoints ---

@router.get("/{doctor_id}/leaves", response_model=List[DoctorLeaveResponse])
def get_doctor_leaves_admin(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RoleChecker(["ADMIN", "DOCTOR"]))
) -> Any:
    """
    Get all leave days configured for a specific doctor.
    Restricted to Admins and the Doctor themselves.
    """
    if current_user.role.upper() == "DOCTOR" and current_user.id != doctor_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view another doctor's leaves"
        )
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    return profile.leaves


@router.post("/{doctor_id}/leaves", response_model=LeaveConflictResponse)
def add_doctor_leave(
    *,
    db: Session = Depends(get_db),
    doctor_id: int,
    leave_in: DoctorLeaveCreate,
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
) -> Any:
    """
    Add a leave day for a doctor.
    Automatically detects active appointments on this date, cancels them, and logs them in response.
    Restricted to Admins.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Check if leave is already registered for this date
    existing_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_profile_id == profile.id,
        DoctorLeave.leave_date == leave_in.leave_date
    ).first()
    if existing_leave:
        raise HTTPException(status_code=400, detail="Leave is already registered for this date.")

    # Find conflicting active appointments
    conflicting_apps = db.query(Appointment).filter(
        Appointment.doctor_profile_id == profile.id,
        Appointment.appointment_date == leave_in.leave_date,
        Appointment.status != "CANCELLED"
    ).all()

    conflicting_list = []
    for app in conflicting_apps:
        # Mark as cancelled due to doctor leave
        app.status = "CANCELLED"
        
        # Get patient details
        patient = db.query(User).filter(User.id == app.patient_id).first()
        patient_name = patient.name if patient else "Unknown"
        patient_email = patient.email if patient else "Unknown"

        conflicting_list.append(
            AppointmentConflictInfo(
                id=app.id,
                patient_name=patient_name,
                patient_email=patient_email,
                appointment_date=app.appointment_date,
                start_time=app.start_time,
                end_time=app.end_time,
                status=app.status
            )
        )

    db_leave = DoctorLeave(
        doctor_profile_id=profile.id,
        leave_date=leave_in.leave_date,
        reason=leave_in.reason
    )
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)

    # Queue doctor leave alert emails in Celery
    doctor_name = profile.user.name if profile.user else "Doctor"
    for conflict in conflicting_list:
        if conflict.patient_email and conflict.patient_email != "Unknown":
            try:
                from app.tasks.notification import send_leave_notifications
                send_leave_notifications.delay(
                    conflict.patient_email,
                    conflict.patient_name,
                    doctor_name,
                    str(conflict.appointment_date),
                    conflict.start_time.strftime("%H:%M")
                )
            except Exception as e:
                try:
                    from app.tasks.notification import send_leave_notifications
                    send_leave_notifications(
                        conflict.patient_email,
                        conflict.patient_name,
                        doctor_name,
                        str(conflict.appointment_date),
                        conflict.start_time.strftime("%H:%M")
                    )
                except Exception as direct_err:
                    pass

    return LeaveConflictResponse(
        leave_id=db_leave.id,
        leave_date=db_leave.leave_date,
        reason=db_leave.reason,
        conflicting_appointments=conflicting_list
    )


@router.delete("/{doctor_id}/leaves/{leave_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_doctor_leave(
    *,
    db: Session = Depends(get_db),
    doctor_id: int,
    leave_id: int,
    current_user: User = Depends(deps.RoleChecker(["ADMIN"]))
):
    """
    Delete / remove a configured leave day.
    Restricted to Admins.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    db_leave = db.query(DoctorLeave).filter(
        DoctorLeave.id == leave_id,
        DoctorLeave.doctor_profile_id == profile.id
    ).first()

    if not db_leave:
        raise HTTPException(status_code=404, detail="Leave record not found")

    db.delete(db_leave)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

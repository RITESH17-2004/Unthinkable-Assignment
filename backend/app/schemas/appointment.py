from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, field_validator


# --- Time Slot Representation ---

class TimeSlot(BaseModel):
    start_time: time
    end_time: time
    is_available: bool
    is_held: bool


class AvailabilityResponse(BaseModel):
    doctor_profile_id: int
    appointment_date: date
    slots: List[TimeSlot]


# --- Slot Hold Schemas ---

class SlotHoldCreate(BaseModel):
    doctor_profile_id: int
    hold_date: date
    start_time: time
    end_time: time


class SlotHoldResponse(BaseModel):
    id: int
    doctor_profile_id: int
    hold_date: date
    start_time: time
    end_time: time
    expires_at: datetime

    class Config:
        from_attributes = True


# --- Appointment Booking Schemas ---

class AppointmentCreate(BaseModel):
    hold_id: int
    symptoms: Optional[str] = None


class AppointmentReschedule(BaseModel):
    new_hold_id: int


class PrescriptionResponse(BaseModel):
    id: int
    appointment_id: int
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None

    class Config:
        from_attributes = True


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_profile_id: int
    appointment_date: date
    start_time: time
    end_time: time
    status: str  # "BOOKED", "CANCELLED", "RESCHEDULED", "COMPLETED"
    symptoms: Optional[str] = None
    clinical_notes: Optional[str] = None
    prescriptions: List[PrescriptionResponse] = []
    
    # Pre-visit AI Summary fields
    ai_urgency_level: Optional[str] = None
    ai_chief_complaint: Optional[str] = None
    ai_suggested_questions: Optional[str] = None
    ai_pre_visit_status: Optional[str] = None
    
    # Post-visit AI Summary fields
    ai_patient_summary: Optional[str] = None
    ai_follow_up_instructions: Optional[str] = None
    ai_post_visit_status: Optional[str] = None
    
    # AI Tracking
    ai_model_info: Optional[str] = None
    
    # Extra helper fields for frontend convenience
    doctor_name: Optional[str] = None
    specialization: Optional[str] = None
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True


class PrescriptionCreate(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None

    @field_validator("medicine_name", "dosage", "frequency", "duration")
    @classmethod
    def check_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Medication field cannot be empty or blank")
        return v.strip()


class AppointmentComplete(BaseModel):
    clinical_notes: str
    prescriptions: List[PrescriptionCreate]

    @field_validator("clinical_notes")
    @classmethod
    def check_notes(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Clinical notes cannot be empty or blank")
        return v.strip()


# --- Leave Conflict Schemas ---

class AppointmentConflictInfo(BaseModel):
    id: int
    patient_name: str
    patient_email: str
    appointment_date: date
    start_time: time
    end_time: time
    status: str

    class Config:
        from_attributes = True


class LeaveConflictResponse(BaseModel):
    leave_id: int
    leave_date: date
    reason: Optional[str] = None
    conflicting_appointments: List[AppointmentConflictInfo] = []

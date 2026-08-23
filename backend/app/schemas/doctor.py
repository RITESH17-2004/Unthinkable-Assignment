from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, EmailStr


# --- Working Hours Schemas ---

class WorkingHourBase(BaseModel):
    day_of_week: int  # 0 = Monday, ..., 6 = Sunday
    start_time: time
    end_time: time
    is_available: bool = True


class WorkingHourCreate(WorkingHourBase):
    pass


class WorkingHourResponse(WorkingHourBase):
    id: int

    class Config:
        from_attributes = True


# --- Doctor Leave Schemas ---

class DoctorLeaveBase(BaseModel):
    leave_date: date
    reason: Optional[str] = None


class DoctorLeaveCreate(DoctorLeaveBase):
    pass


class DoctorLeaveResponse(DoctorLeaveBase):
    id: int

    class Config:
        from_attributes = True


# --- Doctor Profile Schemas ---

class DoctorProfileBase(BaseModel):
    specialization: str
    slot_duration: int = 30
    bio: Optional[str] = None


class DoctorProfileCreate(DoctorProfileBase):
    pass


class DoctorProfileUpdate(BaseModel):
    specialization: Optional[str] = None
    slot_duration: Optional[int] = None
    bio: Optional[str] = None


class DoctorProfileResponse(DoctorProfileBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True


# --- Doctor Account Admin Schemas ---

class DoctorUserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    specialization: str
    slot_duration: int = 30
    bio: Optional[str] = None


class DoctorUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    specialization: Optional[str] = None
    slot_duration: Optional[int] = None
    bio: Optional[str] = None


class DoctorUserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    doctor_profile: Optional[DoctorProfileResponse] = None

    class Config:
        from_attributes = True

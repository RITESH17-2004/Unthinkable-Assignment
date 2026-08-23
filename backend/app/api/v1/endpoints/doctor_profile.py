from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.database import get_db
from app.models.user import User
from app.models.doctor import DoctorProfile
from app.schemas.doctor import DoctorProfileResponse, DoctorProfileUpdate, DoctorUserResponse

router = APIRouter()


@router.get("/me", response_model=DoctorUserResponse)
def read_doctor_profile_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.RoleChecker(["DOCTOR"]))
) -> Any:
    """
    Get current logged-in doctor's profile and user account details.
    """
    # Simply return current user; relationship backref "doctor_profile"
    # will populate it automatically in response.
    return current_user


@router.put("/me/profile", response_model=DoctorProfileResponse)
def update_doctor_profile_me(
    *,
    db: Session = Depends(get_db),
    profile_in: DoctorProfileUpdate,
    current_user: User = Depends(deps.RoleChecker(["DOCTOR"]))
) -> Any:
    """
    Allow a doctor to update their own bio or slot duration.
    """
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found"
        )
    
    if profile_in.bio is not None:
        profile.bio = profile_in.bio
    if profile_in.slot_duration is not None:
        profile.slot_duration = profile_in.slot_duration
    if profile_in.specialization is not None:
        profile.specialization = profile_in.specialization

    db.commit()
    db.refresh(profile)
    return profile

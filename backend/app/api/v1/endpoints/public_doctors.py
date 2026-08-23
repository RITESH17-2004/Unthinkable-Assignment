from typing import Any, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.doctor import DoctorProfile
from app.schemas.doctor import DoctorUserResponse

router = APIRouter()


@router.get("", response_model=List[DoctorUserResponse])
def get_public_doctors(
    db: Session = Depends(get_db),
    specialization: Optional[str] = None
) -> Any:
    """
    Publicly retrieve list of all active doctors.
    Filterable by specialization (case-insensitive).
    Used by patients in the booking portal.
    """
    query = db.query(User).join(DoctorProfile).filter(
        User.role == "DOCTOR",
        User.is_active == True
    )

    if specialization:
        query = query.filter(DoctorProfile.specialization.ilike(f"%{specialization}%"))

    doctors = query.all()
    return doctors

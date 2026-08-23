from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, admin_doctors, doctor_profile, public_doctors

api_router = APIRouter()

# Include endpoints
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin_doctors.router, prefix="/admin/doctors", tags=["admin-doctors"])
api_router.include_router(doctor_profile.router, prefix="/doctor/profile", tags=["doctor-profile"])
api_router.include_router(public_doctors.router, prefix="/doctors", tags=["doctors"])

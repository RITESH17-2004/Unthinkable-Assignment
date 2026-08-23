from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import backref, relationship

from app.models.base import Base


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    specialization = Column(String, nullable=False, index=True)
    slot_duration = Column(Integer, default=30, nullable=False)  # in minutes
    bio = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref=backref("doctor_profile", uselist=False), lazy="joined")
    working_hours = relationship("WorkingHour", back_populates="doctor_profile", cascade="all, delete-orphan")
    leaves = relationship("DoctorLeave", back_populates="doctor_profile", cascade="all, delete-orphan")


class WorkingHour(Base):
    __tablename__ = "working_hours"

    id = Column(Integer, primary_key=True, index=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
    start_time = Column(Time, nullable=False)  # e.g., 09:00:00
    end_time = Column(Time, nullable=False)    # e.g., 17:00:00
    is_available = Column(Boolean, default=True, nullable=False)

    # Relationships
    doctor_profile = relationship("DoctorProfile", back_populates="working_hours")


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(Integer, primary_key=True, index=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_date = Column(Date, nullable=False)
    reason = Column(String, nullable=True)

    # Relationships
    doctor_profile = relationship("DoctorProfile", back_populates="leaves")

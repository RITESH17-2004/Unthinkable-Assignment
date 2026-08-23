from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, Time, func, text
from sqlalchemy.orm import relationship

from app.models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(String, default="BOOKED", nullable=False)  # "BOOKED", "CANCELLED", "RESCHEDULED", "COMPLETED"
    symptoms = Column(String, nullable=True)
    clinical_notes = Column(String, nullable=True)
    
    # Pre-visit AI Summary fields
    ai_urgency_level = Column(String, nullable=True)
    ai_chief_complaint = Column(String, nullable=True)
    ai_suggested_questions = Column(String, nullable=True)  # JSON serialized
    ai_pre_visit_status = Column(String, default="PENDING", nullable=True)
    
    # Post-visit AI Summary fields
    ai_patient_summary = Column(String, nullable=True)
    ai_follow_up_instructions = Column(String, nullable=True)
    ai_post_visit_status = Column(String, default="PENDING", nullable=True)
    
    # AI Tracking
    ai_model_info = Column(String, nullable=True)
    reminder_sent = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id], backref="patient_appointments")
    doctor_profile = relationship("DoctorProfile", foreign_keys=[doctor_profile_id], backref="doctor_appointments")
    prescriptions = relationship("Prescription", back_populates="appointment", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="appointment", cascade="all, delete-orphan")

    # Table arguments - Partial Unique Index to prevent double booking on active appointments
    __table_args__ = (
        Index(
            "idx_uniq_active_appointment",
            "doctor_profile_id",
            "appointment_date",
            "start_time",
            unique=True,
            postgresql_where=text("status != 'CANCELLED'")
        ),
    )


class SlotHold(Base):
    __tablename__ = "slot_holds"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    hold_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_released = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id], backref="slot_holds")
    doctor_profile = relationship("DoctorProfile", foreign_keys=[doctor_profile_id], backref="slot_holds")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    duration = Column(String, nullable=False)
    instructions = Column(String, nullable=True)

    # Relationships
    appointment = relationship("Appointment", back_populates="prescriptions")

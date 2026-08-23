from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    notification_type = Column(String, nullable=False)  # "CONFIRMATION", "CANCELLATION", "APPOINTMENT_REMINDER", "LEAVE_ALERT", "MEDICATION_REMINDER"
    recipient = Column(String, nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True, index=True)
    status = Column(String, default="PENDING", nullable=False)  # "PENDING", "PROCESSING", "SENT", "FAILED"
    retry_count = Column(Integer, default=0, nullable=False)
    error_details = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    appointment = relationship("Appointment", back_populates="notifications")

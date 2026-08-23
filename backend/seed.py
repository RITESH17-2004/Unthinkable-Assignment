import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to syspath to allow importing modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.doctor import DoctorProfile

def seed_database():
    print("Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        admin_email = "admin@caresync.com"
        admin = db.query(User).filter(User.email == admin_email).first()
        
        if not admin:
            print("Creating default Admin account...")
            hashed_pw = get_password_hash("admin123")
            admin_user = User(
                email=admin_email,
                name="System Administrator",
                hashed_password=hashed_pw,
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Default Admin account created successfully!")
            print(f"Email: {admin_email}")
            print("Password: admin123")
        else:
            print("Admin account already exists.")
            
        # Check if a doctor already exists for testing
        doctor_email = "doctor@caresync.com"
        doctor = db.query(User).filter(User.email == doctor_email).first()
        
        if not doctor:
            print("Creating default Doctor account and profile...")
            hashed_pw = get_password_hash("doctor123")
            doctor_user = User(
                email=doctor_email,
                name="John House",
                hashed_password=hashed_pw,
                role="DOCTOR",
                is_active=True
            )
            db.add(doctor_user)
            db.commit()
            db.refresh(doctor_user)
            
            # Create Doctor Profile
            profile = DoctorProfile(
                user_id=doctor_user.id,
                specialization="Diagnostic Medicine",
                slot_duration=30,
                bio="Head of Diagnostic Medicine. Specializes in solving medical mysteries."
            )
            db.add(profile)
            db.commit()
            print("Default Doctor account and profile created successfully!")
            print(f"Email: {doctor_email}")
            print("Password: doctor123")
        else:
            # Check if doctor has a profile, create it if missing
            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first()
            if not profile:
                print("Default doctor exists but has no profile. Creating Doctor Profile...")
                profile = DoctorProfile(
                    user_id=doctor.id,
                    specialization="Diagnostic Medicine",
                    slot_duration=30,
                    bio="Head of Diagnostic Medicine. Specializes in solving medical mysteries."
                )
                db.add(profile)
                db.commit()
                print("Doctor Profile linked successfully!")
            else:
                print("Doctor account and profile already exist.")
            
    except Exception as e:
        print(f"An error occurred during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

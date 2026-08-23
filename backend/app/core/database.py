from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# For PostgreSQL, we create the engine.
# Supabase uses transaction pooling on port 6543, which works fine with standard connections,
# but we disable statement cache for pgbouncer compatibility if using transaction pooling.
# Since we might use standard session pool or transaction pool, we can set up standard options.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """
    Dependency generator for DB sessions.
    Ensures that the session is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

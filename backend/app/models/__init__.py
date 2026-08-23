# Import all models here so that Alembic can auto-detect them.
from app.models.base import Base
from app.models.user import User

__all__ = ["Base", "User"]

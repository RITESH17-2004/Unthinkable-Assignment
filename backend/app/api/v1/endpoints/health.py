from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db

router = APIRouter()


@router.get("")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint to verify database connectivity.
    Executes a simple 'SELECT 1' query on PostgreSQL.
    """
    try:
        # Run a simple query to verify the connection
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "healthy"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "unhealthy",
                "database": f"error: {str(e)}"
            }
        )

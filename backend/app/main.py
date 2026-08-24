from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Healthcare Appointment & Follow-up Manager",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS setup
allow_origins = [str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS] if settings.BACKEND_CORS_ORIGINS else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root path redirect or info
@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "health_check_url": f"{settings.API_V1_STR}/health"
    }


# Include V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

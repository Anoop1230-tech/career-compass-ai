"""Central configuration. Reads values from .env so secrets and
environment-specific settings never live in source code."""
import os

from dotenv import load_dotenv

load_dotenv()  # loads backend/.env into environment variables


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Career Compass AI API")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./career_compass.db")
    # Comma-separated list -> Python list, ignoring empty entries
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]


settings = Settings()

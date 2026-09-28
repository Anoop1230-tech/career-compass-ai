"""Central configuration. Reads values from .env so secrets and
environment-specific settings never live in source code."""
import os
import secrets

from dotenv import load_dotenv

load_dotenv()  # loads backend/.env into environment variables


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Career Compass AI API")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./career_compass.db")
    CORS_ORIGINS: list[str] = _split(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

    # Signs login tokens. Must be long, random and secret.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    JWT_ALGORITHM: str = "HS256"
    AUTH_COOKIE_NAME: str = "cc_session"

    # Brute-force protection for login/register (per IP address)
    AUTH_RATE_LIMIT: int = int(os.getenv("AUTH_RATE_LIMIT", "10"))
    AUTH_RATE_WINDOW_SECONDS: int = int(os.getenv("AUTH_RATE_WINDOW_SECONDS", "60"))

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()

if not settings.SECRET_KEY or settings.SECRET_KEY == "change-me":
    if settings.is_production:
        raise RuntimeError("SECRET_KEY must be set to a long random value in production.")
    # Development fallback: random per start (users get logged out on restart)
    settings.SECRET_KEY = secrets.token_urlsafe(48)

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

    # Failed logins per account (email), from any IP, before that account is paused
    ACCOUNT_RATE_LIMIT: int = int(os.getenv("ACCOUNT_RATE_LIMIT", "5"))
    ACCOUNT_RATE_WINDOW_SECONDS: int = int(os.getenv("ACCOUNT_RATE_WINDOW_SECONDS", "900"))

    # Number of reverse proxies in front of the app that append to X-Forwarded-For.
    # 0 = use the direct connection address (local dev). Render/Heroku/one Nginx = 1.
    TRUSTED_PROXY_HOPS: int = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))

    # Mentor chat messages per user per minute
    MENTOR_RATE_LIMIT: int = int(os.getenv("MENTOR_RATE_LIMIT", "30"))

    # Public address of the website, used in password reset emails
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")
    PASSWORD_RESET_MINUTES: int = int(os.getenv("PASSWORD_RESET_MINUTES", "30"))
    # Reset emails per address per hour (stops using the form to spam someone)
    PASSWORD_RESET_RATE_LIMIT: int = int(os.getenv("PASSWORD_RESET_RATE_LIMIT", "3"))

    # Sign in with Google (OAuth client of type "Web application" in Google Cloud).
    # Redirect URI to register there: {APP_BASE_URL}/api/auth/google/callback. Both empty = button hidden.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()

    # Outgoing email (password reset). Without SMTP_HOST, development logs the link instead.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "Career Compass AI <no-reply@localhost>")
    SMTP_STARTTLS: bool = os.getenv("SMTP_STARTTLS", "true").lower() == "true"
    # Built-in daily exam-reminder email job (runs inside the web server; no separate cron needed).
    # It only sends when SMTP_HOST is set. Off in tests.
    REMINDER_JOB: bool = os.getenv("REMINDER_JOB", "true").lower() == "true"

    # Serve the built frontend (frontend/dist) from this server. On by default in production.
    SERVE_FRONTEND: bool = os.getenv("SERVE_FRONTEND", "").lower() == "true" or (
        os.getenv("SERVE_FRONTEND") is None and os.getenv("ENVIRONMENT", "").lower() == "production"
    )

    # Load datasets/*.csv into the database on startup when they change
    AUTO_SEED: bool = os.getenv("AUTO_SEED", "true").lower() == "true"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()

if not settings.SECRET_KEY or settings.SECRET_KEY == "change-me":
    if settings.is_production:
        raise RuntimeError("SECRET_KEY must be set to a long random value in production.")
    # Development fallback: random per start (users get logged out on restart)
    settings.SECRET_KEY = secrets.token_urlsafe(48)

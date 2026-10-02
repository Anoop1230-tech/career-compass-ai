"""Account endpoints: register, login, logout, current user, change and reset password.

Sessions: every login token carries the user's `token_version`. Logging out,
changing or resetting the password increases it, so tokens issued before that
(on this or any other device) stop working immediately, not when they expire.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import PasswordResetToken, User
from schemas import (
    ChangePasswordRequest, LoginRequest, PasswordResetConfirm, PasswordResetRequest, RegisterRequest, UserOut,
)
from services import mailer
from services.auth import (
    authenticate, create_access_token, get_current_user, get_optional_user, hash_password, revoke_sessions,
    verify_password,
)
from services.rate_limit import RateLimiter, account_limiter, limit_auth_attempts

router = APIRouter(prefix="/auth", tags=["auth"])

reset_limiter = RateLimiter(
    settings.PASSWORD_RESET_RATE_LIMIT, 3600,
    message="Too many reset requests for this email. Please wait an hour and try again.",
)
RESET_ACCEPTED = {"detail": "If an account exists for this email, we have sent a link to reset the password."}
INVALID_RESET = HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Please request a new one.")


def _set_session_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=create_access_token(user.id, user.token_version or 0),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,  # JavaScript can't read it (XSS protection)
        secure=settings.is_production,  # HTTPS only in production
        samesite="lax",  # not sent on cross-site POSTs (CSRF protection)
        path="/api",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path="/api")


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, created_at=user.created_at, has_profile=user.profile is not None)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def _discard_reset_tokens(db: Session, user_id: int) -> None:
    db.execute(update(PasswordResetToken)
               .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
               .values(used_at=datetime.now(timezone.utc)))


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth_attempts)],
)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    user = User(email=data.email, password_hash=hash_password(data.password), token_version=0)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups with the same email at the same moment
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    db.refresh(user)

    _set_session_cookie(response, user)  # log in straight after sign-up
    return _user_out(user)


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit_auth_attempts)])
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    account_key = f"login:{data.email}"
    # Checked for unknown emails too, so the reply doesn't reveal which accounts exist
    account_limiter.check(account_key, consume=False)
    user = authenticate(db, data.email, data.password)
    if user is None:
        account_limiter.hit(account_key)
        # Same message for wrong email and wrong password: don't reveal which one
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    account_limiter.clear(account_key)
    _set_session_cookie(response, user)
    return _user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    """Signs out everywhere: the token in this cookie (and any copy of it) stops working."""
    if user is not None:
        revoke_sessions(user)
        db.commit()
    _clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.post("/change-password", response_model=UserOut, dependencies=[Depends(limit_auth_attempts)])
def change_password(data: ChangePasswordRequest, response: Response,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account_key = f"login:{user.email}"  # wrong guesses here count like failed logins
    account_limiter.check(account_key, consume=False)
    if not verify_password(data.current_password, user.password_hash):
        account_limiter.hit(account_key)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if data.new_password == data.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a new password that is different from the current one.")
    user.password_hash = hash_password(data.new_password)
    revoke_sessions(user)  # other devices are signed out
    _discard_reset_tokens(db, user.id)
    db.commit()
    _set_session_cookie(response, user)  # this device stays logged in with a fresh token
    return _user_out(user)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED,
             dependencies=[Depends(limit_auth_attempts)])
def request_password_reset(data: PasswordResetRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Always gives the same answer, so it can't be used to find out who has an account."""
    reset_limiter.check(f"reset:{data.email}")
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None:
        return RESET_ACCEPTED

    _discard_reset_tokens(db, user.id)  # only the newest link works
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_MINUTES),
    ))
    db.commit()

    link = f"{settings.APP_BASE_URL}/reset-password#token={token}"  # fragment: never sent to servers or logs
    body = (
        "Someone (hopefully you) asked to reset the password for your Career Compass AI account.\n\n"
        f"Open this link within {settings.PASSWORD_RESET_MINUTES} minutes to choose a new password:\n{link}\n\n"
        "If you did not ask for this, ignore this email; your password stays the same."
    )
    background.add_task(mailer.send, user.email, "Reset your Career Compass AI password", body)
    return RESET_ACCEPTED


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT,
             dependencies=[Depends(limit_auth_attempts)])
def confirm_password_reset(data: PasswordResetConfirm, response: Response, db: Session = Depends(get_db)):
    record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash_token(data.token)))
    now = datetime.now(timezone.utc)
    if record is None or record.used_at is not None or _utc(record.expires_at) <= now:
        raise INVALID_RESET
    user = db.get(User, record.user_id)
    if user is None:
        raise INVALID_RESET

    user.password_hash = hash_password(data.new_password)
    revoke_sessions(user)  # whoever had the old password is signed out
    _discard_reset_tokens(db, user.id)
    db.commit()
    account_limiter.clear(f"login:{user.email}")  # the owner proved control of the mailbox
    _clear_session_cookie(response)

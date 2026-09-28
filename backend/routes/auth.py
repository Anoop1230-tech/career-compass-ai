"""Account endpoints: register, login, logout, current user."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User
from schemas import LoginRequest, RegisterRequest, UserOut
from services.auth import authenticate, create_access_token, get_current_user, hash_password
from services.rate_limit import limit_auth_attempts

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=create_access_token(user_id),
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,  # JavaScript can't read it (XSS protection)
        secure=settings.is_production,  # HTTPS only in production
        samesite="lax",  # not sent on cross-site POSTs (CSRF protection)
        path="/api",
    )


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, created_at=user.created_at, has_profile=user.profile is not None)


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth_attempts)],
)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups with the same email at the same moment
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    db.refresh(user)

    _set_session_cookie(response, user.id)  # log in straight after sign-up
    return _user_out(user)


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit_auth_attempts)])
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    if user is None:
        # Same message for wrong email and wrong password: don't reveal which one
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    _set_session_cookie(response, user.id)
    return _user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path="/api")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_out(user)

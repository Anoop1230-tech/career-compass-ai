"""Password hashing and login tokens.

- Passwords are hashed with Argon2 (a slow, memory-hard algorithm designed
  for passwords). The plain password is never stored or logged.
- After login the server issues a signed JWT inside an httpOnly cookie:
  JavaScript cannot read it, which protects it from XSS token theft.
"""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User

password_hasher = PasswordHash.recommended()  # Argon2id

# Used when the email does not exist, so a failed login takes the same time
# either way (attackers can't discover which emails are registered by timing).
_DUMMY_HASH = password_hasher.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password, password_hash)
    except Exception:  # malformed hash etc.: treat as wrong password
        return False


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def create_access_token(user_id: int, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> tuple[int, int] | None:
    """Returns (user_id, token_version) for a valid token, else None."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],  # fixed list: blocks "alg: none" attacks
            options={"require": ["exp", "sub"]},
        )
        if payload.get("type") != "access":
            return None
        version = payload.get("ver", 0)
        if not isinstance(version, int) or isinstance(version, bool):
            return None
        return int(payload["sub"]), version
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


def revoke_sessions(user: User) -> None:
    """Invalidate every login token issued to this user so far (caller commits)."""
    user.token_version = (user.token_version or 0) + 1


NOT_LOGGED_IN = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please log in to continue.")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """FastAPI dependency: returns the logged-in user or responds 401."""
    user = get_optional_user(request, db)
    if user is None:
        raise NOT_LOGGED_IN
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Like get_current_user, but returns None for visitors instead of 401
    (for pages that work without login and get better when logged in)."""
    token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    decoded = decode_access_token(token) if token else None
    if decoded is None:
        return None
    user_id, version = decoded
    user = db.get(User, user_id)  # None if the account was deleted after the token was issued
    if user is None or (user.token_version or 0) != version:
        return None  # logged out, password changed or reset since this token was issued
    return user

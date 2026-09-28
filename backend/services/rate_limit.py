"""Simple in-memory rate limiter (sliding window, per client IP).

Good enough for a single server. When deploying multiple servers,
replace it with a shared store such as Redis."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

from config import settings


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a minute and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = RateLimiter(settings.AUTH_RATE_LIMIT, settings.AUTH_RATE_WINDOW_SECONDS)


def limit_auth_attempts(request: Request) -> None:
    """FastAPI dependency for login/register endpoints."""
    client = request.client.host if request.client else "unknown"
    auth_limiter.check(client)

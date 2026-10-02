"""Simple in-memory rate limiter (sliding window).

Two protections for accounts:
- per client IP on login/register (stops one machine hammering the API)
- per account on failed logins (stops slow password guessing spread over many IPs)

Behind a reverse proxy or hosting platform every request arrives from the
proxy's address, so the real client IP is read from X-Forwarded-For, but only
as many hops as TRUSTED_PROXY_HOPS says (anything further left can be forged
by the client).

Good enough for a single server. When deploying multiple servers,
replace it with a shared store such as Redis."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

from config import settings


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, message: str = "Too many attempts. Please wait a minute and try again."):
        self.limit = limit
        self.window = window_seconds
        self.message = message
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, hits: deque, now: float) -> None:
        while hits and now - hits[0] > self.window:
            hits.popleft()

    def check(self, key: str, consume: bool = True) -> None:
        """Raise 429 if `key` is over the limit; otherwise count this hit (unless consume=False)."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            self._prune(hits, now)
            if len(hits) >= self.limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=self.message,
                    headers={"Retry-After": str(retry_after)},
                )
            if consume:
                hits.append(now)
            elif not hits:
                del self._hits[key]  # don't keep empty entries for every email ever tried

    def hit(self, key: str) -> None:
        """Count one event (e.g. a failed login) without checking."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            self._prune(hits, now)
            hits.append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_limiter = RateLimiter(settings.AUTH_RATE_LIMIT, settings.AUTH_RATE_WINDOW_SECONDS)
account_limiter = RateLimiter(
    settings.ACCOUNT_RATE_LIMIT,
    settings.ACCOUNT_RATE_WINDOW_SECONDS,
    message="Too many failed attempts for this account. Please wait a few minutes and try again.",
)


def client_ip(request: Request) -> str:
    """The visitor's IP address. With TRUSTED_PROXY_HOPS=N, the Nth address from
    the right of X-Forwarded-For is used (each trusted proxy appends one)."""
    direct = request.client.host if request.client else "unknown"
    hops = settings.TRUSTED_PROXY_HOPS
    if hops <= 0:
        return direct
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if len(forwarded) >= hops:
        return forwarded[-hops]
    return forwarded[0] if forwarded else direct


def limit_auth_attempts(request: Request) -> None:
    """FastAPI dependency for login/register endpoints."""
    auth_limiter.check(client_ip(request))

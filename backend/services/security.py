"""HTTP hardening middleware: security headers and a request size limit."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# The frontend is plain React (no inline scripts, no external fonts/CDNs), so
# a strict policy works. Inline styles are used for a few small layout values.
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; "
    "object-src 'none'"
)
# The API docs page (/docs) loads Swagger UI from a CDN, so it gets a looser policy
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

MAX_BODY_BYTES = 256 * 1024  # largest real request (a full profile) is a few KB


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, hsts: bool = False):
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next) -> Response:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request is too large."}, status_code=413)
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if not request.url.path.startswith(DOCS_PATHS):
            h.setdefault("Content-Security-Policy", CSP)
        if request.url.path.startswith("/api/"):
            # Personal data must not be stored by shared caches or the browser's back/forward cache
            h.setdefault("Cache-Control", "no-store")
        if self.hsts:
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

"""Serves the built React app (frontend/dist) from FastAPI in production,
so the whole product runs as ONE server on one origin: no CORS, the login
cookie works as-is, and the security headers cover the pages too.

- /assets/* : hashed build files, cached for a year (their names change on every build)
- /api/*    : never handled here
- anything else: a real file from dist if it exists, otherwise index.html
  (React Router then shows the page, or its own "Page not found")."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

DEFAULT_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def mount_frontend(app: FastAPI, dist: Path = DEFAULT_DIST) -> bool:
    dist = dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        return False

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/") or path == "api":
            raise HTTPException(404, "Not Found")
        target = (dist / path).resolve()
        # Only files inside dist (blocks ../ tricks)
        if path and target.is_file() and dist in target.parents:
            cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
            return FileResponse(target, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return True

"""Résumé upload (login required): read skills from a PDF. Nothing is saved; the user confirms first."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from engine.catalog_data import get_catalog, normalize
from engine.resume import MAX_BYTES, ResumeError, extract_text, find_skills
from models import User
from services.auth import get_current_user

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/skills")
async def resume_skills(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/pdf":
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Please upload a PDF file.")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The file is larger than 2 MB.")
    data = bytearray()
    async for chunk in request.stream():  # stop early instead of buffering an oversized body
        data += chunk
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="The file is larger than 2 MB.")
    try:
        text, pages = extract_text(bytes(data))
    except ResumeError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    skills = find_skills(get_catalog(db), text)
    have = {normalize(s.get("name", "")) for s in ((user.profile.skills or []) if user.profile else [])}
    for s in skills:
        s["in_profile"] = normalize(s["name"]) in have or normalize(s["matched"]) in have
    return {"pages": pages, "skills": skills, "has_profile": user.profile is not None}

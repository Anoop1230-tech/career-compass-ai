"""Career Mentor chat API (login required; history is private to each user)."""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from engine.catalog_data import get_catalog
from engine.context import build_context
from engine.mentor import SUGGESTIONS_DEFAULT, answer
from models import MentorMessage, RoadmapProgress, User
from routes.next_steps import REFERENCE_DATA_MISSING
from services import llm
from services.auth import get_current_user
from services.rate_limit import RateLimiter
from engine import mentor_hi
from services.lang import request_lang

router = APIRouter(prefix="/mentor", tags=["mentor"])
mentor_limiter = RateLimiter(settings.MENTOR_RATE_LIMIT, 60)
HISTORY_LIMIT = 50


class ChatIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


def _out(m: MentorMessage) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat(), **(m.meta or {})}


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db),
            lang: str = Depends(request_lang)):
    rows = db.scalars(select(MentorMessage).where(MentorMessage.user_id == user.id)
                      .order_by(MentorMessage.id.desc()).limit(HISTORY_LIMIT)).all()
    return {"messages": [_out(m) for m in reversed(rows)], "suggestions": mentor_hi.SUGGESTIONS if lang == "hi" else SUGGESTIONS_DEFAULT,
            "llm_enabled": llm.configured()}


@router.post("/chat")
async def chat(body: ChatIn, user: User = Depends(get_current_user), db: Session = Depends(get_db),
               lang: str = Depends(request_lang)):
    """Database work runs in the threadpool (the session is synchronous); the optional
    language-model call is awaited, so a slow provider does not block other requests."""
    mentor_limiter.check(f"user:{user.id}")
    reply, summary = await run_in_threadpool(_draft, body, user, db, lang)
    text, source = reply.text, "local"
    if summary is not None:
        # For a question the engine could not ground, let the model answer it directly;
        # otherwise it only rephrases the grounded draft. Either falls back to local text.
        if reply.intent == "fallback":
            answered = await llm.answer(body.message, summary)
            if answered:
                text, source = answered, "llm"
        else:
            rewritten = await llm.rephrase(body.message, reply.text, summary)
            if rewritten:
                text, source = rewritten, "llm"
    return await run_in_threadpool(_save, body, user, db, reply, text, source)


def _draft(body: ChatIn, user: User, db: Session, lang: str = "en"):
    catalog = get_catalog(db)
    if catalog.is_empty:
        raise REFERENCE_DATA_MISSING
    ctx = build_context(db, catalog, user.id)

    # Remember the last career talked about, for follow-ups like "what skills do I need?"
    last = db.scalar(select(MentorMessage).where(MentorMessage.user_id == user.id, MentorMessage.role == "mentor")
                     .order_by(MentorMessage.id.desc()).limit(1))
    remembered = (last.meta or {}).get("career_id") if last else None
    target = db.scalar(select(RoadmapProgress).where(RoadmapProgress.user_id == user.id, RoadmapProgress.is_target))

    message = mentor_hi.understand(catalog, body.message) if lang == "hi" else body.message
    reply = answer(catalog, ctx, message, db, remembered_career=remembered,
                   target_career=target.career_id if target else None,
                   done_skills=set(target.completed_skill_ids or []) if target else set())
    if lang == "hi":
        # Hindi templates; the optional language model only rephrases English drafts
        return mentor_hi.localize(reply, catalog, ctx), None
    summary = None
    if llm.configured():
        summary = (f"stage: {catalog.stage_name(ctx.stage.stage_id) if ctx.stage.stage_id else 'unknown'}; "
                   f"goals: {', '.join(ctx.goals) or 'none'}; interests: {', '.join(ctx.interests) or 'none'}")
    return reply, summary


def _save(body: ChatIn, user: User, db: Session, reply, text: str, source: str) -> dict:
    user_msg = MentorMessage(user_id=user.id, role="user", content=body.message, meta={})
    meta = {**reply.as_dict(), "source": source}
    meta.pop("text")
    mentor_msg = MentorMessage(user_id=user.id, role="mentor", content=text, meta=meta)
    db.add_all([user_msg, mentor_msg])
    db.commit()
    return {"message": _out(user_msg), "reply": _out(mentor_msg)}


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(delete(MentorMessage).where(MentorMessage.user_id == user.id))
    db.commit()

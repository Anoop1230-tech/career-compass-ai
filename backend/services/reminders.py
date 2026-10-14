"""Send due exam reminder emails. Run once a day (cron / Task Scheduler):

    python -m services.reminders            # send
    python -m services.reminders --dry-run  # print what would be sent

Without SMTP configured, development prints the email to the log (see services/mailer.py).
"""
import argparse
import logging
import sys
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from engine.catalog_data import get_catalog
from engine.reminders import due, email_body, exam_events
from models import ExamFollow, User
from services import mailer

logger = logging.getLogger("career_compass.reminders")


def run(db: Session, today: date | None = None, dry_run: bool = False) -> dict:
    today = today or date.today()
    catalog = get_catalog(db)
    follows = list(db.scalars(select(ExamFollow).where(ExamFollow.email.is_(True)).order_by(ExamFollow.user_id)))
    by_user: dict[int, list[tuple[ExamFollow, list[dict]]]] = {}
    for f in follows:
        exam = catalog.exams.get(f.exam_id)
        if exam is None:
            continue
        events = due(exam_events(exam, catalog.exam_dates.get(f.exam_id, []), today), today, set(f.reminded or []))
        if events:
            by_user.setdefault(f.user_id, []).append((f, events))
    sent = failed = 0
    for user_id, items in by_user.items():
        user = db.get(User, user_id)
        if user is None:
            continue
        events = sorted((e for _, evs in items for e in evs), key=lambda e: e["start"])
        name = user.profile.full_name.split(" ")[0] if getattr(user, "profile", None) and user.profile.full_name else ""
        body = email_body(name, events, settings.APP_BASE_URL)
        if dry_run:
            print(f"--- to {user.email}\n{body}")
            continue
        if mailer.send(user.email, "Coming up: your exam dates", body):
            sent += 1
            for f, evs in items:
                f.reminded = [*(f.reminded or []), *(e["key"] for e in evs)][-200:]
        else:
            failed += 1
    if not dry_run:
        db.commit()
    return {"users": len(by_user), "sent": sent, "failed": failed}


_last_run: date | None = None


def run_if_due(today: date | None = None) -> dict | None:
    """Run the job at most once per calendar day in this process. Sent events are remembered per follow,
    so a restart (or two instances) never emails the same event twice."""
    global _last_run
    today = today or date.today()
    if _last_run == today:
        return None
    _last_run = today
    if not mailer.configured():
        logger.info("Reminder job skipped: email is not configured (SMTP_HOST).")
        return None
    from database import SessionLocal
    with SessionLocal() as db:
        result = run(db, today)
    logger.info("Reminder job: %s", result)
    return result


async def daily_loop(check_every_seconds: int = 3 * 3600) -> None:
    """Background task started by the app: checks every few hours, sends once a day."""
    import asyncio
    while True:
        try:
            await asyncio.to_thread(run_if_due)
        except Exception:  # never let the job crash the web server
            logger.exception("Reminder job failed")
        await asyncio.sleep(check_every_seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    from database import SessionLocal
    with SessionLocal() as db:
        result = run(db, dry_run=args.dry_run)
    print(result)
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())

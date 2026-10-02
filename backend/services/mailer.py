"""Outgoing email (currently only password reset links).

With SMTP_HOST set, mail is sent over SMTP (STARTTLS by default). Without it:
- development/test: the message is written to the log so you can click the link;
- production: nothing is sent and an error is logged (the link is NOT logged,
  because logs are often readable by more people than the mailbox owner).
"""
import logging
import smtplib
from email.message import EmailMessage

from config import settings

logger = logging.getLogger("career_compass.mail")

# Tests replace this list's contents to inspect what would be sent
outbox: list[EmailMessage] | None = None


def configured() -> bool:
    return bool(settings.SMTP_HOST)


def send(to: str, subject: str, body: str) -> bool:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    if outbox is not None:
        outbox.append(message)
        return True
    if not configured():
        if settings.is_production:
            logger.error("Email is not configured (SMTP_HOST); could not send '%s'.", subject)
            return False
        logger.warning("Email not configured; development copy of '%s' to %s:\n%s", subject, to, body)
        return True
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except (smtplib.SMTPException, OSError):
        logger.exception("Sending email '%s' failed.", subject)
        return False

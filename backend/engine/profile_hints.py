"""Profile hints from what we already know at sign-up: the email address and, after
"Continue with Google", the name on the Google account.

Nothing here is guessed loosely. A name is only taken from an email address that is
clearly "first.last" (two or three alphabetic parts joined by . _ or -), and an
institution only when the email domain is the same site as an official college or
university website in datasets/. The user sees every hint in the form and can change it.
"""
import re
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import College, University

# Second-level suffixes where the registrable domain has three labels (iitb.ac.in, not ac.in)
_TWO_PART_SUFFIXES = {
    "ac.in", "edu.in", "res.in", "ernet.in", "gov.in", "nic.in", "org.in", "co.in", "net.in",
    "ac.uk", "co.uk", "edu.au", "ac.nz",
}
_NAME_PART = re.compile(r"[a-z]{2,20}")


def registrable_domain(host: str) -> str:
    labels = [part for part in host.lower().strip(".").split(".") if part]
    if len(labels) >= 3 and ".".join(labels[-2:]) in _TWO_PART_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def name_from_email(email: str) -> str | None:
    """'asha.verma@x.com' -> 'Asha Verma'. None when the address isn't clearly a name."""
    local = email.split("@", 1)[0].split("+", 1)[0].lower()
    parts = [part for part in re.split(r"[._-]+", local) if part and not part.isdigit()]
    if not 2 <= len(parts) <= 3 or not all(_NAME_PART.fullmatch(part) for part in parts):
        return None
    return " ".join(part.capitalize() for part in parts)


def institution_from_email(db: Session, email: str) -> str | None:
    """Official college or university whose website shares the email's domain."""
    if "@" not in email:
        return None
    domain = registrable_domain(email.rsplit("@", 1)[1])
    if "." not in domain:
        return None
    matches = []
    for model in (College, University):
        for name, url in db.execute(select(model.name, model.official_url)):
            host = urlparse(url).hostname or ""
            if host and registrable_domain(host) == domain:
                matches.append(name)
    unique = sorted(set(matches))
    return unique[0] if len(unique) == 1 else None  # two institutions on one domain: don't pick


def profile_hints(db: Session, user) -> dict:
    hints: dict = {}
    if user.display_name:
        hints["full_name"] = {"value": user.display_name, "source": "google"}
    elif name := name_from_email(user.email):
        hints["full_name"] = {"value": name, "source": "email"}
    if institution := institution_from_email(db, user.email):
        hints["institution"] = {"value": institution, "source": "email"}
    return hints

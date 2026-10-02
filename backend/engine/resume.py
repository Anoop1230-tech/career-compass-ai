"""Résumé reading: extract text from a PDF and find catalog skills in it.

Nothing is stored here: the text stays in memory for this request only, and the user confirms which
skills to add to their profile (saved through the normal PUT /api/profile).

Matching uses whole words/phrases of every skill name and alias (casefolded, hyphens = spaces).
Very short aliases (1–2 characters, e.g. "R", "C") are only matched in their exact original case
as a separate token, so ordinary words do not trigger them.
"""
import io
import logging
import re

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from engine.catalog_data import Catalog, normalize

logger = logging.getLogger("career_compass.resume")
MAX_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_PAGES = 10
MAX_CHARS = 100_000
# Catalog skill categories -> profile form categories
PROFILE_CATEGORY = {"programming": "programming", "technical": "technical", "domain": "domain",
                    "management": "management", "soft": "communication", "math": "technical"}


class ResumeError(ValueError):
    """The file cannot be read as a text PDF (message is shown to the user)."""


def extract_text(data: bytes) -> tuple[str, int]:
    if len(data) > MAX_BYTES:
        raise ResumeError("The file is larger than 2 MB.")
    if not data.startswith(b"%PDF-"):
        raise ResumeError("This is not a PDF file.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("This PDF is password-protected.")
        pages = reader.pages[:MAX_PAGES]
        text = "\n".join((page.extract_text() or "") for page in pages)[:MAX_CHARS]
    except ResumeError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError, OSError) as exc:
        logger.info("Unreadable PDF: %s", type(exc).__name__)
        raise ResumeError("This PDF could not be read.") from exc
    if not text.strip():
        raise ResumeError("No text was found in this PDF (it may be a scanned image).")
    return text, len(pages)


def find_skills(catalog: Catalog, text: str) -> list[dict]:
    cleaned = re.sub(r"[^0-9A-Za-z+#.\-]+", " ", text)
    flat = " " + normalize(cleaned) + " "
    tokens = {t.strip(".") for t in re.findall(r"[0-9A-Za-z+#.]+", text)}
    found: dict[str, str] = {}
    for skill in catalog.skills.values():
        for label in [skill.name, *skill.aliases]:
            key = normalize(label)
            if not key:
                continue
            if len(key) <= 2:
                hit = label in tokens
            else:
                hit = re.search(rf"(?<![0-9a-z+#]){re.escape(key)}(?![0-9a-z+#])", flat) is not None
            if hit:
                found.setdefault(skill.skill_id, label)
                break
    out = [{"skill_id": sid, "name": catalog.skills[sid].name, "matched": label,
            "category": PROFILE_CATEGORY.get(catalog.skills[sid].category, "other")}
           for sid, label in found.items()]
    return sorted(out, key=lambda s: s["name"].casefold())

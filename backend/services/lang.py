"""Response language for catalog text.

The frontend sends `Accept-Language: hi` when the user picks Hindi. Catalog names and descriptions
then come from the translations table (draft Hindi), falling back to English field by field.
"""
from fastapi import Request
from sqlalchemy.orm import Session

from engine.catalog_data import get_catalog

SUPPORTED = ("en", "hi")


def request_lang(request: Request) -> str:
    """First language tag of Accept-Language if supported, else English."""
    header = request.headers.get("accept-language", "")
    for part in header.split(","):
        tag = part.split(";")[0].strip().lower().split("-")[0]
        if tag in SUPPORTED:
            return tag
    return "en"


class Localizer:
    def __init__(self, db: Session, lang: str):
        self.lang = lang
        self.table = get_catalog(db).translations if lang == "hi" else {}

    def __call__(self, entity_type: str, entity_id: str, field: str, english):
        return self.table.get((entity_type, entity_id, field), english)

    def career(self, data: dict) -> dict:
        """Translate name/description of a career dict in place (keys career_id, name, description)."""
        if self.table and data.get("career_id"):
            cid = data["career_id"]
            data["name"] = self("career", cid, "name", data.get("name"))
            if "description" in data:
                data["description"] = self("career", cid, "description", data.get("description"))
        return data

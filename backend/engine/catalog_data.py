"""In-memory snapshot of the reference data used by all engines.

The catalog is small (a few hundred rows), so the engines work on plain
Python dicts instead of issuing many small queries. The snapshot is cached
and rebuilt automatically whenever the seed fingerprint changes (i.e. the
CSV files were reloaded)."""
from dataclasses import dataclass, field
from threading import Lock

from sqlalchemy import select
from sqlalchemy.orm import Session

from catalog.models import (
    Career,
    CareerPath,
    CareerSkill,
    CareerTransition,
    CatalogMeta,
    EducationPath,
    Exam,
    Skill,
    Stage,
)

LEVEL_ORDER = ["school", "course", "diploma", "ug", "pg", "doctoral", "professional"]


@dataclass
class Catalog:
    stages: dict[str, Stage] = field(default_factory=dict)
    skills: dict[str, Skill] = field(default_factory=dict)
    careers: dict[str, Career] = field(default_factory=dict)
    exams: dict[str, Exam] = field(default_factory=dict)
    career_skills: dict[str, list[CareerSkill]] = field(default_factory=dict)  # career_id -> links
    education_paths: list[EducationPath] = field(default_factory=list)
    career_paths: list[CareerPath] = field(default_factory=list)
    transitions: list[CareerTransition] = field(default_factory=list)
    skill_lookup: dict[str, str] = field(default_factory=dict)  # casefolded name/alias -> skill_id

    @property
    def is_empty(self) -> bool:
        return not self.careers

    def paths_from(self, stage_id: str) -> list[EducationPath]:
        return [p for p in self.education_paths if p.from_stage_id == stage_id]

    def paths_to_career(self, career_id: str) -> list[EducationPath]:
        return [p for p in self.education_paths if p.to_type == "career" and p.to_id == career_id]

    def skill_name(self, skill_id: str) -> str:
        skill = self.skills.get(skill_id)
        return skill.name if skill else skill_id

    def stage_name(self, stage_id: str) -> str:
        stage = self.stages.get(stage_id)
        return stage.name if stage else stage_id

    def career_name(self, career_id: str) -> str:
        career = self.careers.get(career_id)
        return career.name if career else career_id


def normalize(text: str) -> str:
    return " ".join(text.casefold().replace("-", " ").replace("_", " ").split())


def _build(request_db: Session) -> Catalog:
    # A separate session: expunging must never detach the request's own objects (e.g. the user)
    with Session(bind=request_db.get_bind(), expire_on_commit=False) as db:
        return _load(db)


def _load(db: Session) -> Catalog:
    cat = Catalog()
    cat.stages = {s.stage_id: s for s in db.scalars(select(Stage))}
    cat.skills = {s.skill_id: s for s in db.scalars(select(Skill))}
    cat.careers = {c.career_id: c for c in db.scalars(select(Career))}
    cat.exams = {e.exam_id: e for e in db.scalars(select(Exam))}
    for link in db.scalars(select(CareerSkill)):
        cat.career_skills.setdefault(link.career_id, []).append(link)
    for links in cat.career_skills.values():
        links.sort(key=lambda l: (not l.is_mandatory, -l.importance, l.skill_id))
    cat.education_paths = list(db.scalars(select(EducationPath).order_by(EducationPath.path_id)))
    cat.career_paths = list(db.scalars(select(CareerPath).order_by(CareerPath.path_id)))
    cat.transitions = list(db.scalars(select(CareerTransition).order_by(CareerTransition.transition_id)))
    for skill in cat.skills.values():
        for label in [skill.name, *skill.aliases]:
            cat.skill_lookup.setdefault(normalize(label), skill.skill_id)
    # Detach from the session so the cached objects are plain read-only data
    db.expunge_all()
    return cat


_cache: dict[str, Catalog] = {}
_lock = Lock()


def get_catalog(db: Session) -> Catalog:
    meta = db.get(CatalogMeta, "fingerprint")
    key = meta.value if meta else "<unseeded>"
    with _lock:
        cached = _cache.get(key)
        if cached is not None and key != "<unseeded>":
            return cached
    catalog = _build(db)
    with _lock:
        _cache.clear()
        _cache[key] = catalog
    return catalog


def clear_cache() -> None:
    with _lock:
        _cache.clear()

"""Read-only catalog API: stages, skills, careers and exams.

The reference data is small (tens to a few hundred rows), so filtering by
list fields (stored as JSON) is done in Python after one query. This keeps
the code identical on SQLite and PostgreSQL. Revisit if the data grows to
thousands of rows."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from catalog.models import (
    Career, CareerPath, CareerSkill, CareerTransition, EducationPath, Exam, SalaryRange, Skill, Stage,
)
from catalog.schemas import (
    SalaryOut,
    CareerDetail,
    CareerLink,
    CareerList,
    CareerSkillOut,
    CareerSummary,
    EntryPath,
    ExamOut,
    ExamSummary,
    SkillOut,
    StageOut,
    TransitionOut,
)
from database import get_db

router = APIRouter(prefix="/catalog", tags=["catalog"])

SearchText = Query(default=None, max_length=60, description="Case-insensitive search")
LEVEL_ORDER = ["school", "course", "diploma", "ug", "pg", "doctoral", "professional"]


def _matches(query: str | None, *fields) -> bool:
    if not query:
        return True
    needle = query.strip().casefold()
    return any(needle in (value or "").casefold() for field in fields for value in (field if isinstance(field, list) else [field]))


@router.get("/stages", response_model=list[StageOut])
def list_stages(level: str | None = Query(default=None, max_length=20), db: Session = Depends(get_db)):
    stages = db.scalars(select(Stage)).all()
    stages = [s for s in stages if level is None or s.level == level]
    return sorted(stages, key=lambda s: (LEVEL_ORDER.index(s.level) if s.level in LEVEL_ORDER else 99, s.name))


@router.get("/skills", response_model=list[SkillOut])
def list_skills(
    q: str | None = SearchText,
    category: str | None = Query(default=None, max_length=20),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    skills = db.scalars(select(Skill).order_by(Skill.name)).all()
    result = [
        s for s in skills
        if (category is None or s.category == category) and _matches(q, s.name, s.aliases)
    ]
    # Exact and prefix matches first, so "py" suggests Python before "Spy..."
    if q:
        needle = q.strip().casefold()
        result.sort(key=lambda s: (
            s.name.casefold() != needle,
            not s.name.casefold().startswith(needle),
            needle not in s.name.casefold(),  # alias-only matches last
            s.name,
        ))
    return result[:limit]


@router.get("/careers", response_model=CareerList)
def list_careers(
    q: str | None = SearchText,
    domain: str | None = Query(default=None, max_length=60),
    stage: str | None = Query(default=None, max_length=40, description="Only careers typical for this stage"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    careers = db.scalars(select(Career).order_by(Career.name)).all()
    domains = sorted({c.domain for c in careers})
    filtered = [
        c for c in careers
        if (domain is None or c.domain == domain)
        and (stage is None or stage in c.typical_stage_ids)
        and _matches(q, c.name, c.domain, c.sub_domain, c.description)
    ]
    items = [CareerSummary.model_validate(c) for c in filtered[offset : offset + limit]]
    return CareerList(total=len(filtered), items=items, domains=domains)


@router.get("/careers/{career_id}", response_model=CareerDetail)
def career_detail(career_id: str, db: Session = Depends(get_db)):
    career = db.scalar(
        select(Career)
        .where(Career.career_id == career_id)
        .options(selectinload(Career.skill_links).selectinload(CareerSkill.skill))
    )
    if career is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Career not found.")

    # Lookup tables for names (small; one query each)
    stages = {s.stage_id: s for s in db.scalars(select(Stage))}
    exams = {e.exam_id: e for e in db.scalars(select(Exam))}
    names = dict(db.execute(select(Career.career_id, Career.name)).all())
    skill_names = dict(db.execute(select(Skill.skill_id, Skill.name)).all())

    entry_paths = [
        EntryPath(
            path_id=p.path_id,
            from_stage_id=p.from_stage_id,
            from_stage_name=stages[p.from_stage_id].name,
            required_exams=[ExamSummary.model_validate(exams[e]) for e in p.required_exam_ids if e in exams],
            eligibility_summary=p.eligibility_summary,
            advantages=p.advantages,
            limitations=p.limitations,
            verified=p.verified,
            source_url=p.source_url,
        )
        for p in db.scalars(
            select(EducationPath)
            .where(EducationPath.to_type == "career", EducationPath.to_id == career_id)
            .order_by(EducationPath.path_id)
        )
    ]

    def link(path: CareerPath, other_id: str) -> CareerLink:
        return CareerLink(
            career_id=other_id,
            name=names.get(other_id, other_id),
            transition_type=path.transition_type,
            typical_years_experience=path.typical_years_experience,
            notes=path.notes,
        )

    next_careers = [link(p, p.to_career_id) for p in db.scalars(
        select(CareerPath).where(CareerPath.from_career_id == career_id).order_by(CareerPath.path_id))]
    previous_careers = [link(p, p.from_career_id) for p in db.scalars(
        select(CareerPath).where(CareerPath.to_career_id == career_id).order_by(CareerPath.path_id))]

    transitions_in = [
        TransitionOut(
            transition_id=t.transition_id,
            from_type=t.from_type,
            from_id=t.from_id,
            from_name=(stages[t.from_id].name if t.from_type == "education" and t.from_id in stages
                       else names.get(t.from_id, t.from_id)),
            difficulty=t.difficulty,
            estimated_months_min=t.estimated_months_min,
            estimated_months_max=t.estimated_months_max,
            required_skills=[skill_names.get(s, s) for s in t.required_skill_ids],
            required_qualifications=t.required_qualifications,
            steps=t.steps,
            notes=t.notes,
        )
        for t in db.scalars(
            select(CareerTransition)
            .where(CareerTransition.to_career_id == career_id)
            .order_by(CareerTransition.transition_id)
        )
    ]

    skills = [
        CareerSkillOut(
            skill_id=l.skill_id, name=l.skill.name, category=l.skill.category, importance=l.importance,
            proficiency_required=l.proficiency_required, is_mandatory=l.is_mandatory,
        )
        # mandatory first, then most important, then alphabetical
        for l in sorted(career.skill_links, key=lambda l: (not l.is_mandatory, -l.importance, l.skill.name))
    ]

    return CareerDetail(
        **CareerSummary.model_validate(career).model_dump(),
        typical_stages=[StageOut.model_validate(stages[s]) for s in career.typical_stage_ids if s in stages],
        riasec_codes=career.riasec_codes,
        key_aptitudes=career.key_aptitudes,
        personality_fit=career.personality_fit,
        work_style=career.work_style,
        salary_note=career.salary_note,
        onet_code=career.onet_code,
        source_url=career.source_url,
        last_verified=career.last_verified,
        skills=skills,
        entry_paths=entry_paths,
        next_careers=next_careers,
        previous_careers=previous_careers,
        transitions_in=transitions_in,
        salaries=[SalaryOut.model_validate(s) for s in db.scalars(
            select(SalaryRange).where(SalaryRange.career_id == career_id).order_by(SalaryRange.monthly_min))],
    )


@router.get("/exams", response_model=list[ExamOut])
def list_exams(
    q: str | None = SearchText,
    level: str | None = Query(default=None, max_length=30),
    stage: str | None = Query(default=None, max_length=40, description="Exams open to this stage"),
    db: Session = Depends(get_db),
):
    exams = db.scalars(select(Exam).order_by(Exam.name)).all()
    return [
        e for e in exams
        if (level is None or e.exam_level == level)
        and (stage is None or stage in e.eligible_stage_ids)
        and _matches(q, e.name, e.full_name, e.purpose, e.conducting_body)
    ]


@router.get("/exams/{exam_id}", response_model=ExamOut)
def exam_detail(exam_id: str, db: Session = Depends(get_db)):
    exam = db.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found.")
    return exam

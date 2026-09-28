"""Roadmap Generator: a stage-by-stage plan to a target career that skips
what you already know.

Stages (empty ones are left out):
  0. Study route      – degrees still needed (from the Transition Engine)
  1. Foundations      – maths and programming gaps
  2. Core skills      – the remaining core (mandatory) skills
  3. Specialise       – helpful, non-core skills
  4. Prove it         – projects and portfolio using the skills above
  5. Get in           – exams, internships and applications
Skills you have (profile level, or marked done on the roadmap) are listed
as skipped, so the plan only contains real work."""
from engine.catalog_data import Catalog
from engine.context import UserContext
from engine.skill_gap import skill_gap
from engine.transitions import education_route

FOUNDATION_CATEGORIES = {"math", "programming"}
PROJECT_WEEKS = 6
APPLY_WEEKS = 4


class UnknownCareer(LookupError):
    pass


def _skill(i: dict, done: set[str]) -> dict:
    return {"skill_id": i["skill_id"], "name": i["name"], "from_level": i["current_level"], "to_level": i["required_level"],
            "weeks": i["weeks"], "is_mandatory": i["is_mandatory"], "done": i["skill_id"] in done,
            "description": i["description"]}


def build_roadmap(catalog: Catalog, ctx: UserContext, career_id: str, done: set[str] | None = None) -> dict:
    career = catalog.careers.get(career_id)
    if career is None:
        raise UnknownCareer(career_id)
    done = set(done or ())
    gap = skill_gap(catalog, ctx, career_id)
    gaps = gap["learn_first"] + gap["learn_next"]

    def pending(items):
        return [i for i in items if i["skill_id"] not in done]

    foundations = [i for i in gap["learn_first"] if i["category"] in FOUNDATION_CATEGORIES]
    core = [i for i in gap["learn_first"] if i["category"] not in FOUNDATION_CATEGORIES]
    helpful = gap["learn_next"]
    stages = []

    route = education_route(catalog, ctx.stage.stage_id, career_id) if ctx.stage.stage_id else None
    study = [s for s in (route or []) if s["type"] == "education"]
    if study:
        stages.append({
            "key": "study", "title": "Study route",
            "summary": "Degrees usually needed before this career. Learn the skills below alongside your studies.",
            "weeks": int(sum((s["years"] or 0) * 52 for s in study)),
            "items": [{"kind": "study", "title": s["title"], "detail": s["eligibility"], "years": s["years"],
                       "exams": s["exams"]} for s in study],
        })

    for key, title, summary, items in [
        ("foundations", "Foundations", "Maths and programming basics that the rest builds on.", foundations),
        ("core", "Core skills", f"The skills most {career.name} roles expect.", core),
        ("specialise", "Specialise", "Helpful skills that make you stand out.", helpful),
    ]:
        if items:
            stages.append({
                "key": key, "title": title, "summary": summary,
                "weeks": sum(i["weeks"] for i in pending(items)),
                "items": [{"kind": "skill", **_skill(i, done)} for i in items],
            })

    project_skills = [i["name"] for i in (core or foundations or helpful)][:4] or \
        [catalog.skill_name(l.skill_id) for l in catalog.career_skills.get(career_id, [])][:4]
    stages.append({
        "key": "projects", "title": "Prove it",
        "summary": "Employers look for evidence. Build work you can show and explain.",
        "weeks": PROJECT_WEEKS,
        "items": [
            {"kind": "task", "title": "Build 2–3 projects on real problems",
             "detail": "Use " + ", ".join(project_skills) + "." if project_skills else "Use the skills above."},
            {"kind": "task", "title": "Publish your work",
             "detail": "Put code or case studies online (e.g. GitHub or a portfolio page) with a short write-up of each."},
        ],
    })

    exams = []
    for path in catalog.paths_to_career(career_id):
        if not ctx.stage.stage_id or path.from_stage_id == ctx.stage.stage_id:
            for exam_id in path.required_exam_ids:
                exam = catalog.exams.get(exam_id)
                if exam and exam_id not in {e["exam_id"] for e in exams}:
                    exams.append({"exam_id": exam.exam_id, "name": exam.name, "official_url": exam.official_url,
                                  "typical_month": exam.typical_month})
    get_in = [{"kind": "task", "title": "Apply for internships or entry roles",
               "detail": f"Target {career.name} or closely related roles; tailor your CV to the skills above."}]
    if exams:
        get_in.insert(0, {"kind": "exam", "title": "Prepare for the entrance or recruitment exam",
                          "detail": "Check the official dates and syllabus early.", "exams": exams})
    stages.append({"key": "apply", "title": "Get in", "summary": "Turn your skills into an offer.",
                   "weeks": APPLY_WEEKS, "items": get_in})

    for order, stage in enumerate(stages, 1):
        stage["order"] = order
    skill_total = len(gaps)
    skill_done = sum(1 for i in gaps if i["skill_id"] in done)
    return {
        "career": {"career_id": career.career_id, "name": career.name, "domain": career.domain,
                   "description": career.description},
        "stage": {"stage_id": ctx.stage.stage_id, "name": catalog.stage_name(ctx.stage.stage_id)} if ctx.stage.stage_id else None,
        "stages": stages,
        "skipped": [{"name": i["name"], "level": i["current_level"]} for i in gap["have"]],
        "progress": {"done": skill_done, "total": skill_total,
                     "percent": round(skill_done / skill_total * 100) if skill_total else 100},
        "total_weeks": sum(s["weeks"] for s in stages if s["key"] != "study"),
        "study_years": sum((i["years"] or 0) for s in stages if s["key"] == "study" for i in s["items"]),
        "hours_per_week": gap["estimate"]["hours_per_week"],
        "personalised": ctx.has_profile,
    }

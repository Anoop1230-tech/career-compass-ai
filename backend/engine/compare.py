"""Side-by-side comparison of 2–3 careers: education, route time, exams, skills and (with a profile) fit.

Everything comes from the datasets; nothing is estimated beyond the recorded study durations."""
from engine.catalog_data import LEVEL_ORDER, Catalog
from engine.context import UserContext
from engine.fit import skill_coverage
from engine.recommend import reachable_careers, score_career
from engine.transitions import education_route

MIN_CAREERS, MAX_CAREERS = 2, 3


class UnknownCareer(Exception):
    pass


def _route(catalog: Catalog, stage_id: str | None, career_id: str) -> dict | None:
    """Shortest study route from the stage and its total recorded years (None if not reachable)."""
    if not stage_id:
        return None
    steps = education_route(catalog, stage_id, career_id)
    if steps is None:
        return {"reachable": False, "steps": [], "years": None}
    years = sum(s["years"] or 0 for s in steps if s["type"] == "education")
    return {"reachable": True, "years": round(years, 1),
            "steps": [{"type": s["type"], "id": s["id"], "title": s["title"], "years": s["years"]} for s in steps]}


def _one(catalog: Catalog, ctx: UserContext, career_id: str, stage_id: str | None, reach: dict) -> dict:
    c = catalog.careers[career_id]
    links = catalog.career_skills.get(career_id, [])
    paths = catalog.paths_to_career(career_id)
    # Exams on the way in: on the step into the career, or on the step into the stage before it (e.g. NEET for MBBS)
    entry_ids = {p.from_stage_id for p in paths}
    before = [p for p in catalog.education_paths if p.to_type == "education" and p.to_id in entry_ids]
    exam_ids = sorted({e for p in [*paths, *before] for e in p.required_exam_ids if e in catalog.exams},
                      key=lambda e: catalog.exams[e].name)
    entry = sorted({p.from_stage_id for p in paths}, key=lambda s: (
        LEVEL_ORDER.index(catalog.stages[s].level) if catalog.stages[s].level in LEVEL_ORDER else 9, catalog.stage_name(s)))
    moves = [p for p in catalog.career_paths if p.from_career_id == career_id]
    item = {
        "career_id": c.career_id, "name": c.name, "domain": c.domain, "sub_domain": c.sub_domain,
        "description": c.description, "min_education_level": c.min_education_level,
        "work_style": list(c.work_style), "riasec_codes": list(c.riasec_codes),
        "core_skills": [catalog.skill_name(l.skill_id) for l in links if l.is_mandatory],
        "other_skills": [catalog.skill_name(l.skill_id) for l in links if not l.is_mandatory],
        "entry_stages": [{"stage_id": s, "name": catalog.stage_name(s)} for s in entry],
        "exams": [{"exam_id": e, "name": catalog.exams[e].name, "official_url": catalog.exams[e].official_url}
                  for e in exam_ids],
        "next_careers": [{"career_id": p.to_career_id, "name": catalog.career_name(p.to_career_id)} for p in moves],
        "route": _route(catalog, stage_id, career_id),
        "fit": None,
    }
    if ctx.has_profile:
        scored = score_career(catalog, ctx, c, reach)
        item["fit"] = {"score": round(scored["score"], 1),
                       "readiness": round(skill_coverage(catalog, ctx, career_id)["score"], 1)}
    return item


def compare(catalog: Catalog, ctx: UserContext, career_ids: list[str], stage_id: str | None = None) -> dict:
    ids = list(dict.fromkeys(career_ids))  # keep order, drop repeats
    for cid in ids:
        if cid not in catalog.careers:
            raise UnknownCareer(cid)
    stage_id = stage_id if stage_id in catalog.stages else ctx.stage.stage_id
    reach = reachable_careers(catalog, stage_id)
    items = [_one(catalog, ctx, cid, stage_id, reach) for cid in ids]
    # Skills every compared career needs: learning them keeps all options open
    sets = [set(i["core_skills"]) | set(i["other_skills"]) for i in items]
    shared = sorted(set.intersection(*sets)) if sets else []
    return {
        "careers": items,
        "shared_skills": shared,
        "stage": {"stage_id": stage_id, "name": catalog.stage_name(stage_id)} if stage_id else None,
        "personalised": ctx.has_profile,
    }

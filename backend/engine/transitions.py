"""Transition Engine and Dream Career Checker: "I am X, can I become Y?"

Looks for, in this order:
1. an education route: the shortest chain of study steps in the datasets
   (e.g. Class 12 PCM -> B.Tech CSE -> Data Scientist), with exams and years;
2. a recorded switch (career_transition_paths.csv) from the stage or career;
3. a career progression chain (career_paths.csv), e.g. Software Engineer ->
   Senior -> Engineering Manager.
Then adds the personal skill gap and gives one verdict with the reasons.

Verdicts:
  direct      your stage/career leads straight there
  achievable  a known route exists with extra study or a planned switch
  hard        no recorded route; possible through self-study and projects,
              but expect a long, uncertain path
  not_direct  the usual entry needs a different education base first
Nothing is guaranteed: time ranges are typical, not promises."""
from collections import deque

from engine.catalog_data import LEVEL_ORDER, Catalog
from engine.context import UserContext
from engine.recommend import reachable_careers
from engine.skill_gap import skill_gap


LEVEL_WORDS = {"school": "school", "diploma": "diploma", "ug": "bachelor's", "pg": "master's",
               "doctoral": "doctoral", "professional": "work experience"}


class UnknownTarget(LookupError):
    pass


def _level(level: str | None) -> int:
    return LEVEL_ORDER.index(level) if level in LEVEL_ORDER else -1


def _exam_list(catalog: Catalog, ids: list[str]) -> list[dict]:
    return [{"exam_id": e.exam_id, "name": e.name, "official_url": e.official_url}
            for e in (catalog.exams.get(i) for i in ids) if e]


def education_route(catalog: Catalog, stage_id: str, career_id: str, max_hops: int = 4) -> list[dict] | None:
    """Shortest chain of study steps from a stage to a career (BFS), or None."""
    if stage_id not in catalog.stages:
        return None
    queue = deque([(stage_id, [])])
    seen = {stage_id}
    while queue:
        current, steps = queue.popleft()
        if len(steps) >= max_hops:
            continue
        for p in catalog.paths_from(current):
            step = {
                "type": p.to_type, "id": p.to_id,
                "title": catalog.career_name(p.to_id) if p.to_type == "career" else catalog.stage_name(p.to_id),
                "eligibility": p.eligibility_summary, "years": p.duration_years,
                "exams": _exam_list(catalog, p.required_exam_ids),
                "advantages": p.advantages, "limitations": p.limitations, "verified": p.verified,
            }
            if p.to_type == "career" and p.to_id == career_id:
                return steps + [step]
            if p.to_type == "education" and p.to_id not in seen:
                seen.add(p.to_id)
                stage = catalog.stages[p.to_id] if p.to_id in catalog.stages else None
                if step["years"] is None and stage is not None:
                    step["years"] = stage.typical_duration_years
                queue.append((p.to_id, steps + [step]))
    return None


def career_chain(catalog: Catalog, from_career: str, to_career: str, max_hops: int = 3) -> list[dict] | None:
    queue = deque([(from_career, [])])
    seen = {from_career}
    while queue:
        current, steps = queue.popleft()
        if len(steps) >= max_hops:
            continue
        for p in catalog.career_paths:
            if p.from_career_id != current or p.to_career_id in seen:
                continue
            step = {"type": "career", "id": p.to_career_id, "title": catalog.career_name(p.to_career_id),
                    "transition_type": p.transition_type, "years_experience": p.typical_years_experience,
                    "skills": [catalog.skill_name(s) for s in p.required_skill_ids], "notes": p.notes}
            if p.to_career_id == to_career:
                return steps + [step]
            seen.add(p.to_career_id)
            queue.append((p.to_career_id, steps + [step]))
    return None


def recorded_switch(catalog: Catalog, from_type: str, from_id: str, career_id: str):
    kind = "education" if from_type == "stage" else "career"
    return next((t for t in catalog.transitions
                 if t.from_type == kind and t.from_id == from_id and t.to_career_id == career_id), None)


def _alternatives(catalog: Catalog, stage_id: str | None, target) -> list[dict]:
    """Related careers (same sub-domain, then domain) that are directly reachable."""
    reach = reachable_careers(catalog, stage_id) if stage_id else {}
    related = [c for c in catalog.careers.values() if c.career_id != target.career_id and (
        c.sub_domain == target.sub_domain or c.domain == target.domain)]
    related.sort(key=lambda c: (c.sub_domain != target.sub_domain, reach.get(c.career_id, 9), c.name))
    return [{"career_id": c.career_id, "name": c.name,
             "why": "Directly reachable from your stage" if reach.get(c.career_id) == 1 else
             f"Same area ({c.sub_domain or c.domain})"}
            for c in related if reach.get(c.career_id, 9) <= 2][:3]


def check_transition(catalog: Catalog, ctx: UserContext, to_career: str,
                     from_stage: str | None = None, from_career: str | None = None) -> dict:
    target = catalog.careers.get(to_career)
    if target is None:
        raise UnknownTarget(to_career)
    if from_stage and from_stage not in catalog.stages:
        raise UnknownTarget(from_stage)
    if from_career and from_career not in catalog.careers:
        raise UnknownTarget(from_career)

    reasons, blockers = [], []
    route = education_route(catalog, from_stage, to_career) if from_stage else None
    switch = None
    chain = None
    if from_career:
        switch = recorded_switch(catalog, "career", from_career, to_career)
        chain = career_chain(catalog, from_career, to_career)
    if switch is None and from_stage:
        switch = recorded_switch(catalog, "stage", from_stage, to_career)

    same = from_career == to_career
    months_min = months_max = None
    if same:
        verdict = "direct"
        reasons.append("You are already in this career. Look at the next roles it leads to.")
    elif (route and len(route) == 1) or (chain and len(chain) == 1):
        verdict = "direct"
        reasons.append("Your current " + ("stage" if route and len(route) == 1 else "role") + " leads straight to this career.")
    elif route or switch or chain:
        verdict = "achievable"
        if route:
            study = [s for s in route if s["type"] == "education"]
            years = sum(s["years"] or 0 for s in study)
            n = len(study)
            reasons.append(f"A known route exists with {n} study step{'s' if n != 1 else ''}"
                           + (f" (about {years:g} years)." if years else "."))
            months_min = months_max = int(years * 12) if years else None
        if switch:
            reasons.append(f"People commonly make this switch: {switch.difficulty} effort, about "
                           f"{switch.estimated_months_min}–{switch.estimated_months_max} months.")
            if months_min is None or (switch.estimated_months_max or 0) < months_min:
                months_min, months_max = switch.estimated_months_min, switch.estimated_months_max
        if chain and not route:
            reasons.append(f"A usual career progression gets there in {len(chain)} moves.")
    else:
        stage = catalog.stages.get(from_stage) if from_stage else None
        needs_degree = stage is not None and _level(stage.level) < _level(target.min_education_level)
        # From school with no study route recorded: the stream itself does not lead there
        if needs_degree or (stage is not None and stage.level == "school"):
            verdict = "not_direct"
            blockers.append(f"No recorded study route from {stage.name} leads to this career; it usually needs a "
                            "different subject base or a higher degree first.")
        else:
            verdict = "hard"
            reasons.append("No recorded route from here. It can still be possible through self-study, projects and "
                           "entry roles, but expect a long and uncertain path.")

    gap = skill_gap(catalog, ctx, to_career)
    extra_skills = []
    if switch:
        missing_ids = [s for s in switch.required_skill_ids if ctx.skills.get(s, 0) == 0]
        extra_skills = [catalog.skill_name(s) for s in missing_ids]
    stage_obj = catalog.stages.get(from_stage) if from_stage else None
    if stage_obj and _level(stage_obj.level) < _level(target.min_education_level) and verdict != "not_direct":
        blockers.append(f"Most employers expect at least a {LEVEL_WORDS.get(target.min_education_level, target.min_education_level)} degree for this career.")
    for step in route or []:
        for exam in step["exams"]:
            blockers.append(f"{step['title']} usually needs {exam['name']}. Check the official eligibility.")

    return {
        "from": {
            "stage": {"stage_id": from_stage, "name": catalog.stage_name(from_stage)} if from_stage else None,
            "career": {"career_id": from_career, "name": catalog.career_name(from_career)} if from_career else None,
        },
        "target": {"career_id": target.career_id, "name": target.name, "domain": target.domain,
                   "description": target.description, "min_education_level": target.min_education_level},
        "verdict": verdict,
        "reasons": reasons,
        "blockers": list(dict.fromkeys(blockers)),
        "time": {"months_min": months_min, "months_max": months_max,
                 "skill_weeks": gap["estimate"]["core_weeks"]},
        "education_route": route,
        "switch": {
            "difficulty": switch.difficulty, "months_min": switch.estimated_months_min,
            "months_max": switch.estimated_months_max, "steps": switch.steps, "notes": switch.notes,
            "skills_missing": extra_skills, "qualifications": switch.required_qualifications,
        } if switch else None,
        "career_chain": chain,
        "skills": {"readiness": gap["readiness"], "core_ready": gap["core_ready"], "core_total": gap["core_total"],
                   "learn_first": [i["name"] for i in gap["learn_first"]][:6]},
        "alternatives": _alternatives(catalog, from_stage, target) if verdict in {"hard", "not_direct"} else [],
    }

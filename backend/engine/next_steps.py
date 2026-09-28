"""Next Step Engine: "I am here -> what can I realistically do next?"

Input: a catalog stage (e.g. EDU_BTECH_CSE) and, optionally, the user's context.
Output: every next step recorded in the datasets from that stage, each with
eligibility, time, exams (with official links), advantages, limitations and
one concrete next action. Nothing is invented: if the data does not know a
value it is left empty and the UI says so.

Ranking is a light, explainable relevance score from the profile (goals,
interests, skills). Without a profile the order is the dataset order."""
from dataclasses import dataclass

from catalog.models import EducationPath
from engine.catalog_data import Catalog
from engine.context import UserContext
from engine.fit import GOAL_LABELS, goal_matches_career, interest_matches, skill_coverage


class UnknownStage(LookupError):
    pass


@dataclass
class Ranked:
    points: float
    reasons: list[str]


def _exam(catalog: Catalog, exam_id: str) -> dict | None:
    e = catalog.exams.get(exam_id)
    if e is None:
        return None
    return {
        "exam_id": e.exam_id, "name": e.name, "full_name": e.full_name, "official_url": e.official_url,
        "typical_month": e.typical_month, "frequency": e.frequency, "verified": e.verified,
        "last_verified": e.last_verified.isoformat(),
    }


def _opens(catalog: Catalog, stage_id: str) -> dict:
    """What a further education step leads to (one step ahead)."""
    careers, education = [], []
    for p in catalog.paths_from(stage_id):
        if p.to_type == "career" and p.to_id in catalog.careers:
            careers.append({"id": p.to_id, "name": catalog.career_name(p.to_id)})
        elif p.to_type == "education" and p.to_id in catalog.stages:
            education.append({"id": p.to_id, "name": catalog.stage_name(p.to_id)})
    return {"careers": careers, "education": education}


def _rank(catalog: Catalog, ctx: UserContext, path: EducationPath) -> Ranked:
    points, reasons = 0.0, []
    goals = set(ctx.goals)
    if path.to_type == "education":
        target = catalog.stages.get(path.to_id)
        if "higher_studies" in goals:
            points += 3
            reasons.append(GOAL_LABELS["higher_studies"])
        if "study_abroad" in goals and path.to_id == "EDU_MS_CS_ABROAD":
            points += 3
            reasons.append(GOAL_LABELS["study_abroad"])
        if "research" in goals and target is not None and target.level in {"pg", "doctoral"}:
            points += 2
            reasons.append(GOAL_LABELS["research"])
        if "leadership" in goals and path.to_id == "EDU_MBA":
            points += 2
            reasons.append(GOAL_LABELS["leadership"])
        # Interests that the careers behind this step match
        opened = {c["id"] for c in _opens(catalog, path.to_id)["careers"]}
        hits = {i for cid in opened for i in interest_matches(ctx, catalog.careers[cid])}
        if hits:
            points += 1
            reasons.append("it leads to careers matching your interests")
    elif path.to_type == "career":
        career = catalog.careers.get(path.to_id)
        if career is None:
            return Ranked(0, [])
        if "job" in goals:
            points += 2
            reasons.append(GOAL_LABELS["job"])
        for goal in goal_matches_career(ctx, career):
            points += 3
            reasons.append(GOAL_LABELS[goal])
        interests = interest_matches(ctx, career)
        if interests:
            points += 1.5
            reasons.append("it matches your interest in " + ", ".join(i.replace("_", " ") for i in interests))
        coverage = skill_coverage(catalog, ctx, career.career_id)
        if coverage["score"] >= 25:
            points += coverage["score"] / 25  # up to +4
            reasons.append(f"you already have {coverage['score']:.0f}% of the skills")
        if ctx.riasec and career.riasec_codes:
            top = sorted(ctx.riasec, key=lambda k: -ctx.riasec[k])[:3]
            shared = [c for c in career.riasec_codes if c in top]
            if shared:
                points += len(shared)
                reasons.append("it fits your interest test result")
    elif path.to_type == "exam":
        if "government_career" in goals or "higher_studies" in goals:
            points += 1
    return Ranked(points, reasons)


def _next_action(catalog: Catalog, ctx: UserContext, path: EducationPath, exams: list[dict]) -> str:
    names = " / ".join(e["name"] for e in exams)
    if path.to_type == "exam":
        return f"Read the latest {names} information bulletin on the official site and note the registration dates."
    if path.to_type == "education":
        if exams:
            return f"Check this year's {names} dates on the official website and make a preparation plan."
        return "Shortlist institutes and check their admission rules and deadlines on their official websites."
    coverage = skill_coverage(catalog, ctx, path.to_id)
    if exams:
        return f"Register for {names} (check the official dates) and start preparing alongside your studies."
    first_gap = (coverage["mandatory_missing"] or coverage["partial"] or coverage["missing"] or [None])[0]
    if first_gap is not None:
        return f"Start with {catalog.skill_name(first_gap.skill_id)}, then build a small project that uses it."
    return "Your core skills are covered: build 2–3 portfolio projects and start applying."


def _option(catalog: Catalog, ctx: UserContext, path: EducationPath) -> dict | None:
    if path.to_type == "education":
        target = catalog.stages.get(path.to_id)
        if target is None:
            return None
        title, summary = target.name, target.description
        duration = path.duration_years or target.typical_duration_years
    elif path.to_type == "career":
        target = catalog.careers.get(path.to_id)
        if target is None:
            return None
        title, summary, duration = target.name, target.description, path.duration_years
    else:
        target = catalog.exams.get(path.to_id)
        if target is None:
            return None
        title, summary, duration = target.name, target.purpose, None

    exams = [e for e in (_exam(catalog, x) for x in path.required_exam_ids) if e]
    if path.to_type == "exam":
        exams = [e for e in exams if e["exam_id"] != path.to_id] or []
    rank = _rank(catalog, ctx, path)
    option = {
        "path_id": path.path_id,
        "kind": path.to_type,
        "target_id": path.to_id,
        "title": title,
        "summary": summary,
        "eligibility": path.eligibility_summary,
        "duration_years": duration,
        "exams": exams,
        "advantages": path.advantages,
        "limitations": path.limitations,
        "verified": path.verified,
        "source_url": path.source_url or (catalog.exams[path.to_id].official_url if path.to_type == "exam" else None),
        "last_verified": path.last_verified.isoformat(),
        "next_action": _next_action(catalog, ctx, path, exams if path.to_type != "exam" else [_exam(catalog, path.to_id)]),
        "relevance": round(rank.points, 2),
        "reasons": rank.reasons,
    }
    if path.to_type == "education":
        option["opens"] = _opens(catalog, path.to_id)
    if path.to_type == "career":
        coverage = skill_coverage(catalog, ctx, path.to_id)
        option["skills"] = {
            "coverage": coverage["score"],
            "have": [catalog.skill_name(l.skill_id) for l in coverage["have"]],
            "to_improve": [catalog.skill_name(l.skill_id) for l in coverage["partial"]],
            "missing_core": [catalog.skill_name(l.skill_id) for l in coverage["mandatory_missing"]][:6],
        }
        option["domain"] = target.domain
    return option


def _switches(catalog: Catalog, ctx: UserContext, stage_id: str) -> list[dict]:
    result = []
    for t in catalog.transitions:
        if t.from_type != "education" or t.from_id != stage_id or t.to_career_id not in catalog.careers:
            continue
        missing = [s for s in t.required_skill_ids if ctx.skills.get(s, 0) == 0]
        result.append({
            "transition_id": t.transition_id,
            "career_id": t.to_career_id,
            "title": catalog.career_name(t.to_career_id),
            "difficulty": t.difficulty,
            "months_min": t.estimated_months_min,
            "months_max": t.estimated_months_max,
            "steps": t.steps,
            "skills_needed": [catalog.skill_name(s) for s in t.required_skill_ids],
            "skills_missing": [catalog.skill_name(s) for s in missing],
            "notes": t.notes,
        })
    return result


def next_steps(catalog: Catalog, stage_id: str, ctx: UserContext) -> dict:
    stage = catalog.stages.get(stage_id)
    if stage is None:
        raise UnknownStage(stage_id)

    options = [o for o in (_option(catalog, ctx, p) for p in catalog.paths_from(stage_id)) if o]
    order = {p.path_id: i for i, p in enumerate(catalog.education_paths)}
    options.sort(key=lambda o: (-o["relevance"], order[o["path_id"]]))

    covered_exams = {e["exam_id"] for o in options for e in o["exams"]} | {
        o["target_id"] for o in options if o["kind"] == "exam"}
    other_exams = [
        _exam(catalog, e.exam_id) for e in sorted(catalog.exams.values(), key=lambda e: e.name)
        if stage_id in e.eligible_stage_ids and e.exam_id not in covered_exams
    ]

    personalised = ctx.has_profile and bool(ctx.goals or ctx.interests or ctx.skills or ctx.riasec)
    return {
        "stage": {
            "stage_id": stage.stage_id, "name": stage.name, "level": stage.level,
            "description": stage.description, "typical_duration_years": stage.typical_duration_years,
        },
        "personalised": personalised,
        "groups": {
            "education": [o for o in options if o["kind"] == "education"],
            "career": [o for o in options if o["kind"] == "career"],
            "exam": [o for o in options if o["kind"] == "exam"],
        },
        "switches": _switches(catalog, ctx, stage_id),
        "other_exams": other_exams,
        "counts": {"options": len(options)},
    }

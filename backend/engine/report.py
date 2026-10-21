"""One-page career report for printing or saving as PDF from the browser.

Pulls together what the other engines already compute; nothing new is estimated here."""
from datetime import date

from engine.catalog_data import Catalog
from engine.context import UserContext
from engine.next_steps import next_steps
from engine.recommend import confidence, recommend
from engine.roadmap import build_roadmap
from engine.skill_gap import skill_gap

TOP_MATCHES = 5
TOP_STEPS = 3
TOP_GAPS = 5
PLAN_SKILLS = 4
MONTH_WEEKS = 4      # a skill starts "this month" if the ones before it take under 4 weeks
QUARTER_WEEKS = 13   # ... "next 3 months" if under 13 weeks, otherwise "this year"
RIASEC = ["R", "I", "A", "S", "E", "C"]


def _tests(ctx: UserContext) -> dict:
    out = {}
    if ctx.riasec:
        top = sorted(RIASEC, key=lambda k: -ctx.riasec.get(k, 0))[:3]
        out["interest"] = {"top_codes": top, "scores": {k: round(ctx.riasec.get(k, 0)) for k in RIASEC}}
    if ctx.aptitude:
        out["aptitude"] = {k: round(v) for k, v in sorted(ctx.aptitude.items(), key=lambda kv: -kv[1])}
    if ctx.personality:
        out["personality"] = {k: round(v) for k, v in sorted(ctx.personality.items(), key=lambda kv: -kv[1])}
    return out


def _next_steps(catalog: Catalog, ctx: UserContext) -> list[dict]:
    if not ctx.stage.stage_id:
        return []
    groups = next_steps(catalog, ctx.stage.stage_id, ctx)["groups"]
    options = [o for key in ("education", "career", "exam") for o in groups.get(key, [])]
    options.sort(key=lambda o: -(o.get("relevance") or 0))
    return [{"title": o["title"], "kind": o["kind"], "next_action": o.get("next_action"),
             "reasons": (o.get("reasons") or [])[:2]} for o in options[:TOP_STEPS]]


def _roadmap(catalog: Catalog, ctx: UserContext, career_id: str, done: set[str], done_steps: set[str]) -> dict:
    road = build_roadmap(catalog, ctx, career_id, done, done_steps)
    stages = []
    for s in road["stages"]:
        if s["key"] == "study":
            items = [i["title"] for i in s["items"]]
        elif s["key"] in ("foundations", "core", "specialise"):
            items = [i["name"] for i in s["items"] if not i["done"]][:6]
        elif s["key"] == "projects":
            items = [i["title"] for i in s["items"] if i["kind"] == "project"]
        else:
            items = [i["title"] for i in s["items"]]
        stages.append({"key": s["key"], "title": s["title"], "weeks": s["weeks"], "items": items})
    return {"career": road["career"], "stages": stages, "progress": road["progress"],
            "projects_progress": road.get("projects_progress"), "total_weeks": road["total_weeks"],
            "study_years": road["study_years"], "hours_per_week": road["hours_per_week"]}


def _skill_gap(catalog: Catalog, ctx: UserContext, career_id: str, done: set[str]) -> dict:
    """Skills you have vs the career's list. Skills ticked off on the roadmap count as learned."""
    gap = skill_gap(catalog, ctx, career_id)
    missing = [i for i in gap["learn_first"] + gap["learn_next"] if i["skill_id"] not in done]
    total = len(gap["have"]) + len(gap["learn_first"]) + len(gap["learn_next"])
    core_done = sum(1 for i in gap["learn_first"] if i["skill_id"] in done)
    return {
        "career": gap["career"],
        "have": total - len(missing), "total": total,
        "core_ready": gap["core_ready"] + core_done, "core_total": gap["core_total"],
        "missing": [{"skill_id": i["skill_id"], "name": i["name"], "current_level": i["current_level"],
                     "required_level": i["required_level"], "is_mandatory": i["is_mandatory"], "weeks": i["weeks"]}
                    for i in missing[:TOP_GAPS]],
        "more_missing": max(0, len(missing) - TOP_GAPS),
        "has_skills": gap["has_skills"],
    }, missing


def _action_plan(catalog: Catalog, ctx: UserContext, career_id: str, missing: list[dict],
                 steps: list[dict], road: dict) -> dict:
    """Split the next few months into this month / next 3 months / this year.

    Skills are placed by their cumulative learning time (the same rough estimate the roadmap uses),
    so the plan only reorganises what the other engines already say. Each item is structured
    ({"kind", ...}) so the page can word it in the user's language."""
    plan = {"month": [], "quarter": [], "year": []}
    if steps and steps[0].get("next_action"):
        plan["month"].append({"kind": "action", "text": steps[0]["next_action"], "for": steps[0]["title"]})

    buckets = {"month": [], "quarter": [], "year": []}
    carry = []  # started this month but still going after it
    elapsed = 0
    for i in missing:
        bucket = "month" if elapsed < MONTH_WEEKS else "quarter" if elapsed < QUARTER_WEEKS else "year"
        buckets[bucket].append(i["name"])
        if bucket == "month" and elapsed + i["weeks"] > MONTH_WEEKS:
            carry.append(i["name"])
        elapsed += i["weeks"]
    if carry:
        plan["quarter"].append({"kind": "continue", "skills": carry[:PLAN_SKILLS]})
    for key, names in buckets.items():
        if names:
            plan[key].append({"kind": "learn", "skills": names[:PLAN_SKILLS], "more": max(0, len(names) - PLAN_SKILLS)})

    stages = {s["key"]: s for s in road["stages"]}
    projects = stages.get("projects", {}).get("items", [])
    if projects:
        plan["quarter" if elapsed < QUARTER_WEEKS else "year"].append({"kind": "project", "title": projects[0]})
    exams = []
    for path in catalog.paths_to_career(career_id):
        if not ctx.stage.stage_id or path.from_stage_id == ctx.stage.stage_id:
            exams += [catalog.exams[e].name for e in path.required_exam_ids if e in catalog.exams]
    if exams:
        plan["year"].append({"kind": "exam", "exams": list(dict.fromkeys(exams))[:3]})
    if stages.get("study"):
        plan["year"].append({"kind": "study", "title": stages["study"]["items"][0]})
    else:
        plan["year"].append({"kind": "apply", "career": road["career"]["name"]})
    return plan


def build_report(catalog: Catalog, ctx: UserContext, profile, target: dict | None) -> dict:
    """`target` is {"career_id", "done", "done_steps", "is_target"} or None (then the top match is used)."""
    matches = recommend(catalog, ctx, limit=TOP_MATCHES)["items"] if ctx.has_profile else []
    road = None
    done: set[str] = set()
    if target:
        done = target["done"]
        road = {**_roadmap(catalog, ctx, target["career_id"], target["done"], target["done_steps"]), "is_target": True}
    elif matches:
        road = {**_roadmap(catalog, ctx, matches[0]["career_id"], set(), set()), "is_target": False}
    steps = _next_steps(catalog, ctx)
    gap, plan = None, None
    if road:
        career_id = road["career"]["career_id"]
        gap, missing = _skill_gap(catalog, ctx, career_id, done)
        plan = _action_plan(catalog, ctx, career_id, missing, steps, road)
    summary = None
    if matches or road:
        summary = {
            "best_match": {"name": matches[0]["name"], "score": matches[0]["score"]} if matches else None,
            "target": road["career"]["name"] if road and road["is_target"] else None,
            "next_step": steps[0]["title"] if steps else None,
            "main_gap": gap["missing"][0]["name"] if gap and gap["missing"] else None,
            "skills_ready": {"have": gap["have"], "total": gap["total"]} if gap else None,
        }
    education = profile.education or {} if profile else {}
    return {
        "generated_on": date.today().isoformat(),
        "profile": {
            "name": profile.full_name if profile else None,
            "stage": catalog.stage_name(ctx.stage.stage_id) if ctx.stage.stage_id else None,
            "education": " · ".join(str(v) for v in (education.get("degree") or education.get("stream"),
                                                      education.get("branch"), education.get("institution")) if v),
            "skills": [s.get("name") for s in (profile.skills or [])][:15] if profile else [],
            "interests": list(ctx.interests), "goals": list(ctx.goals),
        } if profile else None,
        "tests": _tests(ctx),
        "confidence": confidence(ctx) if ctx.has_profile else None,
        "matches": [{"career_id": m["career_id"], "name": m["name"], "domain": m["domain"], "score": m["score"],
                     "strengths": m["strengths"][:2], "concerns": m["concerns"][:1]} for m in matches],
        "next_steps": steps,
        "roadmap": road,
        "skill_gap": gap,
        "action_plan": plan,
        "summary": summary,
    }

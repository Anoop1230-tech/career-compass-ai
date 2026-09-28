"""Everything the engines need to know about one user, in one object.

- Maps the free-form profile (stage + degree + branch) to a catalog stage id.
- Maps the user's skill names (and project technologies) to catalog skill ids.
- Collects the latest assessment scores.

All mapping is rule based and transparent: every guess carries a note that
the UI shows, so the user can correct it."""
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from engine.catalog_data import Catalog, normalize
from models import AssessmentResult, Profile

LEVEL_VALUE = {"beginner": 1, "intermediate": 2, "advanced": 3}


@dataclass
class StageGuess:
    stage_id: str | None
    exact: bool
    note: str


@dataclass
class UserContext:
    has_profile: bool = False
    name: str | None = None
    profile_stage: str | None = None  # profile_options.STAGES key
    stage: StageGuess = field(default_factory=lambda: StageGuess(None, False, "No profile yet."))
    skills: dict[str, int] = field(default_factory=dict)  # skill_id -> 1..3
    skill_sources: dict[str, str] = field(default_factory=dict)  # skill_id -> "profile" | "project"
    unmatched_skills: list[str] = field(default_factory=list)
    interests: list[str] = field(default_factory=list)
    goals: list[str] = field(default_factory=list)
    work_mode: str = "any"
    current_career_id: str | None = None
    experience_years: float = 0.0
    riasec: dict[str, float] | None = None  # R..C -> 0..100
    personality: dict[str, float] | None = None  # trait -> 0..100
    aptitude: dict[str, float] | None = None  # category -> 0..100
    self_ratings: dict[str, int] = field(default_factory=dict)  # preferences 1..5

    @property
    def assessments_taken(self) -> list[str]:
        return [k for k, v in (("interest", self.riasec), ("personality", self.personality),
                                ("aptitude", self.aptitude)) if v is not None]


# ------------------------------------------------------------------ stage
def _has(text: str, *words: str) -> bool:
    return any(re.search(rf"(^|[^a-z]){re.escape(w)}([^a-z]|$)", text) for w in words)


_TECH_ROLE_WORDS = (
    "engineer", "developer", "software", "programmer", "data", "devops", "cloud", "it", "tech",
    "qa", "tester", "analyst", "architect", "security", "ml", "ai", "sde", "web", "support",
)


def guess_stage(profile_stage: str | None, education: dict | None, current_role: str | None = None) -> StageGuess:
    """Best catalog stage for a profile. exact=False means 'closest match'."""
    edu = education or {}
    degree = normalize(edu.get("degree") or "").replace(".", "")
    branch = normalize(edu.get("branch") or "")
    both = f"{degree} {branch}"
    stream = edu.get("stream")
    computing = _has(both, "computer", "cse", "cs", "it", "information technology", "computing", "software")
    if not profile_stage:
        return StageGuess(None, False, "Add your current stage to your profile.")

    if profile_stage == "class_10":
        return StageGuess("EDU_CLASS_10", True, "From your profile: Class 10.")

    if profile_stage == "class_11_12":
        mapping = {"pcm": "EDU_12_PCM", "pcmb": "EDU_12_PCM", "pcb": "EDU_12_PCB",
                   "commerce": "EDU_12_COMMERCE", "humanities": "EDU_12_HUMANITIES"}
        if stream in mapping:
            note = "From your profile: Class 11–12"
            if stream == "pcmb":
                note += " with PCMB (shown as PCM; biology options also apply)."
            return StageGuess(mapping[stream], stream != "pcmb", note + ("" if stream == "pcmb" else "."))
        return StageGuess(None, False, "Choose your Class 11–12 stream to see options.")

    if profile_stage == "diploma":
        if computing or not both.strip():
            return StageGuess("EDU_DIPLOMA_CS", computing, "Diploma in computer engineering"
                              + ("." if computing else " (closest match; add your branch)."))
        return StageGuess("EDU_DIPLOMA_CS", False, "Closest match: computer diploma. Other diplomas are not covered yet.")

    if profile_stage in {"phd_student", "phd_graduate"}:
        return StageGuess("EDU_PHD_CS", computing, "PhD" + ("" if computing else " (closest match: computer science)") + ".")

    if profile_stage in {"masters_student", "masters_graduate"}:
        if _has(degree, "mba", "pgdm"):
            return StageGuess("EDU_MBA", True, "From your profile: MBA.")
        if _has(degree, "mca"):
            return StageGuess("EDU_MCA", True, "From your profile: MCA.")
        if _has(both, "data science", "statistics", "ds") and _has(degree, "msc", "m sc", "ms"):
            return StageGuess("EDU_MSC_DS", True, "From your profile: M.Sc data science.")
        if _has(degree, "ms") and not _has(degree, "msc"):
            return StageGuess("EDU_MS_CS_ABROAD", computing, "From your profile: MS in computer science.")
        if _has(degree, "mtech", "m tech", "me", "m e") or computing:
            return StageGuess("EDU_MTECH_CSE", computing, "M.Tech in computer science" + ("." if computing else " (closest match)."))
        return StageGuess(None, False, "Add your master's degree and branch to see options.")

    if profile_stage in {"working_professional", "experienced_professional", "career_changer", "entrepreneur"}:
        role = normalize(current_role or "")
        if not role:
            return StageGuess("EDU_WORKING_TECH" if computing else "EDU_WORKING_NONTECH", False,
                              "Guessed from your degree. Add your current role for a better match.")
        tech = any(_has(role, w) for w in _TECH_ROLE_WORDS)
        return StageGuess("EDU_WORKING_TECH" if tech else "EDU_WORKING_NONTECH", True,
                          f"Working professional ({'technology' if tech else 'non-technology'} role).")

    # Undergraduate student, graduate, fresh graduate, job seeker, other
    if _has(degree, "btech", "b tech", "be", "b e", "bachelor of technology", "bachelor of engineering"):
        if computing:
            return StageGuess("EDU_BTECH_CSE", True, "From your profile: B.Tech in computer science.")
        if _has(branch, "electronics", "ece", "communication", "eee", "electrical"):
            exact = not _has(branch, "electrical", "eee")
            return StageGuess("EDU_BTECH_ECE", exact, "B.Tech in electronics" + ("." if exact else " (closest match)."))
        if _has(branch, "mechanical", "mech", "automobile", "production"):
            return StageGuess("EDU_BTECH_MECH", True, "From your profile: B.Tech in mechanical engineering.")
        if not branch:
            return StageGuess("EDU_BTECH_CSE", False, "B.Tech (branch not given; showing computer science).")
        return StageGuess("EDU_BTECH_MECH", False, "Closest match: core engineering (B.Tech mechanical). "
                          "Your exact branch is not covered yet.")
    if _has(degree, "bca"):
        return StageGuess("EDU_BCA", True, "From your profile: BCA.")
    if _has(degree, "bcom", "b com"):
        return StageGuess("EDU_BCOM", True, "From your profile: B.Com.")
    if _has(degree, "bsc", "b sc"):
        if computing:
            return StageGuess("EDU_BSC_CS", True, "From your profile: B.Sc computer science.")
        if _has(branch, "math", "maths", "mathematics", "statistics", "stats"):
            return StageGuess("EDU_BSC_MATH_STATS", True, "From your profile: B.Sc mathematics / statistics.")
        return StageGuess("EDU_BSC_MATH_STATS", False, "Closest match: B.Sc mathematics / statistics.")
    if _has(degree, "ba", "b a", "bachelor of arts"):
        return StageGuess("EDU_BA", True, "From your profile: BA.")
    if profile_stage in {"ug_student", "bachelors_graduate", "fresh_graduate", "job_seeker"}:
        return StageGuess(None, False, "Add your degree (for example B.Tech, BCA, B.Com) to see options.")
    return StageGuess(None, False, "Pick a stage to see options.")


# ------------------------------------------------------------------ skills
def match_skill(catalog: Catalog, name: str) -> str | None:
    key = normalize(name)
    if key in catalog.skill_lookup:
        return catalog.skill_lookup[key]
    compact = key.replace(" ", "").replace(".", "")
    for label, skill_id in catalog.skill_lookup.items():
        if label.replace(" ", "").replace(".", "") == compact:
            return skill_id
    return None


def match_career(catalog: Catalog, role: str | None) -> str | None:
    """'Senior Software Engineer' -> CAR_SOFTWARE_ENGINEER (longest career name contained in the role)."""
    if not role:
        return None
    text = normalize(role)
    best = None
    for career in catalog.careers.values():
        name = normalize(career.name.split("(")[0])
        if name and name in text and (best is None or len(name) > len(normalize(best.name))):
            best = career
    return best.career_id if best else None


def _latest_results(db: Session, user_id: int) -> dict[str, dict]:
    rows = db.scalars(
        select(AssessmentResult).where(AssessmentResult.user_id == user_id)
        .order_by(AssessmentResult.created_at.desc(), AssessmentResult.id.desc())
    )
    latest: dict[str, dict] = {}
    for row in rows:
        latest.setdefault(row.kind, row.result)
    return latest


def _scales(result: dict | None) -> dict[str, float] | None:
    if not result or not result.get("scales"):
        return None
    return {s["key"]: float(s["score"]) for s in result["scales"]}


def build_context(db: Session, catalog: Catalog, user_id: int | None) -> UserContext:
    ctx = UserContext()
    if user_id is None:
        return ctx
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    results = _latest_results(db, user_id)
    ctx.riasec = _scales(results.get("interest"))
    if results.get("interest", {}).get("undifferentiated"):
        ctx.riasec = None  # all answers the same: no usable preference signal
    ctx.personality = _scales(results.get("personality"))
    ctx.aptitude = _scales(results.get("aptitude"))
    if profile is None:
        return ctx

    ctx.has_profile = True
    ctx.name = profile.full_name
    ctx.profile_stage = profile.current_stage
    experience = profile.experience or {}
    ctx.stage = guess_stage(profile.current_stage, profile.education, experience.get("current_role"))
    ctx.interests = list(profile.interests or [])
    ctx.goals = list(profile.goals or [])
    prefs = profile.preferences or {}
    ctx.work_mode = prefs.get("work_mode") or "any"
    ctx.self_ratings = {k: v for k, v in prefs.items()
                        if k in {"risk_tolerance", "leadership", "creativity", "team_orientation",
                                 "research_orientation"} and isinstance(v, int)}
    ctx.experience_years = float(experience.get("total_years") or 0)
    ctx.current_career_id = match_career(catalog, experience.get("current_role"))
    if ctx.current_career_id is None:
        for job in experience.get("jobs") or []:
            ctx.current_career_id = match_career(catalog, job.get("title"))
            if ctx.current_career_id:
                break

    for skill in profile.skills or []:
        skill_id = match_skill(catalog, skill.get("name", ""))
        if skill_id is None:
            ctx.unmatched_skills.append(skill.get("name", ""))
            continue
        level = LEVEL_VALUE.get(skill.get("level"), 1)
        if level >= ctx.skills.get(skill_id, 0):
            ctx.skills[skill_id] = level
            ctx.skill_sources[skill_id] = "profile"
    # Technologies used in projects count as beginner-level evidence
    for project in experience.get("projects") or []:
        for tech in project.get("technologies") or []:
            skill_id = match_skill(catalog, tech)
            if skill_id and skill_id not in ctx.skills:
                ctx.skills[skill_id] = 1
                ctx.skill_sources[skill_id] = "project"
    return ctx

"""Phase 13: does machine learning beat the rule-based recommendation engine?

There is no real outcome data yet (nobody has reported "I became X and it
fit me"), so this uses SYNTHETIC personas: for every career we generate
people whose tests, skills, stage, interests and goals look like someone who
fits that career, with random noise. The career they were generated from is
the label.

Two test sets:
- held-out: new personas from the same generator (same noise)
- shifted:  personas with MORE noise and misleading signals (e.g. an interest
            profile pointing elsewhere, fewer relevant skills) - closer to
            messy real users

Models (scikit-learn): logistic regression, random forest, k-nearest
neighbours, trained on the training personas. The rule engine is not trained.

Decision rule (fixed BEFORE running): ML replaces the rules only if it beats
them by at least 5 points of top-3 accuracy on BOTH test sets. Because the
labels are synthetic, a win would only be a hint, and it would still need
real user feedback before shipping.

Run from backend/:  python -m ml.evaluate   (writes ml/results.json)"""
import json
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from engine.catalog_data import Catalog
from engine.context import StageGuess, UserContext
from engine.fit import INTEREST_DOMAINS, PROFICIENCY_VALUE
from engine.recommend import recommend
from engine.recommend import FIT_TRAITS

RIASEC = ["R", "I", "A", "S", "E", "C"]
APTITUDES = ["numerical", "logical", "verbal", "spatial", "problem_solving"]
WORK_TRAITS = ["leadership", "risk_tolerance", "team_orientation", "creativity", "research_orientation"]
GOALS = ["job", "higher_studies", "government_career", "research", "entrepreneurship", "leadership", "remote_work"]
MIN_WIN = 5.0  # percentage points of top-3 accuracy
RESULTS = Path(__file__).with_name("results.json")


@dataclass(frozen=True)
class Noise:
    name: str
    signal: float  # how strongly the target career shows in the persona (0..1)
    skill_keep: float  # chance to have each of the career's skills
    decoy: float  # chance an interest profile points to a random other career


CLEAN = Noise("held-out", signal=0.8, skill_keep=0.55, decoy=0.1)
SHIFTED = Noise("shifted", signal=0.55, skill_keep=0.35, decoy=0.35)


def _clip(v: float) -> float:
    return float(max(0.0, min(100.0, v)))


def make_persona(catalog: Catalog, career_id: str, rng: random.Random, noise: Noise) -> UserContext:
    career = catalog.careers[career_id]
    source = career
    if rng.random() < noise.decoy:  # misleading interest profile
        source = catalog.careers[rng.choice(sorted(catalog.careers))]
    riasec = {k: _clip(rng.gauss(40, 15)) for k in RIASEC}
    for rank, code in enumerate(source.riasec_codes):
        riasec[code] = _clip(riasec[code] * (1 - noise.signal) + (90 - 10 * rank) * noise.signal + rng.gauss(0, 8))
    aptitude = {k: _clip(rng.gauss(50, 15)) for k in APTITUDES}
    for a in career.key_aptitudes:
        aptitude[a] = _clip(aptitude[a] * (1 - noise.signal) + 80 * noise.signal + rng.gauss(0, 10))
    personality = {k: _clip(rng.gauss(50, 15)) for k in WORK_TRAITS}
    for f in career.personality_fit:
        if f in FIT_TRAITS:
            t = FIT_TRAITS[f]
            personality[t] = _clip(personality[t] * (1 - noise.signal) + 80 * noise.signal + rng.gauss(0, 10))

    skills: dict[str, int] = {}
    for link in catalog.career_skills.get(career_id, []):
        if rng.random() < noise.skill_keep:
            skills[link.skill_id] = rng.randint(1, PROFICIENCY_VALUE.get(link.proficiency_required, 2))
    for _ in range(rng.randint(0, 3)):  # unrelated skills people also have
        skills.setdefault(rng.choice(sorted(catalog.skills)), rng.randint(1, 3))

    stage = rng.choice(career.typical_stage_ids) if career.typical_stage_ids and rng.random() < 0.85 \
        else rng.choice(sorted(catalog.stages))
    tags = {career.domain, career.sub_domain}
    matching = [i for i, domains in INTEREST_DOMAINS.items() if domains & tags]
    interests = [rng.choice(matching)] if matching and rng.random() < noise.signal else []
    interests += rng.sample(sorted(INTEREST_DOMAINS), rng.randint(0, 2))
    goals = rng.sample(GOALS, rng.randint(0, 2))
    return UserContext(has_profile=True, stage=StageGuess(stage, True, ""), skills=skills, riasec=riasec,
                       aptitude=aptitude, personality=personality, interests=list(dict.fromkeys(interests)),
                       goals=goals)


def make_dataset(catalog: Catalog, per_career: int, seed: int, noise: Noise) -> list[tuple[UserContext, str]]:
    rng = random.Random(seed)
    return [(make_persona(catalog, cid, rng, noise), cid) for cid in sorted(catalog.careers) for _ in range(per_career)]


class Features:
    """Turns a UserContext into a fixed-length numeric vector."""

    def __init__(self, catalog: Catalog):
        self.skills = sorted(catalog.skills)
        self.stages = sorted(catalog.stages)
        self.interests = sorted(INTEREST_DOMAINS)
        self.size = 6 + 5 + 5 + len(self.skills) + len(self.stages) + len(self.interests) + len(GOALS)

    def __call__(self, ctx: UserContext) -> np.ndarray:
        v = [(ctx.riasec or {}).get(k, 50) / 100 for k in RIASEC]
        v += [(ctx.aptitude or {}).get(k, 50) / 100 for k in APTITUDES]
        v += [(ctx.personality or {}).get(k, 50) / 100 for k in WORK_TRAITS]
        v += [ctx.skills.get(s, 0) / 3 for s in self.skills]
        v += [1.0 if ctx.stage.stage_id == s else 0.0 for s in self.stages]
        v += [1.0 if i in ctx.interests else 0.0 for i in self.interests]
        v += [1.0 if g in ctx.goals else 0.0 for g in GOALS]
        return np.array(v, dtype=float)


def metrics(ranked: list[list[str]], labels: list[str]) -> dict:
    n = len(labels)
    top1 = sum(r[0] == y for r, y in zip(ranked, labels)) / n
    top3 = sum(y in r[:3] for r, y in zip(ranked, labels)) / n
    mrr = sum(1 / (r.index(y) + 1) for r, y in zip(ranked, labels)) / n
    return {"top1": round(top1 * 100, 1), "top3": round(top3 * 100, 1), "mrr": round(mrr, 3)}


def rule_rankings(catalog: Catalog, data) -> list[list[str]]:
    n = len(catalog.careers)
    return [[i["career_id"] for i in recommend(catalog, ctx, limit=n)["items"]] for ctx, _ in data]


def model_rankings(model, X: np.ndarray) -> list[list[str]]:
    proba = model.predict_proba(X)
    classes = list(model.classes_)
    return [[classes[i] for i in np.argsort(-row, kind="stable")] for row in proba]


def build_models(seed: int):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.neighbors import KNeighborsClassifier

    return {
        "logistic_regression": LogisticRegression(max_iter=2000, C=1.0),
        "random_forest": RandomForestClassifier(n_estimators=300, random_state=seed, n_jobs=-1),
        "k_nearest_neighbours": KNeighborsClassifier(n_neighbors=15, weights="distance"),
    }


def decide(results: dict, min_win: float = MIN_WIN) -> dict:
    """Pick the rule engine unless one model wins by min_win on every test set."""
    rules = results["rule_engine"]
    winners = []
    for name, r in results.items():
        if name == "rule_engine":
            continue
        margins = {s: r[s]["top3"] - rules[s]["top3"] for s in rules}
        if all(m >= min_win for m in margins.values()):
            winners.append((min(margins.values()), name))
    if winners:
        margin, best = max(winners)
        return {"keep": best, "reason": f"{best} beats the rules by at least {margin:.1f} points of top-3 accuracy "
                f"on every test set (needed {min_win})."}
    best_ml = max((n for n in results if n != "rule_engine"),
                  key=lambda n: min(results[n][s]["top3"] - rules[s]["top3"] for s in rules))
    worst_margin = min(results[best_ml][s]["top3"] - rules[s]["top3"] for s in rules)
    closeness = ("slightly better than" if worst_margin > 0 else "not better than")
    return {"keep": "rule_engine", "reason": f"No model beat the rules by {min_win} points on every test set. "
            f"The best model ({best_ml}) is {closeness} the rules (worst-case margin {worst_margin:+.1f} points), "
            "which is too small to give up explainable scores that need no training data. The rule engine stays."}


def evaluate(catalog: Catalog, train_per_career: int = 60, test_per_career: int = 20, seed: int = 7) -> dict:
    features = Features(catalog)
    train = make_dataset(catalog, train_per_career, seed, CLEAN)
    tests = {CLEAN.name: make_dataset(catalog, test_per_career, seed + 1, CLEAN),
             SHIFTED.name: make_dataset(catalog, test_per_career, seed + 2, SHIFTED)}
    X_train = np.stack([features(c) for c, _ in train])
    y_train = [y for _, y in train]

    results: dict[str, dict] = {"rule_engine": {}}
    timing: dict[str, float] = {}
    for set_name, data in tests.items():
        start = time.perf_counter()
        results["rule_engine"][set_name] = metrics(rule_rankings(catalog, data), [y for _, y in data])
        timing.setdefault("rule_engine", 0.0)
        timing["rule_engine"] += time.perf_counter() - start
    for name, model in build_models(seed).items():
        start = time.perf_counter()
        model.fit(X_train, y_train)
        results[name] = {}
        for set_name, data in tests.items():
            X = np.stack([features(c) for c, _ in data])
            results[name][set_name] = metrics(model_rankings(model, X), [y for _, y in data])
        timing[name] = time.perf_counter() - start
    return {
        "setup": {"careers": len(catalog.careers), "train_personas": len(train),
                  "test_personas_per_set": {k: len(v) for k, v in tests.items()}, "features": features.size,
                  "seed": seed, "min_win_top3_points": MIN_WIN},
        "results": results,
        "seconds": {k: round(v, 2) for k, v in timing.items()},
        "decision": decide(results),
        "caveat": "Labels are synthetic (generated from each career's own profile), not real career outcomes.",
    }


def main() -> int:
    from database import SessionLocal, init_db
    from engine.catalog_data import get_catalog

    init_db()
    with SessionLocal() as db:
        catalog = get_catalog(db)
    if catalog.is_empty:
        print("Load the datasets first: python -m catalog.seed")
        return 1
    report = evaluate(catalog)
    print(f"{'model':24} {'set':10} {'top-1':>6} {'top-3':>6} {'MRR':>6}")
    for name, sets in report["results"].items():
        for set_name, m in sets.items():
            print(f"{name:24} {set_name:10} {m['top1']:6.1f} {m['top3']:6.1f} {m['mrr']:6.3f}")
    print("\nDecision:", report["decision"]["reason"])
    RESULTS.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {RESULTS.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

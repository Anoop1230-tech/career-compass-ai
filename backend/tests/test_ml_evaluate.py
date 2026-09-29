"""Phase 13 evaluation harness: personas, metrics and the decision rule."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from ml.evaluate import CLEAN, SHIFTED, Features, decide, evaluate, make_dataset, metrics


@pytest.fixture
def catalog():
    with SessionLocal() as db:
        seed(db, force=True)
        yield get_catalog(db)


def test_personas_are_deterministic_and_labelled(catalog):
    a = make_dataset(catalog, 2, seed=1, noise=CLEAN)
    b = make_dataset(catalog, 2, seed=1, noise=CLEAN)
    assert len(a) == 2 * len(catalog.careers)
    assert [(c.riasec, c.skills, y) for c, y in a] == [(c.riasec, c.skills, y) for c, y in b]
    assert all(0 <= v <= 100 for c, _ in a for v in c.riasec.values())
    feats = Features(catalog)
    assert feats(a[0][0]).shape == (feats.size,)


def test_metrics():
    ranked = [["A", "B", "C"], ["B", "A", "C"], ["C", "B", "A"]]
    m = metrics(ranked, ["A", "A", "A"])
    assert m == {"top1": 33.3, "top3": 100.0, "mrr": round((1 + 0.5 + 1 / 3) / 3, 3)}


def _r(top3_clean, top3_shift):
    return {CLEAN.name: {"top3": top3_clean}, SHIFTED.name: {"top3": top3_shift}}


def test_decision_rule_needs_a_clear_win_everywhere():
    assert decide({"rule_engine": _r(90, 80), "m": _r(99, 84)})["keep"] == "rule_engine"  # only +4 on one set
    assert decide({"rule_engine": _r(90, 80), "m": _r(96, 86)})["keep"] == "m"
    worse = decide({"rule_engine": _r(90, 80), "m": _r(70, 60)})
    assert worse["keep"] == "rule_engine" and "not better" in worse["reason"]


def test_small_evaluation_runs_end_to_end(catalog):
    report = evaluate(catalog, train_per_career=6, test_per_career=2, seed=3)
    assert set(report["results"]) == {"rule_engine", "logistic_regression", "random_forest", "k_nearest_neighbours"}
    for sets in report["results"].values():
        assert set(sets) == {CLEAN.name, SHIFTED.name}
        for m in sets.values():
            assert 0 <= m["top1"] <= m["top3"] <= 100
    assert report["decision"]["keep"] in report["results"]
    assert "synthetic" in report["caveat"]
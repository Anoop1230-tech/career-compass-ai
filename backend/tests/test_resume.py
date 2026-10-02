"""Phase 28: résumé upload (read skills from a PDF; nothing saved until the user confirms)."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.catalog_data import get_catalog
from engine.resume import MAX_BYTES, ResumeError, extract_text, find_skills
from tests.conftest import valid_profile


def make_pdf(*lines: str) -> bytes:
    """A minimal one-page PDF with Helvetica text (text is extractable)."""
    ops = "BT /F1 11 Tf 72 720 Td 14 TL " + " ".join(
        "(" + line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") '" for line in lines) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(ops)} >>\nstream\n{ops}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


RESUME = make_pdf("Asha Kumar - Data Analyst", "Skills: Python, SQL, Machine Learning and Excel.",
                  "Also: R, Tableau. Interested in teaching.")


@pytest.fixture
def user(client, make_user):
    with SessionLocal() as db:
        seed(db, force=True)
    return make_user()


def post(c, data, ctype="application/pdf"):
    return c.post("/api/resume/skills", content=data, headers={"Content-Type": ctype})


def test_extract_and_match():
    text, pages = extract_text(RESUME)
    assert pages == 1 and "Machine Learning" in text
    with SessionLocal() as db:
        seed(db, force=True)
        names = {s["name"] for s in find_skills(get_catalog(db), text)}
    assert {"Python", "SQL"} <= names
    assert "machine learning" in {n.casefold() for n in names}


def test_short_aliases_need_exact_tokens():
    with SessionLocal() as db:
        seed(db, force=True)
        cat = get_catalog(db)
        plain = find_skills(cat, "I read every report carefully and care about our community.")
    assert all(len(s["matched"]) > 2 for s in plain)


@pytest.mark.parametrize("data,msg", [(b"hello", "not a PDF"), (b"%PDF-1.4 broken", "could not be read"),
                                      (make_pdf(), "No text")])
def test_bad_files(data, msg):
    with pytest.raises(ResumeError, match=msg):
        extract_text(data)


def test_endpoint_returns_skills_and_saves_nothing(user):
    user.put("/api/profile", json=valid_profile())
    before = user.get("/api/profile").json()["skills"]
    body = post(user, RESUME).json()
    assert body["pages"] == 1 and body["has_profile"]
    names = {s["name"]: s for s in body["skills"]}
    assert "SQL" in names and names["SQL"]["category"] in {"programming", "technical", "domain"}
    assert user.get("/api/profile").json()["skills"] == before


def test_endpoint_errors(client, user):
    r = post(user, RESUME, ctype="text/plain")
    assert r.status_code == 415 and r.json()["code"] == "resume.not_pdf_type"
    r = post(user, b"%PDF-" + b"0" * (MAX_BYTES + 10))
    assert r.status_code == 413 and r.json()["code"] == "resume.too_large"
    r = post(user, make_pdf())
    assert r.status_code == 422 and r.json()["code"] == "resume.no_text"
    user.post("/api/auth/logout")
    assert post(client, RESUME).status_code == 401

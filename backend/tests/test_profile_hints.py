"""Profile hints: name and institution taken only from clear evidence in the email / Google account."""
import pytest

from catalog.seed import seed
from database import SessionLocal
from engine.profile_hints import name_from_email, registrable_domain

from .conftest import PASSWORD


@pytest.mark.parametrize("email, name", [
    ("asha.verma@example.com", "Asha Verma"),
    ("ravi_kumar_singh@example.com", "Ravi Kumar Singh"),
    ("asha.verma+jobs@example.com", "Asha Verma"),
    ("asha.verma.2024@example.com", "Asha Verma"),  # a year on its own is dropped
    ("kumaranoop849250@example.com", None),  # can't tell where the name splits
    ("a.verma@example.com", None),  # initials are not a name
    ("asha@example.com", None),
    ("asha.v3rma@example.com", None),
    ("info.admin.team.office@example.com", None),  # too many parts
])
def test_name_from_email_only_when_clear(email, name):
    assert name_from_email(email) == name


@pytest.mark.parametrize("host, domain", [
    ("www.iitb.ac.in", "iitb.ac.in"), ("cse.iitb.ac.in", "iitb.ac.in"), ("home.iitd.ac.in", "iitd.ac.in"),
    ("gmail.com", "gmail.com"), ("www.du.ac.in", "du.ac.in"), ("mail.example.co.uk", "example.co.uk"),
])
def test_registrable_domain(host, domain):
    assert registrable_domain(host) == domain


def hints_for(client, email):
    assert client.post("/api/auth/register", json={"email": email, "password": PASSWORD}).status_code == 201
    return client.get("/api/profile/hints").json()


def test_hints_need_login(client):
    assert client.get("/api/profile/hints").status_code == 401


def test_institution_from_official_college_domain(client):
    with SessionLocal() as db:
        seed(db, force=True)
    hints = hints_for(client, "asha.verma@cse.iitb.ac.in")
    assert hints == {
        "full_name": {"value": "Asha Verma", "source": "email"},
        "institution": {"value": "Indian Institute of Technology Bombay", "source": "email"},
    }


def test_no_hints_for_plain_gmail(client):
    with SessionLocal() as db:
        seed(db, force=True)
    assert hints_for(client, "kumaranoop849250@gmail.com") == {}

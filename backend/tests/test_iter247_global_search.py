"""iter 247 — Global Search rewrite contract tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def super_admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "superadmin@oryno.com", "password": "testpassword123"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}"}


def test_cysoul_event_row(headers):
    r = requests.get(f"{BASE_URL}/api/search/?q=cysoul", headers=headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] >= 1
    assert "event" in d["by_type"]
    ev = d["by_type"]["event"][0]
    assert ev["deep_link"].startswith("/services/showtimes/")
    assert ev["thumbnail"] and ("/api/static/event-showtimes/" in ev["thumbnail"] or ev["thumbnail"].startswith("http"))
    assert "Concert" in ev["subtitle"]
    assert "FCFA" in ev["subtitle"]
    assert any(ch.isdigit() for ch in ev["subtitle"])  # contains a date/price digit


def test_accent_insensitive_yaounde(headers):
    base = requests.get(f"{BASE_URL}/api/search/?q=yaounde", headers=headers).json()
    upper = requests.get(f"{BASE_URL}/api/search/?q=YAOUNDE", headers=headers).json()
    accented = requests.get(f"{BASE_URL}/api/search/?q=yaound%C3%A9", headers=headers).json()
    assert base["total"] == upper["total"] == accented["total"]
    assert base["total"] > 0
    types = {r["type"] for r in base["results"]}
    assert "location" in types
    labels = [r["label"] for r in base["results"]]
    assert any("Cysoul" in l for l in labels)
    assert any("Tech Summit" in l for l in labels)


def test_carter_operator_deep_link(headers):
    r = requests.get(f"{BASE_URL}/api/search/?q=Carter", headers=headers).json()
    ops = [x for x in r["results"] if x["type"] == "operator"]
    assert ops, "Expected at least one operator for Carter"
    assert ops[0]["deep_link"].startswith("/admin/operators?search=")


def test_by_type_present(headers):
    r = requests.get(f"{BASE_URL}/api/search/?q=yaounde", headers=headers).json()
    assert isinstance(r.get("by_type"), dict)
    assert sum(len(v) for v in r["by_type"].values()) >= r["total"] - 1

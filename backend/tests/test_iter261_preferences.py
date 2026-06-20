"""Tests for /api/users/me/preferences GET/PUT with 19 fields - iter 261."""
import os
from pathlib import Path
import pytest
import requests

def _load_url():
    u = os.environ.get("REACT_APP_BACKEND_URL", "")
    if u:
        return u.rstrip("/")
    env = Path("/app/frontend/.env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    return ""

BASE_URL = _load_url()
LOGIN = f"{BASE_URL}/api/auth/login"
PREFS = f"{BASE_URL}/api/users/me/preferences"

CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}

EXPECTED_FIELDS = {
    "language", "currency", "timezone", "theme",
    "date_format", "time_format", "first_day_of_week", "number_format",
    "distance_unit", "temperature_unit",
    "default_landing_page", "default_search_radius_km", "results_per_page",
    "marketing_opt_in", "show_profile_publicly", "share_usage_data",
    "reduce_motion", "high_contrast", "font_scale",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(LOGIN, json=CUSTOMER, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_get_preferences_returns_all_19_fields(session):
    r = session.get(PREFS, timeout=20)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert isinstance(data, dict)
    missing = EXPECTED_FIELDS - set(data.keys())
    assert not missing, f"Missing pref fields: {missing}. Got keys: {list(data.keys())}"


def test_put_preferences_updates_and_persists(session):
    payload = {
        "distance_unit": "mi",
        "reduce_motion": True,
        "font_scale": "large",
        "date_format": "YYYY-MM-DD",
        "marketing_opt_in": True,
        "default_search_radius_km": 50,
    }
    r = session.put(PREFS, json=payload, timeout=20)
    assert r.status_code == 200, r.text[:300]

    # GET to verify persistence
    r2 = session.get(PREFS, timeout=20)
    assert r2.status_code == 200
    d = r2.json()
    assert d["distance_unit"] == "mi"
    assert d["reduce_motion"] is True
    assert d["font_scale"] == "large"
    assert d["date_format"] == "YYYY-MM-DD"
    assert d["marketing_opt_in"] is True
    assert d["default_search_radius_km"] == 50


def test_reset_preferences_to_defaults(session):
    payload = {
        "distance_unit": "km",
        "reduce_motion": False,
        "font_scale": "normal",
        "date_format": "DD/MM/YYYY",
        "marketing_opt_in": False,
        "default_search_radius_km": 25,
    }
    r = session.put(PREFS, json=payload, timeout=20)
    assert r.status_code == 200

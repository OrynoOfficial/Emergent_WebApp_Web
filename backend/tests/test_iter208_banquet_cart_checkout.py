"""Backend tests for Phase 2 — Banquet & Event Services cart checkout.

Covers POST /api/banquets/cart/checkout:
 - happy path (hall + chairs subtotal math)
 - package + line-items combined
 - per_hour pricing (hours overrides duration_hours)
 - validation: missing/past event_date, empty cart, bad service_id
 - auth: rejected without token
 - banquet_bookings row created + GET /api/banquets/bookings/my
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASS = "testpassword123"
CUST_EMAIL = "customer@test.com"
CUST_PASS = "testpassword123"

CITY = "Douala"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def cust_token():
    return _login(CUST_EMAIL, CUST_PASS)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def cust_h(cust_token):
    return {"Authorization": f"Bearer {cust_token}", "Content-Type": "application/json"}


def _create_service(headers, **overrides):
    payload = {
        "name": f"TEST_{overrides.get('category','hall')}_{uuid.uuid4().hex[:6]}",
        "city": CITY,
        "country": "Cameroon",
        "address": "Test St",
        "venue_type": "indoor",
        "capacity_min": 10,
        "capacity_max": 500,
        "base_price": 100000,
        "pricing_model": "per_event",
        "category": "hall",
        "description": "TEST service",
    }
    payload.update(overrides)
    r = requests.post(f"{BASE_URL}/api/banquets/", headers=headers, json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    return r.json()["banquet_id"]


@pytest.fixture(scope="module")
def seeded(admin_h):
    """Seed hall (per_event 100k), chair (per_unit 500), photographer (per_hour 30k/4h), bundle."""
    hall = _create_service(admin_h, name="TEST_Hall", category="hall", base_price=100000, pricing_model="per_event")
    chair = _create_service(admin_h, name="TEST_Chair", category="rental_item",
                            base_price=500, pricing_model="per_unit", unit_label="chair")
    photo = _create_service(admin_h, name="TEST_Photog", category="photographer",
                            base_price=30000, pricing_model="per_hour", duration_hours=4)
    # bundle = hall + 100 chairs, 10% discount → (100000 + 100*500) = 150000 * 0.9 = 135000
    pkg = requests.post(f"{BASE_URL}/api/banquets/packages/", headers=admin_h, json={
        "name": f"TEST_Bundle_{uuid.uuid4().hex[:6]}",
        "description": "TEST bundle",
        "services": [{"service_id": hall, "quantity": 1}, {"service_id": chair, "quantity": 100}],
        "discount_percent": 10,
        "is_active": True,
    }, timeout=20)
    assert pkg.status_code in (200, 201), pkg.text
    pkg_id = pkg.json()["package_id"]
    pkg_total = pkg.json()["total_price"]
    return {"hall": hall, "chair": chair, "photo": photo, "pkg": pkg_id, "pkg_total": pkg_total}


def _future_date(days=14):
    return (datetime.utcnow() + timedelta(days=days)).date().isoformat()


# ─── Happy path: hall + chairs ──────────────────────────────────────────
class TestCartCheckoutBasic:
    def test_hall_plus_chairs_math(self, cust_h, seeded):
        body = {
            "event_date": _future_date(),
            "line_items": [
                {"service_id": seeded["hall"], "quantity": 1},
                {"service_id": seeded["chair"], "quantity": 200},
            ],
            "expected_guests": 200,
            "contact_name": "TEST Customer",
            "contact_phone": "+237600000000",
            "contact_email": "test@example.com",
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # subtotal = 100000 + 200*500 = 200000
        assert d["total_price"] == 200000, d
        assert d["order_number"].startswith("EVT-"), d["order_number"]
        assert len(d["order_number"]) == len("EVT-XXXXXX")
        assert len(d["line_items"]) == 2
        # rate_label sanity
        labels = [li.get("rate_label") for li in d["line_items"]]
        assert any("flat" in (l or "") for l in labels)
        assert any("chair" in (l or "") for l in labels)
        # confirm in orders + banquet_bookings via GET
        gb = requests.get(f"{BASE_URL}/api/banquets/bookings/my", headers=cust_h, timeout=20)
        assert gb.status_code == 200
        ids = [b.get("order_id") for b in gb.json().get("bookings", [])]
        assert d["order_id"] in ids

    def test_per_hour_with_hours_override(self, cust_h, seeded):
        body = {
            "event_date": _future_date(),
            "line_items": [{"service_id": seeded["photo"], "quantity": 1, "hours": 6}],
            "contact_name": "TEST",
            "contact_phone": "+237600",
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # 30000 * 6 * 1 = 180000
        assert d["total_price"] == 180000, d
        li = d["line_items"][0]
        assert li["line_total"] == 180000
        assert "30,000" in li["rate_label"] and "6" in li["rate_label"] and "hour" in li["rate_label"]

    def test_package_plus_individual(self, cust_h, seeded):
        body = {
            "event_date": _future_date(),
            "package_ids": [seeded["pkg"]],
            "line_items": [{"service_id": seeded["chair"], "quantity": 50}],  # +50*500=25000
            "contact_name": "TEST",
            "contact_phone": "+237600",
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        expected = seeded["pkg_total"] + 25000
        assert d["total_price"] == expected, (d["total_price"], expected)
        # package line should expand inner services
        pkg_line = next((li for li in d["line_items"] if li.get("source") == "package"), None)
        assert pkg_line is not None
        assert pkg_line.get("services") and len(pkg_line["services"]) >= 1


# ─── Validation errors ─────────────────────────────────────────────────
class TestCartCheckoutValidation:
    def test_no_event_date(self, cust_h, seeded):
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json={
            "line_items": [{"service_id": seeded["hall"], "quantity": 1}],
            "contact_name": "x", "contact_phone": "y",
        }, timeout=20)
        assert r.status_code in (400, 422), r.text

    def test_past_event_date(self, cust_h, seeded):
        past = (datetime.utcnow() - timedelta(days=2)).date().isoformat()
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json={
            "event_date": past,
            "line_items": [{"service_id": seeded["hall"], "quantity": 1}],
            "contact_name": "x", "contact_phone": "y",
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "future" in r.text.lower()

    def test_empty_cart(self, cust_h):
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json={
            "event_date": _future_date(),
            "contact_name": "x", "contact_phone": "y",
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "empty" in r.text.lower()

    def test_unknown_service_id(self, cust_h):
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json={
            "event_date": _future_date(),
            "line_items": [{"service_id": "does-not-exist-xyz", "quantity": 1}],
            "contact_name": "x", "contact_phone": "y",
        }, timeout=20)
        assert r.status_code == 400, r.text
        assert "not found" in r.text.lower()


# ─── Auth ──────────────────────────────────────────────────────────────
class TestCartCheckoutAuth:
    def test_no_token_rejected(self, seeded):
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", json={
            "event_date": _future_date(),
            "line_items": [{"service_id": seeded["hall"], "quantity": 1}],
            "contact_name": "x", "contact_phone": "y",
        }, timeout=20)
        assert r.status_code in (401, 403), r.text

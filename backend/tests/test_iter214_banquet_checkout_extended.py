"""Backend tests for iter214 — Banquet cart checkout extension:
fields event_time / address / service_fee / promo_code / promo_discount
and response total_price = subtotal + service_fee - promo_discount.

Also re-runs a subset of the iter208 happy-path checks to confirm regression.
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
CITY = "Yaounde"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_h():
    t = _login(ADMIN_EMAIL, ADMIN_PASS)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def cust_h():
    t = _login(CUST_EMAIL, CUST_PASS)
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hall_id(admin_h):
    payload = {
        "name": f"TEST_iter214_Hall_{uuid.uuid4().hex[:6]}",
        "city": CITY, "country": "Cameroon", "address": "Test St",
        "venue_type": "indoor", "capacity_min": 10, "capacity_max": 500,
        "base_price": 45000, "pricing_model": "per_hour", "duration_hours": 5,
        "category": "hall", "description": "TEST hall per_hour",
    }
    r = requests.post(f"{BASE_URL}/api/banquets/", headers=admin_h, json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()["banquet_id"]


def _future_date(days=21):
    return (datetime.utcnow() + timedelta(days=days)).date().isoformat()


class TestExtendedCheckoutFields:
    def test_checkout_with_all_new_fields_no_promo(self, cust_h, hall_id):
        # 45000 * 5h * 1 = 225000 subtotal; service_fee 2500 → total 227500
        body = {
            "event_date": _future_date(),
            "event_time": "17:00",
            "expected_guests": 150,
            "event_type": "wedding",
            "line_items": [{"service_id": hall_id, "quantity": 1, "hours": 5}],
            "contact_name": "TEST iter214",
            "contact_phone": "+237600000000",
            "contact_email": "iter214@test.com",
            "address": "Hilton Yaoundé, Boulevard du 20 Mai",
            "special_requests": "Vegetarian menu",
            "service_fee": 2500,
            "promo_code": None,
            "promo_discount": 0,
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=25)
        assert r.status_code == 200, r.text
        d = r.json()
        # Core regression
        assert "order_id" in d, d
        assert d.get("order_number", "").startswith("EVT-")
        # New response fields
        assert d.get("subtotal") == 225000, d
        assert d.get("service_fee") == 2500, d
        assert d.get("promo_discount", 0) == 0, d
        assert d.get("total_price") == 227500, d  # 225000 + 2500 - 0

    def test_checkout_with_promo_discount(self, cust_h, hall_id):
        # subtotal 225000 + fee 2500 - promo 5000 = 222500
        body = {
            "event_date": _future_date(),
            "event_time": "18:00",
            "line_items": [{"service_id": hall_id, "quantity": 1, "hours": 5}],
            "contact_name": "TEST",
            "contact_phone": "+237600",
            "address": "Test address",
            "service_fee": 2500,
            "promo_code": "TESTCODE",
            "promo_discount": 5000,
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("subtotal") == 225000
        assert d.get("service_fee") == 2500
        assert d.get("promo_discount") == 5000
        assert d.get("total_price") == 222500, d

    def test_persisted_fields_visible_in_bookings(self, cust_h, hall_id):
        body = {
            "event_date": _future_date(),
            "event_time": "19:30",
            "line_items": [{"service_id": hall_id, "quantity": 1, "hours": 5}],
            "contact_name": "TEST persist",
            "contact_phone": "+237600000001",
            "address": "Persistence Test Hall",
            "service_fee": 2500,
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        gb = requests.get(f"{BASE_URL}/api/banquets/bookings/my", headers=cust_h, timeout=20)
        assert gb.status_code == 200
        bookings = gb.json().get("bookings", [])
        match = next((b for b in bookings if b.get("order_id") == order_id), None)
        assert match is not None, "newly-created booking missing from /bookings/my"
        # event_time and address should be retrievable somewhere on the booking row
        flat = str(match)
        assert "19:30" in flat or match.get("event_time") == "19:30", match
        assert "Persistence Test Hall" in flat, match

    def test_optional_new_fields_omitted_still_works(self, cust_h, hall_id):
        # iter208 regression: omitting all new fields must still succeed
        body = {
            "event_date": _future_date(),
            "line_items": [{"service_id": hall_id, "quantity": 1, "hours": 5}],
            "contact_name": "TEST",
            "contact_phone": "+237600",
        }
        r = requests.post(f"{BASE_URL}/api/banquets/cart/checkout", headers=cust_h, json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        # subtotal == total because no fee/promo
        assert d.get("total_price") == 225000 or d.get("subtotal") == 225000

"""Tests for /api/analytics/admin/operator-comparison."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

CARTER = "00809e3f-8196-4580-8ce2-bff1720df8f4"
MUSANGO = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
NETFLIX = "9f0179c6-424b-42a1-bdb0-7330c397508e"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code == 429:
        pytest.skip("rate limited")
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def superadmin_token():
    return _login("superadmin@oryno.com", "testpassword123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@test.com", "testpassword123")


@pytest.fixture(scope="module")
def operator_token():
    return _login("operator@test.com", "testpassword123")


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def test_two_operators_returns_metrics(superadmin_token):
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": f"{CARTER},{MUSANGO}", "period": "30days"},
        headers=_hdr(superadmin_token), timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "operators" in body
    ops = body["operators"]
    assert len(ops) == 2
    for op in ops:
        for key in ("operator_id", "operator_name", "total_orders", "total_revenue",
                    "completed_orders", "avg_order_value", "completion_rate",
                    "daily_data", "by_category"):
            assert key in op, f"missing key {key}"
        assert isinstance(op["daily_data"], list)
        assert isinstance(op["by_category"], list)


def test_three_operators_ok(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": f"{CARTER},{MUSANGO},{NETFLIX}", "period": "7days"},
        headers=_hdr(admin_token), timeout=30,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["operators"]) == 3


def test_one_operator_rejected(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": CARTER, "period": "30days"},
        headers=_hdr(admin_token), timeout=30,
    )
    assert r.status_code == 400, r.text


def test_four_operators_rejected(admin_token):
    ids = ",".join([CARTER, MUSANGO, NETFLIX, CARTER])
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": ids, "period": "30days"},
        headers=_hdr(admin_token), timeout=30,
    )
    assert r.status_code == 400, r.text


def test_operator_role_forbidden(operator_token):
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": f"{CARTER},{MUSANGO}", "period": "30days"},
        headers=_hdr(operator_token), timeout=30,
    )
    assert r.status_code in (401, 403), r.text


def test_unauthenticated_rejected():
    r = requests.get(
        f"{BASE_URL}/api/analytics/admin/operator-comparison",
        params={"operator_ids": f"{CARTER},{MUSANGO}", "period": "30days"},
        timeout=30,
    )
    assert r.status_code in (401, 403), r.text

"""Test /api/management/dashboard-stats effective vs gross totals."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def operator_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "operator@test.com", "password": "testpassword123"},
                      timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@test.com", "password": "testpassword123"},
                      timeout=30)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.mark.parametrize("service_type", ["hotel", "event", "banquet", "restaurant", "cinema"])
def test_dashboard_stats_effective_le_gross(operator_token, admin_token, service_type):
    # try operator first, fallback to admin for services the operator may not have
    for token in (operator_token, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": service_type},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if r.status_code == 200:
            break
    assert r.status_code == 200, f"{service_type}: {r.status_code} {r.text[:300]}"
    body = r.json()
    data = body.get("stats", body)
    for k in ("totalBookings", "totalRevenue", "grossBookings", "grossRevenue"):
        assert k in data, f"{service_type} missing field {k}: keys={list(data.keys())}"
    tb, tr = data["totalBookings"], data["totalRevenue"]
    gb, gr = data["grossBookings"], data["grossRevenue"]
    assert isinstance(tb, (int, float)) and isinstance(gb, (int, float))
    assert tb <= gb, f"{service_type}: totalBookings({tb}) > grossBookings({gb})"
    assert tr <= gr + 1e-6, f"{service_type}: totalRevenue({tr}) > grossRevenue({gr})"
    print(f"[{service_type}] tb={tb} gb={gb} tr={tr} gr={gr}")

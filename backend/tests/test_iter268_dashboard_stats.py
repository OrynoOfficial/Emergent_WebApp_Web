"""Iteration 268: Management dashboard stats - verify totalBookings vs grossBookings."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def op_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "operator@test.com", "password": "testpassword123"},
                      timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.mark.parametrize("service_type", ["hotel", "hotels", "event", "events", "cinema", "travel", "restaurants"])
def test_dashboard_stats_gross_and_effective(op_token, service_type):
    r = requests.get(f"{BASE_URL}/api/management/dashboard-stats",
                     params={"service_type": service_type},
                     headers={"Authorization": f"Bearer {op_token}"},
                     timeout=30)
    assert r.status_code == 200, f"{service_type}: {r.status_code} {r.text}"
    data = r.json()
    stats = data.get("stats", {})
    for key in ("totalBookings", "totalRevenue", "grossBookings", "grossRevenue"):
        assert key in stats, f"{service_type}: missing {key} in stats {list(stats.keys())}"
    assert stats["totalBookings"] <= stats["grossBookings"], \
        f"{service_type}: totalBookings {stats['totalBookings']} > grossBookings {stats['grossBookings']}"
    assert stats["totalRevenue"] <= stats["grossRevenue"], \
        f"{service_type}: totalRevenue {stats['totalRevenue']} > grossRevenue {stats['grossRevenue']}"
    # numeric types
    assert isinstance(stats["totalBookings"], (int, float))
    assert isinstance(stats["grossBookings"], (int, float))
    print(f"{service_type}: totalBookings={stats['totalBookings']} grossBookings={stats['grossBookings']} "
          f"totalRevenue={stats['totalRevenue']} grossRevenue={stats['grossRevenue']}")

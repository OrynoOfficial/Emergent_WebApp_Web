"""
Verifies:
 1) Operator-scoping bug fix on /management/my-* endpoints for hotels, restaurants,
    car-rental, events, cinema, laundry, banquets, and packages.
 2) /analytics/overview returns a dailyTrend array with 14 daily buckets (latest = today).
 3) /orders/?operator_id=X filters as admin.
"""
import os
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@test.com", "password": "testpassword123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def operator_token():
    r = requests.post(f"{API}/auth/login", json={"email": "operator@test.com", "password": "testpassword123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_user_id(admin_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    return r.json().get("id")


@pytest.fixture(scope="module")
def operator_user_id(operator_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {operator_token}"}, timeout=20)
    me = r.json()
    # An operator user has a dedicated operator_id field that links to their org/operator entity.
    # Services are scoped by that operator_id (not by the auth user id).
    return me.get("operator_id") or me.get("id")


# ---------------- Operator scoping ----------------
def _extract_items(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # try common wrapping keys
        for k in ("items", "data", "hotels", "restaurants", "vehicles", "cars", "events",
                  "cinemas", "shops", "venues", "packages", "results", "orders"):
            if k in data and isinstance(data[k], list):
                return data[k]
    return []


MGMT_PATHS = [
    ("/hotels/management/my-hotels", "hotels"),
    ("/restaurants/management/my-restaurants", "restaurants"),
    ("/car-rental/management/my-vehicles", "car-rental"),
    ("/events/management/my-events", "events"),
    ("/cinema/management/my-cinemas", "cinema"),
    ("/pressing/management/my-shops", "laundry"),
    ("/banquets/management/my-venues", "banquets"),
]


@pytest.mark.parametrize("path,name", MGMT_PATHS)
def test_operator_sees_only_own_services(path, name, operator_token, operator_user_id):
    r = requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {operator_token}"}, timeout=20)
    assert r.status_code == 200, f"{name} -> {r.status_code} {r.text[:200]}"
    data = r.json()
    items = _extract_items(data)
    # All returned items must belong to this operator
    leaked = []
    for item in items:
        owner = item.get("operator_id") or item.get("owner_id") or item.get("user_id")
        if owner is not None and owner != operator_user_id:
            leaked.append({"id": item.get("id"), "operator_id": owner})
    assert not leaked, f"{name}: leaked items belonging to other operators: {leaked[:3]}"
    print(f"[{name}] operator sees {len(items)} item(s) — scoped OK")


@pytest.mark.parametrize("path,name", MGMT_PATHS)
def test_admin_sees_services(path, name, admin_token):
    r = requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200, f"{name} -> {r.status_code} {r.text[:200]}"
    data = r.json()
    items = _extract_items(data)
    print(f"[{name}] admin sees {len(items)} item(s)")


def test_packages_requires_auth_and_scopes(operator_token, operator_user_id, admin_token):
    # Unauth should be rejected (per fix: GET /packages/ now requires auth)
    r_unauth = requests.get(f"{API}/packages/", timeout=20)
    assert r_unauth.status_code in (401, 403), f"packages should require auth, got {r_unauth.status_code}"

    # Operator: only own packages
    r_op = requests.get(f"{API}/packages/", headers={"Authorization": f"Bearer {operator_token}"}, timeout=20)
    assert r_op.status_code == 200, r_op.text
    data = r_op.json()
    items = _extract_items(data)
    leaked = []
    for it in items:
        owner = it.get("operator_id") or it.get("owner_id")
        if owner is not None and owner != operator_user_id:
            leaked.append({"id": it.get("id"), "operator_id": owner})
    assert not leaked, f"packages leaked: {leaked[:3]}"

    # Admin should see all without error
    r_admin = requests.get(f"{API}/packages/", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r_admin.status_code == 200, r_admin.text


# ---------------- Analytics overview dailyTrend ----------------
def test_analytics_overview_daily_trend(admin_token):
    r = requests.get(f"{API}/analytics/overview", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "dailyTrend" in body, f"missing dailyTrend in {list(body.keys())}"
    trend = body["dailyTrend"]
    assert isinstance(trend, list) and len(trend) == 14, f"expected 14 buckets got {len(trend)}"
    for b in trend:
        assert "date" in b and "label" in b and "orders" in b and "revenue" in b, f"bucket missing keys: {b}"
    # Latest date should be today (UTC)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_date = trend[-1]["date"]
    # Allow trend ordered ascending. If descending, latest is trend[0].
    assert today in (trend[-1]["date"], trend[0]["date"]), f"latest date {last_date} != today {today}"
    print(f"dailyTrend OK: {trend[0]['date']} -> {trend[-1]['date']}")


# ---------------- Orders operator_id filter ----------------
def test_orders_operator_id_filter_as_admin(admin_token, operator_user_id):
    r = requests.get(
        f"{API}/orders/?operator_id={operator_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    items = _extract_items(body)
    # All must belong to that operator (if not empty)
    leaked = []
    for o in items:
        owner = o.get("operator_id")
        if owner is not None and owner != operator_user_id:
            leaked.append({"id": o.get("id"), "operator_id": owner})
    assert not leaked, f"orders leaked: {leaked[:3]}"
    print(f"orders?operator_id filter OK: {len(items)} orders")

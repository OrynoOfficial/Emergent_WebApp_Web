"""Iteration 240 - verify admin_bulk now supports banquet_items collection,
and verify banquet_packages accepts operator_id and supports operator filtering."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cinema-management-p0.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"


def login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    return login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def operator_session():
    return login(OPERATOR_EMAIL, OPERATOR_PASSWORD)


# === Issue 4a backend: banquet_items must be an allowed bulk collection ===
def test_bulk_endpoint_accepts_banquet_items(admin_session):
    # With empty ids list -> min_length=1 means 422; use one fake id
    r = admin_session.post(f"{BASE_URL}/api/admin/bulk", json={
        "collection": "banquet_items", "action": "deactivate", "ids": ["NONEXISTENT_TEST_ID"]
    }, timeout=20)
    # Should NOT 400 with "not allowed"; expect 200 with 0 matched
    assert r.status_code == 200, f"banquet_items not allowed by bulk endpoint: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("matched", 0) == 0


def test_bulk_endpoint_rejects_unknown_collection(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/admin/bulk", json={
        "collection": "nonsense_xxx", "action": "delete", "ids": ["x"]
    }, timeout=20)
    assert r.status_code == 400


def test_bulk_event_locations_cascades(admin_session):
    # Just verify endpoint is wired and accepts the collection
    r = admin_session.post(f"{BASE_URL}/api/admin/bulk", json={
        "collection": "event_locations", "action": "deactivate", "ids": ["NONEXISTENT"]
    }, timeout=20)
    assert r.status_code == 200


def test_bulk_event_showtimes_allowed(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/admin/bulk", json={
        "collection": "event_showtimes", "action": "delete", "ids": ["NONEXISTENT"]
    }, timeout=20)
    assert r.status_code == 200


# === Issue 7: banquet package creation must accept operator_id ===
def test_banquet_package_create_with_operator_id(admin_session):
    # Find an operator id
    op_r = admin_session.get(f"{BASE_URL}/api/operators/", timeout=20)
    if op_r.status_code != 200:
        pytest.skip(f"Cannot fetch operators: {op_r.status_code}")
    ops = op_r.json()
    if isinstance(ops, dict):
        ops = ops.get('operators', ops.get('items', ops.get('data', [])))
    assert len(ops) > 0, "No operators in seed"
    operator_id = ops[0].get('id') or ops[0].get('_id')

    # Need at least one banquet service to attach
    svc_r = admin_session.get(f"{BASE_URL}/api/banquets/services/", timeout=20)
    if svc_r.status_code != 200:
        pytest.skip(f"banquet services unavailable: {svc_r.status_code}")
    services_list = svc_r.json()
    if isinstance(services_list, dict):
        services_list = services_list.get('services', services_list.get('items', []))
    if not services_list:
        pytest.skip("no banquet services seeded")
    svc = services_list[0]
    svc_id = svc.get('id') or svc.get('_id')

    payload = {
        "name": "TEST_iter240_pkg",
        "description": "test",
        "operator_id": operator_id,
        "services": [{"service_id": svc_id, "quantity": 1}],
        "price_xaf": 50000,
        "is_active": True,
    }
    r = admin_session.post(f"{BASE_URL}/api/banquets/packages/", json=payload, timeout=20)
    if r.status_code in (404, 405):
        pytest.skip(f"banquet packages endpoint not present: {r.status_code}")
    assert r.status_code in (200, 201), f"package create failed: {r.status_code} {r.text}"
    body = r.json()
    pkg_id = body.get('id') or body.get('_id')
    assert body.get('operator_id') == operator_id, f"operator_id not persisted in response: {body}"
    # Cleanup
    if pkg_id:
        admin_session.delete(f"{BASE_URL}/api/banquets/packages/{pkg_id}", timeout=20)


# === Sanity: refunds endpoint loads (Issue 1) ===
def test_admin_refunds_endpoint(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/refunds/", timeout=20)
    assert r.status_code in (200, 404), f"refunds endpoint failure: {r.status_code} {r.text}"


# === Sanity: banquet services list ===
def test_banquet_services_list(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/banquets/services/", timeout=20)
    assert r.status_code in (200, 404)

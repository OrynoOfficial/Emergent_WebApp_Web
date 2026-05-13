"""Iteration 145 — New package-service offerings MUST always start as 'pending',
regardless of creator role. Previously super_admin/admin were fast-tracked to 'active'.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

CREDS = {
    "superadmin": ("superadmin@oryno.com", "testpassword123"),
    "admin": ("admin@test.com", "testpassword123"),
    "operator": ("operator@test.com", "testpassword123"),
}

SAMPLE_PAYLOAD = {
    "name": "TEST_PendingSvc_{}",
    "origin_city": "Yaoundé",
    "destination_city": "Bafoussam",
    "pricing_model": "per_kg",
    "base_price": 1000,
    "per_kg_rate": 250,
    "max_weight_kg": 30,
    "delivery_time_hours": 24,
    "accepted_types": ["document", "parcel"],
    "features": ["tracking"],
    "operator_id": "",  # fills from user
}


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def superadmin_token():
    return _login(*CREDS["superadmin"])


@pytest.fixture(scope="module")
def admin_token():
    return _login(*CREDS["admin"])


@pytest.fixture(scope="module")
def operator_token():
    try:
        return _login(*CREDS["operator"])
    except AssertionError:
        pytest.skip("operator login failed")


def _create_service(token: str, suffix: str) -> dict:
    payload = dict(SAMPLE_PAYLOAD)
    payload["name"] = payload["name"].format(suffix)
    r = requests.post(f"{BASE_URL}/api/package-services/", json=payload, headers=_headers(token), timeout=15)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    return r.json()


def _delete_service(token: str, service_id: str) -> None:
    try:
        requests.delete(f"{BASE_URL}/api/package-services/{service_id}", headers=_headers(token), timeout=10)
    except Exception:
        pass


def test_superadmin_create_service_is_pending(superadmin_token):
    created_id = None
    try:
        res = _create_service(superadmin_token, "sa")
        assert res.get("status") == "pending", f"expected pending, got {res.get('status')}: {res}"
        created_id = res["service_id"]

        # Verify via GET
        g = requests.get(f"{BASE_URL}/api/package-services/{created_id}", headers=_headers(superadmin_token), timeout=10)
        assert g.status_code == 200
        assert g.json()["status"] == "pending"
    finally:
        if created_id:
            _delete_service(superadmin_token, created_id)


def test_admin_create_service_is_pending(admin_token, superadmin_token):
    created_id = None
    try:
        res = _create_service(admin_token, "adm")
        assert res.get("status") == "pending", f"expected pending, got {res.get('status')}: {res}"
        created_id = res["service_id"]
        g = requests.get(f"{BASE_URL}/api/package-services/{created_id}", headers=_headers(admin_token), timeout=10)
        assert g.json()["status"] == "pending"
    finally:
        if created_id:
            _delete_service(superadmin_token, created_id)


def test_operator_create_service_is_pending(operator_token, superadmin_token):
    created_id = None
    try:
        payload = dict(SAMPLE_PAYLOAD)
        payload["name"] = "TEST_PendingSvc_op"
        r = requests.post(f"{BASE_URL}/api/package-services/", json=payload, headers=_headers(operator_token), timeout=15)
        if r.status_code == 403:
            pytest.skip(f"operator lacks packages.create permission: {r.text}")
        assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
        res = r.json()
        assert res.get("status") == "pending", f"expected pending, got {res.get('status')}"
        created_id = res["service_id"]
    finally:
        if created_id:
            _delete_service(superadmin_token, created_id)


def test_legacy_active_service_remains_active(superadmin_token):
    """Any pre-existing active service must remain active (no regression)."""
    r = requests.get(
        f"{BASE_URL}/api/package-services/",
        params={"status": "active", "limit": 200},
        headers=_headers(superadmin_token),
        timeout=15,
    )
    assert r.status_code == 200
    services = r.json().get("services", [])
    # Only pre-existing legacy seed services (they all must still be active)
    legacy = [s for s in services if not (s.get("name") or "").startswith("TEST_")]
    assert legacy, "No legacy active service found (expected at least one — e.g. Bwako-Ko or CoCo-Yams)"
    for s in legacy:
        assert s.get("status") == "active", f"legacy service {s.get('name')} no longer active: {s.get('status')}"


def test_pending_service_hidden_from_search(superadmin_token):
    """A newly-created (pending) service must NOT appear in public /search."""
    created_id = None
    try:
        res = _create_service(superadmin_token, "hidden")
        created_id = res["service_id"]
        # Hit public search for its route (no auth)
        s = requests.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaoundé", "destination_city": "Bafoussam", "limit": 100},
            timeout=15,
        )
        assert s.status_code == 200
        ids = [x["id"] for x in s.json().get("services", [])]
        assert created_id not in ids, f"pending service leaked into public search: {ids}"
    finally:
        if created_id:
            _delete_service(superadmin_token, created_id)


def test_superadmin_can_approve_pending(superadmin_token):
    """Approve pending service via validation endpoint; verify it becomes active + appears in search."""
    created_id = None
    try:
        res = _create_service(superadmin_token, "approveme")
        created_id = res["service_id"]
        assert res["status"] == "pending"

        ap = requests.post(
            f"{BASE_URL}/api/validation/services/package_service/{created_id}/approve",
            headers=_headers(superadmin_token),
            timeout=15,
        )
        assert ap.status_code in (200, 201), f"approve failed: {ap.status_code} {ap.text}"

        g = requests.get(f"{BASE_URL}/api/package-services/{created_id}", headers=_headers(superadmin_token), timeout=10)
        assert g.status_code == 200
        assert g.json().get("status") == "active", f"status after approve: {g.json().get('status')}"

        # Should appear in public search now
        s = requests.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaoundé", "destination_city": "Bafoussam", "limit": 200},
            timeout=15,
        )
        ids = [x["id"] for x in s.json().get("services", [])]
        assert created_id in ids, "approved service did not appear in public search"
    finally:
        if created_id:
            _delete_service(superadmin_token, created_id)

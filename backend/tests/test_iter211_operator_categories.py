"""Iteration 211 - Operator service-category assignment tests.

Covers:
- PUT /api/operators/{id} accepts qualified tags like 'banquet.catering'
- GET /api/operators/by-service-category for banquet + restaurant cuisine
- 403 for users without operators.view permission
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@oryno.com"
SUPER_PASS = "testpassword123"
CUST_EMAIL = "customer@test.com"
CUST_PASS = "testpassword123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def cust_token():
    return _login(CUST_EMAIL, CUST_PASS)


@pytest.fixture(scope="module")
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}"}


@pytest.fixture(scope="module")
def oryno_operator(super_headers):
    """Find an operator with banquet service area (Oryno Travel & Hospitality preferred)."""
    r = requests.get(f"{API}/operators/?limit=100", headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    payload = r.json()
    ops = payload.get("operators") if isinstance(payload, dict) else payload
    assert ops, "No operators returned"
    # Prefer Oryno; else any banquet-capable operator
    chosen = None
    for op in ops:
        if "oryno" in op.get("name", "").lower():
            chosen = op
            break
    if not chosen:
        for op in ops:
            st = op.get("service_types") or []
            if "banquet" in st or op.get("operator_type") == "banquet" or op.get("operator_type") == "multi":
                chosen = op
                break
    assert chosen, "Could not find a banquet-capable operator"
    return chosen


class TestOperatorCategoryAssignment:
    """Backend: tagging operator with qualified sub-category strings."""

    def test_put_operator_persists_qualified_tags(self, super_headers, oryno_operator):
        op_id = oryno_operator["id"]
        # Fetch current operator to merge service_types
        r = requests.get(f"{API}/operators/{op_id}", headers=super_headers, timeout=20)
        assert r.status_code == 200, r.text
        current = r.json()
        existing_types = list(current.get("service_types") or [])

        new_types = sorted(set(existing_types + ["banquet", "banquet.catering", "banquet.photographer"]))
        update = requests.put(
            f"{API}/operators/{op_id}",
            headers=super_headers,
            json={"service_types": new_types},
            timeout=20,
        )
        assert update.status_code == 200, f"PUT failed: {update.status_code} {update.text}"

        # Verify persistence
        verify = requests.get(f"{API}/operators/{op_id}", headers=super_headers, timeout=20)
        assert verify.status_code == 200, verify.text
        persisted = verify.json().get("service_types") or []
        assert "banquet.catering" in persisted, f"banquet.catering not persisted: {persisted}"
        assert "banquet.photographer" in persisted, f"banquet.photographer not persisted: {persisted}"


class TestByServiceCategory:
    """Backend: /api/operators/by-service-category endpoint."""

    def test_banquet_catering_includes_tagged_operator(self, super_headers, oryno_operator):
        op_id = oryno_operator["id"]
        # Ensure the operator has the qualified tag
        r = requests.get(f"{API}/operators/{op_id}", headers=super_headers, timeout=20)
        existing = r.json().get("service_types") or []
        if "banquet.catering" not in existing:
            requests.put(
                f"{API}/operators/{op_id}",
                headers=super_headers,
                json={"service_types": sorted(set(existing + ["banquet", "banquet.catering"]))},
                timeout=20,
            )

        resp = requests.get(
            f"{API}/operators/by-service-category",
            params={"service_type": "banquet", "category": "catering"},
            headers=super_headers,
            timeout=20,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("category") == "catering"
        assert data.get("service_type") == "banquet"
        ops = data.get("operators") or []
        found = [o for o in ops if o["id"] == op_id]
        assert found, f"Tagged operator {op_id} not in result: {[o['id'] for o in ops]}"
        # Since no active banquet doc in that category may exist, flag must be False or True - just exists
        assert "has_active_service_in_category" in found[0]

    def test_bare_category_tag_also_works(self, super_headers, oryno_operator):
        """Bare 'catering' (without banquet. prefix) should also match."""
        op_id = oryno_operator["id"]
        r = requests.get(f"{API}/operators/{op_id}", headers=super_headers, timeout=20)
        existing = r.json().get("service_types") or []
        # Replace qualified tags with bare ones temporarily
        new_types = [t for t in existing if not t.startswith("banquet.")]
        if "catering" not in new_types:
            new_types.append("catering")
        if "banquet" not in new_types:
            new_types.append("banquet")
        requests.put(
            f"{API}/operators/{op_id}",
            headers=super_headers,
            json={"service_types": sorted(set(new_types))},
            timeout=20,
        )

        resp = requests.get(
            f"{API}/operators/by-service-category",
            params={"service_type": "banquet", "category": "catering"},
            headers=super_headers,
            timeout=20,
        )
        assert resp.status_code == 200, resp.text
        ops = resp.json().get("operators") or []
        assert any(o["id"] == op_id for o in ops), "Bare 'catering' tag did not match operator"

        # Restore qualified tag for downstream tests
        requests.put(
            f"{API}/operators/{op_id}",
            headers=super_headers,
            json={"service_types": sorted(set(new_types + ["banquet.catering"]))},
            timeout=20,
        )

    def test_restaurant_cuisine_filter(self, super_headers):
        resp = requests.get(
            f"{API}/operators/by-service-category",
            params={"service_type": "restaurant", "category": "italian"},
            headers=super_headers,
            timeout=20,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("service_type") == "restaurant"
        assert data.get("category") == "italian"
        assert isinstance(data.get("operators"), list)

    def test_requires_operators_view_permission(self, cust_token):
        headers = {"Authorization": f"Bearer {cust_token}"}
        resp = requests.get(
            f"{API}/operators/by-service-category",
            params={"service_type": "banquet", "category": "catering"},
            headers=headers,
            timeout=20,
        )
        assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}: {resp.text}"

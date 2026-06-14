"""Backend tests for the role-chips + DnD P3 features.

Covers:
- POST /api/auth/login    (admin)
- GET  /api/access/roles  (returns {id, name, color})
- GET  /api/users/        (returns assigned_roles field per user)
- PUT  /api/access/users/{id}/permissions   (DnD assignment endpoint)
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
CUSTOMER_EMAIL = "customer@test.com"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestRolesEndpoint:
    def test_get_roles_shape(self, headers):
        r = requests.get(f"{BASE_URL}/api/access/roles", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        roles = body.get("roles") if isinstance(body, dict) else body
        assert isinstance(roles, list) and len(roles) > 0
        sample = roles[0]
        for key in ("id", "name"):
            assert key in sample, f"role missing key {key}: {sample}"
        # color may be optional but is expected by chip resolver
        # ensure at least one role has color
        assert any("color" in r for r in roles), "No role has color field"


class TestUsersEndpoint:
    def test_get_users_returns_assigned_roles(self, headers):
        r = requests.get(f"{BASE_URL}/api/users/", headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        users = r.json().get("users") or r.json()
        assert isinstance(users, list) and len(users) > 0
        # `assigned_roles` should be present (possibly empty list) on each user
        sample = users[0]
        assert "assigned_roles" in sample or "assigned_role_ids" in sample, f"keys: {list(sample.keys())}"


class TestDndAssignment:
    """Simulate DnD via PUT /api/access/users/{id}/permissions."""

    def _find_customer(self, headers):
        r = requests.get(f"{BASE_URL}/api/users/", headers=headers, timeout=20)
        users = r.json().get("users") or r.json()
        for u in users:
            if u.get("email") == CUSTOMER_EMAIL:
                return u
        # fallback any non-admin user
        for u in users:
            if u.get("role") == "customer":
                return u
        pytest.skip("No customer user available")

    def _pick_non_system_role(self, headers):
        r = requests.get(f"{BASE_URL}/api/access/roles", headers=headers, timeout=15)
        roles = r.json().get("roles") or r.json()
        for r_ in roles:
            if not r_.get("isSystem") and not r_.get("is_system") and r_["id"] not in ("admin", "super_admin", "customer", "operator", "employee", "service_provider"):
                return r_
        # fallback to first non admin
        for r_ in roles:
            if r_["id"] not in ("admin", "super_admin"):
                return r_
        pytest.skip("No assignable role found")

    def test_dnd_assign_and_verify(self, headers):
        user = self._find_customer(headers)
        role = self._pick_non_system_role(headers)
        uid, rid = user["id"], role["id"]

        existing = user.get("assigned_roles") or []
        # remove first if already present to ensure clean assign
        if rid in existing:
            new_list = [x for x in existing if x != rid]
            requests.put(
                f"{BASE_URL}/api/access/users/{uid}/permissions",
                json={"assigned_roles": new_list, "permissions": []},
                headers=headers, timeout=15,
            )
            existing = new_list

        # Assign role
        target = existing + [rid]
        r = requests.put(
            f"{BASE_URL}/api/access/users/{uid}/permissions",
            json={"assigned_roles": target, "permissions": []},
            headers=headers, timeout=15,
        )
        assert r.status_code in (200, 204), r.text

        # Verify via GET
        r2 = requests.get(f"{BASE_URL}/api/users/", headers=headers, timeout=20)
        users = r2.json().get("users") or r2.json()
        u_after = next((u for u in users if u["id"] == uid), None)
        assert u_after is not None
        assert rid in (u_after.get("assigned_roles") or []), f"Role not persisted. assigned_roles={u_after.get('assigned_roles')}"

        # Cleanup: remove the role we added if it wasn't there originally
        cleanup = [x for x in target if x != rid]
        requests.put(
            f"{BASE_URL}/api/access/users/{uid}/permissions",
            json={"assigned_roles": cleanup, "permissions": []},
            headers=headers, timeout=15,
        )

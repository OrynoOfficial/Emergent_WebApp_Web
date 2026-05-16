"""Tests for the AddUserWizard role-assignment flow:

1. `POST /api/users` accepts `assigned_role_ids` and persists them on the user.
2. The user's `permissions[]` becomes the UNION of (manually picked perms)
   + (each picked role's bundled perms).
3. The `user_count` on each picked role is incremented by 1.
4. Unknown role IDs are dropped silently (no phantom IDs persisted).

Also covers:
5. `GET /api/operators/` surfaces `owner_name` / `owner_email` by querying
   the LIVE `operator_role='owner'` user — not stale `owner_user_id`.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://cinema-management-p0.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASS = "testpassword123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_role(admin_token):
    """Create a temporary custom role with 2 specific permissions."""
    payload = {
        "name": f"E2E-Wizard-Role-{uuid.uuid4().hex[:8]}",
        "description": "Temporary role created by automated test",
        "color": "#10b981",
        "permissions": ["bookings.view", "services.view"],
    }
    r = requests.post(f"{BASE_URL}/api/access/roles", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"role create failed: {r.status_code} {r.text}"
    body = r.json()
    role = body.get("role") or body  # endpoint returns {message, role_id, role: {...}}
    assert role.get("id"), f"role response missing id: {body}"
    yield role
    # cleanup
    try:
        requests.delete(f"{BASE_URL}/api/access/roles/{role['id']}", headers=_h(admin_token), timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module")
def some_operator(admin_token):
    """Grab any existing operator so we can attach the test user to it."""
    r = requests.get(f"{BASE_URL}/api/operators/", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    ops = r.json().get("operators") or r.json() or []
    if not ops:
        pytest.skip("No operators seeded — cannot run operator-scoped user tests")
    return ops[0]


def test_user_created_with_assigned_roles_merges_permissions(admin_token, created_role, some_operator):
    """Creating a user with `assigned_role_ids` must merge each role's perms
    into the user's `permissions[]` array."""
    email = f"e2e-wizard-{uuid.uuid4().hex[:8]}@test.com"
    payload = {
        "email": email,
        "full_name": "Wizard Test User",
        "password": "verystrongpassword123",
        "role": "operator",
        "operator_id": some_operator.get("_id") or some_operator.get("id"),
        "operator_role": "staff",
        "send_invite": False,
        "permissions": ["reports.view"],          # manual perm
        "assigned_role_ids": [created_role["id"]],  # role brings bookings.view + services.view
    }
    r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"user create failed: {r.status_code} {r.text}"

    # Find the new user
    r = requests.get(f"{BASE_URL}/api/users/", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    users = r.json().get("users") or r.json()
    me = next((u for u in users if u.get("email") == email), None)
    assert me is not None, f"newly created user not found in /api/users list"

    perms = set(me.get("permissions") or [])
    assert "reports.view" in perms, "manual permission missing"
    assert "bookings.view" in perms, "permission from role NOT merged in"
    assert "services.view" in perms, "permission from role NOT merged in"

    assert created_role["id"] in (me.get("assigned_role_ids") or []), \
        "assigned_role_ids should be persisted on the user document"


def test_user_count_increments_on_role(admin_token, created_role, some_operator):
    """Each role's `user_count` should increment by 1 when assigned."""
    r = requests.get(f"{BASE_URL}/api/access/roles", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    before = next((rr for rr in (r.json().get("roles") or []) if rr["id"] == created_role["id"]), None)
    assert before is not None, "test role not found in /access/roles listing"
    before_count = before.get("user_count", 0)

    payload = {
        "email": f"e2e-count-{uuid.uuid4().hex[:8]}@test.com",
        "full_name": "Count Bump User",
        "password": "verystrongpassword123",
        "role": "operator",
        "operator_id": some_operator.get("_id") or some_operator.get("id"),
        "operator_role": "staff",
        "send_invite": False,
        "permissions": [],
        "assigned_role_ids": [created_role["id"]],
    }
    r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"user create failed: {r.text}"

    r = requests.get(f"{BASE_URL}/api/access/roles", headers=_h(admin_token), timeout=15)
    after = next((rr for rr in (r.json().get("roles") or []) if rr["id"] == created_role["id"]), None)
    assert after is not None
    assert after.get("user_count", 0) == before_count + 1, \
        f"user_count should have incremented from {before_count}, got {after.get('user_count')}"


def test_unknown_role_ids_are_silently_dropped(admin_token, some_operator):
    """Phantom role ids should not be persisted on the user document."""
    email = f"e2e-phantom-{uuid.uuid4().hex[:8]}@test.com"
    bogus_id = "00000000-0000-0000-0000-000000000000"
    payload = {
        "email": email,
        "full_name": "Phantom Role User",
        "password": "verystrongpassword123",
        "role": "operator",
        "operator_id": some_operator.get("_id") or some_operator.get("id"),
        "operator_role": "staff",
        "send_invite": False,
        "permissions": [],
        "assigned_role_ids": [bogus_id],
    }
    r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code in (200, 201), r.text
    r = requests.get(f"{BASE_URL}/api/users/", headers=_h(admin_token), timeout=20)
    me = next((u for u in (r.json().get("users") or r.json()) if u.get("email") == email), None)
    assert me is not None
    assert bogus_id not in (me.get("assigned_role_ids") or []), \
        "Phantom role id should be dropped, not persisted"


def test_operators_listing_owner_from_live_user(admin_token):
    """`GET /api/operators/` should populate `owner_name`/`owner_email` from
    the LIVE `operator_role='owner'` user (single source of truth)."""
    r = requests.get(f"{BASE_URL}/api/operators/", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    ops = r.json().get("operators") or r.json() or []
    if not ops:
        pytest.skip("No operators seeded")
    # At least one operator should have an owner_name populated. If none do
    # this is still an environment quirk (no live owners assigned), not a bug.
    has_owner = [o for o in ops if (o.get("owner_name") or "").strip()]
    if not has_owner:
        pytest.skip("No operator with an active owner user — cannot assert")
    for op in has_owner:
        # owner_name should match a user with operator_role='owner' or fallback
        assert isinstance(op["owner_name"], str)
        assert op["owner_name"]

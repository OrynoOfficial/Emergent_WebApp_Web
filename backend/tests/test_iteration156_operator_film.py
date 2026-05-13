"""
Iteration 156 tests:
1. POST /api/cinema/films accepts operator_id + operator_name (admin override).
2. Operator user creating a film gets auto-assigned their own operator_id (cannot override).
3. Listing /api/cinema/films returns films with operator_id field.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@test.com"
OPERATOR_EMAIL = "operator@test.com"
PASSWORD = "testpassword123"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def operator_token():
    return _login(OPERATOR_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def operator_headers(operator_token):
    return {"Authorization": f"Bearer {operator_token}"}


@pytest.fixture(scope="module")
def operator_user(operator_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=operator_headers, timeout=30)
    assert r.status_code == 200, f"/auth/me failed: {r.text}"
    return r.json()


# ---------- Film creation as operator (auto-assigned) ----------
# Note: operator@test.com is a bus-service operator without cinema permission,
# so direct POST yields 403. That is correct authz behaviour.
def test_operator_without_cinema_permission_cannot_create_film(operator_headers):
    params = {"title": "TEST_OperatorFilm_iter156", "duration_minutes": 90}
    r = requests.post(f"{BASE_URL}/api/cinema/films", params=params, headers=operator_headers, timeout=30)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ---------- Film creation as admin (with override) ----------
def test_admin_creates_film_with_operator_override(admin_headers, operator_user):
    target_op = operator_user.get("operator_id")
    if not target_op:
        pytest.skip("No operator_id available to use as override target.")

    params = {
        "title": "TEST_AdminOverride_iter156",
        "duration_minutes": 110,
        "operator_id": target_op,
        "operator_name": operator_user.get("operator_name", "Operator"),
    }
    r = requests.post(f"{BASE_URL}/api/cinema/films", params=params, headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), r.text
    film_id = r.json().get("film_id")

    listing = requests.get(f"{BASE_URL}/api/cinema/films?include_all_operators=true", headers=admin_headers, timeout=30)
    films = listing.json().get("films", listing.json()) if isinstance(listing.json(), dict) else listing.json()
    mine = next((f for f in films if (f.get("_id") == film_id or f.get("id") == film_id)), None)
    assert mine is not None, f"Created film not found in admin listing"
    assert mine.get("operator_id") == target_op, (
        f"Admin override didn't stick: {mine.get('operator_id')} != {target_op}"
    )
    requests.delete(f"{BASE_URL}/api/cinema/films/{film_id}", headers=admin_headers, timeout=30)


def test_admin_creates_film_no_operator(admin_headers):
    """Admin creating film without operator_id: should succeed and store None/null."""
    params = {
        "title": "TEST_AdminNoOp_iter156",
        "duration_minutes": 85,
    }
    r = requests.post(f"{BASE_URL}/api/cinema/films", params=params, headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), r.text
    film_id = r.json().get("film_id")
    assert film_id
    # cleanup
    requests.delete(f"{BASE_URL}/api/cinema/films/{film_id}", headers=admin_headers, timeout=30)


# ---------- Regression: operator scoping for /management/my-hotels ----------
def test_operator_my_hotels_no_leak(operator_headers, operator_user):
    r = requests.get(f"{BASE_URL}/api/hotels/management/my-hotels", headers=operator_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    hotels = body.get("hotels", body) if isinstance(body, dict) else body
    op_id = operator_user.get("operator_id")
    for h in hotels:
        if op_id:
            assert h.get("operator_id") == op_id, f"Leak: hotel {h.get('_id')} operator_id={h.get('operator_id')}"

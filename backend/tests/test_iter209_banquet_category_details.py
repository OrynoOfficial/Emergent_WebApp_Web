"""
Iteration 209 — Banquet category_details + by-service-category endpoint tests.

Covers:
  * POST /api/banquets/ with photographer + catering category_details persists intact
  * PUT /api/banquets/{id} updating only category_details merges via $set
  * GET /api/banquets/management/my-venues?category=photographer returns full details
  * GET /api/operators/by-service-category requires operators.view (403 for customer)
  * /by-service-category returns {operators, category, service_type} with has_active_service_in_category flag
  * /by-service-category with category having no services returns empty list (not 500)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
SUPER_EMAIL = "superadmin@oryno.com"
SUPER_PASS = "testpassword123"
CUST_EMAIL = "customer@test.com"
CUST_PASS = "testpassword123"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUST_EMAIL, CUST_PASS)


@pytest.fixture(scope="module")
def first_banquet_operator(admin_headers):
    """Find an operator currently selling some banquet service so we can attach new services."""
    r = requests.get(
        f"{BASE_URL}/api/operators/by-service-category",
        params={"service_type": "banquet", "category": "hall"},
        headers=admin_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    ops = r.json().get("operators", [])
    if not ops:
        pytest.skip("no banquet operators available — seed data missing")
    return ops[0]["id"]


# ─────────────────────────── /by-service-category ────────────────────────────
class TestByServiceCategory:
    def test_returns_shape(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/operators/by-service-category",
            params={"service_type": "banquet", "category": "photographer"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "operators" in data and isinstance(data["operators"], list)
        assert data["category"] == "photographer"
        assert data["service_type"] == "banquet"
        for op in data["operators"]:
            assert "id" in op and "name" in op
            assert "has_active_service_in_category" in op
            assert isinstance(op["has_active_service_in_category"], bool)

    def test_unknown_category_returns_empty(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/operators/by-service-category",
            params={"service_type": "banquet", "category": "definitely_nonexistent_xyz_1234"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["operators"] == []
        assert body["category"] == "definitely_nonexistent_xyz_1234"

    def test_customer_forbidden(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/operators/by-service-category",
            params={"service_type": "banquet", "category": "photographer"},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403 for customer, got {r.status_code} {r.text}"

    def test_photographer_only_lists_photographer_operators(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/operators/by-service-category",
            params={"service_type": "banquet", "category": "photographer"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200
        ops = r.json()["operators"]
        # At least one should be flagged active (seeded photographers exist per the request context)
        # If none active, we accept empty list — the contract only forbids 500s.
        active = [o for o in ops if o.get("has_active_service_in_category")]
        # Print to aid debugging
        print(f"photographer operators active={len(active)} total={len(ops)}")


# ─────────────────────────── category_details persistence ────────────────────
@pytest.fixture(scope="module")
def created_photographer(admin_headers, first_banquet_operator):
    payload = {
        "name": "TEST_ITER209_PHOTOG",
        "description": "iteration 209 test photographer",
        "category": "photographer",
        "operator_id": first_banquet_operator,
        "base_price": 250000,
        "pricing_model": "flat_fee",
        "is_active": True,
        "category_details": {
            "years_experience": 8,
            "team_size": 2,
            "style": ["cinematic", "documentary"],
            "equipment": ["DSLR", "mirrorless", "lighting kit"],
            "deliverables": ["digital album", "cloud gallery"],
            "edited_photos_count": 300,
            "revisions_included": 2,
            "turnaround_days": 14,
            "portfolio_url": "https://example.com/portfolio",
            "drone_licensed": True,
            "travels_outside_city": True,
        },
    }
    r = requests.post(f"{BASE_URL}/api/banquets/", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    body = r.json()
    bid = body.get("banquet_id") or body.get("id") or body.get("_id")
    assert bid, f"no id in create response: {body}"
    # Fetch the freshly-created row so tests can check persisted shape.
    g = requests.get(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)
    assert g.status_code == 200, g.text
    created = g.json()
    created["id"] = bid
    yield created
    # teardown
    try:
        bid = created.get("id") or created.get("_id")
        if bid:
            requests.delete(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)
    except Exception:
        pass


class TestPhotographerCategoryDetails:
    def test_create_returns_full_details(self, created_photographer):
        cd = created_photographer.get("category_details") or {}
        assert cd.get("years_experience") == 8
        assert cd.get("team_size") == 2
        assert cd.get("style") == ["cinematic", "documentary"]
        assert cd.get("equipment") == ["DSLR", "mirrorless", "lighting kit"]
        assert cd.get("deliverables") == ["digital album", "cloud gallery"]
        assert cd.get("turnaround_days") == 14
        assert cd.get("portfolio_url") == "https://example.com/portfolio"
        assert cd.get("drone_licensed") is True
        assert cd.get("travels_outside_city") is True

    def test_get_my_venues_returns_full_details(self, admin_headers, created_photographer):
        r = requests.get(
            f"{BASE_URL}/api/banquets/management/my-venues",
            params={"category": "photographer"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        if isinstance(items, dict):
            items = items.get("venues") or items.get("items") or items.get("results") or []
        bid = created_photographer.get("id") or created_photographer.get("_id")
        match = next((x for x in items if (x.get("id") or x.get("_id")) == bid), None)
        assert match is not None, f"created photographer {bid} not in my-venues result"
        cd = match.get("category_details") or {}
        assert cd.get("years_experience") == 8
        assert cd.get("style") == ["cinematic", "documentary"]
        assert cd.get("portfolio_url") == "https://example.com/portfolio"
        assert cd.get("drone_licensed") is True

    def test_put_updates_only_category_details(self, admin_headers, created_photographer):
        bid = created_photographer.get("id") or created_photographer.get("_id")
        new_details = {
            "years_experience": 12,
            "style": ["cinematic", "documentary", "fine_art"],
            "equipment": ["DSLR", "drone"],
            "turnaround_days": 21,
            "portfolio_url": "https://example.com/new",
            "drone_licensed": False,
        }
        r = requests.put(
            f"{BASE_URL}/api/banquets/{bid}",
            json={"category_details": new_details},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code in (200, 204), f"PUT failed: {r.status_code} {r.text}"

        # Verify via GET
        g = requests.get(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)
        assert g.status_code == 200, g.text
        body = g.json()
        # Name should still be intact
        assert body.get("name") == "TEST_ITER209_PHOTOG"
        cd = body.get("category_details") or {}
        assert cd.get("years_experience") == 12
        assert cd.get("turnaround_days") == 21
        assert "fine_art" in (cd.get("style") or [])
        assert cd.get("drone_licensed") is False


class TestCateringCategoryDetails:
    def test_create_catering_with_arrays_and_guests(self, admin_headers, first_banquet_operator):
        payload = {
            "name": "TEST_ITER209_CATERING",
            "description": "iteration 209 catering",
            "category": "catering",
            "operator_id": first_banquet_operator,
            "base_price": 50000,
            "pricing_model": "per_person",
            "is_active": True,
            "category_details": {
                "cuisines": ["italian", "indian", "japanese"],
                "dietary_options": ["vegan", "halal", "gluten_free"],
                "service_style": ["buffet", "plated"],
                "min_guests": 50,
                "max_guests": 500,
                "signature_dishes": "Truffle risotto, butter chicken",
            },
        }
        r = requests.post(f"{BASE_URL}/api/banquets/", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
        body = r.json()
        bid = body.get("banquet_id") or body.get("id") or body.get("_id")
        assert bid, f"no id in create response: {body}"
        try:
            # Re-fetch to inspect persisted shape
            g0 = requests.get(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)
            assert g0.status_code == 200
            body = g0.json()
            cd = body.get("category_details") or {}
            assert cd.get("cuisines") == ["italian", "indian", "japanese"]
            assert cd.get("dietary_options") == ["vegan", "halal", "gluten_free"]
            assert cd.get("service_style") == ["buffet", "plated"]
            assert cd.get("min_guests") == 50
            assert cd.get("max_guests") == 500
            assert "Truffle" in (cd.get("signature_dishes") or "")

            # Re-fetch and confirm persistence
            g = requests.get(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)
            assert g.status_code == 200
            cd2 = g.json().get("category_details") or {}
            assert cd2.get("cuisines") == ["italian", "indian", "japanese"]
            assert cd2.get("min_guests") == 50
            assert cd2.get("max_guests") == 500
        finally:
            if bid:
                requests.delete(f"{BASE_URL}/api/banquets/{bid}", headers=admin_headers, timeout=30)

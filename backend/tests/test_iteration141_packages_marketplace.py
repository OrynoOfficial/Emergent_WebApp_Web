"""
Iteration 141 - Packages logistics marketplace backend tests.

Covers:
- GET /api/package-services/search (origin/destination/weight)
- GET /api/package-services/search with weight above max → 0 results
- POST /api/packages/ with package_service_id → server-calculated price + tracking
- POST /api/packages/ with invalid/inactive service_id → 404/400
- POST /api/packages/ with weight exceeding limits → 400 with reason
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, pwd):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text}")
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def admin_token(api):
    return _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def customer_token(api):
    return _login(api, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


class TestPackageServiceSearch:
    def test_search_yaounde_to_douala_3kg(self, api):
        r = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaounde", "destination_city": "Douala", "weight_kg": 3},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "services" in data and "total" in data
        assert data["total"] >= 1, f"Expected >=1 service, got: {data}"
        svc = data["services"][0]
        assert "calculated_price" in svc
        assert svc["calculated_price"] > 0
        assert svc.get("price_ok") is True
        # capture for next tests
        TestPackageServiceSearch.service = svc
        print(f"Got service: {svc.get('name')} price={svc['calculated_price']}")

    def test_search_accent_insensitive(self, api):
        # "Yaoundé" with accent should match
        r = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaoundé", "destination_city": "Douala", "weight_kg": 3},
        )
        assert r.status_code == 200, r.text
        assert r.json()["total"] >= 1

    def test_search_weight_above_max_returns_zero(self, api):
        # Use an absurdly high weight that exceeds any tier or max
        r = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaounde", "destination_city": "Douala", "weight_kg": 9999},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Either total=0 or any returned services do not include the test offering
        assert data["total"] == 0, f"Expected 0 services for 9999kg, got {data['total']}"

    def test_search_no_route_match_returns_zero(self, api):
        r = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "ZZZNonexistent", "destination_city": "ZZZAlsoNone", "weight_kg": 1},
        )
        assert r.status_code == 200
        assert r.json()["total"] == 0


class TestPackageBookingViaService:
    created_pkg_ids = []

    def _payload(self, service_id):
        return {
            "package_service_id": service_id,
            "sender": {
                "name": f"TEST_Sender_{uuid.uuid4().hex[:6]}",
                "phone": "+237670000001",
                "email": "sender@test.com",
                "address": "123 Sender St",
            },
            "receiver": {
                "name": f"TEST_Receiver_{uuid.uuid4().hex[:6]}",
                "phone": "+237670000002",
                "email": "receiver@test.com",
                "address": "456 Receiver Ave",
            },
            "origin_city": "Yaounde",
            "destination_city": "Douala",
            "package_type": "parcel",
            "weight_kg": 3,
            "dimensions": {"length_cm": 30, "width_cm": 20, "height_cm": 15},
            "declared_value": 50000,
            "description": "TEST shipment via marketplace",
            # Intentionally set client price wrong — server should override
            "price": 999999,
            "payment_status": "unpaid",
        }

    def test_create_with_valid_service(self, api, customer_token):
        # First grab a valid service offering
        s = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaounde", "destination_city": "Douala", "weight_kg": 3},
        ).json()
        assert s["total"] >= 1, "Need at least one seeded service offering"
        service = s["services"][0]
        service_id = service["id"]
        expected_price = service["calculated_price"]

        payload = self._payload(service_id)
        r = api.post(
            f"{BASE_URL}/api/packages/",
            json=payload,
            headers=_auth(customer_token),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "package_id" in data
        assert "tracking_number" in data
        tn = data["tracking_number"]
        assert tn.startswith("ORYNO-"), tn
        assert len(tn) == len("ORYNO-") + 8
        # CRITICAL: server must override client-supplied 999999 price
        assert data["price"] == expected_price, (
            f"Server should recalculate price; got {data['price']} expected {expected_price}"
        )

        TestPackageBookingViaService.created_pkg_ids.append(data["package_id"])

        # Verify persistence via GET
        g = api.get(f"{BASE_URL}/api/packages/{data['package_id']}", headers=_auth(customer_token))
        assert g.status_code == 200
        gd = g.json()
        assert gd["price"] == expected_price
        assert gd["package_service_id"] == service_id
        assert gd["status"] == "pending"
        assert gd["tracking_number"] == tn

    def test_create_with_unknown_service_returns_404(self, api, customer_token):
        payload = self._payload(service_id="nonexistent-id-xyz")
        r = api.post(f"{BASE_URL}/api/packages/", json=payload, headers=_auth(customer_token))
        assert r.status_code == 404, r.text

    def test_create_with_weight_exceeding_limits(self, api, customer_token):
        s = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaounde", "destination_city": "Douala", "weight_kg": 3},
        ).json()
        if s["total"] < 1:
            pytest.skip("No seed service")
        service_id = s["services"][0]["id"]

        payload = self._payload(service_id)
        payload["weight_kg"] = 9999  # guaranteed to exceed
        r = api.post(f"{BASE_URL}/api/packages/", json=payload, headers=_auth(customer_token))
        assert r.status_code == 400, r.text
        # Reason should mention weight or tier
        detail = r.json().get("detail", "").lower()
        assert "weight" in detail or "tier" in detail, f"Unexpected detail: {detail}"

    def test_quote_endpoint(self, api):
        s = api.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaounde", "destination_city": "Douala", "weight_kg": 3},
        ).json()
        if s["total"] < 1:
            pytest.skip("No seed service")
        service_id = s["services"][0]["id"]

        r = api.post(
            f"{BASE_URL}/api/package-services/{service_id}/quote",
            params={"weight_kg": 3, "length_cm": 30, "width_cm": 20, "height_cm": 15},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["price"] > 0

    def test_zz_cleanup(self, api, admin_token):
        for pid in TestPackageBookingViaService.created_pkg_ids:
            api.delete(f"{BASE_URL}/api/packages/{pid}", headers=_auth(admin_token))

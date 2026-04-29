"""
Iteration 139 - Physical Packages (logistics shipments) CRUD tests.

Covers the refactored /api/packages endpoints that now model physical
shipments instead of the old holiday/tour packages schema.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back: read from frontend .env if the env var isn't injected in test shell
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


# ----------------------------- Fixtures ---------------------------------


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.skip("No token returned from login")
    return token


@pytest.fixture(scope="module")
def auth_api(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


# ------------------------------ Tests -----------------------------------


def _sample_payload(suffix: str = ""):
    return {
        "sender": {
            "name": f"TEST_Sender{suffix}",
            "phone": "+237670000001",
            "email": "sender@test.com",
            "address": "123 Sender St, Douala",
        },
        "receiver": {
            "name": f"TEST_Receiver{suffix}",
            "phone": "+237670000002",
            "email": "receiver@test.com",
            "address": "456 Receiver Ave, Yaounde",
        },
        "origin_city": "Douala",
        "destination_city": "Yaounde",
        "package_type": "parcel",
        "weight_kg": 3.5,
        "dimensions": {"length_cm": 30, "width_cm": 20, "height_cm": 15},
        "declared_value": 50000,
        "description": "TEST shipment",
        "price": 5000,
        "payment_status": "unpaid",
    }


class TestPhysicalPackages:
    created_ids = []

    def test_01_list_packages_auth(self, auth_api):
        r = auth_api.get(f"{BASE_URL}/api/packages/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "packages" in data and "total" in data
        assert isinstance(data["packages"], list)
        # Since collection was dropped we expect a list (could be 0 or non-zero from prior tests)
        print(f"Initial package count: {data['total']}")

    def test_02_create_package(self, auth_api):
        payload = _sample_payload(suffix=str(uuid.uuid4())[:6])
        r = auth_api.post(f"{BASE_URL}/api/packages/", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "package_id" in data
        assert "tracking_number" in data
        assert data["tracking_number"].startswith("ORYNO-"), data["tracking_number"]
        assert len(data["tracking_number"]) == len("ORYNO-") + 8
        TestPhysicalPackages.created_ids.append(data["package_id"])
        TestPhysicalPackages.tracking = data["tracking_number"]
        TestPhysicalPackages.sender_name = payload["sender"]["name"]

    def test_03_get_package_by_id(self, auth_api):
        pid = TestPhysicalPackages.created_ids[0]
        r = auth_api.get(f"{BASE_URL}/api/packages/{pid}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == pid
        assert data["tracking_number"] == TestPhysicalPackages.tracking
        assert data["status"] == "pending"
        assert data["sender"]["name"] == TestPhysicalPackages.sender_name
        assert data["receiver"]["address"].startswith("456 Receiver")
        assert data["origin_city"] == "Douala"
        assert data["destination_city"] == "Yaounde"

    def test_04_track_by_tracking_number(self, auth_api):
        tr = TestPhysicalPackages.tracking
        r = auth_api.get(f"{BASE_URL}/api/packages/track/{tr}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tracking_number"] == tr

    def test_05_update_package(self, auth_api):
        pid = TestPhysicalPackages.created_ids[0]
        upd = {"price": 7500, "description": "TEST updated description"}
        r = auth_api.put(f"{BASE_URL}/api/packages/{pid}", json=upd)
        assert r.status_code == 200, r.text

        # Verify persistence via GET
        g = auth_api.get(f"{BASE_URL}/api/packages/{pid}")
        assert g.status_code == 200
        assert g.json()["price"] == 7500
        assert g.json()["description"] == "TEST updated description"

    def test_06_status_advance(self, auth_api):
        pid = TestPhysicalPackages.created_ids[0]
        r = auth_api.post(f"{BASE_URL}/api/packages/{pid}/status", params={"status": "picked_up"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "picked_up"

        g = auth_api.get(f"{BASE_URL}/api/packages/{pid}")
        assert g.json()["status"] == "picked_up"

    def test_07_search_filter(self, auth_api):
        # Create another package with distinct sender name for search
        payload = _sample_payload(suffix="_SEARCH_UNIQ")
        r = auth_api.post(f"{BASE_URL}/api/packages/", json=payload)
        assert r.status_code == 200, r.text
        TestPhysicalPackages.created_ids.append(r.json()["package_id"])

        q = auth_api.get(f"{BASE_URL}/api/packages/", params={"search": "_SEARCH_UNIQ"})
        assert q.status_code == 200
        assert q.json()["total"] >= 1
        names = [p["sender"]["name"] for p in q.json()["packages"]]
        assert any("_SEARCH_UNIQ" in n for n in names)

    def test_08_status_filter(self, auth_api):
        # Advance the second package to in_transit and filter
        pid = TestPhysicalPackages.created_ids[-1]
        auth_api.post(f"{BASE_URL}/api/packages/{pid}/status", params={"status": "in_transit"})
        r = auth_api.get(f"{BASE_URL}/api/packages/", params={"status": "in_transit"})
        assert r.status_code == 200
        statuses = [p["status"] for p in r.json()["packages"]]
        assert all(s == "in_transit" for s in statuses)
        assert r.json()["total"] >= 1

    def test_09_delete_package(self, auth_api):
        for pid in TestPhysicalPackages.created_ids:
            d = auth_api.delete(f"{BASE_URL}/api/packages/{pid}")
            assert d.status_code == 200, d.text
            g = auth_api.get(f"{BASE_URL}/api/packages/{pid}")
            assert g.status_code == 404
        TestPhysicalPackages.created_ids = []

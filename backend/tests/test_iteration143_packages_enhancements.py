"""
Iteration 143 — Packages module enhancements

Validates:
- Accent-insensitive search regex bug (Yaoundé / YAOUNDE / yaounde)
- Admin/Super-admin POST /api/package-services/ → status='active' immediately
- Non-admin POST → status='pending' (approval workflow)
- PUT /api/package-services/{id} operator status silently dropped
- Validation endpoints include package_services
- Approve/Reject endpoints flip status and affect public search
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
SUPER = {"email": "superadmin@oryno.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}
OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}


# ---------- Helpers ----------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return r.json()["token"] if "token" in r.json() else r.json().get("access_token")


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER)


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def operator_token():
    return _login(OPERATOR)


# ---------- Accent-insensitive search ----------
class TestAccentInsensitiveSearch:
    def test_search_with_accent(self):
        r = requests.get(f"{API}/package-services/search",
                         params={"origin_city": "Yaoundé", "destination_city": "Douala"},
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        names = [s.get("name","") for s in data["services"]]
        assert any("CoCo-Yams" in n for n in names), f"Expected CoCo-Yams; got {names}"

    def test_search_uppercase_no_accent(self):
        r = requests.get(f"{API}/package-services/search",
                         params={"origin_city": "YAOUNDE", "destination_city": "Douala"},
                         timeout=15)
        assert r.status_code == 200
        names = [s.get("name","") for s in r.json()["services"]]
        assert any("CoCo-Yams" in n for n in names), f"Got {names}"

    def test_search_lowercase(self):
        r = requests.get(f"{API}/package-services/search",
                         params={"origin_city": "yaounde", "destination_city": "douala"},
                         timeout=15)
        assert r.status_code == 200
        names = [s.get("name","") for s in r.json()["services"]]
        assert any("CoCo-Yams" in n for n in names), f"Got {names}"


# ---------- Create status role branching ----------
SAMPLE_OFFERING = {
    "operator_name": "TEST_Iteration143",
    "name": "TEST Express",
    "origin_city": "Yaounde",
    "destination_city": "Bafoussam",
    "pricing_model": "per_kg",
    "base_price": 1000,
    "per_kg_rate": 500,
    "max_weight_kg": 30,
    "delivery_time_hours": 24,
    "accepted_types": ["parcel"],
    "features": ["tracking"],
}


class TestCreateStatusBranching:
    def test_admin_create_returns_active(self, admin_token):
        payload = {**SAMPLE_OFFERING, "name": f"TEST_admin_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "active", body
        # cleanup
        requests.delete(f"{API}/package-services/{body['service_id']}", headers=_hdr(admin_token), timeout=15)

    def test_super_admin_create_returns_active(self, super_token):
        payload = {**SAMPLE_OFFERING, "name": f"TEST_super_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(super_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "active", body
        requests.delete(f"{API}/package-services/{body['service_id']}", headers=_hdr(super_token), timeout=15)

    def test_operator_create_denied_or_pending(self, operator_token):
        """Existing operator is a travel operator — expect 403. Either way this
        verifies operators without packages.create cannot bypass to active."""
        payload = {**SAMPLE_OFFERING, "name": f"TEST_op_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(operator_token), timeout=15)
        # Per agent-to-agent-context: operator is travel — expect 403
        assert r.status_code in (200, 403), r.text
        if r.status_code == 200:
            body = r.json()
            assert body["status"] == "pending", f"Non-admin create should be pending, got {body}"
            requests.delete(f"{API}/package-services/{body['service_id']}", headers=_hdr(operator_token), timeout=15)


# ---------- PUT status dropped for operators ----------
class TestUpdateStatusDrop:
    def test_operator_cannot_change_status(self, admin_token, operator_token):
        """Create a pending offering via admin (set status=pending manually via DB?),
        actually: admin creates → active. We test by creating as admin (active),
        then asserting the non-admin PUT with status='rejected' keeps status='active'.
        """
        # Create via admin
        payload = {**SAMPLE_OFFERING, "name": f"TEST_putstatus_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["service_id"]

        # Try operator PUT status='rejected'
        put_resp = requests.put(f"{API}/package-services/{sid}",
                                json={"status": "rejected", "name": "TEST_updated_name"},
                                headers=_hdr(operator_token), timeout=15)
        # Operator likely gets 403 (not packages operator). That also validates
        # authorization. If it passes, status MUST still be 'active'.
        get_r = requests.get(f"{API}/package-services/{sid}", timeout=15)
        assert get_r.status_code == 200
        assert get_r.json()["status"] == "active", f"Status was changed by non-admin! body={get_r.json()}"

        # cleanup
        requests.delete(f"{API}/package-services/{sid}", headers=_hdr(admin_token), timeout=15)


# ---------- Validation endpoints ----------
class TestValidationPending:
    def test_pending_includes_package_services(self, super_token):
        r = requests.get(f"{API}/validation/pending", headers=_hdr(super_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "services" in data, data
        assert "package_services" in data["services"], data["services"].keys()
        assert isinstance(data["services"]["package_services"], list)
        # counts.services present (sum)
        assert "counts" in data and "services" in data["counts"]


class TestApproveReject:
    def _create_pending(self, admin_token):
        """Create offering via admin (→active) then flip to pending via direct update."""
        # Simpler: create via admin then PUT status=pending as admin (admins CAN change status)
        payload = {**SAMPLE_OFFERING, "name": f"TEST_appr_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["service_id"]
        put = requests.put(f"{API}/package-services/{sid}",
                           json={"status": "pending"},
                           headers=_hdr(admin_token), timeout=15)
        assert put.status_code == 200, put.text
        # verify
        got = requests.get(f"{API}/package-services/{sid}", timeout=15).json()
        assert got["status"] == "pending", got
        return sid

    def test_approve_flips_to_active_and_appears_in_search(self, admin_token, super_token):
        sid = self._create_pending(admin_token)
        try:
            # Search should NOT contain this pending
            s = requests.get(f"{API}/package-services/search",
                             params={"origin_city": "Yaounde", "destination_city": "Bafoussam"},
                             timeout=15).json()
            assert not any(x["id"] == sid for x in s["services"]), "Pending appeared in public search!"

            # Approve
            ar = requests.post(f"{API}/validation/services/package_service/{sid}/approve",
                               json={"notes": "ok"}, headers=_hdr(super_token), timeout=15)
            assert ar.status_code == 200, ar.text

            got = requests.get(f"{API}/package-services/{sid}", timeout=15).json()
            assert got["status"] == "active", got

            # Now in search
            s2 = requests.get(f"{API}/package-services/search",
                              params={"origin_city": "Yaounde", "destination_city": "Bafoussam"},
                              timeout=15).json()
            assert any(x["id"] == sid for x in s2["services"]), "Approved service missing from search"
        finally:
            requests.delete(f"{API}/package-services/{sid}", headers=_hdr(admin_token), timeout=15)

    def test_reject_flips_to_rejected_and_hidden(self, admin_token, super_token):
        sid = self._create_pending(admin_token)
        try:
            rr = requests.post(f"{API}/validation/services/package_service/{sid}/reject",
                               json={"reason": "test reject"}, headers=_hdr(super_token), timeout=15)
            assert rr.status_code == 200, rr.text
            got = requests.get(f"{API}/package-services/{sid}", timeout=15).json()
            assert got["status"] == "rejected", got

            s = requests.get(f"{API}/package-services/search",
                             params={"origin_city": "Yaounde", "destination_city": "Bafoussam"},
                             timeout=15).json()
            assert not any(x["id"] == sid for x in s["services"]), "Rejected service still in search"
        finally:
            requests.delete(f"{API}/package-services/{sid}", headers=_hdr(admin_token), timeout=15)


# ---------- Search filters only active ----------
class TestSearchActiveOnly:
    def test_pending_not_in_search(self, admin_token):
        # Create a pending offering via admin->pending
        payload = {**SAMPLE_OFFERING,
                   "name": f"TEST_pfilter_{uuid.uuid4().hex[:6]}",
                   "origin_city": "Yaounde",
                   "destination_city": "Kribi"}
        r = requests.post(f"{API}/package-services/", json=payload, headers=_hdr(admin_token), timeout=15)
        sid = r.json()["service_id"]
        requests.put(f"{API}/package-services/{sid}", json={"status": "pending"},
                     headers=_hdr(admin_token), timeout=15)
        try:
            s = requests.get(f"{API}/package-services/search",
                             params={"origin_city": "Yaounde", "destination_city": "Kribi"},
                             timeout=15).json()
            assert not any(x["id"] == sid for x in s["services"])
        finally:
            requests.delete(f"{API}/package-services/{sid}", headers=_hdr(admin_token), timeout=15)

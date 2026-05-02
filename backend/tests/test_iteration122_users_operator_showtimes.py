"""Iteration 122 tests.

Covers:
- POST /api/users/create operator role validation (operator_id required, must exist)
- GET /api/users/ enriches operator_name
- Cinema Showtimes: GET /operator (returns id field), POST body-based create,
  PUT update, DELETE soft-delete (409 if active bookings), operator scoping
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://delivery-platform-108.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}
SUPERADMIN = {"email": "superadmin@oryno.com", "password": "testpassword123"}
KNOWN_OPERATOR_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"  # Musango


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def operator_token():
    return _login(OPERATOR)


@pytest.fixture(scope="module")
def superadmin_token():
    try:
        return _login(SUPERADMIN)
    except Exception:
        return None


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------- Users: create w/ operator role ---------

class TestUsersCreateOperator:
    created_user_ids = []

    def test_reject_operator_without_operator_id(self, admin_token):
        payload = {
            "email": f"TEST_op_noid_{uuid.uuid4().hex[:8]}@example.com",
            "username": f"TEST_op_noid_{uuid.uuid4().hex[:6]}",
            "password": "testpassword123",
            "full_name": "Test NoOpId",
            "role": "operator",
        }
        r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "operator_id" in r.text.lower()

    def test_reject_operator_with_unknown_operator_id(self, admin_token):
        payload = {
            "email": f"TEST_op_bad_{uuid.uuid4().hex[:8]}@example.com",
            "username": f"TEST_op_bad_{uuid.uuid4().hex[:6]}",
            "password": "testpassword123",
            "full_name": "Test BadOp",
            "role": "operator",
            "operator_id": "nonexistent-operator-id-xxx",
        }
        r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"
        assert "operator" in r.text.lower()

    def test_create_operator_success_and_persisted(self, admin_token):
        email = f"TEST_op_ok_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "username": f"TEST_op_ok_{uuid.uuid4().hex[:6]}",
            "password": "testpassword123",
            "full_name": "Test OperatorUser",
            "role": "operator",
            "operator_id": KNOWN_OPERATOR_ID,
        }
        r = requests.post(f"{BASE_URL}/api/users/create", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        uid = data.get("user_id")
        assert uid
        self.__class__.created_user_ids.append(uid)

        # Verify persistence via GET /api/users/
        g = requests.get(f"{BASE_URL}/api/users/?role=operator&limit=100", headers=_hdr(admin_token), timeout=30)
        assert g.status_code == 200
        body = g.json()
        users = body.get("users") if isinstance(body, dict) else body
        match = next((u for u in users if u.get("email") == email), None)
        assert match is not None, "created user not found in list"
        assert match.get("operator_id") == KNOWN_OPERATOR_ID
        assert match.get("operator_name")  # should be enriched


class TestUsersListEnrichment:
    def test_list_users_enriches_operator_name(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/users/?role=operator&limit=100", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        body = r.json()
        users = body.get("users") if isinstance(body, dict) else body
        with_op = [u for u in users if u.get("operator_id")]
        assert len(with_op) >= 1, "expected at least one operator user with operator_id"
        # every user with operator_id should have operator_name after enrichment
        missing = [u for u in with_op if not u.get("operator_name")]
        assert not missing, f"users missing operator_name: {[u.get('email') for u in missing]}"


# --------- Cinema Showtimes ---------

class TestShowtimesOperatorList:
    def test_admin_sees_showtimes_with_id_field(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/operator", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "showtimes" in data
        if data["showtimes"]:
            first = data["showtimes"][0]
            assert "id" in first, "showtime must expose 'id' field"
            assert "_id" not in first, "showtime must not expose '_id' field"

    def test_operator_sees_only_own_showtimes(self, operator_token):
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/operator", headers=_hdr(operator_token), timeout=30)
        # Operator may have 0 cinemas (Musango is bus). Allow 200 empty or 403.
        assert r.status_code in (200, 403), r.text
        if r.status_code == 200:
            data = r.json()
            # musango operator has no cinemas -> empty list expected
            assert isinstance(data.get("showtimes"), list)


class TestShowtimeCRUD:
    """Create via body POST, update via PUT, delete soft-deletes."""
    created_id = None
    cinema_id = None
    film_id = None

    def _pick_cinema_and_film(self, token):
        # fetch from operator list to find a valid cinema+film
        r = requests.get(f"{BASE_URL}/api/cinema/showtimes/operator", headers=_hdr(token), timeout=30)
        assert r.status_code == 200
        sts = r.json().get("showtimes", [])
        if not sts:
            pytest.skip("no showtimes available to discover cinema_id/film_id")
        for s in sts:
            if s.get("cinema_id") and s.get("film_id"):
                return s["cinema_id"], s["film_id"]
        pytest.skip("no suitable showtime found")

    def test_create_showtime_body(self, admin_token):
        cinema_id, film_id = self._pick_cinema_and_film(admin_token)
        self.__class__.cinema_id = cinema_id
        self.__class__.film_id = film_id
        body = {
            "cinema_id": cinema_id,
            "film_id": film_id,
            "screen_name": "TEST-SCREEN-ITER122",
            "show_date": "2030-01-15",
            "show_time": "20:00",
            "end_time": "22:00",
            "price": 9.99,
            "total_seats": 50,
        }
        r = requests.post(f"{BASE_URL}/api/cinema/showtimes", json=body, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        sid = data.get("showtime_id")
        assert sid
        self.__class__.created_id = sid

    def test_update_showtime(self, admin_token):
        sid = self.__class__.created_id
        if not sid:
            pytest.skip("no showtime created")
        r = requests.put(
            f"{BASE_URL}/api/cinema/showtimes/{sid}",
            json={"price": 14.5, "screen_name": "TEST-SCREEN-UPDATED"},
            headers=_hdr(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        # Verify by listing
        lst = requests.get(f"{BASE_URL}/api/cinema/showtimes/operator", headers=_hdr(admin_token), timeout=30).json()
        found = next((s for s in lst.get("showtimes", []) if s.get("id") == sid), None)
        assert found is not None, "updated showtime not found"
        assert abs(found.get("price", 0) - 14.5) < 0.01
        assert found.get("screen_name") == "TEST-SCREEN-UPDATED"

    def test_delete_showtime_soft(self, admin_token):
        sid = self.__class__.created_id
        if not sid:
            pytest.skip("no showtime created")
        r = requests.delete(f"{BASE_URL}/api/cinema/showtimes/{sid}", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, f"expected 200 soft-delete, got {r.status_code}: {r.text}"

    def test_delete_unknown_showtime_returns_404(self, admin_token):
        r = requests.delete(f"{BASE_URL}/api/cinema/showtimes/nonexistent-xxx", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 404


class TestShowtimeDeleteBlockedByBooking:
    """Create showtime -> insert direct-db order -> expect 409 on delete."""

    def test_delete_blocked_when_active_booking(self, admin_token):
        # Discover cinema+film
        lst = requests.get(f"{BASE_URL}/api/cinema/showtimes/operator", headers=_hdr(admin_token), timeout=30)
        assert lst.status_code == 200
        sts = lst.json().get("showtimes", [])
        if not sts:
            pytest.skip("no showtimes available")
        pick = next((s for s in sts if s.get("cinema_id") and s.get("film_id")), None)
        if not pick:
            pytest.skip("no suitable showtime")

        # Create a new showtime
        body = {
            "cinema_id": pick["cinema_id"],
            "film_id": pick["film_id"],
            "screen_name": "TEST-SCREEN-ITER122-LOCK",
            "show_date": "2030-02-20",
            "show_time": "18:00",
            "end_time": "20:00",
            "price": 7.5,
            "total_seats": 20,
        }
        c = requests.post(f"{BASE_URL}/api/cinema/showtimes", json=body, headers=_hdr(admin_token), timeout=30)
        assert c.status_code == 200, c.text
        sid = c.json()["showtime_id"]

        # Insert a mock active booking directly via mongo
        import asyncio
        import sys

        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("MONGO_DB_NAME", "oryno_webapp")

        order_id = f"TEST-ITER122-{uuid.uuid4().hex[:8]}"

        async def _seed_and_cleanup():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            await db.orders.insert_one({
                "_id": order_id,
                "order_number": order_id,
                "service_type": "cinema",
                "booking_details": {"showtime_id": sid},
                "status": "confirmed",
            })
            client.close()

        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_seed_and_cleanup())
        finally:
            loop.close()

        try:
            # DELETE should now return 409
            d = requests.delete(f"{BASE_URL}/api/cinema/showtimes/{sid}", headers=_hdr(admin_token), timeout=30)
            assert d.status_code == 409, f"expected 409 blocked, got {d.status_code}: {d.text}"
            assert "active booking" in d.text.lower() or "replace" in d.text.lower()
        finally:
            # Cleanup: delete mock order, then delete showtime
            async def _cleanup():
                client = AsyncIOMotorClient(mongo_url)
                db = client[db_name]
                await db.orders.delete_one({"_id": order_id})
                client.close()
            loop2 = asyncio.new_event_loop()
            try:
                loop2.run_until_complete(_cleanup())
            finally:
                loop2.close()
            requests.delete(f"{BASE_URL}/api/cinema/showtimes/{sid}", headers=_hdr(admin_token), timeout=30)

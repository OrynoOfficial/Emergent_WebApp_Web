"""Iteration 169 backend tests.

Covers:
  * One-owner-per-operator enforcement on /api/operator-users.
  * VIP pricing on /api/cinema/showtimes (POST/PUT) and /book endpoint
    with seat_breakdown stored on both cinema_bookings + orders.
"""
import os
import uuid
import time
import requests
import pytest

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://cinema-management-p0.preview.emergentagent.com').rstrip('/')
API = f"{BASE}/api"

# Shared state across tests (avoids implicit pytest module-monkey-patching)
STATE: dict = {}

SUPER = ("superadmin@oryno.com", "testpassword123")
OPER = ("mani-monroe@netflix.com", "testpassword123")
CUST = ("customer@test.com", "testpassword123")

# ------- shared helpers -------

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return _login(*SUPER)


@pytest.fixture(scope="module")
def oper_token():
    return _login(*OPER)


@pytest.fixture(scope="module")
def cust_token():
    return _login(*CUST)


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ============================================================
# Section 1 — one-owner-per-operator
# ============================================================
class TestOneOwnerPerOperator:
    def test_create_operator_with_fresh_owner(self, super_token):
        """POST /api/operators with create_owner_account=true + fresh owner_email succeeds."""
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_OP_{suffix}",
            "operator_type": "cinema",
            "phone": "+237600000000",
            "email": f"test_op_{suffix}@example.com",
            "create_owner_account": True,
            "owner_email": f"TEST_owner_{suffix}@example.com",
            "owner_full_name": "Test Owner",
            "owner_password": "testpassword123",
        }
        r = requests.post(f"{API}/operators/", json=payload, headers=_hdr(super_token), timeout=20, allow_redirects=False)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        op_id = data.get("operator_id") or data.get("_id") or data.get("id")
        assert op_id, f"missing operator id: {data}"
        STATE.update({"op_id": op_id, "owner_email": payload["owner_email"], "suffix": suffix})

    def test_create_second_owner_via_operator_users_returns_400(self, super_token):
        """POST /api/operators/{op_id}/users with operator_role='owner' must be rejected
        with 400 because only local_admin/local_user are allowed values."""
        op_id = STATE["op_id"]
        suffix = STATE["suffix"]
        payload = {
            "email": f"TEST_second_owner_{suffix}@example.com",
            "full_name": "Second Owner",
            "operator_role": "owner",
            "password": "testpassword123",
        }
        r = requests.post(f"{API}/operators/{op_id}/users", json=payload, headers=_hdr(super_token), timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "owner" in body or "local_admin" in body or "role" in body

    def test_promote_to_owner_via_update_returns_409(self, super_token):
        """First create a local_user, then PUT operator_role='owner' — must 409 mentioning existing owner."""
        op_id = STATE["op_id"]
        suffix = STATE["suffix"]
        # create local_user
        u_payload = {
            "email": f"TEST_lu_{suffix}@example.com",
            "full_name": "Local User",
            "operator_role": "local_user",
            "password": "testpassword123",
        }
        r = requests.post(f"{API}/operators/{op_id}/users", json=u_payload, headers=_hdr(super_token), timeout=20)
        assert r.status_code in (200, 201), f"create local_user failed: {r.status_code} {r.text}"
        user = r.json()
        uid = user.get("_id") or user.get("id") or user.get("user_id")
        assert uid, f"missing user id: {user}"
        STATE["lu_id"] = uid

        # attempt to promote to owner
        upd = requests.put(
            f"{API}/operators/{op_id}/users/{uid}",
            json={"operator_role": "owner"},
            headers=_hdr(super_token),
            timeout=20,
        )
        assert upd.status_code == 409, f"expected 409, got {upd.status_code}: {upd.text}"
        detail = upd.json().get("detail", "")
        assert STATE["owner_email"].lower() in detail.lower(), (
            f"409 detail should mention existing owner email — got: {detail}"
        )

    def test_cleanup_operator(self, super_token):
        op_id = STATE.get("op_id")
        if not op_id:
            return
        # Best-effort cleanup
        requests.delete(f"{API}/operators/{op_id}", headers=_hdr(super_token), timeout=20)


# ============================================================
# Section 2 — VIP pricing on cinema showtimes & booking
# ============================================================
NETFLIX_OP_ID = "9f0179c6-424b-42a1-bdb0-7330c397508e"
ORYNO_CINEMA_ID = "7a84617c-4ba8-4186-bf6a-3b240407ff69"  # has Screen 1 with vip_rows=['A','B']
OLYMPUS_FILM_ID = "1edf5c04-f19a-4808-9b3c-b8e168e8dc02"


class TestVipPricing:
    def test_create_showtime_with_vip_price(self, oper_token):
        payload = {
            "film_id": OLYMPUS_FILM_ID,
            "cinema_id": ORYNO_CINEMA_ID,
            "screen_name": "Screen 1",
            "show_date": "2099-12-30",
            "show_time": "18:00",
            "end_time": "20:00",
            "price": 5000,
            "vip_price": 8000,
            "total_seats": 96,
        }
        r = requests.post(f"{API}/cinema/showtimes", json=payload, headers=_hdr(oper_token), timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        st_id = data.get("_id") or data.get("id") or data.get("showtime_id")
        assert st_id, data
        STATE["st_id"] = st_id

    def test_get_showtime_persists_vip_price(self, oper_token):
        st_id = STATE["st_id"]
        r = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", headers=_hdr(oper_token), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json().get("showtimes") or []
        match = next((s for s in rows if s.get("id") == st_id), None)
        assert match is not None, f"created showtime {st_id} not in listing"
        assert match.get("vip_price") == 8000, f"vip_price not persisted: {match}"
        assert match.get("price") == 5000

    def test_update_showtime_vip_price(self, oper_token):
        st_id = STATE["st_id"]
        r = requests.put(
            f"{API}/cinema/showtimes/{st_id}",
            json={"vip_price": 9500},
            headers=_hdr(oper_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/cinema/films/{OLYMPUS_FILM_ID}/showtimes", headers=_hdr(oper_token), timeout=20)
        assert g.status_code == 200
        rows = g.json().get("showtimes") or []
        match = next((s for s in rows if s.get("id") == st_id), None)
        assert match is not None
        assert match.get("vip_price") == 9500, f"updated vip_price not persisted: {match}"

    def test_book_mixed_vip_regular_seats(self, cust_token):
        st_id = STATE["st_id"]
        # Book 2 VIP (A1, B2) + 1 regular (C3). price=5000, vip_price=9500
        # Expected: 2*9500 + 1*5000 = 24000
        seats = ["A1", "B2", "C3"]
        r = requests.post(
            f"{API}/cinema/showtimes/{st_id}/book",
            json=seats,
            headers=_hdr(cust_token),
            timeout=20,
        )
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        booking = r.json()
        assert booking.get("total_price") == 24000, f"expected 24000, got {booking.get('total_price')}: {booking}"
        STATE["booking_id"] = booking.get("booking_id") or booking.get("_id")
        STATE["order_id"] = booking.get("order_id")

    def test_seat_breakdown_persisted_on_booking_and_order(self, cust_token):
        """Verify cinema_bookings.seat_breakdown AND orders.booking_details.seat_breakdown stored."""
        order_id = STATE.get("order_id")
        if not order_id:
            pytest.skip("no order id from previous test")
        # Customer can list own cinema bookings
        b = requests.get(f"{API}/cinema/bookings/my", headers=_hdr(cust_token), timeout=20)
        assert b.status_code == 200, b.text
        items = b.json().get("bookings") if isinstance(b.json(), dict) else b.json()
        # Latest booking that matches our order_id
        matching = [x for x in items if x.get("order_id") == order_id]
        assert matching, f"could not find booking with order_id={order_id}"
        sb = matching[0].get("seat_breakdown") or []
        assert len(sb) == 3, f"cinema_bookings.seat_breakdown should have 3 entries: {sb}"
        tiers = {e["seat"]: e["tier"] for e in sb}
        assert tiers["A1"] == "vip" and tiers["B2"] == "vip"
        assert tiers["C3"] == "regular"
        prices = {e["seat"]: e["price"] for e in sb}
        assert prices["A1"] == 9500 and prices["B2"] == 9500 and prices["C3"] == 5000

        # And via orders endpoint — check booking_details.seat_breakdown is stored
        o = requests.get(f"{API}/orders/{order_id}", headers=_hdr(cust_token), timeout=20)
        if o.status_code == 200:
            bd = (o.json().get("booking_details") or {})
            osb = bd.get("seat_breakdown") or []
            assert len(osb) == 3, f"orders.booking_details.seat_breakdown should have 3 entries: {osb}"
            assert o.json().get("total_amount") == 24000

    def test_cleanup_showtime(self, oper_token):
        st_id = STATE.get("st_id")
        if not st_id:
            return
        # Best-effort: the 409-on-active-booking guard may block deletion. That's expected.
        requests.delete(f"{API}/cinema/showtimes/{st_id}", headers=_hdr(oper_token), timeout=20)

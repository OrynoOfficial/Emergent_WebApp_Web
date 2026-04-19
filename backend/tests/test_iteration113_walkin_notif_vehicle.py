"""
Iteration 113 tests:
  - Feature C: Walk-in / manual bookings (POST/GET /api/operator/manual-bookings/, lookup-customer)
  - Feature B: Notifications dedupe helper + /api/notifications/dedupe admin endpoint
  - Feature A: Travel order vehicle_info enrichment on POST /api/orders/create
"""
import os
import uuid
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

OPERATOR = {"email": "operator@test.com", "password": "testpassword123"}
ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text[:200]}"
    data = r.json()
    # API returns access_token or token
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in login response: {data}"
    return token, data.get("user", {})


@pytest.fixture(scope="session")
def operator_headers():
    tok, user = _login(OPERATOR)
    return {"Authorization": f"Bearer {tok}"}, user


@pytest.fixture(scope="session")
def admin_headers():
    tok, _ = _login(ADMIN)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def customer_headers():
    tok, user = _login(CUSTOMER)
    return {"Authorization": f"Bearer {tok}"}, user


@pytest.fixture(scope="session")
def operator_travel_route(operator_headers):
    """Find a travel route owned by the operator's operator_id."""
    headers, user = operator_headers
    op_id = user.get("operator_id") or (user.get("operator_context") or {}).get("operator_id")
    assert op_id, f"operator user has no operator_id: {user}"
    # Try operator-scoped route listing first
    r = requests.get(f"{BASE}/api/travel/routes", headers=headers, timeout=30)
    assert r.status_code == 200, f"list routes -> {r.status_code} {r.text[:200]}"
    payload = r.json()
    routes = payload if isinstance(payload, list) else payload.get("routes") or payload.get("items") or []
    match = None
    for rt in routes:
        if rt.get("operator_id") == op_id:
            match = rt
            break
    if not match and routes:
        match = routes[0]
    assert match, "no travel routes found"
    return match, op_id


# ---------------- Feature C: Manual Bookings ----------------

class TestManualBookings:
    def test_list_bookings_all(self, operator_headers):
        headers, _ = operator_headers
        r = requests.get(f"{BASE}/api/operator/manual-bookings/?channel=all", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("bookings", "total", "on_site_count", "online_count"):
            assert k in j, f"missing key {k} in {j.keys()}"

    def test_lookup_customer_found(self, operator_headers):
        headers, _ = operator_headers
        r = requests.get(
            f"{BASE}/api/operator/manual-bookings/lookup-customer",
            params={"email": "customer@test.com"},
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("found") is True
        assert j["customer"]["email"].lower() == "customer@test.com"

    def test_lookup_customer_not_found(self, operator_headers):
        headers, _ = operator_headers
        r = requests.get(
            f"{BASE}/api/operator/manual-bookings/lookup-customer",
            params={"email": f"nobody-{uuid.uuid4().hex[:6]}@nowhere.io"},
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json().get("found") is False

    def test_create_travel_walkin_and_seat_lock(self, operator_headers, operator_travel_route):
        headers, user = operator_headers
        route, op_id = operator_travel_route
        route_id = route.get("_id") or route.get("id")
        # Use a far-future date and unique seats to avoid conflicts with previous runs
        travel_date = "2030-06-15"
        seat1 = f"T{uuid.uuid4().hex[:4].upper()}"
        seat2 = f"T{uuid.uuid4().hex[:4].upper()}"
        price = float(route.get("price") or route.get("base_price") or 5000)
        payload = {
            "service_type": "travel",
            "service_id": route_id,
            "service_name": route.get("route_name") or f"{route.get('from_city')} -> {route.get('to_city')}",
            "total_amount": price * 2,
            "currency": "XAF",
            "payment_method": "cash",
            "customer": {"name": "Walk-in Tester", "phone": "+237600000001", "email": "customer@test.com"},
            "booking_details": {"seat_numbers": [seat1, seat2], "travel_date": travel_date},
            "service_date": travel_date,
            "notes": "TEST_walkin_iter113",
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"create walk-in -> {r.status_code} {r.text[:400]}"
        j = r.json()
        assert j.get("success") is True
        assert j.get("order_id")
        assert j.get("order_number", "").startswith("TRV-")
        # Customer was linked by email
        assert j.get("customer_linked") is True

        # Duplicate seat booking must return 409
        r2 = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r2.status_code == 409, f"expected 409 seat conflict, got {r2.status_code} {r2.text[:200]}"

        # List filtered by on_site should include our order
        lst = requests.get(
            f"{BASE}/api/operator/manual-bookings/?channel=on_site&service_type=travel",
            headers=headers, timeout=30,
        )
        assert lst.status_code == 200
        bookings = lst.json().get("bookings", [])
        assert any(b.get("order_number") == j["order_number"] for b in bookings), "created booking not in on_site list"

        # Verify seat_bookings collection lock via 409 already; also verify vehicle_info saved
        order = next((b for b in bookings if b.get("order_number") == j["order_number"]), None)
        assert order is not None
        bd = order.get("booking_details", {})
        assert bd.get("seat_numbers") == [seat1, seat2]
        assert "vehicle_info" in bd  # may be {} if route has no vehicle_id, which is ok

    def test_operator_cannot_create_for_other_operator_service(self, operator_headers, admin_headers):
        """Pick a service whose operator_id != operator's operator_id."""
        headers, user = operator_headers
        my_op = user.get("operator_id") or (user.get("operator_context") or {}).get("operator_id")
        # Get hotels (any) via admin
        r = requests.get(f"{BASE}/api/hotels", timeout=30)
        if r.status_code != 200:
            pytest.skip(f"cannot list hotels: {r.status_code}")
        hotels = r.json()
        hotels = hotels if isinstance(hotels, list) else hotels.get("hotels") or hotels.get("items") or []
        foreign = next((h for h in hotels if h.get("operator_id") and h.get("operator_id") != my_op), None)
        if not foreign:
            pytest.skip("no foreign-operator hotel found")
        payload = {
            "service_type": "hotel",
            "service_id": foreign.get("_id") or foreign.get("id"),
            "total_amount": 10000,
            "payment_method": "cash",
            "customer": {"name": "X"},
            "booking_details": {},
        }
        r = requests.post(f"{BASE}/api/operator/manual-bookings/", json=payload, headers=headers, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"


# ---------------- Feature B: Notifications dedupe ----------------

class TestNotificationsDedupe:
    def test_dedupe_admin_endpoint_is_idempotent(self, admin_headers, customer_headers):
        # Run dedupe twice; second call should remove 0 (or very few)
        r1 = requests.post(f"{BASE}/api/notifications/dedupe", headers=admin_headers, timeout=60)
        assert r1.status_code == 200, r1.text
        stats1 = r1.json()
        assert "duplicates_removed" in stats1
        assert "merged_read_state" in stats1

        r2 = requests.post(f"{BASE}/api/notifications/dedupe", headers=admin_headers, timeout=60)
        assert r2.status_code == 200
        stats2 = r2.json()
        assert stats2.get("duplicates_removed", 0) == 0, f"dedupe not idempotent: {stats2}"

    def test_dedupe_requires_admin(self, customer_headers):
        headers, _ = customer_headers
        r = requests.post(f"{BASE}/api/notifications/dedupe", headers=headers, timeout=30)
        assert r.status_code in (401, 403), f"customer should not be allowed: {r.status_code}"

    def test_create_dedupe_upsert_preserves_is_read(self, admin_headers, customer_headers):
        _, cust = customer_headers
        dk = f"TEST_iter113_{uuid.uuid4().hex[:6]}"
        payload = {
            "user_id": cust["_id"] if "_id" in cust else cust.get("id"),
            "title": "Test dedupe",
            "message": "iter113",
            "notification_type": "system",
            "data": {"dedupe_key": dk},
        }
        # Insert 1
        r1 = requests.post(f"{BASE}/api/notifications/", json=payload, headers=admin_headers, timeout=30)
        assert r1.status_code == 200, r1.text
        nid = r1.json().get("notification_id")
        assert nid

        # Fetch & mark read as customer
        ch, _ = customer_headers
        # find the notif id visible to customer
        lst = requests.get(f"{BASE}/api/notifications/", headers=ch, timeout=30)
        assert lst.status_code == 200
        notifs = lst.json().get("notifications", [])
        mine = next((n for n in notifs if n.get("_id") == nid or n.get("id") == nid), None)
        # The API may serialize id differently
        if not mine:
            mine = next((n for n in notifs if n.get("dedupe_key") == dk), None)
        assert mine, f"created notif not visible to customer (dk={dk})"
        mark_id = mine.get("_id") or mine.get("id")
        mr = requests.put(f"{BASE}/api/notifications/{mark_id}/read", headers=ch, timeout=30)
        assert mr.status_code == 200, mr.text

        # Insert again with same dedupe_key
        r2 = requests.post(f"{BASE}/api/notifications/", json=payload, headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        nid2 = r2.json().get("notification_id")
        # Should be same logical notification (upserted)
        assert nid2 == nid or nid2 == mark_id, f"dedupe_key upsert produced a new row: old={nid} new={nid2}"

        # Refetch: should still be marked read
        lst2 = requests.get(f"{BASE}/api/notifications/", headers=ch, timeout=30)
        notifs2 = lst2.json().get("notifications", [])
        again = next((n for n in notifs2 if (n.get("_id") or n.get("id")) == mark_id), None)
        assert again is not None, "dedupe notif disappeared"
        assert again.get("is_read") is True, f"is_read was reset after upsert: {again}"

        # Count: no duplicates for same dedupe_key
        dup_count = sum(1 for n in notifs2 if n.get("dedupe_key") == dk)
        assert dup_count == 1, f"expected 1 notif for dedupe_key, got {dup_count}"


# ---------------- Feature A: Travel vehicle_info enrichment ----------------

class TestTravelVehicleEnrichment:
    def test_travel_order_has_vehicle_info(self, customer_headers, operator_travel_route):
        headers, _ = customer_headers
        route, _ = operator_travel_route
        route_id = route.get("_id") or route.get("id")
        travel_date = "2030-07-20"
        seat = f"V{uuid.uuid4().hex[:4].upper()}"
        price = float(route.get("price") or route.get("base_price") or 5000)
        payload = {
            "service_type": "travel",
            "service_id": route_id,
            "service_name": route.get("route_name") or "Test Route",
            "total_amount": price,
            "subtotal": price,
            "final_amount": price,
            "currency": "XAF",
            "booking_details": {
                "seat_numbers": [seat],
                "travel_date": travel_date,
                "passenger_name": "Test Pax",
                "passenger_phone": "+237600000002",
            },
        }
        r = requests.post(f"{BASE}/api/orders/create", json=payload, headers=headers, timeout=30)
        if r.status_code not in (200, 201):
            # Some backends require payment_method etc.
            payload["payment_method"] = "mtn_momo"
            r = requests.post(f"{BASE}/api/orders/create", json=payload, headers=headers, timeout=30)
        assert r.status_code in (200, 201), f"create travel order -> {r.status_code} {r.text[:300]}"
        j = r.json()
        order = j.get("order") or j
        bd = order.get("booking_details") or {}
        if not bd and order.get("order_id"):
            # fetch detail
            det = requests.get(f"{BASE}/api/orders/{order['order_id']}", headers=headers, timeout=30)
            if det.status_code == 200:
                order = det.json()
                bd = order.get("booking_details") or {}
        # Only assert presence — vehicle_info key must exist when route has a vehicle_id
        if route.get("vehicle_id"):
            assert "vehicle_info" in bd, f"vehicle_info missing from booking_details: {list(bd.keys())}"
            vi = bd["vehicle_info"] or {}
            # Expect at least one of the canonical vehicle fields
            assert any(k in vi for k in ("plate_number", "model", "manufacturer", "images")), (
                f"vehicle_info lacks canonical fields: {vi}"
            )
        else:
            pytest.skip("route has no vehicle_id; cannot verify enrichment")

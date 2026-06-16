"""
Scanner ↔ Refund integration — gate staff must see the refund state of any
ticket they're about to admit, AND the backend must hard-block check-in for
fully-refunded orders.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import requests

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass


API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
_token_cache: dict[str, str] = {}


def _login(email, password):
    if email in _token_cache:
        return _token_cache[email]
    tok = requests.post(
        f"{API}/api/auth/login", json={"email": email, "password": password}
    ).json().get("access_token")
    if tok:
        _token_cache[email] = tok
    return tok


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def _future_iso(days=14):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")


def _new_showtime_and_book(qty=1, seat_ids=None):
    """Spin up an isolated showtime and book a ticket; return (showtime_id, order_id)."""
    loc_id = requests.post(
        f"{API}/api/event-locations/",
        json={
            "name": f"Scanner Venue {uuid.uuid4().hex[:6]}",
            "city": "Douala",
            "address": "Scanner Ave",
            "layout_type": "simple",
            "capacity": 50,
            "operator_id": OP_ID,
        },
        headers=_super(),
    ).json()["id"]
    sid = requests.post(
        f"{API}/api/event-showtimes/",
        json={
            "location_id": loc_id,
            "title": f"Scanner Show {uuid.uuid4().hex[:6]}",
            "start_datetime": _future_iso(),
            "end_datetime": _future_iso(),
            "classes": [{"name": "Std", "price": 7500, "total_units": 10}],
            "operator_id": OP_ID,
            "status": "published",
        },
        headers=_super(),
    ).json()["id"]
    st = requests.get(f"{API}/api/event-showtimes/{sid}").json()
    class_id = st["classes"][0]["id"]
    order_id = requests.post(
        f"{API}/api/event-showtimes/book",
        json={
            "showtime_id": sid,
            "class_id": class_id,
            "quantity": qty,
            "seat_ids": seat_ids,
            "contact_name": "Scanner Tester",
        },
        headers=_customer(),
    ).json()["order_id"]
    # Event bookings don't get an `order_number` by default — but the scanner
    # endpoint looks up by `order_number` first and uppercases input. We patch
    # the order in-place with a known uppercase order_number so the scanner
    # finds it deterministically.
    order_number = f"EVT-{uuid.uuid4().hex[:10].upper()}"
    _mongo_update(order_id, {"order_number": order_number})
    return sid, order_id, order_number


def _mongo_update(order_id, fields):
    """Direct Mongo write — used to simulate state we can't reach via API yet
    (e.g. flipping payment_status=completed without running Stripe)."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _do():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db_name = (os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "oryno_webapp").strip()
        await client[db_name].orders.update_one({"_id": order_id}, {"$set": fields})
        client.close()

    asyncio.run(_do())


def _scan(code):
    return requests.post(
        f"{API}/api/orders/scan/validate",
        json={"code": code},
        headers=_super(),
    ).json()


# ── Tests ───────────────────────────────────────────────────────────────────
def test_scanner_clean_ticket_shows_no_refund_flags():
    _, oid, ocode = _new_showtime_and_book()
    _mongo_update(oid, {"status": "confirmed", "payment_status": "paid"})
    data = _scan(ocode)
    assert data["valid"] is True
    assert data["is_refunded"] is False
    assert data["is_partially_refunded"] is False
    assert data["refunded_amount"] == 0
    assert data["open_refund"] is None


def test_scanner_surfaces_pending_refund():
    _, oid, ocode = _new_showtime_and_book()
    _mongo_update(oid, {
        "status": "confirmed",
        "payment_status": "completed",
        "payment_method": "momo",
    })
    refund_id = requests.post(
        f"{API}/api/refunds/orders/{oid}/request",
        json={"reason": "change_of_plans"},
        headers=_customer(),
    ).json()["refund_id"]

    data = _scan(ocode)
    assert data["valid"] is True
    assert data["open_refund"] is not None
    assert data["open_refund"]["refund_id"] == refund_id
    assert data["open_refund"]["status"] == "pending"
    assert data["open_refund"]["requires_manual_processing"] is True


def test_scanner_marks_fully_refunded_and_blocks_checkin():
    _, oid, ocode = _new_showtime_and_book()
    _mongo_update(oid, {
        "status": "confirmed",
        "payment_status": "completed",
        "payment_method": "momo",
    })
    refund_id = requests.post(
        f"{API}/api/refunds/orders/{oid}/request",
        json={"reason": "duplicate_booking"},
        headers=_customer(),
    ).json()["refund_id"]
    requests.post(
        f"{API}/api/refunds/{refund_id}/approve",
        json={"approved_amount": None},
        headers=_super(),
    )

    data = _scan(ocode)
    assert data["is_refunded"] is True
    assert data["refunded_amount"] > 0
    assert data["open_refund"] is not None and data["open_refund"]["status"] == "approved"

    # Hard-block check-in
    r = requests.post(
        f"{API}/api/orders/scan/check-in",
        json={"code": ocode},
        headers=_super(),
    )
    assert r.status_code == 400
    assert "refund" in r.json()["detail"].lower()


def test_scanner_partial_refund_flag():
    _, oid, ocode = _new_showtime_and_book(qty=2)
    _mongo_update(oid, {
        "status": "confirmed",
        "payment_status": "completed",
        "payment_method": "momo",
    })
    refund_id = requests.post(
        f"{API}/api/refunds/orders/{oid}/request",
        json={"reason": "service_issue", "requested_amount": 5000.0},
        headers=_customer(),
    ).json()["refund_id"]
    requests.post(
        f"{API}/api/refunds/{refund_id}/approve",
        json={"approved_amount": 5000.0},
        headers=_super(),
    )
    data = _scan(ocode)
    assert data["is_refunded"] is False
    assert data["is_partially_refunded"] is True
    assert data["refunded_amount"] == 5000.0
    # Partial refunds DON'T fire the refund-block branch — they bounce on the
    # payment_status check instead, which is fine: operator policy decides
    # whether to admit a partially-refunded customer.
    r = requests.post(
        f"{API}/api/orders/scan/check-in",
        json={"code": ocode},
        headers=_super(),
    )
    assert r.status_code == 400
    # The refund-block branch produces "do not admit"; the payment-status guard
    # produces "Cannot check in — ticket status: …". Partial refunds bounce on
    # the latter, not the former.
    assert "do not admit" not in r.json()["detail"].lower()

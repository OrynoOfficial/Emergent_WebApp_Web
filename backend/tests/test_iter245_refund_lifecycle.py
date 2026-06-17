"""Iteration 245 — refund-request lifecycle + EVT- order_number."""
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "oryno_webapp"

CUSTOMER = ("customer@test.com", "testpassword123")
ADMIN = ("admin@test.com", "testpassword123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    return _login(*CUSTOMER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def customer_user_id(db):
    u = db.users.find_one({"email": CUSTOMER[0]}, {"_id": 1})
    assert u, "customer user missing"
    return u["_id"]


def _seed_paid_event_order(db, user_id, *, checked_in=False, past_service=False):
    order_id = f"TEST-ORD-{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    svc = (now - timedelta(days=2)) if past_service else (now + timedelta(days=7))
    db.orders.insert_one({
        "_id": order_id,
        "order_number": f"TEST-EVT-{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "operator_id": "test-operator-iter245",
        "service_type": "event",
        "service_id": "test-showtime-iter245",
        "showtime_id": "test-showtime-iter245",
        "total_amount": 10000.0,
        "currency": "XAF",
        "status": "confirmed",
        "payment_status": "paid",
        "payment_method": "cash",
        "checked_in": bool(checked_in),
        "booking_details": {"showtime_id": "test-showtime-iter245", "class_id": "test-class",
                            "quantity": 1, "start_datetime": svc.isoformat()},
        "created_at": now,
        "updated_at": now,
    })
    return order_id


# ── 1. Event order_number EVT- format ────────────────────────────────────
class TestOrderNumberFormat:
    def test_customer_event_orders_have_evt_prefix(self, customer_token):
        r = requests.get(f"{API}/orders/?limit=200",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        payload = r.json()
        orders = payload if isinstance(payload, list) else payload.get("orders", [])
        events = [o for o in orders if (o.get("service_type") or "").lower() in ("event", "events")]
        if not events:
            pytest.skip("no event orders on file")
        evt_prefixed = [o for o in events if str(o.get("order_number") or "").startswith("EVT-")]
        # Allow legacy orders to exist; at least one (newest) must have EVT- prefix
        assert evt_prefixed, (
            f"No event order has EVT- order_number. Sample: "
            f"{[(o.get('id') or o.get('_id'), o.get('order_number')) for o in events[:5]]}"
        )


# ── 2-5. Refund lifecycle ────────────────────────────────────────────────
class TestRefundLifecycle:
    def test_request_invalidates_and_admin_reject_reverts(self, customer_token, admin_token, db, customer_user_id):
        order_id = _seed_paid_event_order(db, customer_user_id)
        try:
            # submit refund
            r = requests.post(f"{API}/refunds/orders/{order_id}/request",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"reason": "other", "customer_notes": "iter245"}, timeout=15)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["status"] == "pending"
            refund_id = body["refund_id"]

            order = db.orders.find_one({"_id": order_id})
            assert order["status"] == "refund_requested"
            assert order["ticket_invalidated"] is True
            assert order["pre_refund_status"] == "confirmed"

            # 'refund_submitted' notification
            nr = requests.get(f"{API}/notifications/",
                              headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
            assert nr.status_code == 200, nr.text
            jb = nr.json()
            notifs = jb if isinstance(jb, list) else jb.get("notifications", [])
            assert any(n.get("notification_type") == "refund_submitted"
                       and (n.get("data") or {}).get("refund_id") == refund_id for n in notifs), \
                "missing refund_submitted notif"

            # admin reject (not expired) → revert to confirmed
            rr = requests.post(f"{API}/refunds/{refund_id}/reject",
                               headers={"Authorization": f"Bearer {admin_token}"},
                               json={"admin_notes": "test reject"}, timeout=15)
            assert rr.status_code == 200, rr.text
            order2 = db.orders.find_one({"_id": order_id})
            assert order2["status"] == "confirmed", order2["status"]
            assert order2["ticket_invalidated"] is False

            nr2 = requests.get(f"{API}/notifications/",
                               headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
            jb2 = nr2.json()
            notifs2 = jb2 if isinstance(jb2, list) else jb2.get("notifications", [])
            assert any(n.get("notification_type") == "refund_rejected"
                       and (n.get("data") or {}).get("refund_id") == refund_id for n in notifs2), \
                "missing refund_rejected notif"
        finally:
            db.orders.delete_one({"_id": order_id})
            db.refunds.delete_many({"order_id": order_id})

    def test_scanned_ticket_blocks_refund(self, customer_token, db, customer_user_id):
        order_id = _seed_paid_event_order(db, customer_user_id, checked_in=True)
        try:
            r = requests.post(f"{API}/refunds/orders/{order_id}/request",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"reason": "other"}, timeout=15)
            assert r.status_code == 400, r.text
            assert "scanned" in r.json().get("detail", "").lower()
        finally:
            db.orders.delete_one({"_id": order_id})

    def test_reject_after_service_date_stays_expired(self, customer_token, admin_token, db, customer_user_id):
        order_id = _seed_paid_event_order(db, customer_user_id, past_service=True)
        try:
            r = requests.post(f"{API}/refunds/orders/{order_id}/request",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"reason": "other"}, timeout=15)
            assert r.status_code == 200, r.text
            refund_id = r.json()["refund_id"]
            rr = requests.post(f"{API}/refunds/{refund_id}/reject",
                               headers={"Authorization": f"Bearer {admin_token}"},
                               json={"admin_notes": "past"}, timeout=15)
            assert rr.status_code == 200, rr.text
            order = db.orders.find_one({"_id": order_id})
            assert order["status"] == "expired", order["status"]
            assert order["ticket_invalidated"] is True
        finally:
            db.orders.delete_one({"_id": order_id})
            db.refunds.delete_many({"order_id": order_id})

    def test_approve_full_refund(self, customer_token, admin_token, db, customer_user_id):
        order_id = _seed_paid_event_order(db, customer_user_id)
        try:
            r = requests.post(f"{API}/refunds/orders/{order_id}/request",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"reason": "other"}, timeout=15)
            assert r.status_code == 200, r.text
            refund_id = r.json()["refund_id"]

            ar = requests.post(f"{API}/refunds/{refund_id}/approve",
                               headers={"Authorization": f"Bearer {admin_token}"},
                               json={"approved_amount": 10000.0, "admin_notes": "ok"}, timeout=15)
            assert ar.status_code == 200, ar.text
            body = ar.json()
            assert body["status"] in ("completed", "approved")

            order = db.orders.find_one({"_id": order_id})
            assert order["status"] == "refunded", order["status"]
            assert order["payment_status"] == "refunded"
            assert order["ticket_invalidated"] is True

            nr = requests.get(f"{API}/notifications/",
                              headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
            jb = nr.json()
            notifs = jb if isinstance(jb, list) else jb.get("notifications", [])
            assert any(n.get("notification_type") == "refund_approved"
                       and (n.get("data") or {}).get("refund_id") == refund_id for n in notifs), \
                "missing refund_approved notif"
        finally:
            db.orders.delete_one({"_id": order_id})
            db.refunds.delete_many({"order_id": order_id})

"""
iter 248 — Backend test for POST /api/refunds/{id}/complete

Tests:
1. Admin can mark an APPROVED manual refund as COMPLETED.
2. Response shape: refund_id, status='completed', proof_reference echoed.
3. Refund doc updated: completed_at, completed_by, gateway_refund_id=proof.
4. Order updated: status='refunded', payment_status='refunded'.
5. Notification 'refund_completed' created for customer.
6. Calling /complete when not APPROVED returns 400.
7. Non-admin caller returns 403.
"""
import os
import time
import uuid
import requests
import pytest
from pymongo import MongoClient
from datetime import datetime, timezone

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "oryno_webapp")

ADMIN = {"email": "admin@test.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture
def approved_manual_refund(db):
    """Seed: insert a refund directly in APPROVED+manual state tied to a real-ish order."""
    user = db.users.find_one({"email": CUSTOMER["email"]})
    assert user, "customer@test.com must exist"
    uid = user["_id"]

    order_id = f"TEST_ORDER_{uuid.uuid4()}"
    refund_id = f"TEST_REFUND_{uuid.uuid4()}"
    now = datetime.now(timezone.utc)

    db.orders.insert_one({
        "_id": order_id,
        "user_id": uid,
        "operator_id": "op-test",
        "service_type": "travel",
        "service_id": "svc-test",
        "payment_method": "mtn_momo",
        "payment_status": "completed",
        "status": "confirmed",
        "total_amount": 5000,
        "currency": "XAF",
        "order_number": "TST248",
        "ticket_invalidated": True,
        "pre_refund_status": "confirmed",
        "created_at": now,
        "updated_at": now,
    })
    db.refunds.insert_one({
        "_id": refund_id,
        "order_id": order_id,
        "user_id": uid,
        "operator_id": "op-test",
        "service_type": "travel",
        "total_amount": 5000,
        "requested_amount": 5000,
        "approved_amount": 5000,
        "eligible_amount": 5000,
        "refundable_pct": 100,
        "status": "approved",
        "gateway_refund_id": None,
        "requires_manual_processing": True,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    })
    yield {"refund_id": refund_id, "order_id": order_id, "user_id": uid}
    # cleanup
    db.refunds.delete_one({"_id": refund_id})
    db.orders.delete_one({"_id": order_id})
    db.notifications.delete_many({"data.refund_id": refund_id})


def test_complete_refund_happy_path(db, admin_token, approved_manual_refund):
    rid = approved_manual_refund["refund_id"]
    oid = approved_manual_refund["order_id"]
    uid = approved_manual_refund["user_id"]
    proof = "MOMO-AUDIT-001"

    r = requests.post(
        f"{BASE}/api/refunds/{rid}/complete",
        json={"proof_reference": proof},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 200, f"unexpected {r.status_code}: {r.text}"
    body = r.json()
    assert body["refund_id"] == rid
    assert body["status"] == "completed"
    assert body["proof_reference"] == proof

    # Refund doc updated
    refund = db.refunds.find_one({"_id": rid})
    assert refund["status"] == "completed"
    assert refund["gateway_refund_id"] == proof
    assert refund["completed_at"] is not None
    assert refund["completed_by"] is not None

    # Order updated
    order = db.orders.find_one({"_id": oid})
    assert order["status"] == "refunded"
    assert order["payment_status"] == "refunded"

    # Notification created
    # Give async write a beat then check
    time.sleep(0.5)
    notif = db.notifications.find_one({
        "user_id": uid,
        "notification_type": "refund_completed",
        "data.refund_id": rid,
    })
    assert notif is not None, "refund_completed notification not created"


def test_complete_refund_rejects_non_approved(db, admin_token, approved_manual_refund):
    rid = approved_manual_refund["refund_id"]
    # Flip to pending
    db.refunds.update_one({"_id": rid}, {"$set": {"status": "pending"}})
    r = requests.post(
        f"{BASE}/api/refunds/{rid}/complete",
        json={"proof_reference": "X"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 400
    assert "approved" in r.json().get("detail", "").lower()


def test_complete_refund_requires_admin(db, customer_token, approved_manual_refund):
    rid = approved_manual_refund["refund_id"]
    r = requests.post(
        f"{BASE}/api/refunds/{rid}/complete",
        json={"proof_reference": "X"},
        headers={"Authorization": f"Bearer {customer_token}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_complete_refund_not_found(admin_token):
    r = requests.post(
        f"{BASE}/api/refunds/does-not-exist-{uuid.uuid4()}/complete",
        json={"proof_reference": "X"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=15,
    )
    assert r.status_code == 404

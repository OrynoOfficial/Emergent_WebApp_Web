"""Regression tests for the abandon-pending-order guard.

The original guard only blocked payment_status=='paid' orders, missing
'completed' (which is what MoMo writes on success). That caused successful
MoMo payments to be deleted when the LaundryBooking unmounted on
navigation to /orders, wiping the just-paid order and all derived data.
"""
import os
import uuid
from datetime import datetime, timezone

import requests


def _base_url():
    val = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not val:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    val = line.split("=", 1)[1].strip()
                    break
    return val.rstrip("/")


BASE = _base_url()


def _login(email="customer@test.com", password="testpassword123"):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    body = r.json()
    return body.get("access_token") or body.get("token")


def _make_order(token, payment_status="pending", order_status="pending"):
    """Insert an order directly via the API."""
    payload = {
        "service_type": "laundry",
        "service_id": "test-shop-id",
        "service_name": "Abandon Guard Test Shop",
        "total_amount": 5000,
        "currency": "XAF",
        "status": order_status,
        "payment_status": payment_status,
        "booking_details": {
            "shop_id": "test-shop-id",
            "items": [{"name": "Shirt", "quantity": 1, "unit_price": 5000}],
        },
    }
    r = requests.post(f"{BASE}/api/orders/create",
                      json=payload,
                      headers={"Authorization": f"Bearer {token}"},
                      timeout=30)
    r.raise_for_status()
    return r.json()["order_id"]


def _set_order_state(token, order_id, payment_status, order_status="pending"):
    """Patch via direct mongo write since orders/create always creates pending."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["oryno_webapp"]
    asyncio.get_event_loop().run_until_complete(
        db.orders.update_one(
            {"_id": order_id},
            {"$set": {"payment_status": payment_status, "status": order_status,
                      "paid_at": datetime.now(timezone.utc)}},
        )
    )


def test_abandon_blocks_completed_payment_status():
    """payment_status='completed' (MoMo success) MUST NOT be deletable."""
    token = _login()
    order_id = _make_order(token)
    try:
        _set_order_state(token, order_id, payment_status="completed")
        r = requests.delete(f"{BASE}/api/orders/{order_id}/abandon",
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 409, f"Expected 409 for completed payment, got {r.status_code}: {r.text}"
        # Verify order still exists
        r2 = requests.get(f"{BASE}/api/orders/{order_id}",
                          headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200, "Paid order was wrongly deleted"
    finally:
        # Cleanup — bypass the guard via direct mongo
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio
        db = AsyncIOMotorClient("mongodb://localhost:27017")["oryno_webapp"]
        asyncio.get_event_loop().run_until_complete(db.orders.delete_one({"_id": order_id}))


def test_abandon_blocks_paid_status():
    token = _login()
    order_id = _make_order(token)
    try:
        _set_order_state(token, order_id, payment_status="paid")
        r = requests.delete(f"{BASE}/api/orders/{order_id}/abandon",
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 409
    finally:
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio
        db = AsyncIOMotorClient("mongodb://localhost:27017")["oryno_webapp"]
        asyncio.get_event_loop().run_until_complete(db.orders.delete_one({"_id": order_id}))


def test_abandon_allows_pending_unpaid_orders():
    """Truly pending unpaid orders SHOULD still be abandonable."""
    token = _login()
    order_id = _make_order(token)
    r = requests.delete(f"{BASE}/api/orders/{order_id}/abandon",
                        headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"Pending order should be abandonable, got {r.status_code}"
    body = r.json()
    assert body.get("success") is True
    assert body.get("deleted") is True


def test_abandon_idempotent_for_already_gone_orders():
    """Calling abandon twice should not error."""
    token = _login()
    order_id = _make_order(token)
    requests.delete(f"{BASE}/api/orders/{order_id}/abandon",
                    headers={"Authorization": f"Bearer {token}"})
    # Second call
    r2 = requests.delete(f"{BASE}/api/orders/{order_id}/abandon",
                         headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json().get("already_gone") is True

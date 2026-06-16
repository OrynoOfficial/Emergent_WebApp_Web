"""
/api/refunds/{id}/details — rich admin detail view used by the new modal.
Returns refund + order + enriched customer (lifetime totals, refund history).
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
_tok: dict[str, str] = {}


def _login(email, pwd):
    if email in _tok:
        return _tok[email]
    t = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pwd}).json().get("access_token")
    if t:
        _tok[email] = t
    return t


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def _future_iso(days=14):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")


def _seed_refund():
    loc_id = requests.post(
        f"{API}/api/event-locations/",
        json={"name": f"D Venue {uuid.uuid4().hex[:5]}", "city": "Douala", "address": "x",
              "layout_type": "simple", "capacity": 20, "operator_id": OP_ID},
        headers=_super(),
    ).json()["id"]
    sid = requests.post(
        f"{API}/api/event-showtimes/",
        json={"location_id": loc_id, "title": "Detail Show",
              "start_datetime": _future_iso(), "end_datetime": _future_iso(),
              "classes": [{"name": "VIP", "price": 12000, "total_units": 10}],
              "operator_id": OP_ID, "status": "published"},
        headers=_super(),
    ).json()["id"]
    cid = requests.get(f"{API}/api/event-showtimes/{sid}").json()["classes"][0]["id"]
    order_id = requests.post(
        f"{API}/api/event-showtimes/book",
        json={"showtime_id": sid, "class_id": cid, "quantity": 1,
              "contact_name": "Detail Tester"},
        headers=_customer(),
    ).json()["order_id"]
    # Mark paid via Mongo (no public endpoint for this in tests).
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _mark():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db_name = (os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME") or "oryno_webapp").strip()
        await client[db_name].orders.update_one(
            {"_id": order_id},
            {"$set": {"status": "confirmed", "payment_status": "completed", "payment_method": "momo"}},
        )
        client.close()
    asyncio.run(_mark())
    refund_id = requests.post(
        f"{API}/api/refunds/orders/{order_id}/request",
        json={"reason": "service_issue", "customer_notes": "Couldn't find the venue"},
        headers=_customer(),
    ).json()["refund_id"]
    return refund_id, order_id


def test_details_includes_refund_order_customer():
    refund_id, order_id = _seed_refund()
    r = requests.get(f"{API}/api/refunds/{refund_id}/details", headers=_super())
    assert r.status_code == 200
    body = r.json()
    assert body["refund"]["id"] == refund_id
    assert body["order"]["id"] == order_id
    assert body["customer"] is not None
    c = body["customer"]
    assert c["email"] == "customer@test.com"
    assert c["name"]   # full name field populated
    assert "joined_at" in c
    assert "lifetime_spent" in c
    assert "total_orders" in c
    assert "total_refunds_count" in c


def test_details_requires_admin():
    refund_id, _ = _seed_refund()
    r = requests.get(f"{API}/api/refunds/{refund_id}/details", headers=_customer())
    assert r.status_code == 403


def test_list_refunds_includes_customer_block():
    refund_id, _ = _seed_refund()
    r = requests.get(f"{API}/api/refunds", params={"status_filter": "pending"}, headers=_super()).json()
    row = next(x for x in r["refunds"] if x["id"] == refund_id)
    assert row.get("customer") is not None
    assert row["customer"]["email"] == "customer@test.com"

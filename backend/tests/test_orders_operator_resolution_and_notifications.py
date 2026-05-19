"""Regression tests for operator-id resolution + booking notifications.

The `POST /api/orders/create` endpoint used to look up cinema service_id
in the `db.cinemas` collection directly. That's wrong because for cinema
bookings, service_id is the SHOWTIME id, not the cinema id, so the operator
never got resolved and orders showed operator=N/A.

It also did not notify operators / admins when a new booking came in.
This module locks in both behaviours.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import requests
from motor.motor_asyncio import AsyncIOMotorClient


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
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "oryno_webapp"


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _login(email="customer@test.com", password="testpassword123"):
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    body = r.json()
    return body.get("access_token") or body.get("token"), body.get("user", {})


def test_cinema_order_resolves_operator_via_showtime():
    """A cinema booking sends service_id=showtime_id; orders/create must
    walk showtime -> cinema to resolve operator_id."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

    operator_id = f"test-op-cinema-{uuid.uuid4()}"
    operator = {
        "_id": operator_id,
        "name": "TestOperator-Cinema",
        "owner_user_id": "test-owner-user",
        "status": "active",
    }
    cinema_id = f"test-cinema-{uuid.uuid4()}"
    cinema = {
        "_id": cinema_id,
        "name": "Test Cinema",
        "operator_id": operator_id,
        "operator_name": "TestOperator-Cinema",
        "address": "TestSt",
        "city": "Yaoundé",
    }
    showtime_id = f"test-showtime-{uuid.uuid4()}"
    showtime = {
        "_id": showtime_id,
        "cinema_id": cinema_id,
        "cinema_name": "Test Cinema",
        "film_id": "test-film",
        "screen_name": "Screen 1",
        "show_date": "2026-12-01",
        "show_time": "20:00",
        "end_time": "22:00",
        "price": 3000,
    }

    token, _ = _login()
    try:
        _run(db.operators.insert_one(operator))
        _run(db.cinemas.insert_one(cinema))
        _run(db.showtimes.insert_one(showtime))

        r = requests.post(
            f"{BASE}/api/orders/create",
            json={
                "service_type": "cinema",
                "service_id": showtime_id,
                "service_name": "Cinema booking",
                "total_amount": 3000,
                "currency": "XAF",
                "status": "pending",
                "payment_status": "pending",
                "booking_details": {"seats": ["A1"]},
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        order = _run(db.orders.find_one({"_id": order_id}))
        assert order is not None
        assert order["operator_id"] == operator_id, f"Expected {operator_id}, got {order.get('operator_id')}"
        assert order["operator_name"] == "TestOperator-Cinema"
    finally:
        _run(db.orders.delete_many({"service_id": showtime_id}))
        _run(db.showtimes.delete_one({"_id": showtime_id}))
        _run(db.cinemas.delete_one({"_id": cinema_id}))
        _run(db.operators.delete_one({"_id": operator_id}))
        _run(db.notifications.delete_many({"service_type": "cinema", "order_id": {"$exists": True}}))


def test_new_booking_notifies_operator_owner_and_team():
    """Operator owner + team members must receive a 'new_booking' notification."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]

    operator_id = f"test-op-notify-{uuid.uuid4()}"
    owner_user_id = f"test-owner-{uuid.uuid4()}"
    team_user_id = f"test-team-{uuid.uuid4()}"
    operator = {
        "_id": operator_id,
        "name": "NotifyOp",
        "owner_user_id": owner_user_id,
        "status": "active",
    }
    pressing_id = f"test-pressing-{uuid.uuid4()}"
    pressing = {
        "_id": pressing_id,
        "name": "Notify Pressing",
        "operator_id": operator_id,
        "operator_name": "NotifyOp",
        "shop_type": "pressing",
        "city": "Douala",
    }
    users = [
        {"_id": owner_user_id, "email": "owner@notify.test", "role": "operator", "is_active": True},
        {"_id": team_user_id, "email": "team@notify.test", "role": "operator",
         "operator_id": operator_id, "is_active": True},
    ]

    token, _ = _login()
    try:
        _run(db.operators.insert_one(operator))
        _run(db.pressings.insert_one(pressing))
        _run(db.users.insert_many(users))

        r = requests.post(
            f"{BASE}/api/orders/create",
            json={
                "service_type": "laundry",
                "service_id": pressing_id,
                "service_name": "Notify Pressing",
                "total_amount": 5000,
                "currency": "XAF",
                "status": "pending",
                "payment_status": "pending",
                "booking_details": {},
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        # Owner + team should both have a new_booking notification
        notifs_owner = _run(db.notifications.count_documents(
            {"order_id": order_id, "user_id": owner_user_id, "type": "new_booking"}
        ))
        notifs_team = _run(db.notifications.count_documents(
            {"order_id": order_id, "user_id": team_user_id, "type": "new_booking"}
        ))
        assert notifs_owner == 1, f"Owner notif count was {notifs_owner}"
        assert notifs_team == 1, f"Team notif count was {notifs_team}"
    finally:
        _run(db.orders.delete_many({"service_id": pressing_id}))
        _run(db.notifications.delete_many({"order_id": {"$exists": True}, "user_id": {"$in": [owner_user_id, team_user_id]}}))
        _run(db.users.delete_many({"_id": {"$in": [owner_user_id, team_user_id]}}))
        _run(db.pressings.delete_one({"_id": pressing_id}))
        _run(db.operators.delete_one({"_id": operator_id}))


def test_new_booking_notifies_admins_for_validation():
    """All admin and super_admin users must receive a validation_required notification."""
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    token, _ = _login()
    pressing_id = f"test-pressing-{uuid.uuid4()}"
    pressing = {
        "_id": pressing_id,
        "name": "Admin Notify Shop",
        "operator_id": "irrelevant-op",
        "shop_type": "pressing",
        "city": "Douala",
    }

    try:
        _run(db.pressings.insert_one(pressing))
        admins_before = _run(db.users.count_documents(
            {"role": {"$in": ["admin", "super_admin", "superadmin"]}, "is_active": {"$ne": False}}
        ))
        assert admins_before > 0, "Need at least one admin to test this"

        r = requests.post(
            f"{BASE}/api/orders/create",
            json={
                "service_type": "laundry",
                "service_id": pressing_id,
                "service_name": "Admin Notify Shop",
                "total_amount": 5000,
                "currency": "XAF",
                "status": "pending",
                "payment_status": "pending",
                "booking_details": {},
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        admin_notifs = _run(db.notifications.count_documents(
            {"order_id": order_id, "type": "validation_required"}
        ))
        assert admin_notifs >= 1, f"Expected at least 1 admin notif, got {admin_notifs}"
    finally:
        _run(db.orders.delete_many({"service_id": pressing_id}))
        _run(db.notifications.delete_many({"order_id": {"$exists": True}, "type": "validation_required"}))
        _run(db.pressings.delete_one({"_id": pressing_id}))

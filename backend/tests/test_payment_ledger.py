"""
Tests for the immutable payment ledger.

Focus: the reducer correctness (out-of-order events, partial refunds,
disputes won/lost) and the dedup invariants enforced at the DB layer.
"""
from __future__ import annotations

import os
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient

from models.payment_event import reduce_events
from services.payment_ledger import (
    append_event,
    find_intent_by_idempotency,
    refresh_snapshot,
    verify_mtn_momo_signature,
)


# ───────────────────────── UNIT: REDUCER ────────────────────────────────────

def _ev(event_type, *, amount=None, when=None, payload=None):
    return {
        "event_type": event_type,
        "amount": amount,
        "occurred_at": when or datetime.now(timezone.utc),
        "payload": payload or {},
    }


def test_reducer_pending_when_only_intent():
    out = reduce_events([_ev("intent_created", amount=100)])
    assert out["state"] == "pending"
    assert out["captured_amount"] == 0
    assert out["event_count"] == 1


def test_reducer_happy_path_capture():
    base = datetime.now(timezone.utc)
    events = [
        _ev("intent_created", amount=100, when=base),
        _ev("authorized", amount=100, when=base + timedelta(seconds=2)),
        _ev("captured", amount=100, when=base + timedelta(seconds=5)),
    ]
    out = reduce_events(events)
    assert out["state"] == "captured"
    assert out["captured_amount"] == 100


def test_reducer_handles_out_of_order_webhooks():
    """Captured arrives BEFORE authorized — reducer must still land on captured."""
    base = datetime.now(timezone.utc)
    events = [
        _ev("captured", amount=50, when=base + timedelta(seconds=5)),
        _ev("intent_created", amount=50, when=base),
        _ev("authorized", amount=50, when=base + timedelta(seconds=2)),
    ]
    out = reduce_events(events)
    assert out["state"] == "captured"
    assert out["captured_amount"] == 50


def test_reducer_partial_then_full_refund():
    base = datetime.now(timezone.utc)
    events = [
        _ev("intent_created", amount=200, when=base),
        _ev("captured", amount=200, when=base + timedelta(seconds=1)),
        _ev("refunded", amount=50, when=base + timedelta(hours=1)),
    ]
    assert reduce_events(events)["state"] == "partially_refunded"

    events.append(_ev("refunded", amount=150, when=base + timedelta(hours=2)))
    out = reduce_events(events)
    assert out["state"] == "refunded"
    assert out["refunded_amount"] == 200


def test_reducer_failure_terminates():
    out = reduce_events([
        _ev("intent_created", amount=100),
        _ev("failed", amount=0),
    ])
    assert out["state"] == "failed"


def test_reducer_dispute_won_returns_to_captured():
    base = datetime.now(timezone.utc)
    events = [
        _ev("intent_created", amount=100, when=base),
        _ev("captured", amount=100, when=base + timedelta(seconds=1)),
        _ev("disputed", when=base + timedelta(days=1)),
        _ev("dispute_resolved", when=base + timedelta(days=30), payload={"outcome": "won"}),
    ]
    out = reduce_events(events)
    assert out["state"] == "captured"
    assert out["in_dispute"] is False


def test_reducer_dispute_lost_marks_refunded_equivalent():
    base = datetime.now(timezone.utc)
    events = [
        _ev("intent_created", amount=100, when=base),
        _ev("captured", amount=100, when=base + timedelta(seconds=1)),
        _ev("disputed", when=base + timedelta(days=1)),
        _ev("dispute_resolved", when=base + timedelta(days=30), payload={"outcome": "lost"}),
    ]
    out = reduce_events(events)
    assert out["state"] == "dispute_lost"
    assert out["refunded_amount"] == 100


# ───────────────────────── SIGNATURE VERIFICATION ───────────────────────────

def test_mtn_momo_signature_valid(monkeypatch):
    import hmac, hashlib
    secret = "test_secret_123"
    monkeypatch.setenv("MTN_MOMO_WEBHOOK_SECRET", secret)
    body = b'{"referenceId":"abc","status":"SUCCESSFUL"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_mtn_momo_signature(body, sig) is True


def test_mtn_momo_signature_rejects_tampered_body(monkeypatch):
    import hmac, hashlib
    secret = "test_secret_123"
    monkeypatch.setenv("MTN_MOMO_WEBHOOK_SECRET", secret)
    body = b'{"referenceId":"abc","status":"SUCCESSFUL"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    tampered = b'{"referenceId":"abc","status":"FAILED"}'
    assert verify_mtn_momo_signature(tampered, sig) is False


def test_mtn_momo_signature_rejects_when_secret_missing(monkeypatch):
    monkeypatch.delenv("MTN_MOMO_WEBHOOK_SECRET", raising=False)
    assert verify_mtn_momo_signature(b"anything", "deadbeef") is False


# ───────────────────────── INTEGRATION: APPEND + DEDUP ──────────────────────

@pytest_asyncio.fixture
async def db():
    """Async Mongo client scoped to a throw-away test DB."""
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    test_db_name = f"oryno_test_ledger_{uuid.uuid4().hex[:8]}"
    test_db = client[test_db_name]
    yield test_db
    await client.drop_database(test_db_name)
    client.close()


@pytest.mark.asyncio
async def test_append_dedup_by_provider_event_id(db):
    pid = str(uuid.uuid4())
    evt_id = "evt_test_123"

    await append_event(
        db,
        payment_id=pid,
        event_type="intent_created",
        provider="stripe",
        provider_event_id=evt_id,
        idempotency_key=str(uuid.uuid4()),
        amount=100,
        currency="USD",
        payload={"order_id": "ord-1"},
    )
    # second call with same provider_event_id is a no-op
    await append_event(
        db,
        payment_id=pid,
        event_type="intent_created",
        provider="stripe",
        provider_event_id=evt_id,
        amount=100,
        currency="USD",
    )
    count = await db.payment_events.count_documents({"payment_id": pid})
    assert count == 1


@pytest.mark.asyncio
async def test_idempotency_lookup_finds_intent(db):
    key = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    await append_event(
        db,
        payment_id=pid,
        event_type="intent_created",
        provider="stripe",
        provider_event_id="evt_xyz",
        idempotency_key=key,
        amount=10,
        currency="USD",
    )
    found = await find_intent_by_idempotency(db, key)
    assert found is not None
    assert found["payment_id"] == pid


@pytest.mark.asyncio
async def test_snapshot_rebuilds_from_ledger(db):
    pid = str(uuid.uuid4())
    base = datetime.now(timezone.utc)

    await append_event(
        db,
        payment_id=pid,
        event_type="intent_created",
        provider="stripe",
        provider_event_id=f"evt_{uuid.uuid4().hex}",
        amount=100,
        currency="USD",
        occurred_at=base,
    )
    await append_event(
        db,
        payment_id=pid,
        event_type="captured",
        provider="stripe",
        provider_event_id=f"evt_{uuid.uuid4().hex}",
        amount=100,
        currency="USD",
        occurred_at=base + timedelta(seconds=2),
    )
    await append_event(
        db,
        payment_id=pid,
        event_type="refunded",
        provider="stripe",
        provider_event_id=f"evt_{uuid.uuid4().hex}",
        amount=30,
        currency="USD",
        occurred_at=base + timedelta(hours=1),
    )

    snap = await db.payments.find_one({"_id": pid})
    assert snap is not None
    assert snap["state"] == "partially_refunded"
    assert snap["captured_amount"] == 100
    assert snap["refunded_amount"] == 30
    assert snap["net_amount"] == 70
    assert snap["event_count"] == 3

"""
Payment ledger service — the only module that writes to `payment_events`.

Responsibilities:
  • Append events idempotently (dedup by `provider_event_id` and `idempotency_key`)
  • Rebuild the denormalized `payments` snapshot after every mutation
  • Verify webhook signatures (Stripe via stripe-sdk, MTN MoMo via HMAC)

Why a separate service module?
  - Keeps routes thin and focused on HTTP concerns
  - Lets us unit-test the ledger logic without spinning up FastAPI
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from models.payment_event import reduce_events

logger = logging.getLogger(__name__)


# ── EVENT APPEND ────────────────────────────────────────────────────────────

async def append_event(
    db,
    *,
    payment_id: str,
    event_type: str,
    provider: str,
    provider_event_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    amount: Optional[float] = None,
    currency: Optional[str] = None,
    payload: Optional[dict] = None,
    occurred_at: Optional[datetime] = None,
) -> dict:
    """Append a new event to the ledger and refresh the snapshot.

    Returns the inserted event document. If `provider_event_id` is already in
    the ledger (replay), returns the existing row and skips the write.
    """
    now = datetime.now(timezone.utc)

    # Replay guard — duplicate webhook delivery is the rule, not the exception.
    if provider_event_id:
        existing = await db.payment_events.find_one(
            {"provider": provider, "provider_event_id": provider_event_id}
        )
        if existing:
            logger.info(
                "payment_ledger: skip duplicate %s/%s for payment=%s",
                provider, provider_event_id, payment_id,
            )
            return existing

    event = {
        "_id": str(uuid.uuid4()),
        "payment_id": payment_id,
        "event_type": event_type,
        "provider": provider,
        "provider_event_id": provider_event_id,
        "idempotency_key": idempotency_key,
        "amount": amount,
        "currency": currency,
        "payload": payload or {},
        "occurred_at": occurred_at or now,
        "recorded_at": now,
    }
    await db.payment_events.insert_one(event)
    await refresh_snapshot(db, payment_id)
    return event


# ── IDEMPOTENCY LOOKUP ──────────────────────────────────────────────────────

async def find_intent_by_idempotency(db, idempotency_key: str) -> Optional[dict]:
    """Return the existing intent_created event for this key, if any.

    Used by the `/intent` endpoint to short-circuit duplicate client retries
    without charging the user twice.
    """
    return await db.payment_events.find_one(
        {"event_type": "intent_created", "idempotency_key": idempotency_key}
    )


# ── SNAPSHOT / READ-MODEL ───────────────────────────────────────────────────

async def refresh_snapshot(db, payment_id: str) -> dict:
    """Rebuild the `payments` snapshot row for one payment by replaying events."""
    events = []
    async for ev in db.payment_events.find({"payment_id": payment_id}):
        events.append(ev)

    if not events:
        await db.payments.delete_one({"_id": payment_id})
        return {}

    derived = reduce_events(events)
    first = min(events, key=lambda e: e.get("occurred_at") or datetime.min.replace(tzinfo=timezone.utc))

    snapshot = {
        "_id": payment_id,
        "provider": first.get("provider"),
        "currency": first.get("currency"),
        "intent_amount": first.get("amount"),
        "state": derived["state"],
        "captured_amount": derived["captured_amount"],
        "refunded_amount": derived["refunded_amount"],
        "net_amount": round((derived["captured_amount"] or 0) - (derived["refunded_amount"] or 0), 2),
        "in_dispute": derived["in_dispute"],
        "event_count": derived["event_count"],
        "last_event_at": derived["last_event_at"],
        "order_id": (first.get("payload") or {}).get("order_id"),
        "user_id": (first.get("payload") or {}).get("user_id"),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payments.update_one({"_id": payment_id}, {"$set": snapshot}, upsert=True)
    return snapshot


async def get_timeline(db, payment_id: str) -> list[dict]:
    """Return the full event history for a payment, sorted chronologically."""
    events = []
    async for ev in db.payment_events.find({"payment_id": payment_id}).sort("occurred_at", 1):
        ev["id"] = ev.pop("_id")
        events.append(ev)
    return events


# ── WEBHOOK SIGNATURE VERIFICATION ─────────────────────────────────────────

def verify_mtn_momo_signature(raw_body: bytes, header_signature: Optional[str]) -> bool:
    """Verify an MTN MoMo callback using shared-secret HMAC-SHA256.

    MoMo's standard signature scheme is a hex digest of the raw request body
    keyed by a secret you configure in the operator portal. We expose the
    secret as `MTN_MOMO_WEBHOOK_SECRET` — if it's not set, we refuse the
    request rather than fail-open.
    """
    secret = os.environ.get("MTN_MOMO_WEBHOOK_SECRET", "").strip()
    if not secret or not header_signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    # constant-time compare to avoid timing attacks
    return hmac.compare_digest(expected, header_signature.strip())

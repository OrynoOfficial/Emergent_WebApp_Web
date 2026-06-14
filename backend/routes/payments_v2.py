"""
Payment v2 — immutable ledger-based endpoints.

This replaces the in-place mutation pattern of `routes/payments.py` with an
append-only ledger. The old endpoints remain live (hybrid migration) so
existing clients keep working while new flows opt in.

Endpoints:
  POST /api/v2/payments/intent          — Create intent (requires Idempotency-Key)
  GET  /api/v2/payments/{payment_id}    — Derived current state
  GET  /api/v2/payments/{payment_id}/timeline — Full event history
  POST /api/v2/payments/webhook/stripe          — Stripe webhooks
  POST /api/v2/payments/webhook/mtn-momo        — MTN MoMo callbacks
  POST /api/v2/payments/webhook/orange-money    — Orange Money (stub)
  POST /api/v2/payments/{payment_id}/refund     — Admin refund initiation
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Request, Header
from pydantic import BaseModel, Field

from config.database import get_database
from middleware.auth import get_current_active_user
from services.payment_ledger import (
    append_event,
    find_intent_by_idempotency,
    get_timeline,
    refresh_snapshot,
    verify_mtn_momo_signature,
)
from services.stripe_service import StripeService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/payments", tags=["Payments V2 (Ledger)"])

stripe_service = StripeService()


# ── REQUEST MODELS ──────────────────────────────────────────────────────────

class IntentCreateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = "XAF"
    provider: str   # "stripe" | "mtn_momo" | "orange_money"
    order_id: Optional[str] = None
    customer_phone: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class RefundRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0, description="Partial refund. Omit for full.")
    reason: Optional[str] = None


# ── STRIPE EVENT TYPE MAP ──────────────────────────────────────────────────
# Map Stripe's event names to our internal event types. Unmapped events
# are simply ignored (logged at INFO).
STRIPE_EVENT_MAP = {
    "payment_intent.created": None,                # noise — we already wrote intent_created
    "payment_intent.requires_action": None,
    "payment_intent.processing": None,
    "payment_intent.amount_capturable_updated": "authorized",
    "payment_intent.succeeded": "captured",
    "payment_intent.payment_failed": "failed",
    "payment_intent.canceled": "voided",
    "charge.refunded": "refunded",
    "charge.refund.updated": "refunded",
    "charge.dispute.created": "disputed",
    "charge.dispute.closed": "dispute_resolved",
}


# ── HELPERS ────────────────────────────────────────────────────────────────

def _event_dt(stripe_event: dict) -> datetime:
    """Stripe `created` is a unix timestamp."""
    created = stripe_event.get("created")
    if created:
        return datetime.fromtimestamp(int(created), tz=timezone.utc)
    return datetime.now(timezone.utc)


# ── INTENT ─────────────────────────────────────────────────────────────────

@router.post("/intent", status_code=status.HTTP_201_CREATED)
async def create_payment_intent_v2(
    req: IntentCreateRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    current_user: dict = Depends(get_current_active_user),
):
    """Create a payment intent and write the first ledger entry.

    The client MUST send a stable `Idempotency-Key` header (a UUID generated
    once per payment attempt). If we see the same key again — for example
    because the network dropped the response and the client retried — we
    return the original result instead of charging again.
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    # 1. Idempotency short-circuit
    existing = await find_intent_by_idempotency(db, idempotency_key)
    if existing:
        snapshot = await db.payments.find_one({"_id": existing["payment_id"]})
        return {
            "payment_id": existing["payment_id"],
            "provider_reference": (existing.get("payload") or {}).get("provider_reference"),
            "client_secret": (existing.get("payload") or {}).get("client_secret"),
            "state": (snapshot or {}).get("state", "pending"),
            "idempotent_replay": True,
        }

    payment_id = str(uuid.uuid4())
    provider_reference: Optional[str] = None
    client_secret: Optional[str] = None

    # 2. Call the provider to actually create the upstream intent.
    if req.provider == "stripe":
        result = await stripe_service.create_payment_intent(
            amount=req.amount,
            currency=req.currency,
            metadata={
                "payment_id": payment_id,
                "user_id": user_id,
                "order_id": req.order_id or "",
                "idempotency_key": idempotency_key,
            },
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Stripe error"))
        provider_reference = result.get("payment_intent_id")
        client_secret = result.get("client_secret")

    elif req.provider in ("mtn_momo", "orange_money"):
        # Mobile money flows: we don't pre-call the provider here; the client
        # collects the phone number and our webhook receives the result. We
        # still write the intent so we have a row to correlate against when
        # the callback arrives.
        provider_reference = f"momo-{payment_id}"

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {req.provider}")

    # 3. Append the intent_created event (the BEFORE-call write is implicit:
    #    if the provider call above failed, we never get here — no orphan row).
    await append_event(
        db,
        payment_id=payment_id,
        event_type="intent_created",
        provider=req.provider,
        provider_event_id=provider_reference,
        idempotency_key=idempotency_key,
        amount=req.amount,
        currency=req.currency,
        payload={
            "user_id": user_id,
            "order_id": req.order_id,
            "provider_reference": provider_reference,
            "client_secret": client_secret,
            "customer_phone": req.customer_phone,
            "metadata": req.metadata,
        },
        occurred_at=datetime.now(timezone.utc),
    )

    return {
        "payment_id": payment_id,
        "provider_reference": provider_reference,
        "client_secret": client_secret,
        "state": "pending",
        "idempotent_replay": False,
    }


# ── READ ───────────────────────────────────────────────────────────────────

@router.get("/{payment_id}")
async def get_payment_state(
    payment_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Return the derived current state of a payment.

    The snapshot is updated automatically on every append. If you suspect it
    has drifted, call `POST /{payment_id}/recompute` (admin only).
    """
    db = get_database()
    snap = await db.payments.find_one({"_id": payment_id})
    if not snap:
        raise HTTPException(status_code=404, detail="Payment not found")
    snap["id"] = snap.pop("_id")
    return snap


@router.get("/{payment_id}/timeline")
async def get_payment_timeline(
    payment_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Return the full immutable event history for a payment."""
    db = get_database()
    events = await get_timeline(db, payment_id)
    if not events:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"payment_id": payment_id, "events": events}


@router.post("/{payment_id}/recompute")
async def recompute_payment(
    payment_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Force a snapshot rebuild from the ledger. Super-admin only."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super-admin only")
    db = get_database()
    snapshot = await refresh_snapshot(db, payment_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="No events for that payment")
    return snapshot


# ── WEBHOOKS ───────────────────────────────────────────────────────────────

@router.post("/webhook/stripe")
async def webhook_stripe(request: Request):
    """Stripe webhook → append to ledger.

    Replay protection comes from the unique index on
    (provider='stripe', provider_event_id=<evt_xxx>). Stripe retries the
    same event id up to 3 days — we'll just no-op after the first write.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    event = stripe_service.verify_webhook_signature(payload, sig_header)
    if not event:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    et_internal = STRIPE_EVENT_MAP.get(event["type"])
    if not et_internal:
        logger.info("stripe webhook: ignoring %s", event["type"])
        return {"status": "ignored"}

    obj = event["data"]["object"]
    metadata = obj.get("metadata", {}) or {}
    payment_id = metadata.get("payment_id")

    # `charge.*` events carry the payment_intent id, not metadata. Fall back
    # to lookup-by-provider_reference if metadata is missing.
    if not payment_id:
        pi_id = obj.get("payment_intent")
        if pi_id:
            db = get_database()
            intent_event = await db.payment_events.find_one(
                {"provider": "stripe", "provider_event_id": pi_id, "event_type": "intent_created"}
            )
            if intent_event:
                payment_id = intent_event["payment_id"]

    if not payment_id:
        logger.warning("stripe webhook: cannot resolve payment_id for %s", event["type"])
        return {"status": "unresolved"}

    db = get_database()
    amount = None
    if obj.get("amount_received") is not None:
        amount = obj["amount_received"] / 100
    elif obj.get("amount_refunded") is not None:
        amount = obj["amount_refunded"] / 100
    elif obj.get("amount") is not None:
        amount = obj["amount"] / 100

    extra_payload = {"raw_type": event["type"]}
    if event["type"] == "charge.dispute.closed":
        extra_payload["outcome"] = "won" if obj.get("status") == "won" else "lost"

    await append_event(
        db,
        payment_id=payment_id,
        event_type=et_internal,
        provider="stripe",
        provider_event_id=event["id"],
        amount=amount,
        currency=(obj.get("currency") or "").upper() or None,
        payload=extra_payload,
        occurred_at=_event_dt(event),
    )
    return {"status": "ok"}


@router.post("/webhook/mtn-momo")
async def webhook_mtn_momo(request: Request):
    """MTN MoMo callback → append to ledger.

    Signature is HMAC-SHA256 of the raw body with `MTN_MOMO_WEBHOOK_SECRET`.
    """
    raw = await request.body()
    sig = request.headers.get("x-signature")
    if not verify_mtn_momo_signature(raw, sig):
        raise HTTPException(status_code=401, detail="Invalid MTN MoMo signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    reference_id = data.get("referenceId") or data.get("externalId")
    momo_status = (data.get("status") or "").upper()
    if not reference_id:
        return {"status": "ignored", "reason": "missing referenceId"}

    db = get_database()
    intent = await db.payment_events.find_one({
        "provider": "mtn_momo",
        "provider_event_id": reference_id,
        "event_type": "intent_created",
    })
    if not intent:
        logger.warning("mtn-momo webhook: no intent for reference=%s", reference_id)
        return {"status": "unresolved"}

    # MoMo doesn't provide a stable event id — use referenceId + status as a
    # composite. Same status arriving twice is a true replay and we dedupe.
    event_id_synthetic = f"{reference_id}:{momo_status}"

    et_map = {
        "SUCCESSFUL": "captured",
        "FAILED": "failed",
        "REJECTED": "failed",
        "TIMEOUT": "failed",
        "CANCELLED": "voided",
        "REFUNDED": "refunded",
    }
    et = et_map.get(momo_status)
    if not et:
        return {"status": "ignored", "reason": f"unmapped status {momo_status}"}

    await append_event(
        db,
        payment_id=intent["payment_id"],
        event_type=et,
        provider="mtn_momo",
        provider_event_id=event_id_synthetic,
        amount=data.get("amount"),
        currency=data.get("currency"),
        payload={"raw": data, "status": momo_status},
        occurred_at=datetime.now(timezone.utc),
    )
    return {"status": "ok"}


@router.post("/webhook/orange-money")
async def webhook_orange_money(request: Request):
    """Orange Money webhook — stubbed.

    TODO: integrate Orange Money API once credentials and signing scheme are
    confirmed. The skeleton mirrors the MTN MoMo handler — only the
    signature-verification function and status-code map differ.
    """
    raise HTTPException(status_code=501, detail="Orange Money webhook not yet implemented")


# ── REFUND ─────────────────────────────────────────────────────────────────

@router.post("/{payment_id}/refund")
async def initiate_refund(
    payment_id: str,
    req: RefundRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Admin-initiated refund.

    We call the provider's refund API. The provider then sends a webhook
    which appends the `refunded` event to the ledger and updates the
    snapshot. Until the webhook arrives, the snapshot still shows the
    pre-refund state — that's intentional (only confirmed money movement
    is reflected).
    """
    if current_user.get("role") not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    db = get_database()
    snap = await db.payments.find_one({"_id": payment_id})
    if not snap:
        raise HTTPException(status_code=404, detail="Payment not found")

    if snap["state"] not in ("captured", "partially_refunded"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot refund a payment in state '{snap['state']}'",
        )

    # Find the intent to grab the provider reference (Stripe PI id, MoMo ref).
    intent = await db.payment_events.find_one(
        {"payment_id": payment_id, "event_type": "intent_created"}
    )
    if not intent:
        raise HTTPException(status_code=500, detail="Intent row missing — ledger corrupted")

    provider = intent["provider"]
    if provider == "stripe":
        pi_id = intent.get("provider_event_id")
        result = await stripe_service.create_refund(pi_id, amount=req.amount)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        return {"status": "submitted", "provider": "stripe", "refund_id": result.get("refund_id")}

    # Mobile money refunds are out of scope for this iteration — operator
    # must reverse manually and then call POST /api/v2/payments/{id}/recompute.
    raise HTTPException(
        status_code=501,
        detail=f"Refund automation not implemented for provider '{provider}' — process manually and recompute",
    )

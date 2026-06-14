"""
Immutable payment ledger — model definitions and state machine.

Every state change in a payment's lifecycle (intent → authorize → capture →
refund → dispute) is appended as a NEW row in `payment_events`. Rows are never
mutated. The "current state" of a payment is derived by replaying its events
in chronological order through `reduce_events()`.

A separate `payments` collection acts as a denormalized read-model so list
queries don't have to reduce events every time. The read-model is rebuildable
from the ledger at any moment.

Why this matters:
  - Full audit trail for finance / regulators
  - Out-of-order webhook delivery is safe (events are sorted before reducing)
  - Replay protection via `provider_event_id` unique index
  - Idempotency via `idempotency_key` unique index on intent_created
"""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, Literal, Any
from datetime import datetime, timezone

# All event types our ledger understands. Adding a new one only requires
# extending this Literal and `reduce_events()` below.
EventType = Literal[
    "intent_created",
    "authorized",
    "captured",
    "failed",
    "voided",
    "refunded",
    "disputed",
    "dispute_resolved",
]

Provider = Literal["stripe", "mtn_momo", "orange_money"]

# Terminal states are those from which no further mutation is expected.
# `disputed` is NOT terminal (waiting for resolution).
TERMINAL_STATES = {"refunded", "failed", "voided", "dispute_lost"}


class PaymentEvent(BaseModel):
    """One immutable row in the ledger."""
    id: str = Field(..., alias="_id")
    payment_id: str                     # correlation key — groups all events
    event_type: EventType
    provider: Provider
    provider_event_id: Optional[str] = None   # e.g. evt_xxx (Stripe) or MoMo UUID
    idempotency_key: Optional[str] = None     # client-supplied on intent_created
    amount: Optional[float] = None
    currency: Optional[str] = None
    payload: dict = Field(default_factory=dict)   # raw provider data
    occurred_at: datetime               # when the event happened (provider-side)
    recorded_at: datetime               # when we wrote it to the ledger

    class Config:
        populate_by_name = True


def reduce_events(events: list[dict]) -> dict:
    """Replay events in chronological order to compute current payment state.

    Returns:
        {
          "state": str,                    # current derived state
          "captured_amount": float,
          "refunded_amount": float,
          "in_dispute": bool,
          "last_event_at": datetime|None,
          "event_count": int,
        }
    """
    sorted_events = sorted(events, key=lambda e: e.get("occurred_at") or datetime.min.replace(tzinfo=timezone.utc))

    state = "pending"
    captured_amount = 0.0
    refunded_amount = 0.0
    in_dispute = False
    last_event_at = None

    for ev in sorted_events:
        et = ev.get("event_type")
        amt = float(ev.get("amount") or 0)
        last_event_at = ev.get("occurred_at")

        if et == "intent_created":
            # intent is the starting point — state remains "pending"
            continue

        if et == "authorized":
            if state == "pending":
                state = "authorized"

        elif et == "captured":
            captured_amount += amt
            if state in ("pending", "authorized"):
                state = "captured"

        elif et == "failed":
            if state in ("pending", "authorized"):
                state = "failed"

        elif et == "voided":
            if state in ("pending", "authorized"):
                state = "voided"

        elif et == "refunded":
            refunded_amount += amt
            # Promote captured → partially_refunded → refunded based on amount.
            # Refund-without-capture (rare provider edge case) still tracked.
            if captured_amount > 0:
                if refunded_amount + 1e-6 >= captured_amount:
                    state = "refunded"
                else:
                    state = "partially_refunded"

        elif et == "disputed":
            in_dispute = True
            state = "disputed"

        elif et == "dispute_resolved":
            in_dispute = False
            outcome = (ev.get("payload") or {}).get("outcome")
            if outcome == "won":
                # Revert to whatever post-capture state we were in.
                if refunded_amount > 0:
                    state = "refunded" if refunded_amount + 1e-6 >= captured_amount else "partially_refunded"
                else:
                    state = "captured"
            else:
                # lost / unknown — treat as effectively refunded to merchant
                state = "dispute_lost"
                refunded_amount = captured_amount

    return {
        "state": state,
        "captured_amount": round(captured_amount, 2),
        "refunded_amount": round(refunded_amount, 2),
        "in_dispute": in_dispute,
        "last_event_at": last_event_at,
        "event_count": len(sorted_events),
    }

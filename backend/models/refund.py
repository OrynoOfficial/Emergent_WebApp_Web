"""
Refund model + eligibility calculator.

Refund eligibility is policy-driven and per service-type:
  • event     — 100% ≥7 days, 50% 24h-7d, 0% <24h before showtime.
                If operator-cancelled → 100% regardless.
  • cinema    — 100% ≥2h before showtime, 0% after.
  • hotel     — operator-configured `cancellation_policy` (TODO: wire when needed).
  • Other     — manual review by admin (no auto-grant).

Refunds are NEVER auto-issued — they go through admin approval. The eligibility
calculation only sets the *expected* amount the customer can request; the admin
can still grant more (e.g. operator goodwill) or reject.
"""
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RefundStatus(str, Enum):
    PENDING = "pending"          # awaiting admin action
    APPROVED = "approved"        # admin OK'd but gateway not yet acked
    COMPLETED = "completed"      # money returned + stock restored
    REJECTED = "rejected"
    FAILED = "failed"            # gateway returned an error
    CANCELLED = "cancelled"      # customer withdrew


class RefundReason(str, Enum):
    CHANGE_OF_PLANS = "change_of_plans"
    EVENT_CANCELLED = "event_cancelled"
    SERVICE_ISSUE = "service_issue"
    DUPLICATE_BOOKING = "duplicate_booking"
    OTHER = "other"


class RefundCreate(BaseModel):
    reason: RefundReason
    customer_notes: Optional[str] = None
    # Customer can request LESS than the eligible amount; admin can grant more.
    requested_amount: Optional[float] = None


class RefundDecision(BaseModel):
    approved_amount: Optional[float] = None   # required when approving
    admin_notes: Optional[str] = None


# ── Eligibility ─────────────────────────────────────────────────────────────
class EligibilityResult(BaseModel):
    eligible: bool
    eligible_amount: float
    window: str                     # human-readable explanation
    refundable_pct: int             # 0–100
    operator_initiated: bool = False


def _parse_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def compute_eligibility(order: dict, *, operator_cancelled: bool = False) -> EligibilityResult:
    """Pure function — no DB, easy to unit-test."""
    total = float(order.get("total_amount") or 0)
    service_type = (order.get("service_type") or order.get("service_category") or "").lower()
    booking = order.get("booking_details") or {}

    # An operator-initiated cancellation always entitles the customer to 100%.
    if operator_cancelled:
        return EligibilityResult(
            eligible=True, eligible_amount=total,
            window="Operator-cancelled service — full refund mandatory",
            refundable_pct=100, operator_initiated=True,
        )

    if service_type in ("event", "events"):
        starts_at = _parse_iso(booking.get("start_datetime") or booking.get("event_date") or order.get("service_date"))
        if not starts_at:
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="No event date — admin review", refundable_pct=100)
        delta = starts_at - datetime.now(timezone.utc)
        if delta >= timedelta(days=7):
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="More than 7 days before event — full refund",
                                     refundable_pct=100)
        if delta >= timedelta(hours=24):
            return EligibilityResult(eligible=True, eligible_amount=round(total * 0.5, 2),
                                     window="Between 24h and 7 days — 50% refund",
                                     refundable_pct=50)
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Less than 24h before event — non-refundable",
                                 refundable_pct=0)

    if service_type == "cinema":
        starts_at = _parse_iso(booking.get("show_datetime") or booking.get("show_date") or order.get("service_date"))
        if not starts_at:
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="No showtime — admin review", refundable_pct=100)
        delta = starts_at - datetime.now(timezone.utc)
        if delta >= timedelta(hours=2):
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="More than 2h before showtime — full refund",
                                     refundable_pct=100)
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Less than 2h before showtime — non-refundable",
                                 refundable_pct=0)

    # Default — manual review.
    return EligibilityResult(eligible=True, eligible_amount=total,
                             window="Admin review required", refundable_pct=100)

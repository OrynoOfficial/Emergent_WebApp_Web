"""
Refund model + eligibility calculator.

Refund eligibility is policy-driven and per service-type:
  • event     — 100% ≥7 days, 50% 24h-7d, 0% <24h before showtime.
                If operator-cancelled → 100% regardless.
  • cinema    — 100% ≥2h before showtime, 0% after.
  • travel    — 100% ≥48h, 50% 24h-48h, 0% <24h before departure.
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
class PolicyTier(BaseModel):
    """A single threshold in the refund policy schedule."""
    threshold: str                  # e.g. "≥ 7 days before event"
    refund_pct: int                 # 0-100
    active: bool = False            # which tier currently applies


class EligibilityResult(BaseModel):
    eligible: bool
    eligible_amount: float
    window: str                     # human-readable explanation
    refundable_pct: int             # 0–100
    operator_initiated: bool = False
    # Rich-modal fields (all optional for back-compat with old tests/UIs).
    service_type: Optional[str] = None
    total_paid: Optional[float] = None
    hours_until_service: Optional[float] = None
    service_date: Optional[str] = None        # ISO string for client formatting
    policy: list[PolicyTier] = Field(default_factory=list)


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


def _policy_for_event(active_pct: int) -> list[PolicyTier]:
    return [
        PolicyTier(threshold="≥ 7 days before event", refund_pct=100, active=active_pct == 100),
        PolicyTier(threshold="24h – 7 days before event", refund_pct=50, active=active_pct == 50),
        PolicyTier(threshold="< 24h before event", refund_pct=0, active=active_pct == 0),
    ]


def _policy_for_cinema(active_pct: int) -> list[PolicyTier]:
    return [
        PolicyTier(threshold="≥ 2 hours before showtime", refund_pct=100, active=active_pct == 100),
        PolicyTier(threshold="< 2 hours before showtime", refund_pct=0, active=active_pct == 0),
    ]


def _policy_for_travel(active_pct: int) -> list[PolicyTier]:
    return [
        PolicyTier(threshold="≥ 48 hours before departure", refund_pct=100, active=active_pct == 100),
        PolicyTier(threshold="24h – 48h before departure", refund_pct=50, active=active_pct == 50),
        PolicyTier(threshold="< 24h before departure", refund_pct=0, active=active_pct == 0),
    ]


def _policy_default() -> list[PolicyTier]:
    return [
        PolicyTier(threshold="Subject to operator/admin review", refund_pct=100, active=True),
    ]


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
            service_type=service_type, total_paid=total,
            policy=[PolicyTier(threshold="Operator-cancelled", refund_pct=100, active=True)],
        )

    if service_type in ("event", "events"):
        starts_at = _parse_iso(booking.get("start_datetime") or booking.get("event_date") or order.get("service_date"))
        if not starts_at:
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="No event date — admin review", refundable_pct=100,
                                     service_type=service_type, total_paid=total,
                                     policy=_policy_for_event(100))
        delta = starts_at - datetime.now(timezone.utc)
        hrs = delta.total_seconds() / 3600
        if delta >= timedelta(days=7):
            pct = 100
            window = "More than 7 days before event — full refund"
        elif delta >= timedelta(hours=24):
            pct = 50
            window = "Between 24h and 7 days — 50% refund"
        else:
            pct = 0
            window = "Less than 24h before event — non-refundable"
        return EligibilityResult(
            eligible=pct > 0, eligible_amount=round(total * pct / 100, 2),
            window=window, refundable_pct=pct,
            service_type=service_type, total_paid=total,
            hours_until_service=round(hrs, 1), service_date=starts_at.isoformat(),
            policy=_policy_for_event(pct),
        )

    if service_type == "cinema":
        starts_at = _parse_iso(booking.get("show_datetime") or booking.get("show_date") or order.get("service_date"))
        if not starts_at:
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="No showtime — admin review", refundable_pct=100,
                                     service_type=service_type, total_paid=total,
                                     policy=_policy_for_cinema(100))
        delta = starts_at - datetime.now(timezone.utc)
        hrs = delta.total_seconds() / 3600
        if delta >= timedelta(hours=2):
            pct = 100
            window = "More than 2h before showtime — full refund"
        else:
            pct = 0
            window = "Less than 2h before showtime — non-refundable"
        return EligibilityResult(
            eligible=pct > 0, eligible_amount=round(total * pct / 100, 2),
            window=window, refundable_pct=pct,
            service_type=service_type, total_paid=total,
            hours_until_service=round(hrs, 1), service_date=starts_at.isoformat(),
            policy=_policy_for_cinema(pct),
        )

    if service_type in ("travel", "transport"):
        starts_at = _parse_iso(
            booking.get("departure_datetime") or booking.get("departure_date")
            or booking.get("travel_date") or order.get("service_date")
        )
        if not starts_at:
            return EligibilityResult(eligible=True, eligible_amount=total,
                                     window="No departure time — admin review", refundable_pct=100,
                                     service_type=service_type, total_paid=total,
                                     policy=_policy_for_travel(100))
        delta = starts_at - datetime.now(timezone.utc)
        hrs = delta.total_seconds() / 3600
        if delta >= timedelta(hours=48):
            pct = 100
            window = "More than 48h before departure — full refund"
        elif delta >= timedelta(hours=24):
            pct = 50
            window = "Between 24h and 48h — 50% refund"
        else:
            pct = 0
            window = "Less than 24h before departure — non-refundable"
        return EligibilityResult(
            eligible=pct > 0, eligible_amount=round(total * pct / 100, 2),
            window=window, refundable_pct=pct,
            service_type=service_type, total_paid=total,
            hours_until_service=round(hrs, 1), service_date=starts_at.isoformat(),
            policy=_policy_for_travel(pct),
        )

    # Default — manual review.
    return EligibilityResult(
        eligible=True, eligible_amount=total,
        window="Admin review required", refundable_pct=100,
        service_type=service_type, total_paid=total,
        policy=_policy_default(),
    )

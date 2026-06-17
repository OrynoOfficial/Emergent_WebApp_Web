"""
Refund model + eligibility calculator.

Refund eligibility is policy-driven and per service-type:
  • event       — 100% ≥7d  · 50% 24h-7d   · 0% <24h before showtime.
  • cinema      — 100% ≥2h  ·               · 0% <2h  before showtime.
  • travel      — 100% ≥48h · 50% 24h-48h   · 0% <24h before departure.
  • hotel       — 100% ≥7d  · 50% 24h-7d    · 0% <24h before check-in.
  • restaurant  — 100% ≥24h · 50% 6h-24h    · 0% <6h  before reservation.
  • car_rental  — 100% ≥48h · 50% 24h-48h   · 0% <24h before pick-up.
  • banquet     — 100% ≥14d · 50% 7-14d     · 0% <7d  before event.
  • laundry     — 100% pre-pickup · 50% in-progress · 0% post-delivery.
  • package     — bundles multiple services → admin reviews per sub-item.
  • Operator-cancelled → 100% regardless of timing.

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
    # Where the active schedule came from — "platform", "operator", or "listing".
    # Drives the "Custom operator policy" badge on the refund modal.
    policy_source: str = "platform"


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


def _combine_date_time(date_value, time_value, *, default_hour: int = 12):
    """Combine a YYYY-MM-DD date with an HH:MM time into a tz-aware datetime.

    Booking flows historically split the service moment across two fields
    (e.g. cinema's `show_date` + `show_time`, restaurant's `date` + `time`).
    This helper produces the precise datetime so the refund window can be
    computed to the minute rather than rounding to start-of-day.
    """
    if not date_value:
        return None
    # If the date_value already encodes a time → use it as-is.
    parsed = _parse_iso(date_value)
    if parsed and parsed.hour + parsed.minute + parsed.second > 0:
        return parsed

    # Parse time portion separately.
    hour, minute = default_hour, 0
    if time_value:
        try:
            parts = str(time_value).strip().split(":")
            hour = int(parts[0])
            if len(parts) > 1:
                minute = int(parts[1])
        except (TypeError, ValueError):
            pass

    base = parsed or _parse_iso(f"{date_value}T00:00:00")
    if not base:
        return None
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


# ── Preset packs ────────────────────────────────────────────────────────────
# Operators (and individual listings) can pick one of these named presets
# instead of authoring custom tiers. Each preset is a list of
# (timedelta_threshold, refund_pct, window_message, tier_label).
#
# Adding a new preset is a single dict entry. The platform default for each
# service is the "standard" preset.

PRESET_DEFINITIONS = {
    # Service              ┌─ Strict                                                                    Standard                                                                Flexible
    "event": {
        "strict":   [(timedelta(days=30), 100, "More than 30 days before event — full refund", "≥ 30 days before event"),
                     (timedelta(days=7),  50,  "Between 7 and 30 days — 50% refund", "7 – 30 days before event"),
                     (timedelta(0),       0,  "Less than 7 days before event — non-refundable", "< 7 days before event")],
        "standard": [(timedelta(days=7),  100, "More than 7 days before event — full refund", "≥ 7 days before event"),
                     (timedelta(hours=24), 50, "Between 24h and 7 days — 50% refund", "24h – 7 days before event"),
                     (timedelta(0),       0,  "Less than 24h before event — non-refundable", "< 24h before event")],
        "flexible": [(timedelta(hours=2), 100, "More than 2h before event — full refund", "≥ 2h before event"),
                     (timedelta(0),       0,  "Less than 2h before event — non-refundable", "< 2h before event")],
    },
    "cinema": {
        "strict":   [(timedelta(hours=24), 100, "More than 24h before showtime — full refund", "≥ 24h before showtime"),
                     (timedelta(0),       0,  "Less than 24h before showtime — non-refundable", "< 24h before showtime")],
        "standard": [(timedelta(hours=2),  100, "More than 2h before showtime — full refund", "≥ 2 hours before showtime"),
                     (timedelta(0),       0,  "Less than 2h before showtime — non-refundable", "< 2 hours before showtime")],
        "flexible": [(timedelta(minutes=30), 100, "More than 30 min before showtime — full refund", "≥ 30 min before showtime"),
                     (timedelta(0),       0,  "Less than 30 min before showtime — non-refundable", "< 30 min before showtime")],
    },
    "travel": {
        "strict":   [(timedelta(days=7),  100, "More than 7 days before departure — full refund", "≥ 7 days before departure"),
                     (timedelta(hours=48), 50, "Between 48h and 7 days — 50% refund", "48h – 7 days before departure"),
                     (timedelta(0),       0,  "Less than 48h before departure — non-refundable", "< 48h before departure")],
        "standard": [(timedelta(hours=48), 100, "More than 48h before departure — full refund", "≥ 48 hours before departure"),
                     (timedelta(hours=24), 50, "Between 24h and 48h — 50% refund", "24h – 48h before departure"),
                     (timedelta(0),       0,  "Less than 24h before departure — non-refundable", "< 24h before departure")],
        "flexible": [(timedelta(hours=2), 100, "More than 2h before departure — full refund", "≥ 2h before departure"),
                     (timedelta(0),       0,  "Less than 2h before departure — non-refundable", "< 2h before departure")],
    },
    "hotel": {
        "strict":   [(timedelta(days=30), 100, "More than 30 days before check-in — full refund", "≥ 30 days before check-in"),
                     (timedelta(days=7),  50, "Between 7 and 30 days — 50% refund", "7 – 30 days before check-in"),
                     (timedelta(0),       0,  "Less than 7 days before check-in — non-refundable", "< 7 days before check-in")],
        "standard": [(timedelta(days=7),  100, "More than 7 days before check-in — full refund", "≥ 7 days before check-in"),
                     (timedelta(hours=24), 50, "Between 24h and 7 days — 50% refund", "24h – 7 days before check-in"),
                     (timedelta(0),       0,  "Less than 24h before check-in — non-refundable", "< 24h before check-in")],
        "flexible": [(timedelta(hours=24), 100, "More than 24h before check-in — full refund", "≥ 24h before check-in"),
                     (timedelta(hours=6),  50, "Between 6h and 24h — 50% refund", "6h – 24h before check-in"),
                     (timedelta(0),       0,  "Less than 6h before check-in — non-refundable", "< 6h before check-in")],
    },
    "restaurant": {
        "strict":   [(timedelta(hours=48), 100, "More than 48h before reservation — full refund", "≥ 48h before reservation"),
                     (timedelta(hours=24), 50, "Between 24h and 48h — 50% refund", "24h – 48h before reservation"),
                     (timedelta(0),       0,  "Less than 24h before reservation — non-refundable", "< 24h before reservation")],
        "standard": [(timedelta(hours=24), 100, "More than 24h before reservation — full refund", "≥ 24 hours before reservation"),
                     (timedelta(hours=6),  50, "Between 6h and 24h — 50% refund", "6h – 24h before reservation"),
                     (timedelta(0),       0,  "Less than 6h before reservation — non-refundable", "< 6h before reservation")],
        "flexible": [(timedelta(hours=2),  100, "More than 2h before reservation — full refund", "≥ 2h before reservation"),
                     (timedelta(0),       0,  "Less than 2h before reservation — non-refundable", "< 2h before reservation")],
    },
    "car_rental": {
        "strict":   [(timedelta(days=7),  100, "More than 7 days before pick-up — full refund", "≥ 7 days before pick-up"),
                     (timedelta(hours=48), 50, "Between 48h and 7 days — 50% refund", "48h – 7 days before pick-up"),
                     (timedelta(0),       0,  "Less than 48h before pick-up — non-refundable", "< 48h before pick-up")],
        "standard": [(timedelta(hours=48), 100, "More than 48h before pick-up — full refund", "≥ 48 hours before pick-up"),
                     (timedelta(hours=24), 50, "Between 24h and 48h — 50% refund", "24h – 48h before pick-up"),
                     (timedelta(0),       0,  "Less than 24h before pick-up — non-refundable", "< 24h before pick-up")],
        "flexible": [(timedelta(hours=6), 100, "More than 6h before pick-up — full refund", "≥ 6h before pick-up"),
                     (timedelta(hours=1), 50, "Between 1h and 6h — 50% refund", "1h – 6h before pick-up"),
                     (timedelta(0),       0,  "Less than 1h before pick-up — non-refundable", "< 1h before pick-up")],
    },
    "banquet": {
        "strict":   [(timedelta(days=30), 100, "More than 30 days before event — full refund", "≥ 30 days before event"),
                     (timedelta(days=14), 50, "Between 14 and 30 days — 50% refund", "14 – 30 days before event"),
                     (timedelta(0),       0,  "Less than 14 days before event — non-refundable", "< 14 days before event")],
        "standard": [(timedelta(days=14), 100, "More than 14 days before event — full refund", "≥ 14 days before event"),
                     (timedelta(days=7),  50, "Between 7 and 14 days — 50% refund", "7 – 14 days before event"),
                     (timedelta(0),       0,  "Less than 7 days before event — non-refundable", "< 7 days before event")],
        "flexible": [(timedelta(days=7),  100, "More than 7 days before event — full refund", "≥ 7 days before event"),
                     (timedelta(days=3),  50, "Between 3 and 7 days — 50% refund", "3 – 7 days before event"),
                     (timedelta(0),       0,  "Less than 3 days before event — non-refundable", "< 3 days before event")],
    },
    "laundry": {
        "strict":   [(timedelta(hours=2),  100, "Before pick-up scheduled — full refund", "Before pick-up scheduled"),
                     (timedelta(0),        0, "Pick-up started — non-refundable", "Pick-up started or later")],
        "standard": [(timedelta(hours=2),  100, "Before pick-up scheduled — full refund", "Before pick-up scheduled"),
                     (timedelta(0),       50, "Pick-up in progress — 50% refund", "Pick-up done, before delivery"),
                     (timedelta(days=-365), 0, "Order delivered — non-refundable", "After delivery")],
        "flexible": [(timedelta(hours=2),  100, "Before pick-up scheduled — full refund", "Before pick-up scheduled"),
                     (timedelta(0),       75, "Pick-up in progress — 75% refund", "Pick-up done, before delivery"),
                     (timedelta(days=-365), 25, "Order delivered — 25% refund", "After delivery")],
    },
}

PRESET_LABELS = {"strict": "Strict", "standard": "Standard", "flexible": "Flexible"}

# Service-type aliases — laundry and pressing share a schedule; travel/transport too.
_SERVICE_ALIASES = {"events": "event", "pressing": "laundry", "transport": "travel", "rental": "car_rental"}


def _canonical_service(service_type: str) -> str:
    s = (service_type or "").lower()
    return _SERVICE_ALIASES.get(s, s)


def get_preset(service_type: str, preset: str = "standard"):
    """Return the raw tier list for `(service_type, preset)`.

    Returns the platform default ("standard") if the preset name is unknown.
    """
    svc = _canonical_service(service_type)
    presets = PRESET_DEFINITIONS.get(svc, {})
    return presets.get(preset) or presets.get("standard") or []


def list_presets_for(service_type: str) -> dict:
    """For settings UI — return all available presets for a service."""
    svc = _canonical_service(service_type)
    out = {}
    for preset_key, tiers in PRESET_DEFINITIONS.get(svc, {}).items():
        out[preset_key] = {
            "label": PRESET_LABELS.get(preset_key, preset_key.title()),
            "tiers": [
                {"threshold_hours": int(td.total_seconds() // 3600), "refund_pct": pct, "label": tier_label}
                for td, pct, _msg, tier_label in tiers
            ],
        }
    return out


def _tiers_from_custom(custom_tiers: list[dict]) -> list:
    """Validate + convert operator-authored custom tiers into the internal
    timedelta-based tuple format used by `compute_eligibility`.

    Expected input shape per row: {threshold_hours: int, refund_pct: int, label: str}
    """
    out = []
    for row in custom_tiers or []:
        try:
            hrs = int(row.get("threshold_hours") or 0)
            pct = max(0, min(100, int(row.get("refund_pct") or 0)))
            lbl = (row.get("label") or f"≥ {hrs}h before service").strip()
        except (TypeError, ValueError):
            continue
        td = timedelta(hours=hrs)
        msg = f"{lbl} — {pct}% refund" if pct > 0 else f"{lbl} — non-refundable"
        out.append((td, pct, msg, lbl))
    return out


def _resolve_tiers(service_type: str, listing_policy: Optional[dict],
                    operator_policy: Optional[dict]) -> tuple[list, str]:
    """Resolve which tier schedule to use for this order.

    Precedence (highest wins):
      1. Listing-level policy        (service.cancellation_policy)
      2. Operator-level policy       (operator.cancellation_policies[service])
      3. Platform default ("standard" preset for the service type)

    Returns (tiers, source_label) where source_label is one of
    "listing", "operator", or "platform" — useful for the UI badge.
    """
    for policy, source in [(listing_policy, "listing"), (operator_policy, "operator")]:
        if not policy:
            continue
        preset = policy.get("preset")
        custom = policy.get("custom_tiers")
        if preset == "custom" and custom:
            tiers = _tiers_from_custom(custom)
            if tiers:
                return tiers, source
        elif preset:
            tiers = get_preset(service_type, preset)
            if tiers:
                return tiers, source
    return get_preset(service_type, "standard"), "platform"


def tiers_to_policy_list(tiers: list, active_pct: int) -> list[PolicyTier]:
    """Convert internal tier tuples to the PolicyTier UI list."""
    # Determine which tier is currently active — earliest tier whose pct matches.
    seen_active = False
    out = []
    for _td, pct, _msg, label in tiers:
        is_active = (pct == active_pct) and not seen_active
        if is_active:
            seen_active = True
        out.append(PolicyTier(threshold=label, refund_pct=pct, active=is_active))
    return out


def _policy_default() -> list[PolicyTier]:
    return [
        PolicyTier(threshold="Subject to operator/admin review", refund_pct=100, active=True),
    ]


# Each service maps to:
#   • policy_fn      — schedule generator
#   • window_labels  — (full_msg, partial_msg, none_msg) human-readable
#   • tiers          — list of (timedelta_threshold, refund_pct) descending
#   • date_finder    — callable(order, booking) -> datetime | None
def _find_event_date(order, bd):
    return _combine_date_time(
        bd.get("start_datetime") or bd.get("event_date") or order.get("service_date"),
        bd.get("event_time") or bd.get("start_time"),
    )


def _find_cinema_date(order, bd):
    return _combine_date_time(
        bd.get("show_datetime") or bd.get("show_date") or order.get("service_date"),
        bd.get("show_time"),
        default_hour=20,
    )


def _find_travel_date(order, bd):
    return _combine_date_time(
        bd.get("departure_datetime") or bd.get("departure_date")
        or bd.get("travel_date") or order.get("service_date"),
        bd.get("departure_time") or bd.get("travel_time"),
        default_hour=8,
    )


def _find_hotel_date(order, bd):
    return _combine_date_time(
        bd.get("check_in") or bd.get("check_in_date") or order.get("service_date"),
        bd.get("check_in_time"),
        default_hour=14,
    )


def _find_restaurant_date(order, bd):
    return _combine_date_time(
        bd.get("reservation_datetime") or bd.get("date") or order.get("service_date"),
        bd.get("time") or bd.get("reservation_time"),
        default_hour=19,
    )


def _find_car_rental_date(order, bd):
    return _combine_date_time(
        bd.get("pickup_datetime") or bd.get("pickup_date") or order.get("service_date"),
        bd.get("pickup_time"),
        default_hour=10,
    )


def _find_banquet_date(order, bd):
    return _combine_date_time(
        bd.get("event_datetime") or bd.get("event_date") or order.get("service_date"),
        bd.get("event_time"),
        default_hour=17,
    )


def _find_laundry_date(order, bd):
    return _combine_date_time(
        bd.get("pickup_datetime") or bd.get("pickup_date") or order.get("service_date"),
        bd.get("pickup_time"),
        default_hour=9,
    )


# Service → (date_finder, anchor_label) — schedules now come from the
# preset resolver, not hard-coded per-service tier lists.
_SERVICE_RESOLVERS = {
    "event":      (_find_event_date,      "event"),
    "cinema":     (_find_cinema_date,     "showtime"),
    "travel":     (_find_travel_date,     "departure"),
    "hotel":      (_find_hotel_date,      "check-in"),
    "restaurant": (_find_restaurant_date, "reservation"),
    "car_rental": (_find_car_rental_date, "pick-up"),
    "banquet":    (_find_banquet_date,    "event"),
    "laundry":    (_find_laundry_date,    "pick-up"),
}


def compute_eligibility(
    order: dict,
    *,
    operator_cancelled: bool = False,
    operator_policy: Optional[dict] = None,
    listing_policy: Optional[dict] = None,
) -> EligibilityResult:
    """Pure function — no DB, easy to unit-test.

    `operator_policy` and `listing_policy` are optional override hooks. Shape:
        { "preset": "strict" | "standard" | "flexible" | "custom",
          "custom_tiers": [ {threshold_hours, refund_pct, label}, ... ] }
    """
    total = float(order.get("total_amount") or 0)
    service_type = (order.get("service_type") or order.get("service_category") or "").lower()
    booking = order.get("booking_details") or {}
    canonical = _canonical_service(service_type)

    # Operator cancellation always wins.
    if operator_cancelled:
        return EligibilityResult(
            eligible=True, eligible_amount=total,
            window="Operator-cancelled service — full refund mandatory",
            refundable_pct=100, operator_initiated=True,
            service_type=service_type, total_paid=total,
            policy_source="platform",
            policy=[PolicyTier(threshold="Operator-cancelled", refund_pct=100, active=True)],
        )

    resolver = _SERVICE_RESOLVERS.get(canonical)
    if resolver:
        date_finder, anchor_label = resolver
        tiers, source = _resolve_tiers(canonical, listing_policy, operator_policy)
        starts_at = date_finder(order, booking)
        if not starts_at:
            return EligibilityResult(
                eligible=True, eligible_amount=total,
                window=f"No {anchor_label} time on file — admin review",
                refundable_pct=100,
                service_type=service_type, total_paid=total,
                policy_source=source,
                policy=tiers_to_policy_list(tiers, 100) if tiers else _policy_default(),
            )
        delta = starts_at - datetime.now(timezone.utc)
        hrs = delta.total_seconds() / 3600
        # Pick the first tier whose threshold is still in the future.
        pct, window = tiers[-1][1], tiers[-1][2]
        for threshold, tier_pct, tier_window, _label in tiers:
            if delta >= threshold:
                pct, window = tier_pct, tier_window
                break
        return EligibilityResult(
            eligible=pct > 0, eligible_amount=round(total * pct / 100, 2),
            window=window, refundable_pct=pct,
            service_type=service_type, total_paid=total,
            hours_until_service=round(hrs, 1), service_date=starts_at.isoformat(),
            policy_source=source,
            policy=tiers_to_policy_list(tiers, pct),
        )

    # Package & anything not in the schedule → manual admin review.
    if canonical == "package":
        return EligibilityResult(
            eligible=True, eligible_amount=total,
            window="Package bookings bundle multiple services — admin reviews per sub-item",
            refundable_pct=100,
            service_type=service_type, total_paid=total,
            policy_source="platform",
            policy=[
                PolicyTier(threshold="Cancelled before any sub-service starts", refund_pct=100, active=True),
                PolicyTier(threshold="Once any sub-service has started", refund_pct=50, active=False),
                PolicyTier(threshold="After all sub-services delivered", refund_pct=0, active=False),
            ],
        )

    return EligibilityResult(
        eligible=True, eligible_amount=total,
        window="Admin review required", refundable_pct=100,
        service_type=service_type, total_paid=total,
        policy_source="platform",
        policy=_policy_default(),
    )

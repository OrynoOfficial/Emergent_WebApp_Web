"""End-to-end coverage of `compute_eligibility` for every service type.

For each service we exercise:
  • happy-path full refund (well outside the cancellation window)
  • partial refund (where the policy has a 50% tier)
  • non-refundable (inside the no-go window)
  • missing date → falls back to "no date — admin review · 100%"

Run: `cd /app/backend && python -m pytest tests/test_refund_policies.py -v`
"""
from datetime import datetime, timezone, timedelta

import pytest

from models.refund import compute_eligibility


def _order(service_type, *, booking_details=None, total=10000.0):
    return {
        "_id": "test-order",
        "service_type": service_type,
        "service_category": service_type,
        "total_amount": total,
        "payment_status": "paid",
        "status": "confirmed",
        "booking_details": booking_details or {},
    }


def _iso(days=0, hours=0):
    return (datetime.now(timezone.utc) + timedelta(days=days, hours=hours)).isoformat()


# ── Cinema ──────────────────────────────────────────────────────────────────
def test_cinema_full_refund_more_than_2h():
    bd = {"show_date": (datetime.now(timezone.utc) + timedelta(hours=5)).date().isoformat(),
          "show_time": (datetime.now(timezone.utc) + timedelta(hours=5)).strftime("%H:%M")}
    r = compute_eligibility(_order("cinema", booking_details=bd))
    assert r.refundable_pct == 100 and r.eligible_amount == 10000.0


def test_cinema_non_refundable_under_2h():
    bd = {"show_datetime": _iso(hours=1)}
    r = compute_eligibility(_order("cinema", booking_details=bd))
    assert r.refundable_pct == 0 and not r.eligible


# ── Event ───────────────────────────────────────────────────────────────────
def test_event_full_refund_more_than_7_days():
    r = compute_eligibility(_order("event", booking_details={"start_datetime": _iso(days=10)}))
    assert r.refundable_pct == 100


def test_event_partial_24h_to_7d():
    r = compute_eligibility(_order("event", booking_details={"start_datetime": _iso(days=3)}))
    assert r.refundable_pct == 50 and r.eligible_amount == 5000.0


def test_event_non_refundable_under_24h():
    r = compute_eligibility(_order("event", booking_details={"start_datetime": _iso(hours=10)}))
    assert r.refundable_pct == 0


# ── Travel ──────────────────────────────────────────────────────────────────
def test_travel_combines_date_and_time():
    bd = {"travel_date": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat(),
          "departure_time": "08:00"}
    r = compute_eligibility(_order("travel", booking_details=bd))
    assert r.refundable_pct == 100 and r.service_date is not None


def test_travel_partial_24h_to_48h():
    r = compute_eligibility(_order("travel", booking_details={"departure_datetime": _iso(hours=36)}))
    assert r.refundable_pct == 50


def test_travel_non_refundable_under_24h():
    r = compute_eligibility(_order("travel", booking_details={"departure_datetime": _iso(hours=12)}))
    assert r.refundable_pct == 0


def test_travel_missing_date_falls_back_to_admin_review():
    r = compute_eligibility(_order("travel", booking_details={"departure_time": "08:00"}))
    assert r.refundable_pct == 100 and "admin review" in r.window.lower()


# ── Hotel ───────────────────────────────────────────────────────────────────
def test_hotel_full_refund_more_than_7_days():
    bd = {"check_in": (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()}
    r = compute_eligibility(_order("hotel", booking_details=bd))
    assert r.refundable_pct == 100


def test_hotel_partial_24h_to_7d():
    r = compute_eligibility(_order("hotel", booking_details={"check_in": _iso(days=3)}))
    assert r.refundable_pct == 50


def test_hotel_non_refundable_under_24h():
    r = compute_eligibility(_order("hotel", booking_details={"check_in": _iso(hours=10)}))
    assert r.refundable_pct == 0


# ── Restaurant ──────────────────────────────────────────────────────────────
def test_restaurant_full_refund_more_than_24h():
    bd = {"date": (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat(), "time": "19:00"}
    r = compute_eligibility(_order("restaurant", booking_details=bd))
    assert r.refundable_pct == 100


def test_restaurant_partial_6h_to_24h():
    r = compute_eligibility(_order("restaurant", booking_details={"reservation_datetime": _iso(hours=12)}))
    assert r.refundable_pct == 50


def test_restaurant_non_refundable_under_6h():
    r = compute_eligibility(_order("restaurant", booking_details={"reservation_datetime": _iso(hours=3)}))
    assert r.refundable_pct == 0


# ── Car rental ──────────────────────────────────────────────────────────────
def test_car_rental_full_refund_more_than_48h():
    bd = {"pickup_date": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()}
    r = compute_eligibility(_order("car_rental", booking_details=bd))
    assert r.refundable_pct == 100


def test_car_rental_partial_24h_to_48h():
    r = compute_eligibility(_order("car_rental", booking_details={"pickup_datetime": _iso(hours=36)}))
    assert r.refundable_pct == 50


def test_car_rental_non_refundable_under_24h():
    r = compute_eligibility(_order("car_rental", booking_details={"pickup_datetime": _iso(hours=12)}))
    assert r.refundable_pct == 0


# ── Banquet ─────────────────────────────────────────────────────────────────
def test_banquet_full_refund_more_than_14_days():
    bd = {"event_date": (datetime.now(timezone.utc) + timedelta(days=20)).date().isoformat()}
    r = compute_eligibility(_order("banquet", booking_details=bd))
    assert r.refundable_pct == 100


def test_banquet_partial_7d_to_14d():
    r = compute_eligibility(_order("banquet", booking_details={"event_datetime": _iso(days=10)}))
    assert r.refundable_pct == 50


def test_banquet_non_refundable_under_7d():
    r = compute_eligibility(_order("banquet", booking_details={"event_datetime": _iso(days=3)}))
    assert r.refundable_pct == 0


# ── Laundry / Pressing ──────────────────────────────────────────────────────
def test_laundry_full_refund_before_pickup():
    bd = {"pickup_date": (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat(), "pickup_time": "09:00"}
    r = compute_eligibility(_order("laundry", booking_details=bd))
    assert r.refundable_pct == 100


def test_pressing_alias():
    """The 'pressing' alias should map to the laundry schedule."""
    r = compute_eligibility(_order("pressing", booking_details={"pickup_date": _iso(days=2)}))
    assert r.refundable_pct == 100


# ── Package ─────────────────────────────────────────────────────────────────
def test_package_admin_review_tier():
    r = compute_eligibility(_order("package", booking_details={}))
    assert r.eligible
    # Package returns its own 3-tier schedule even without dates
    assert any("sub-service" in t.threshold for t in r.policy)


# ── Operator-cancel always wins ──────────────────────────────────────────────
def test_operator_cancelled_overrides_policy():
    """Even a 'less than 24h before' event should refund 100% if the
    operator cancelled (force-majeure / venue closure / weather etc.)."""
    bd = {"start_datetime": _iso(hours=10)}
    r = compute_eligibility(_order("event", booking_details=bd), operator_cancelled=True)
    assert r.refundable_pct == 100 and r.operator_initiated


# ── Per-operator + per-listing override resolver ─────────────────────────────
def test_operator_strict_preset_overrides_platform_default():
    """An operator who selects 'strict' for hotel should see 0% inside 7d
    (vs the platform default that allows 50% in that window)."""
    bd = {"check_in": _iso(days=3)}  # 3 days out — Standard would be 50%, Strict = 0%
    r = compute_eligibility(
        _order("hotel", booking_details=bd),
        operator_policy={"preset": "strict"},
    )
    assert r.refundable_pct == 0
    assert r.policy_source == "operator"


def test_listing_flexible_preset_beats_operator_strict():
    """When a specific room (listing) overrides with 'flexible', that wins
    over the operator-level 'strict' setting."""
    bd = {"check_in": _iso(hours=12)}  # 12h out
    r = compute_eligibility(
        _order("hotel", booking_details=bd),
        operator_policy={"preset": "strict"},
        listing_policy={"preset": "flexible"},  # Flexible: 50% in 6-24h window
    )
    assert r.refundable_pct == 50
    assert r.policy_source == "listing"


def test_custom_tiers_supported_for_advanced_operators():
    """Operators on enterprise plans can author their own tier schedule."""
    bd = {"check_in": _iso(days=14)}
    r = compute_eligibility(
        _order("hotel", booking_details=bd),
        operator_policy={
            "preset": "custom",
            "custom_tiers": [
                {"threshold_hours": 24 * 60, "refund_pct": 100, "label": "≥ 60 days"},
                {"threshold_hours": 24 * 30, "refund_pct": 75,  "label": "30 – 60 days"},
                {"threshold_hours": 24 * 7,  "refund_pct": 25,  "label": "7 – 30 days"},
                {"threshold_hours": 0,       "refund_pct": 0,   "label": "< 7 days"},
            ],
        },
    )
    # 14 days out → matches "7-30 days" tier → 25%
    assert r.refundable_pct == 25
    assert r.policy_source == "operator"


def test_policy_source_defaults_to_platform_when_no_overrides():
    bd = {"start_datetime": _iso(days=10)}
    r = compute_eligibility(_order("event", booking_details=bd))
    assert r.policy_source == "platform"

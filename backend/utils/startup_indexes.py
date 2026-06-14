"""
Idempotent MongoDB index bootstrapper — run once on application startup.

This module is the single source of truth for which fields the application
queries on hot paths. Without these indexes, every list endpoint does a full
COLLSCAN at scale (we have ~5 indexes today across 65k LOC).

Design notes:
  - `create_index` in MongoDB is idempotent when the index name matches — so
    this is safe to run on every restart.
  - We give every index a stable, descriptive name so future audits can
    cross-reference the codebase against `db.collection.getIndexes()`.
  - Sparse + partial indexes are used to avoid bloat on optional fields.
  - TTL indexes are used for short-lived collections (otps, verification
    tokens, seat reservations) so Mongo evicts expired docs automatically.
  - We collect failures into a single log line instead of crashing the boot
    sequence — a bad index spec must never take the API offline.

To add a new index: append an `IndexSpec` to `INDEX_DEFINITIONS` below.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Sequence

from pymongo import ASCENDING, DESCENDING

logger = logging.getLogger(__name__)


@dataclass
class IndexSpec:
    collection: str
    keys: Sequence[tuple[str, int]]
    name: str
    unique: bool = False
    sparse: bool = False
    expire_after_seconds: int | None = None
    partial: dict[str, Any] | None = field(default=None)


# ── INDEX CATALOG ────────────────────────────────────────────────────
# Ordered by collection. Each tuple is (field, direction):
#   ASCENDING  = 1
#   DESCENDING = -1
INDEX_DEFINITIONS: list[IndexSpec] = [
    # ── users ──────────────────────────────────────────────────────────
    # Most authentication & lookup paths hit users by email/phone/role.
    IndexSpec("users", [("email", ASCENDING)], "ix_users_email", unique=True),
    IndexSpec("users", [("phone", ASCENDING)], "ix_users_phone", sparse=True),
    IndexSpec("users", [("role", ASCENDING)], "ix_users_role"),
    IndexSpec("users", [("operator_id", ASCENDING)], "ix_users_operator", sparse=True),
    IndexSpec("users", [("status", ASCENDING)], "ix_users_status"),
    IndexSpec("users", [("assigned_role_ids", ASCENDING)], "ix_users_assigned_roles", sparse=True),

    # ── orders ─────────────────────────────────────────────────────────
    # Hottest collection: customer history, operator dashboards, analytics.
    IndexSpec("orders", [("user_id", ASCENDING), ("created_at", DESCENDING)], "ix_orders_user_created"),
    IndexSpec("orders", [("operator_id", ASCENDING), ("created_at", DESCENDING)], "ix_orders_operator_created"),
    IndexSpec("orders", [("service_category", ASCENDING), ("created_at", DESCENDING)], "ix_orders_category_created"),
    IndexSpec("orders", [("service_type", ASCENDING), ("service_id", ASCENDING)], "ix_orders_service_type_id"),
    IndexSpec("orders", [("status", ASCENDING), ("created_at", DESCENDING)], "ix_orders_status_created"),
    IndexSpec("orders", [("payment_status", ASCENDING)], "ix_orders_payment_status", sparse=True),
    IndexSpec("orders", [("channel", ASCENDING)], "ix_orders_channel", sparse=True),
    IndexSpec("orders", [("order_number", ASCENDING)], "ix_orders_order_number", sparse=True, unique=True),
    IndexSpec("orders", [("customer_email", ASCENDING)], "ix_orders_customer_email", sparse=True),
    IndexSpec("orders", [("guest_customer.email", ASCENDING)], "ix_orders_guest_email", sparse=True),
    IndexSpec("orders", [("booking_details.showtime_id", ASCENDING)], "ix_orders_showtime", sparse=True),
    IndexSpec("orders", [("booking_details.route_id", ASCENDING), ("booking_details.travel_date", ASCENDING)],
             "ix_orders_route_date", sparse=True),
    IndexSpec("orders", [("created_at", DESCENDING)], "ix_orders_created"),
    IndexSpec("orders", [("checked_in", ASCENDING), ("user_id", ASCENDING)], "ix_orders_checkedin_user", sparse=True),

    # ── operators ──────────────────────────────────────────────────────
    IndexSpec("operators", [("status", ASCENDING)], "ix_operators_status"),
    IndexSpec("operators", [("country", ASCENDING)], "ix_operators_country", sparse=True),
    IndexSpec("operators", [("operator_type", ASCENDING)], "ix_operators_type"),
    IndexSpec("operators", [("service_types", ASCENDING)], "ix_operators_service_types"),
    IndexSpec("operators", [("name", ASCENDING)], "ix_operators_name"),

    # ── ratings ────────────────────────────────────────────────────────
    IndexSpec("ratings", [("entity_id", ASCENDING), ("created_at", DESCENDING)], "ix_ratings_entity_created"),
    IndexSpec("ratings", [("user_id", ASCENDING), ("created_at", DESCENDING)], "ix_ratings_user_created"),
    IndexSpec("ratings", [("operator_id", ASCENDING)], "ix_ratings_operator", sparse=True),
    IndexSpec("ratings", [("order_id", ASCENDING)], "ix_ratings_order", sparse=True),

    # ── rooms / room_bookings ─────────────────────────────────────────
    IndexSpec("rooms", [("hotel_id", ASCENDING)], "ix_rooms_hotel"),
    IndexSpec("rooms", [("hotel_id", ASCENDING), ("room_type", ASCENDING)], "ix_rooms_hotel_type"),
    IndexSpec("room_bookings", [("room_id", ASCENDING), ("status", ASCENDING)], "ix_roombook_room_status"),
    IndexSpec("room_bookings", [("hotel_id", ASCENDING), ("check_in_date", ASCENDING), ("check_out_date", ASCENDING)],
             "ix_roombook_hotel_dates"),
    IndexSpec("room_bookings", [("user_id", ASCENDING), ("created_at", DESCENDING)], "ix_roombook_user_created"),

    # ── cinema (films, showtimes, bookings) ───────────────────────────
    IndexSpec("films", [("operator_id", ASCENDING)], "ix_films_operator", sparse=True),
    IndexSpec("films", [("is_active", ASCENDING)], "ix_films_active"),
    IndexSpec("showtimes", [("film_id", ASCENDING), ("show_date", ASCENDING), ("show_time", ASCENDING)],
             "ix_showtimes_film_date"),
    IndexSpec("showtimes", [("cinema_id", ASCENDING), ("show_date", ASCENDING)], "ix_showtimes_cinema_date"),
    IndexSpec("showtimes", [("is_active", ASCENDING), ("show_date", ASCENDING)], "ix_showtimes_active_date"),
    IndexSpec("cinema_bookings", [("showtime_id", ASCENDING), ("status", ASCENDING)], "ix_cinemabook_showtime_status"),
    IndexSpec("cinema_bookings", [("user_id", ASCENDING)], "ix_cinemabook_user"),
    IndexSpec("cinemas", [("operator_id", ASCENDING)], "ix_cinemas_operator", sparse=True),
    IndexSpec("cinemas", [("city", ASCENDING)], "ix_cinemas_city", sparse=True),

    # ── travel ────────────────────────────────────────────────────────
    IndexSpec("travel_routes", [("operator_id", ASCENDING)], "ix_routes_operator", sparse=True),
    IndexSpec("travel_routes", [("from_city", ASCENDING), ("to_city", ASCENDING)], "ix_routes_cities"),
    IndexSpec("seat_bookings", [("route_id", ASCENDING), ("travel_date", ASCENDING), ("status", ASCENDING)],
             "ix_seatbook_route_date_status"),
    IndexSpec("seat_bookings", [("user_id", ASCENDING)], "ix_seatbook_user", sparse=True),
    # Auto-expire stale "reserved" seat holds (the route reserves seats for ~15 min).
    # Set TTL on `expires_at` only — sparse so it doesn't try to expire docs without it.
    IndexSpec("seat_bookings", [("expires_at", ASCENDING)], "ix_seatbook_ttl",
             expire_after_seconds=0, sparse=True),

    # ── other services ────────────────────────────────────────────────
    IndexSpec("hotels", [("operator_id", ASCENDING)], "ix_hotels_operator", sparse=True),
    IndexSpec("hotels", [("city", ASCENDING)], "ix_hotels_city", sparse=True),
    IndexSpec("hotels", [("country", ASCENDING)], "ix_hotels_country", sparse=True),
    IndexSpec("restaurants", [("operator_id", ASCENDING)], "ix_restaurants_operator", sparse=True),
    IndexSpec("restaurants", [("city", ASCENDING)], "ix_restaurants_city", sparse=True),
    IndexSpec("car_rentals", [("operator_id", ASCENDING)], "ix_carrentals_operator", sparse=True),
    IndexSpec("vehicles", [("car_rental_id", ASCENDING)], "ix_vehicles_rental", sparse=True),
    IndexSpec("events", [("operator_id", ASCENDING)], "ix_events_operator", sparse=True),
    IndexSpec("events", [("event_date", ASCENDING)], "ix_events_date"),
    IndexSpec("events", [("city", ASCENDING)], "ix_events_city", sparse=True),
    IndexSpec("packages", [("operator_id", ASCENDING)], "ix_packages_operator", sparse=True),
    IndexSpec("pressings", [("operator_id", ASCENDING)], "ix_pressings_operator", sparse=True),
    IndexSpec("pressings", [("city", ASCENDING)], "ix_pressings_city", sparse=True),
    IndexSpec("pressings", [("status", ASCENDING)], "ix_pressings_status"),
    IndexSpec("banquets", [("operator_id", ASCENDING)], "ix_banquets_operator", sparse=True),
    IndexSpec("banquets", [("category", ASCENDING)], "ix_banquets_category", sparse=True),
    IndexSpec("banquets", [("operator_id", ASCENDING), ("category", ASCENDING)],
             "ix_banquets_op_category", sparse=True),
    IndexSpec("banquet_packages", [("operator_id", ASCENDING)], "ix_bnqpkg_operator", sparse=True),
    IndexSpec("banquet_packages", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_bnqpkg_op_active", sparse=True),

    # ── auth / verification ────────────────────────────────────────────
    IndexSpec("verification_tokens", [("email", ASCENDING)], "ix_verif_email"),
    # Auto-evict expired tokens (TTL=0 means "expire at the date stored in expires_at").
    IndexSpec("verification_tokens", [("expires_at", ASCENDING)], "ix_verif_ttl",
             expire_after_seconds=0),
    IndexSpec("invitations", [("email", ASCENDING)], "ix_invitations_email"),
    IndexSpec("invitations", [("status", ASCENDING)], "ix_invitations_status"),

    # ── support / loyalty / promos ────────────────────────────────────
    IndexSpec("support_tickets", [("user_id", ASCENDING), ("created_at", DESCENDING)], "ix_tickets_user_created"),
    IndexSpec("support_tickets", [("operator_id", ASCENDING), ("status", ASCENDING)], "ix_tickets_operator_status",
             sparse=True),
    IndexSpec("support_tickets", [("status", ASCENDING)], "ix_tickets_status"),
    IndexSpec("loyalty_programs", [("operator_id", ASCENDING)], "ix_loyalty_operator", sparse=True),
    IndexSpec("loyalty_programs", [("user_id", ASCENDING)], "ix_loyalty_user", sparse=True),
    IndexSpec("promotions", [("operator_id", ASCENDING), ("active", ASCENDING)], "ix_promos_operator_active",
             sparse=True),
    IndexSpec("promo_codes", [("code", ASCENDING)], "ix_promocodes_code", unique=True, sparse=True),
    IndexSpec("promo_codes", [("operator_id", ASCENDING)], "ix_promocodes_operator", sparse=True),

    # ── pods / employees / permissions ────────────────────────────────
    IndexSpec("pods", [("operator_id", ASCENDING)], "ix_pods_operator", sparse=True),
    IndexSpec("pod_memberships", [("user_id", ASCENDING)], "ix_podmem_user"),
    IndexSpec("pod_memberships", [("pod_id", ASCENDING)], "ix_podmem_pod"),
    IndexSpec("employees", [("operator_id", ASCENDING)], "ix_employees_operator", sparse=True),
    IndexSpec("employee_access_scopes", [("user_id", ASCENDING)], "ix_empscope_user"),
    IndexSpec("operator_roles", [("operator_id", ASCENDING)], "ix_roles_operator", sparse=True),

    # ── subscriptions / payments ──────────────────────────────────────
    IndexSpec("subscriptions", [("user_id", ASCENDING)], "ix_subs_user"),
    IndexSpec("subscriptions", [("operator_id", ASCENDING)], "ix_subs_operator", sparse=True),
    IndexSpec("payment_transactions", [("user_id", ASCENDING), ("created_at", DESCENDING)],
             "ix_payments_user_created"),
    IndexSpec("payment_transactions", [("order_id", ASCENDING)], "ix_payments_order", sparse=True),
    IndexSpec("payment_transactions", [("session_id", ASCENDING)], "ix_payments_session", sparse=True),

    # ── idempotency keys (TTL self-clean) ─────────────────────────────
    # Mongo auto-evicts an idempotency record once `expires_at` is in the past.
    IndexSpec("idempotency_keys", [("user_id", ASCENDING)], "ix_idemp_user"),
    IndexSpec("idempotency_keys", [("expires_at", ASCENDING)], "ix_idemp_ttl",
             expire_after_seconds=0),

    # ── analytics rollup (materialised view of orders) ────────────────
    IndexSpec("analytics_daily_rollup", [("date", ASCENDING)], "ix_rollup_date"),
    IndexSpec("analytics_daily_rollup", [("operator_id", ASCENDING), ("date", ASCENDING)],
             "ix_rollup_operator_date", sparse=True),
    IndexSpec("analytics_daily_rollup", [("service_category", ASCENDING), ("date", ASCENDING)],
             "ix_rollup_category_date"),

    # ── compound (operator_id, is_active) — kills full-scans on the
    # "my-X" management lists (hotels, restaurants, etc.). These are the
    # endpoints the operator dashboard hits on every page load.
    IndexSpec("hotels", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_hotels_op_active", sparse=True),
    IndexSpec("hotels", [("is_active", ASCENDING)], "ix_hotels_active"),
    IndexSpec("restaurants", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_restaurants_op_active", sparse=True),
    IndexSpec("restaurants", [("is_active", ASCENDING)], "ix_restaurants_active"),
    IndexSpec("cinemas", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_cinemas_op_active", sparse=True),
    IndexSpec("films", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_films_op_active", sparse=True),
    IndexSpec("car_rentals", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_carrentals_op_active", sparse=True),
    IndexSpec("vehicles", [("car_rental_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_vehicles_rental_active", sparse=True),
    IndexSpec("events", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_events_op_active", sparse=True),
    IndexSpec("packages", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_packages_op_active", sparse=True),
    IndexSpec("travel_routes", [("operator_id", ASCENDING), ("is_active", ASCENDING)],
             "ix_routes_op_active", sparse=True),

    # ── notifications (already partly indexed elsewhere, but the unread-
    # badge hits these on every page nav so the compound shape matters).
    IndexSpec("notifications", [("user_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)],
             "ix_notifs_user_read_created"),
    # NOTE: (user_id, created_at DESC) already exists under the auto-name
    # `user_id_1_created_at_-1` — re-declaring with our naming convention
    # raises IndexOptionsConflict, so we leave it as-is.

    # ── activity_logs (Audit Logs page sorts DESC by created_at, then
    # filters by user/action — both should be cheap).
    IndexSpec("activity_logs", [("created_at", DESCENDING)], "ix_audit_created"),
    IndexSpec("activity_logs", [("user_id", ASCENDING), ("created_at", DESCENDING)],
             "ix_audit_user_created", sparse=True),
    IndexSpec("activity_logs", [("action", ASCENDING), ("created_at", DESCENDING)],
             "ix_audit_action_created"),

    # ── favourites / ratings supplemental ──────────────────────────────
    IndexSpec("favourites", [("user_id", ASCENDING), ("service_type", ASCENDING)],
             "ix_favs_user_type"),

    # ── support tickets supplemental ───────────────────────────────────
    IndexSpec("support_tickets", [("assigned_to", ASCENDING), ("status", ASCENDING)],
             "ix_tickets_assignee_status", sparse=True),

    # ── system_settings (read on every request via middleware) ─────────
    IndexSpec("system_settings", [("key", ASCENDING)], "ix_settings_key", unique=True, sparse=True),

    # ── payment_events (immutable ledger — V2 payments) ────────────────
    # Append-only event log. Reads are timeline (`payment_id` + chronological)
    # and dedup (provider event id, idempotency key). Mutations are forbidden.
    IndexSpec(
        "payment_events",
        [("payment_id", ASCENDING), ("occurred_at", ASCENDING)],
        "ix_payment_events_payment_chrono",
    ),
    IndexSpec(
        "payment_events",
        [("provider", ASCENDING), ("provider_event_id", ASCENDING)],
        "ix_payment_events_provider_dedup",
        unique=True,
        partial={"provider_event_id": {"$type": "string"}},
    ),
    IndexSpec(
        "payment_events",
        [("idempotency_key", ASCENDING)],
        "ix_payment_events_idempotency",
        unique=True,
        partial={"idempotency_key": {"$type": "string"}, "event_type": "intent_created"},
    ),
    IndexSpec("payments", [("state", ASCENDING)], "ix_payments_state"),
    IndexSpec("payments", [("user_id", ASCENDING), ("updated_at", DESCENDING)], "ix_payments_user_updated", sparse=True),

    # ── otps (TTL — auto-evict expired OTPs) ───────────────────────────
    IndexSpec("otps", [("phone", ASCENDING), ("purpose", ASCENDING)], "ix_otp_phone_purpose"),
    IndexSpec("otps", [("email", ASCENDING), ("purpose", ASCENDING)], "ix_otp_email_purpose", sparse=True),
    IndexSpec("otps", [("expires_at", ASCENDING)], "ix_otp_ttl", expire_after_seconds=0, sparse=True),
]


async def ensure_all_indexes(db) -> dict:
    """Create every index in `INDEX_DEFINITIONS` idempotently.

    Returns a stats dict suitable for logging:
        {"created": int, "existed": int, "failed": [(coll, name, err)]}

    `create_index` is safe to call repeatedly when the name + spec match — it
    short-circuits with an "exists" response. If the SAME name is bound to a
    DIFFERENT spec, Mongo raises `IndexOptionsConflict` — we catch that and
    surface it for manual remediation rather than crashing the boot.
    """
    stats = {"created": 0, "existed": 0, "failed": []}

    # Get the list of existing indexes per collection to determine "existed" vs "created"
    existing_by_collection: dict[str, set[str]] = {}
    collections = await db.list_collection_names()
    for coll in collections:
        try:
            names = set()
            async for ix in db[coll].list_indexes():
                names.add(ix.get("name"))
            existing_by_collection[coll] = names
        except Exception:
            existing_by_collection[coll] = set()

    for spec in INDEX_DEFINITIONS:
        kwargs: dict[str, Any] = {"name": spec.name}
        if spec.unique:
            kwargs["unique"] = True
        if spec.sparse:
            kwargs["sparse"] = True
        if spec.expire_after_seconds is not None:
            kwargs["expireAfterSeconds"] = spec.expire_after_seconds
        if spec.partial:
            kwargs["partialFilterExpression"] = spec.partial

        try:
            await db[spec.collection].create_index(list(spec.keys), **kwargs)
            if spec.name in existing_by_collection.get(spec.collection, set()):
                stats["existed"] += 1
            else:
                stats["created"] += 1
        except Exception as exc:  # noqa: BLE001 — we explicitly want broad catch
            stats["failed"].append((spec.collection, spec.name, str(exc)))
            logger.warning("Index %s.%s failed: %s", spec.collection, spec.name, exc)

    return stats

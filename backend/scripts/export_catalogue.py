#!/usr/bin/env python3
"""
Oryno — Production seed bootstrap exporter.

Dumps the catalogue / reference collections from the *preview* database into a
single portable JSON file that the production backend can import via
`POST /api/admin/seed-bootstrap`.

WHAT IS EXPORTED  (matches the "catalogue + reference" tier the team chose)
    operators, cinemas, films, showtimes, hotels, rooms,
    restaurants, restaurant_menu, pressings, pressing, pressing_services,
    car_rentals, vehicles, events, banquets,
    travel_routes, services, packages, package_services,
    loyalty_programs, loyalty_rewards,
    promotions, promo_codes,
    market_segments, countries, regions,
    roles, operator_roles, employee_access_scopes,
    pods, pod_memberships

WHAT IS *NOT* EXPORTED
    users, invitations, verification_tokens, otps, password_reset_tokens
    orders, payments, bookings, seat_bookings, room_bookings, cinema_bookings,
    laundry_orders, commission_records, receipts
    notifications, support_tickets, chat_sessions
    activity_logs, audit trails, validation_history
    ratings, favourites, referrals, subscriptions, loyalty_transactions,
    loyalty_redemptions, promo_code_uses, promotion_redemptions
    employees, support_team_members
    analytics_daily_rollup, resource_reassignments
    system_settings, system_config   (prod admin configures their own)

USER-REFERENCE SANITISATION
Foreign keys like `owner_user_id`, `created_by`, `updated_by`, `manager_id`
get blanked out — prod will have zero users from preview, so leaving them in
would create dangling references. The platform tolerates `None` for all of
these (no crashes).

USAGE
    python3 backend/scripts/export_catalogue.py            # writes /tmp/oryno_seed.json
    python3 backend/scripts/export_catalogue.py path/to/out.json

The output file is intentionally a single JSON document so the importer can
parse it atomically and reject the whole batch if anything is malformed.
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Collections to dump. Order matters only for human readability of the output
# file — the importer is upsert-by-_id so it doesn't care.
CATALOGUE_COLLECTIONS = [
    "countries", "regions", "market_segments",
    "operators",
    "cinemas", "films", "showtimes",
    "hotels", "rooms",
    "restaurants", "restaurant_menu",
    "pressings", "pressing", "pressing_services",
    "car_rentals", "vehicles",
    "events", "banquets",
    "travel_routes",
    "services",
    "packages", "package_services",
    "loyalty_programs", "loyalty_rewards",
    "promotions", "promo_codes",
    "roles", "operator_roles", "employee_access_scopes",
    "pods", "pod_memberships",
]

# Foreign-key field names that reference a user. Blanked at export time so we
# don't carry dangling refs into prod.
USER_REF_FIELDS = {
    "owner_user_id", "owner_id",
    "created_by", "updated_by", "deleted_by",
    "manager_id", "managed_by", "assigned_to",
    "user_id",  # only safe to blank here because we already excluded any
                # collection where user_id is the primary semantic (orders, ratings)
}


def _serialize(value: Any) -> Any:
    """Recursively coerce BSON / datetime values into JSON-safe forms."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize(v) for v in value]
    if isinstance(value, bytes):
        # Catch-all — base64 would be safer but no collection in the
        # catalogue list stores binary data today.
        return value.decode("utf-8", errors="replace")
    return value


def _scrub_user_refs(doc: dict) -> dict:
    """Null out every user FK in the document tree (top-level + nested)."""
    if isinstance(doc, dict):
        return {
            k: (None if k in USER_REF_FIELDS else _scrub_user_refs(v))
            for k, v in doc.items()
        }
    if isinstance(doc, list):
        return [_scrub_user_refs(v) for v in doc]
    return doc


def _read_env() -> dict:
    out: dict = {}
    with open(Path(__file__).resolve().parents[1] / ".env") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k] = v.strip("\"'")
    return out


async def export() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/oryno_seed.json")

    env = _read_env()
    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env.get("MONGO_DB_NAME", "oryno_webapp")]

    bundle: dict[str, Any] = {
        "format_version": 1,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "source_db": env.get("MONGO_DB_NAME", "oryno_webapp"),
        "collections": {},
    }

    grand_total = 0
    for name in CATALOGUE_COLLECTIONS:
        try:
            docs = []
            cursor = db[name].find({})
            async for raw in cursor:
                docs.append(_serialize(_scrub_user_refs(raw)))
            bundle["collections"][name] = docs
            grand_total += len(docs)
            print(f"  {name:.<35} {len(docs):>5} docs")
        except Exception as e:
            print(f"  {name:.<35} SKIP ({e})")
            bundle["collections"][name] = []

    client.close()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False))
    size_kb = out_path.stat().st_size / 1024
    print()
    print(f"✓ {grand_total} docs across {len(CATALOGUE_COLLECTIONS)} collections")
    print(f"✓ wrote {out_path}  ({size_kb:,.1f} KB)")


if __name__ == "__main__":
    asyncio.run(export())

"""
Admin Operations endpoints — super_admin-only utilities for keeping the DB clean.

Currently exposes a wrapped version of `scripts/cleanup_test_data.py` so super
admins can run dry-run previews and apply deletions from a UI instead of SSH.

Endpoints:
  GET  /api/admin/ops/cleanup/preview   -> returns the counts that *would* be
                                            deleted (no writes).
  POST /api/admin/ops/cleanup/apply     -> actually deletes the data.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict

from fastapi import APIRouter, Depends

from config.database import get_database
from utils.permissions import require_super_admin
from scripts.cleanup_test_data import (
    _scan_and_collect_test_ids,
    PROTECTED_EMAILS,
)

router = APIRouter(prefix="/api/admin/ops", tags=["admin-ops"])


async def _run_cleanup(apply: bool) -> Dict[str, int]:
    db = get_database()
    targets = await _scan_and_collect_test_ids(db)

    stats: Dict[str, int] = {
        "users_matched": len(targets["users"]),
        "orders_matched": len(targets["orders"]),
        "showtimes_matched": len(targets["showtimes"]),
        "locations_matched": len(targets["locations"]),
    }

    async def _do(coll_name: str, query: dict, key: str):
        coll = db[coll_name]
        if apply:
            res = await coll.delete_many(query)
            stats[key] = res.deleted_count
        else:
            stats[key] = await coll.count_documents(query)

    order_ids = list(targets["orders"])
    user_ids = list(targets["users"])
    showtime_ids = list(targets["showtimes"])
    location_ids = list(targets["locations"])

    if order_ids:
        await _do("refunds",            {"order_id": {"$in": order_ids}}, "refunds")
        await _do("ticket_validations", {"order_id": {"$in": order_ids}}, "ticket_validations")
        await _do("receipts",           {"order_id": {"$in": order_ids}}, "receipts")
    if user_ids:
        await _do("bills",              {"user_id": {"$in": user_ids}},  "bills")
    if order_ids:
        await _do("orders",             {"_id": {"$in": order_ids}},     "orders")
    if user_ids:
        await _do("bookings",           {"user_id": {"$in": user_ids}},  "bookings")
    if showtime_ids:
        await _do("event_showtimes",    {"_id": {"$in": showtime_ids}},  "event_showtimes")
    if location_ids:
        await _do("event_locations",    {"_id": {"$in": location_ids}},  "event_locations")

    await _do(
        "commission_configs",
        {"name": {"$regex": r"^(QA|Smoke|Test)\b", "$options": "i"}},
        "commission_configs",
    )

    cutoff7  = datetime.now(timezone.utc) - timedelta(days=7)
    cutoff24 = datetime.now(timezone.utc) - timedelta(hours=24)
    cutoff30 = datetime.now(timezone.utc) - timedelta(days=30)
    await _do("verification_tokens",    {"created_at": {"$lt": cutoff7}},  "verification_tokens_aged")
    await _do("revoked_access_tokens",  {"revoked_at": {"$lt": cutoff24}}, "revoked_tokens_aged")
    await _do("refresh_tokens",         {"created_at": {"$lt": cutoff30}}, "refresh_tokens_aged")

    if user_ids:
        await _do("users", {"_id": {"$in": user_ids}}, "users")

    return stats


@router.get("/cleanup/preview")
async def cleanup_preview(_: dict = Depends(require_super_admin())):
    stats = await _run_cleanup(apply=False)
    return {
        "mode": "dry_run",
        "protected_emails": sorted(PROTECTED_EMAILS),
        "stats": stats,
    }


@router.post("/cleanup/apply")
async def cleanup_apply(_: dict = Depends(require_super_admin())):
    stats = await _run_cleanup(apply=True)
    return {
        "mode": "applied",
        "stats": stats,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

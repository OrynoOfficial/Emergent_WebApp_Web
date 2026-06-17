"""
Generic bulk-actions endpoint. Frontend management pages call this with a
collection name + an array of ids + an action, instead of N round-trips.

Hard-gated:
  • Only `admin.delete` permission holders may invoke bulk delete.
  • Whitelist of allowed collections — prevents arbitrary mongo writes.
  • For destructive actions on user-facing data (orders, refunds, etc.) we
    cascade through the related collections.

Example call:
  POST /api/admin/bulk
  {
    "collection": "operators",
    "action": "delete" | "activate" | "deactivate",
    "ids": ["uuid-1", "uuid-2", ...]
  }
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from config.database import get_database
from utils.permissions import require_permission

router = APIRouter(prefix="/api/admin/bulk", tags=["admin-bulk"])

# Allowed (collection → cascading writes, status field) — every entry is
# explicit so a typo never blasts a non-whitelisted collection.
ALLOWED_COLLECTIONS = {
    "operators":      {"cascade": ["bookings", "bills"], "active_field": "is_active"},
    "users":          {"cascade": ["orders", "bookings"], "active_field": "is_active"},
    "orders":         {"cascade": ["refunds", "receipts", "ticket_validations"], "active_field": None},
    "bookings":       {"cascade": [], "active_field": None},
    "bills":          {"cascade": [], "active_field": None},
    "receipts":       {"cascade": [], "active_field": None},
    "refunds":        {"cascade": [], "active_field": None},
    "ticket_validations": {"cascade": [], "active_field": None},
    "event_locations": {"cascade": ["event_showtimes"], "active_field": "is_active"},
    "event_showtimes": {"cascade": [], "active_field": None},
    "hotels":         {"cascade": [], "active_field": "is_active"},
    "restaurants":    {"cascade": [], "active_field": "is_active"},
    "cinemas":        {"cascade": ["films"], "active_field": "is_active"},
    "films":          {"cascade": [], "active_field": "is_active"},
    "car_rentals":    {"cascade": ["vehicles"], "active_field": "is_active"},
    "vehicles":       {"cascade": [], "active_field": "is_active"},
    "events":         {"cascade": [], "active_field": "is_active"},
    "packages":       {"cascade": [], "active_field": "is_active"},
    "travel_routes":  {"cascade": [], "active_field": "is_active"},
    "commission_configs": {"cascade": [], "active_field": "is_active"},
    "promo_codes":    {"cascade": [], "active_field": "is_active"},
    "categories":     {"cascade": [], "active_field": "is_active"},
    "operator_categories": {"cascade": [], "active_field": "is_active"},
}


class BulkRequest(BaseModel):
    collection: str
    action: str = Field(..., description="delete | activate | deactivate")
    ids: List[str] = Field(..., min_length=1, max_length=500)


def _resolve(spec, collection):
    if collection not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Bulk ops not allowed on '{collection}'")
    return spec[collection]


@router.post("")
async def bulk_action(payload: BulkRequest,
                      current_user: dict = Depends(require_permission("admin.delete"))):
    coll = payload.collection
    cfg = _resolve(ALLOWED_COLLECTIONS, coll)
    db = get_database()

    if payload.action == "delete":
        deleted = (await db[coll].delete_many({"_id": {"$in": payload.ids}})).deleted_count
        cascaded = {}
        for child in cfg["cascade"]:
            # FK field convention used across the codebase
            fk_candidates = {
                "operators": "operator_id",
                "users": "user_id",
                "orders": "order_id",
                "event_showtimes": "location_id",
                "films": "cinema_id",
                "vehicles": "car_rental_id",
            }
            fk = fk_candidates.get(coll)
            if not fk:
                continue
            res = await db[child].delete_many({fk: {"$in": payload.ids}})
            if res.deleted_count:
                cascaded[child] = res.deleted_count
        return {"deleted": deleted, "cascaded": cascaded}

    if payload.action in ("activate", "deactivate"):
        if not cfg["active_field"]:
            raise HTTPException(status_code=400, detail=f"'{coll}' does not support activate/deactivate")
        new_val = payload.action == "activate"
        res = await db[coll].update_many(
            {"_id": {"$in": payload.ids}},
            {"$set": {cfg["active_field"]: new_val}},
        )
        return {"matched": res.matched_count, "modified": res.modified_count}

    raise HTTPException(status_code=400, detail=f"Unknown action '{payload.action}'")

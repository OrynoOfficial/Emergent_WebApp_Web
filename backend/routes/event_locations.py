"""
Event Locations API — operator-managed venues that host Showtimes.
Mirrors the Cinema (venue) routes.

Permissions: re-uses `events.*` and `operator.services.*` permissions so
operators with banquet+events sales can manage their venues.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from config.database import get_database
from models.event_location import (
    EventLocationCreate,
    EventLocationUpdate,
    LayoutType,
)
from utils.permissions import require_any_permission

router = APIRouter(prefix="/api/event-locations", tags=["Event Locations"])

_VIEW_PERMS = ["events.view", "operator.services.view", "services.view"]
_CREATE_PERMS = ["events.create", "operator.services.create", "services.manage"]
_EDIT_PERMS = ["events.edit", "operator.services.edit", "services.manage"]
_DELETE_PERMS = ["events.delete", "operator.services.delete", "services.manage"]


@router.post("/")
async def create_location(
    payload: EventLocationCreate,
    current_user: dict = Depends(require_any_permission(_CREATE_PERMS)),
):
    db = get_database()
    operator_id = payload.operator_id or current_user.get("operator_id") or current_user.get("_id")
    operator_name = payload.operator_name or current_user.get("operator_name", "")
    if not operator_name and operator_id:
        op = await db.operators.find_one({"_id": operator_id}, {"name": 1})
        if op:
            operator_name = op.get("name", "")

    doc = {
        "_id": str(uuid.uuid4()),
        **payload.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    # Pydantic enum coercion → str so Mongo stores plain strings.
    if isinstance(doc.get("layout_type"), LayoutType):
        doc["layout_type"] = doc["layout_type"].value
    if doc.get("simple_kind") and not isinstance(doc["simple_kind"], str):
        doc["simple_kind"] = doc["simple_kind"].value
    # Generate IDs for any zones that were sent without them.
    for z in doc.get("zones") or []:
        if isinstance(z, dict) and not z.get("id"):
            z["id"] = str(uuid.uuid4())
    await db.event_locations.insert_one(doc)
    return {"id": doc["_id"], "message": "Location created"}


@router.get("/")
async def list_locations(
    operator_id: Optional[str] = None,
    city: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(require_any_permission(_VIEW_PERMS)),
):
    db = get_database()
    q = {}
    role = (current_user or {}).get("role")
    if operator_id:
        q["operator_id"] = operator_id
    elif role in ("operator", "staff"):
        q["operator_id"] = current_user.get("operator_id") or current_user.get("_id")
    if city:
        q["city"] = {"$regex": city, "$options": "i"}
    if is_active is not None:
        q["is_active"] = is_active
    docs = await db.event_locations.find(q).sort("created_at", -1).to_list(500)
    for d in docs:
        d["id"] = d.pop("_id", None)
    return {"locations": docs, "total": len(docs)}


@router.get("/{location_id}")
async def get_location(location_id: str):
    """Public endpoint — customer-facing pages need basic location info."""
    db = get_database()
    doc = await db.event_locations.find_one({"_id": location_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")
    doc["id"] = doc.pop("_id", None)
    # Surface operator brand for the customer-facing pages.
    if doc.get("operator_id"):
        op = await db.operators.find_one({"_id": doc["operator_id"]}, {"logo_url": 1})
        if op and op.get("logo_url"):
            doc["operator_logo_url"] = op["logo_url"]
    return doc


@router.put("/{location_id}")
async def update_location(
    location_id: str,
    payload: EventLocationUpdate,
    current_user: dict = Depends(require_any_permission(_EDIT_PERMS)),
):
    db = get_database()
    existing = await db.event_locations.find_one({"_id": location_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Location not found")
    if current_user.get("role") == "operator" and existing.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    if "layout_type" in update and isinstance(update["layout_type"], LayoutType):
        update["layout_type"] = update["layout_type"].value
    if update.get("simple_kind") and not isinstance(update["simple_kind"], str):
        update["simple_kind"] = update["simple_kind"].value
    for z in update.get("zones") or []:
        if isinstance(z, dict) and not z.get("id"):
            z["id"] = str(uuid.uuid4())
    await db.event_locations.update_one({"_id": location_id}, {"$set": update})
    return {"id": location_id, "message": "Location updated"}


@router.delete("/{location_id}")
async def delete_location(
    location_id: str,
    current_user: dict = Depends(require_any_permission(_DELETE_PERMS)),
):
    """Permanently delete an event location.

    iter 254: hard-delete migration. Showtimes that referenced this location
    keep working from their own embedded ``location_name`` snapshot. New
    showtimes can no longer be created against the deleted row.
    """
    db = get_database()
    res = await db.event_locations.delete_one({"_id": location_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"id": location_id, "message": "Location deleted"}

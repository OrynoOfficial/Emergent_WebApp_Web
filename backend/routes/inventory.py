"""
Inventory routes — iter 230.

Endpoints:
  POST   /api/inventory/holds                                  → create a rental hold for a booking
  GET    /api/inventory/holds                                  → list holds for the current operator (filters)
  POST   /api/inventory/holds/{hold_id}/confirm-return         → operator confirms a return
  POST   /api/inventory/holds/{hold_id}/report-damage          → operator flags damaged units
  POST   /api/inventory/holds/{hold_id}/cancel                 → cancel a reservation (refund-like)

  POST   /api/inventory/units/{unit_id}/toggle-availability    → operator keeps a unit out of stock
  GET    /api/inventory/{entity_type}/{entity_id}/stock        → current available_units + counts by status

  POST   /api/inventory/banquet-items                          → create a rentable item (chairs/plates/etc)
  GET    /api/inventory/banquet-items                          → list rentable items (scoped to operator)
  PUT    /api/inventory/banquet-items/{item_id}                → edit
  DELETE /api/inventory/banquet-items/{item_id}                → soft-delete (is_active=false)
"""

import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from config.database import get_database
from middleware.auth import get_current_active_user
from models.inventory import (
    InventoryHold,
    InventoryHoldStatus,
    InventoryUnitStatus,
    BanquetItem,
)
from utils.permissions import require_any_permission

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

# Permission shortcuts — operators get scoped permission via `operator.services.*`,
# admins get vertical-specific permissions, super-admin bypasses everything.
_VIEW_PERMS = ["banquets.view", "car_rental.view", "operator.services.view", "services.view"]
_MANAGE_PERMS = ["banquets.edit", "car_rental.edit", "operator.services.edit", "services.manage"]
_CREATE_PERMS = ["banquets.create", "car_rental.create", "operator.services.create", "services.manage"]
_DELETE_PERMS = ["banquets.delete", "car_rental.delete", "operator.services.delete", "services.manage"]


# ---------------------------------------------------------------------------
# Holds
# ---------------------------------------------------------------------------

class HoldCreate(BaseModel):
    entity_type: str
    entity_id: str
    booking_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    unit_ids: List[str] = []
    quantity: int = 1
    start_date: Optional[str] = None
    end_date: Optional[str] = None


async def _entity_available_units(db, entity_type: str, entity_id: str) -> int:
    """Computes available_units = total_units - active reservations (reserved+out)."""
    if entity_type == "car_rental":
        doc = await db.car_rentals.find_one({"_id": entity_id})
    elif entity_type == "banquet_item":
        doc = await db.banquet_items.find_one({"_id": entity_id})
    else:
        return 0
    if not doc:
        return 0
    total = doc.get("total_units") or 0
    active_holds = await db.inventory_holds.find({
        "entity_id": entity_id,
        "status": {"$in": [InventoryHoldStatus.RESERVED.value, InventoryHoldStatus.OUT.value]}
    }).to_list(None)
    reserved_qty = sum((h.get("quantity") or 0) for h in active_holds)
    return max(0, total - reserved_qty)


async def _refresh_available(db, entity_type: str, entity_id: str) -> None:
    avail = await _entity_available_units(db, entity_type, entity_id)
    coll = "car_rentals" if entity_type == "car_rental" else "banquet_items"
    await db[coll].update_one(
        {"_id": entity_id},
        {"$set": {"available_units": avail, "updated_at": datetime.utcnow()}}
    )


@router.post("/holds")
async def create_hold(payload: HoldCreate, current_user: dict = Depends(get_current_active_user)):
    """Create a rental hold. Called by booking flows on success.

    The endpoint is intentionally tolerant of an anonymous customer — we record the
    booking_id and the inventory hold so the operator can track it from the dashboard.
    """
    db = get_database()
    entity_coll = "car_rentals" if payload.entity_type == "car_rental" else "banquet_items"
    entity = await db[entity_coll].find_one({"_id": payload.entity_id})
    if not entity:
        raise HTTPException(status_code=404, detail=f"{payload.entity_type} not found")

    avail = await _entity_available_units(db, payload.entity_type, payload.entity_id)
    if avail < payload.quantity:
        raise HTTPException(status_code=409, detail=f"Only {avail} units available")

    hold = {
        "_id": str(uuid.uuid4()),
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "operator_id": entity.get("operator_id"),
        "booking_id": payload.booking_id,
        "customer_id": payload.customer_id or (current_user.get("_id") if current_user else None),
        "customer_name": payload.customer_name or (current_user.get("name") if current_user else None),
        "unit_ids": payload.unit_ids,
        "quantity": payload.quantity,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "status": InventoryHoldStatus.RESERVED.value,
        "damaged_quantity": 0,
        "damage_fee": 0.0,
        "damage_description": None,
        "operator_note": None,
        # Denormalised fields for fast operator-dashboard rendering.
        "item_name": entity.get("name"),
        "unit_price": float(entity.get("unit_price") or entity.get("base_price") or 0),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.inventory_holds.insert_one(hold)
    await _refresh_available(db, payload.entity_type, payload.entity_id)
    return {"hold_id": hold["_id"], "status": "reserved"}


@router.get("/holds")
async def list_holds(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_any_permission(_VIEW_PERMS)),
):
    db = get_database()
    q = {}
    if current_user.get("role") not in ("admin", "super_admin"):
        q["operator_id"] = current_user.get("operator_id") or current_user.get("_id")
    if entity_type:
        q["entity_type"] = entity_type
    if entity_id:
        q["entity_id"] = entity_id
    if status:
        q["status"] = status
    holds = await db.inventory_holds.find(q).sort("created_at", -1).to_list(200)

    # Backfill `item_name`/`unit_price` for legacy holds created before the
    # denormalisation was added. Best-effort — only one round-trip per
    # missing parent doc.
    missing_names = {h["entity_id"] for h in holds if not h.get("item_name")}
    name_map = {}
    if missing_names:
        async for it in db.banquet_items.find({"_id": {"$in": list(missing_names)}}, {"_id": 1, "name": 1, "unit_price": 1}):
            name_map[it["_id"]] = it
        async for it in db.car_rentals.find({"_id": {"$in": list(missing_names)}}, {"_id": 1, "name": 1, "base_price": 1}):
            name_map.setdefault(it["_id"], {"name": it.get("name"), "unit_price": it.get("base_price")})

    for h in holds:
        h["id"] = h.pop("_id", None)
        if not h.get("item_name") and h["entity_id"] in name_map:
            h["item_name"] = name_map[h["entity_id"]].get("name")
        if not h.get("unit_price") and h["entity_id"] in name_map:
            h["unit_price"] = float(name_map[h["entity_id"]].get("unit_price") or 0)
    return {"holds": holds, "total": len(holds)}


@router.get("/active-rentals")
async def active_rentals_summary(
    entity_type: Optional[str] = "banquet_item",
    current_user: dict = Depends(require_any_permission(_VIEW_PERMS)),
):
    """Compact operator-dashboard summary: counts by hold status + total damage fees collected."""
    db = get_database()
    q = {}
    if current_user.get("role") not in ("admin", "super_admin"):
        q["operator_id"] = current_user.get("operator_id") or current_user.get("_id")
    if entity_type:
        q["entity_type"] = entity_type
    holds = await db.inventory_holds.find(q).to_list(None)
    by_status = {"reserved": 0, "out": 0, "returned": 0, "damaged": 0, "cancelled": 0}
    total_units_out = 0
    total_damage_fees = 0.0
    pending_return = 0
    for h in holds:
        s = h.get("status") or "reserved"
        by_status[s] = by_status.get(s, 0) + 1
        qty = int(h.get("quantity") or 0)
        if s in ("reserved", "out"):
            total_units_out += qty
            pending_return += 1
        total_damage_fees += float(h.get("damage_fee") or 0)
    return {
        "by_status": by_status,
        "total_holds": len(holds),
        "pending_return": pending_return,
        "total_units_currently_out": total_units_out,
        "total_damage_fees_collected": round(total_damage_fees, 2),
    }


class ReturnPayload(BaseModel):
    damaged_quantity: int = 0
    damage_fee: float = 0.0
    damage_description: Optional[str] = None
    operator_note: Optional[str] = None


@router.post("/holds/{hold_id}/confirm-return")
async def confirm_return(
    hold_id: str,
    payload: ReturnPayload,
    current_user: dict = Depends(require_any_permission(_MANAGE_PERMS)),
):
    """Operator confirms a return. Damaged units are removed from total_units
    so they no longer count as stock; an optional damage_fee is appended to
    the linked order's invoice as a `damage_charge` line item.
    """
    db = get_database()
    hold = await db.inventory_holds.find_one({"_id": hold_id})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    damaged = max(0, payload.damaged_quantity)
    if damaged > hold.get("quantity", 0):
        raise HTTPException(status_code=400, detail="damaged_quantity exceeds hold quantity")
    damage_fee = max(0.0, float(payload.damage_fee or 0))

    new_status = (
        InventoryHoldStatus.DAMAGED.value
        if damaged > 0 and damaged >= hold.get("quantity", 0)
        else InventoryHoldStatus.RETURNED.value
    )

    await db.inventory_holds.update_one(
        {"_id": hold_id},
        {"$set": {
            "status": new_status,
            "returned_at": datetime.utcnow(),
            "damaged_quantity": damaged,
            "damage_fee": damage_fee,
            "damage_description": payload.damage_description,
            "operator_note": payload.operator_note,
            "updated_at": datetime.utcnow(),
        }}
    )

    # Damaged units are removed from total_units so they no longer count as stock.
    if damaged > 0:
        entity_coll = "car_rentals" if hold["entity_type"] == "car_rental" else "banquet_items"
        await db[entity_coll].update_one(
            {"_id": hold["entity_id"]},
            {"$inc": {"total_units": -damaged}}
        )

    # If a damage fee was charged AND the hold is linked to an order, append a
    # `damage_charge` to the order's invoice so the customer sees it on receipts
    # and the operator's revenue report counts it.
    if damage_fee > 0 and hold.get("booking_id"):
        order = await db.orders.find_one({"_id": hold["booking_id"]})
        if not order:
            order = await db.orders.find_one({"service_booking_id": hold["booking_id"]})
        if order:
            damage_line = {
                "kind": "damage_charge",
                "hold_id": hold_id,
                "item_name": hold.get("item_name") or "Damaged item",
                "damaged_quantity": damaged,
                "amount": damage_fee,
                "description": payload.damage_description,
                "added_at": datetime.utcnow().isoformat(),
            }
            await db.orders.update_one(
                {"_id": order["_id"]},
                {
                    "$inc": {"total_amount": damage_fee},
                    "$push": {"booking_details.damage_charges": damage_line},
                    "$set": {"updated_at": datetime.utcnow()},
                }
            )
            # Also annotate the banquet booking with the same line for parity.
            await db.banquet_bookings.update_one(
                {"_id": order.get("service_booking_id") or order["_id"]},
                {
                    "$inc": {"total_price": damage_fee},
                    "$push": {"damage_charges": damage_line},
                    "$set": {"updated_at": datetime.utcnow()},
                }
            )

    await _refresh_available(db, hold["entity_type"], hold["entity_id"])
    return {
        "hold_id": hold_id,
        "status": new_status,
        "damaged_units_removed_from_stock": damaged,
        "damage_fee_applied": damage_fee,
    }


@router.post("/holds/{hold_id}/cancel")
async def cancel_hold(
    hold_id: str,
    current_user: dict = Depends(require_any_permission(_MANAGE_PERMS)),
):
    db = get_database()
    hold = await db.inventory_holds.find_one({"_id": hold_id})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    await db.inventory_holds.update_one(
        {"_id": hold_id},
        {"$set": {"status": InventoryHoldStatus.CANCELLED.value, "updated_at": datetime.utcnow()}}
    )
    await _refresh_available(db, hold["entity_type"], hold["entity_id"])
    return {"hold_id": hold_id, "status": "cancelled"}


@router.post("/holds/{hold_id}/mark-out")
async def mark_hold_out(
    hold_id: str,
    current_user: dict = Depends(require_any_permission(_MANAGE_PERMS)),
):
    """Operator confirms the units have physically left the warehouse for the event.
    Moves the hold from `reserved` → `out`. Does NOT change `available_units`
    (still reserved). Purely a status update used by the operator UI."""
    db = get_database()
    hold = await db.inventory_holds.find_one({"_id": hold_id})
    if not hold:
        raise HTTPException(status_code=404, detail="Hold not found")
    if hold.get("status") not in (InventoryHoldStatus.RESERVED.value, InventoryHoldStatus.OUT.value):
        raise HTTPException(status_code=400, detail=f"Hold is {hold.get('status')} — only reserved holds can be marked out.")
    await db.inventory_holds.update_one(
        {"_id": hold_id},
        {"$set": {"status": InventoryHoldStatus.OUT.value, "updated_at": datetime.utcnow()}}
    )
    return {"hold_id": hold_id, "status": "out"}


class StockAdjustPayload(BaseModel):
    delta: int                              # positive = restocked, negative = lost/written-off
    reason: Optional[str] = None


@router.post("/banquet-items/{item_id}/adjust-stock")
async def adjust_banquet_item_stock(
    item_id: str,
    payload: StockAdjustPayload,
    current_user: dict = Depends(require_any_permission(_MANAGE_PERMS)),
):
    """Manual stock adjustment outside of a booking lifecycle. Use for:
    - Operator buys more chairs:  delta = +N
    - Operator writes off lost/stolen inventory: delta = -N
    The adjustment is recorded in `inventory_adjustments` for audit.
    """
    db = get_database()
    item = await db.banquet_items.find_one({"_id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    delta = int(payload.delta or 0)
    if delta == 0:
        raise HTTPException(status_code=400, detail="delta must be non-zero")
    new_total = max(0, int(item.get("total_units") or 0) + delta)
    await db.banquet_items.update_one(
        {"_id": item_id},
        {"$set": {"total_units": new_total, "updated_at": datetime.utcnow()}}
    )
    await db.inventory_adjustments.insert_one({
        "_id": str(uuid.uuid4()),
        "entity_type": "banquet_item",
        "entity_id": item_id,
        "operator_id": item.get("operator_id"),
        "actor_user_id": current_user.get("_id"),
        "actor_name": current_user.get("name"),
        "delta": delta,
        "new_total": new_total,
        "reason": payload.reason,
        "created_at": datetime.utcnow(),
    })
    await _refresh_available(db, "banquet_item", item_id)
    return {"item_id": item_id, "new_total_units": new_total, "delta_applied": delta}


# ---------------------------------------------------------------------------
# Stock summary
# ---------------------------------------------------------------------------

@router.get("/{entity_type}/{entity_id}/stock")
async def stock_summary(entity_type: str, entity_id: str):
    db = get_database()
    entity_coll = "car_rentals" if entity_type == "car_rental" else "banquet_items"
    entity = await db[entity_coll].find_one({"_id": entity_id})
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    total = entity.get("total_units") or 0
    holds = await db.inventory_holds.find({"entity_id": entity_id}).to_list(None)
    by_status = {}
    for h in holds:
        by_status[h["status"]] = by_status.get(h["status"], 0) + (h.get("quantity") or 0)
    available = await _entity_available_units(db, entity_type, entity_id)
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "total_units": total,
        "available_units": available,
        "holds_by_status": by_status,
    }


# ---------------------------------------------------------------------------
# Banquet items CRUD
# ---------------------------------------------------------------------------

class BanquetItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "other"
    unit_price: float = 0.0
    images: List[str] = []
    total_units: int = 0
    policies: List[str] = []
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


class BanquetItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    images: Optional[List[str]] = None
    total_units: Optional[int] = None
    policies: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.post("/banquet-items")
async def create_banquet_item(payload: BanquetItemCreate, current_user: dict = Depends(require_any_permission(_MANAGE_PERMS))):
    db = get_database()
    op_id = payload.operator_id or current_user.get("operator_id") or current_user.get("_id")
    op_name = payload.operator_name
    if not op_name and op_id:
        op = await db.operators.find_one({"_id": op_id})
        op_name = (op or {}).get("name")
    item = {
        "_id": str(uuid.uuid4()),
        **payload.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": op_id,
        "operator_name": op_name,
        "available_units": payload.total_units,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.banquet_items.insert_one(item)
    return {"id": item["_id"], "message": "Banquet item created"}


@router.get("/banquet-items")
async def list_banquet_items(
    operator_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    city: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    db = get_database()
    q = {}
    role = (current_user or {}).get("role")
    if operator_id:
        q["operator_id"] = operator_id
    elif role in ("operator", "staff"):
        # Only true operator/staff roles are scoped to their own inventory.
        # Customers, admins and super-admins see all items unless they pass
        # an explicit ?operator_id filter (admins for ops dashboards).
        q["operator_id"] = current_user.get("operator_id") or current_user.get("_id")
    if is_active is not None:
        q["is_active"] = is_active
    items = await db.banquet_items.find(q).sort("created_at", -1).to_list(500)

    # Optional city filter — banquet_items don't store a city directly, so
    # we route through the parent operator's primary city when provided.
    if city and items:
        op_ids = list({it.get("operator_id") for it in items if it.get("operator_id")})
        ops_with_city = {op["_id"] async for op in db.operators.find(
            {"_id": {"$in": op_ids}, "city": {"$regex": city, "$options": "i"}},
            {"_id": 1},
        )}
        items = [it for it in items if it.get("operator_id") in ops_with_city]

    for it in items:
        it["id"] = it.pop("_id", None)
    return {"items": items, "total": len(items)}


@router.put("/banquet-items/{item_id}")
async def update_banquet_item(
    item_id: str,
    payload: BanquetItemUpdate,
    current_user: dict = Depends(require_any_permission(_MANAGE_PERMS)),
):
    db = get_database()
    item = await db.banquet_items.find_one({"_id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if "total_units" in update:
        # When total_units changes, recompute available_units immediately.
        update["available_units"] = update["total_units"]
    update["updated_at"] = datetime.utcnow()
    await db.banquet_items.update_one({"_id": item_id}, {"$set": update})
    return {"id": item_id, "message": "Banquet item updated"}


@router.delete("/banquet-items/{item_id}")
async def delete_banquet_item(item_id: str, current_user: dict = Depends(require_any_permission(_MANAGE_PERMS))):
    db = get_database()
    await db.banquet_items.update_one({"_id": item_id}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}})
    return {"id": item_id, "message": "Banquet item deactivated"}

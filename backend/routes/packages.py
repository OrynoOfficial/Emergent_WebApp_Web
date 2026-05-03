"""
Package (physical shipment / logistics) routes.

Each "package" record in db.packages now represents a physical shipment
created/managed by a logistics operator: sender + receiver + dimensions +
weight + tracking + status.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.package import (
    PhysicalPackageCreate,
    PhysicalPackageUpdate,
    PackageStatus,
    PaymentStatus,
)
from typing import Optional, List
from datetime import datetime
import uuid
import secrets
import string

router = APIRouter(prefix="/api/packages", tags=["Packages"])


def _generate_tracking_number() -> str:
    """ORYNO-XXXXXX (uppercase alphanumeric)"""
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(8))
    return f"ORYNO-{suffix}"


def _normalize(pkg: dict) -> dict:
    """Convert internal _id to id and clean ObjectId references."""
    pkg = dict(pkg)
    pkg["id"] = str(pkg.pop("_id", ""))
    return pkg


_STATUS_LABELS = {
    "pending":          {"title": "Pending Pickup",      "msg": "Awaiting pickup from sender"},
    "picked_up":        {"title": "Package Received",    "msg": "Package collected from sender"},
    "in_transit":       {"title": "In Transit",          "msg": "Package is on its way"},
    "out_for_delivery": {"title": "Out for Delivery",    "msg": "Package is out for delivery to recipient"},
    "delivered":        {"title": "Delivered",           "msg": "Package successfully delivered"},
    "cancelled":        {"title": "Cancelled",           "msg": "Shipment was cancelled"},
    "returned":         {"title": "Returned",            "msg": "Package returned to sender"},
}

# Map our internal statuses to the public widget's status codes
_PUBLIC_STATUS_MAP = {
    "pending":          "pending",
    "picked_up":        "received",
    "in_transit":       "in_transit",
    "out_for_delivery": "out_for_delivery",
    "delivered":        "delivered",
    "cancelled":        "delayed",
    "returned":         "delayed",
}


@router.post("/")
async def create_package(
    package_data: PhysicalPackageCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create a new physical package booking.

    Two flows:
    1. Customer booking against an operator's service offering (sets
       `package_service_id`) — price is computed server-side from the service.
    2. Operator manually creating a shipment record (no service id) — uses the
       provided price, operator falls back to the current user's operator_id.
    """
    db = get_database()

    # Resolve the booking's service & operator
    service = None
    if package_data.package_service_id:
        service = await db.package_services.find_one({"_id": package_data.package_service_id})
        if not service:
            raise HTTPException(status_code=404, detail="Selected package service not found")
        if service.get("status") != "active":
            raise HTTPException(status_code=400, detail="Selected package service is not active")

    if service:
        # Server-calculate price from the service's pricing model
        from routes.package_services import calculate_price
        dims = package_data.dimensions
        calc = calculate_price(
            service,
            package_data.weight_kg or 0,
            (dims.length_cm if dims else 0) or 0,
            (dims.width_cm if dims else 0) or 0,
            (dims.height_cm if dims else 0) or 0,
        )
        if not calc["ok"]:
            raise HTTPException(status_code=400, detail=calc["reason"])
        price = calc["price"]
        operator_id = service.get("operator_id")
        operator_name = service.get("operator_name", "")
        carrier = package_data.carrier or service.get("operator_name", "")
        # Estimated delivery from now + delivery_time_hours if not provided
        est = package_data.estimated_delivery
        if not est and service.get("delivery_time_hours"):
            from datetime import timedelta
            est = (datetime.utcnow() + timedelta(hours=int(service["delivery_time_hours"]))).date().isoformat()
    else:
        # Operator manual entry path — keep existing fallback behaviour
        if current_user.get("role") not in ("admin", "super_admin", "operator"):
            raise HTTPException(status_code=403, detail="Only operators can manually create shipments without a service")
        price = package_data.price or 0
        operator_id = package_data.operator_id or current_user.get("operator_id")
        operator_name = package_data.operator_name or current_user.get("operator_name", "")
        carrier = package_data.carrier
        est = package_data.estimated_delivery

    now = datetime.utcnow()
    initial_event = {
        "status": PackageStatus.PENDING.value,
        "title": "Package registered",
        "description": f"Shipment created and awaiting pickup at {package_data.origin_city}",
        "location": package_data.origin_city,
        "timestamp": now,
    }

    package = {
        "_id": str(uuid.uuid4()),
        "tracking_number": _generate_tracking_number(),
        "package_service_id": package_data.package_service_id,
        **package_data.dict(exclude={
            "operator_id", "operator_name", "package_service_id",
            "estimated_delivery", "carrier", "price", "customer_id",
        }),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "carrier": carrier,
        "estimated_delivery": est,
        "price": price,
        "customer_id": package_data.customer_id or current_user.get("id") or current_user.get("_id"),
        "status": PackageStatus.PENDING.value,
        "current_location": package_data.origin_city,
        "status_history": [initial_event],
        "created_at": now,
        "updated_at": now,
    }

    await db.packages.insert_one(package)
    return {
        "message": "Package booking created",
        "package_id": package["_id"],
        "tracking_number": package["tracking_number"],
        "price": price,
    }


@router.get("/")
async def get_packages(
    search: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    package_type: Optional[str] = None,
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """List physical packages with optional filters."""
    db = get_database()
    query: dict = {}

    if operator_id:
        query["operator_id"] = operator_id
    if status:
        query["status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    if package_type:
        query["package_type"] = package_type
    if origin_city:
        query["origin_city"] = {"$regex": origin_city, "$options": "i"}
    if destination_city:
        query["destination_city"] = {"$regex": destination_city, "$options": "i"}
    if search:
        query["$or"] = [
            {"tracking_number": {"$regex": search, "$options": "i"}},
            {"sender.name": {"$regex": search, "$options": "i"}},
            {"receiver.name": {"$regex": search, "$options": "i"}},
            {"sender.phone": {"$regex": search, "$options": "i"}},
            {"receiver.phone": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.packages.find(query).sort("created_at", -1).skip(skip).limit(limit)
    packages = [_normalize(p) for p in await cursor.to_list(limit)]
    total = await db.packages.count_documents(query)
    return {"packages": packages, "total": total}


@router.get("/track/{tracking_number}")
async def track_package(tracking_number: str):
    """
    PUBLIC tracking endpoint by tracking number.

    Returns a payload shaped for the public Track widget on the marketing site:
      {
        tracking_number, status,            # mapped public status code
        description,                         # contents description
        origin, destination,
        estimated_delivery, weight,
        current_location, vehicle,
        events: [{ status, title, description, timestamp, location }]
      }
    """
    db = get_database()
    # Accept tracking numbers with leading/trailing whitespace and any casing
    # (the Base 44 widget often sends trimmed-but-not-uppercased values).
    tn = (tracking_number or "").strip().upper()
    pkg = await db.packages.find_one({"tracking_number": tn})
    if not pkg:
        # Case-insensitive fallback for legacy numbers stored in mixed case
        pkg = await db.packages.find_one({
            "tracking_number": {"$regex": f"^{tn}$", "$options": "i"}
        })
    if not pkg:
        raise HTTPException(status_code=404, detail="No package found with this tracking number.")

    raw_status = pkg.get("status", "pending")
    public_status = _PUBLIC_STATUS_MAP.get(raw_status, raw_status)

    # Build events array (newest last)
    events = []
    for ev in pkg.get("status_history", []) or []:
        ev_status = ev.get("status", "")
        events.append({
            "status": _PUBLIC_STATUS_MAP.get(ev_status, ev_status),
            "title": ev.get("title") or _STATUS_LABELS.get(ev_status, {}).get("title", ev_status),
            "description": ev.get("description") or "",
            "timestamp": ev.get("timestamp").isoformat() if hasattr(ev.get("timestamp"), "isoformat") else ev.get("timestamp"),
            "location": ev.get("location") or "",
            "photos": ev.get("photos") or [],
        })
    # Fallback: synthesize a single event from current state
    if not events:
        events.append({
            "status": public_status,
            "title": _STATUS_LABELS.get(raw_status, {}).get("title", raw_status),
            "description": _STATUS_LABELS.get(raw_status, {}).get("msg", ""),
            "timestamp": (pkg.get("updated_at") or pkg.get("created_at")).isoformat() if hasattr((pkg.get("updated_at") or pkg.get("created_at")), "isoformat") else None,
            "location": pkg.get("current_location") or pkg.get("origin_city") or "",
        })

    est = pkg.get("estimated_delivery")
    return {
        "tracking_number": pkg.get("tracking_number"),
        "status": public_status,
        "description": pkg.get("description") or f"{(pkg.get('package_type') or 'parcel').replace('_', ' ').title()}",
        "origin": pkg.get("origin_city"),
        "destination": pkg.get("destination_city"),
        "estimated_delivery": est.isoformat() if hasattr(est, "isoformat") else est,
        "weight": pkg.get("weight_kg") or 0,
        "current_location": pkg.get("current_location") or "",
        "vehicle": pkg.get("carrier") or pkg.get("operator_name") or "",
        "sender_location": pkg.get("origin_city"),
        "receiver_location": pkg.get("destination_city"),
        "package_photos": pkg.get("package_photos") or [],
        "delivery_photos": pkg.get("delivery_photos") or [],
        "events": events,
    }


@router.get("/{package_id}")
async def get_package(
    package_id: str,
    current_user: dict = Depends(require_any_permission(
        ["packages.view", "packages.edit", "operator.services.view", "operator.services.edit"]
    )),
):
    """Get package details by id. Authenticated only — returns `internal_notes`
    which must NOT be exposed publicly. Public tracking uses /track/{tn}."""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    if current_user.get("role") == "operator" and package.get("operator_id") != current_user.get("operator_id"):
        # Strip internal_notes for cross-operator reads (defensive)
        package = dict(package)
        package.pop("internal_notes", None)
    return _normalize(package)


@router.put("/{package_id}")
async def update_package(
    package_id: str,
    package_data: PhysicalPackageUpdate,
    current_user: dict = Depends(require_any_permission(["packages.edit", "operator.services.edit"]))
):
    """Update a package (status, payment, contacts, etc.)."""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if current_user["role"] == "operator" and package.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in package_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()

    await db.packages.update_one({"_id": package_id}, {"$set": update_data})
    return {"message": "Package updated"}


@router.post("/{package_id}/status")
async def update_status(
    package_id: str,
    status: PackageStatus,
    location: Optional[str] = None,
    note: Optional[str] = None,
    delivery_photos: Optional[List[str]] = Body(default=None, embed=True),
    current_user: dict = Depends(require_any_permission(["packages.edit", "operator.services.edit"]))
):
    """Quick endpoint to advance package status. Pushes a status_history event.

    When `status == 'delivered'`, a list of `delivery_photos` (3 URLs) MAY be sent
    in the body and is persisted on the package as proof-of-delivery. They are
    also attached to the status_history event and exposed by the public
    /track/{tracking_number} endpoint.
    """
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if current_user["role"] == "operator" and package.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Enforce 3 PoD photos when marking as delivered
    if status == PackageStatus.DELIVERED:
        photos = list(delivery_photos or [])
        if len(photos) < 3:
            raise HTTPException(
                status_code=400,
                detail="3 proof-of-delivery photos are required to mark a package as delivered.",
            )
        delivery_photos = photos[:3]
    else:
        delivery_photos = None  # don't accidentally store on non-delivery transitions

    now = datetime.utcnow()
    label = _STATUS_LABELS.get(status.value, {})
    event = {
        "status": status.value,
        "title": label.get("title", status.value.replace("_", " ").title()),
        "description": note or label.get("msg", ""),
        "location": location or package.get("current_location") or package.get("destination_city"),
        "timestamp": now,
    }
    if delivery_photos:
        event["photos"] = delivery_photos

    update = {
        "updated_at": now,
    }

    # Stage ordering — once a shipment has advanced past a stage the operator
    # can NOT go back to re-edit it. Reject any attempt to re-save a status at
    # or below the current one (defense-in-depth; the UI also locks past
    # stages, but a direct API call should also be rejected).
    _STATUS_ORDER = [
        "pending", "received", "picked_up", "in_transit",
        "out_for_delivery", "delivered", "delayed", "cancelled", "returned",
    ]
    cur_idx = _STATUS_ORDER.index(package.get("status")) if package.get("status") in _STATUS_ORDER else -1
    new_idx = _STATUS_ORDER.index(status.value) if status.value in _STATUS_ORDER else -1
    if cur_idx != -1 and new_idx != -1 and new_idx <= cur_idx:
        raise HTTPException(
            status_code=400,
            detail=f"Shipment is already at '{package.get('status')}'. You cannot move back to or re-edit '{status.value}'."
        )
    if cur_idx == -1 or new_idx >= cur_idx:
        update["status"] = status.value
    if location:
        update["current_location"] = location
    if delivery_photos:
        update["delivery_photos"] = delivery_photos

    await db.packages.update_one(
        {"_id": package_id},
        {"$set": update, "$push": {"status_history": event}},
    )
    return {"message": "Status updated", "status": update.get("status", package.get("status")), "delivery_photos": delivery_photos or []}


@router.delete("/{package_id}")
async def delete_package(
    package_id: str,
    current_user: dict = Depends(require_any_permission(["packages.delete", "operator.services.delete"]))
):
    """Delete a package record."""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if current_user["role"] == "operator" and package.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.packages.delete_one({"_id": package_id})
    return {"message": "Package deleted"}


@router.get("/management/my-services")
async def get_my_packages(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_active_user),
):
    """Operator-scoped package list (used by management dashboards)."""
    from middleware.auth import get_operator_filter

    db = get_database()
    query = get_operator_filter(current_user)

    if search:
        query["$or"] = [
            {"tracking_number": {"$regex": search, "$options": "i"}},
            {"sender.name": {"$regex": search, "$options": "i"}},
            {"receiver.name": {"$regex": search, "$options": "i"}},
        ]
    if status:
        query["status"] = status

    cursor = db.packages.find(query).sort("created_at", -1).skip(skip).limit(limit)
    packages = [_normalize(p) for p in await cursor.to_list(limit)]
    total = await db.packages.count_documents(query)
    return {
        "packages": packages,
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"],
    }

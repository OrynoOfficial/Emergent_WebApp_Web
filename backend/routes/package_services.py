"""
Package Service Offerings — operator-published package pickup & delivery services.

Marketplace model:
- Operators create service offerings with route (origin → destination), pricing model
  (tiered or per-kg), max weight/dimensions, delivery time, features
- Customers search these offerings and book one → creates a row in db.packages
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.package import (
    PackageServiceOfferingCreate,
    PackageServiceOfferingUpdate,
    PricingModel,
)
from typing import Optional, List
from datetime import datetime
import uuid
import re
import unicodedata

router = APIRouter(prefix="/api/package-services", tags=["Package Services"])


def _accent_insensitive_regex(value: str) -> str:
    """Make city searches accent-insensitive in either direction:
    typing 'Yaounde' OR 'Yaoundé' should both match a stored 'Yaounde'/'Yaoundé'."""
    if not value:
        return value
    # First strip accents from the input so we always work from the bare ascii char
    stripped = unicodedata.normalize('NFD', value)
    stripped = ''.join(ch for ch in stripped if unicodedata.category(ch) != 'Mn')
    char_map = {
        'a': '[aàáâãäå]', 'e': '[eèéêë]', 'i': '[iìíîï]',
        'o': '[oòóôõö]', 'u': '[uùúûü]', 'c': '[cç]', 'n': '[nñ]',
    }
    pattern = ''
    for ch in stripped.lower():
        pattern += char_map.get(ch, re.escape(ch))
    return pattern


def _normalize(svc: dict) -> dict:
    """Convert MongoDB _id -> id."""
    svc = dict(svc)
    svc["id"] = str(svc.pop("_id", ""))
    return svc


def calculate_price(service: dict, weight_kg: float, length_cm: float = 0,
                    width_cm: float = 0, height_cm: float = 0) -> dict:
    """
    Compute the price for a shipment against a service offering.
    Returns: {"price": float, "ok": bool, "reason": str}
    """
    # Weight cap
    max_w = service.get("max_weight_kg", 0)
    if max_w and weight_kg > max_w:
        return {"price": 0, "ok": False, "reason": f"Exceeds max weight ({max_w} kg)"}

    # Dimensions cap (only check if provided)
    if length_cm or width_cm or height_cm:
        for dim_name, dim_v, max_v in [
            ("length", length_cm, service.get("max_length_cm", 0)),
            ("width", width_cm, service.get("max_width_cm", 0)),
            ("height", height_cm, service.get("max_height_cm", 0)),
        ]:
            if max_v and dim_v > max_v:
                return {"price": 0, "ok": False, "reason": f"Exceeds max {dim_name} ({max_v} cm)"}

    pricing_model = service.get("pricing_model", PricingModel.TIERED.value)

    if pricing_model == PricingModel.PER_KG.value:
        base = service.get("base_price", 0) or 0
        per_kg = service.get("per_kg_rate", 0) or 0
        return {"price": base + per_kg * weight_kg, "ok": True, "reason": ""}

    # Tiered
    tiers = service.get("tiers", []) or []
    for tier in tiers:
        wmin = tier.get("weight_min_kg", 0) or 0
        wmax = tier.get("weight_max_kg", 0) or 0
        if wmin <= weight_kg <= wmax:
            # Check size limits per tier (optional)
            if length_cm or width_cm or height_cm:
                if tier.get("max_length_cm") and length_cm > tier["max_length_cm"]:
                    continue
                if tier.get("max_width_cm") and width_cm > tier["max_width_cm"]:
                    continue
                if tier.get("max_height_cm") and height_cm > tier["max_height_cm"]:
                    continue
            return {"price": tier.get("price", 0) or 0, "ok": True, "reason": ""}

    return {"price": 0, "ok": False, "reason": "No matching tier for this weight/size"}


# ========== Operator CRUD ==========

@router.post("/")
async def create_service(
    data: PackageServiceOfferingCreate,
    current_user: dict = Depends(require_any_permission(["packages.create", "operator.services.create"]))
):
    """Operator creates a new package service offering.

    Newly-created offerings always start in **pending** status and need to be
    approved by an admin / super-admin via the Validation page before they
    show up in the public marketplace search.
    """
    db = get_database()
    operator_id = data.operator_id or current_user.get("operator_id")
    operator_name = data.operator_name or current_user.get("operator_name", "")

    payload = data.dict(exclude={"operator_id", "operator_name", "status"})
    role = current_user.get("role")
    # Admin/super_admin can fast-track to active, everyone else goes through approval
    initial_status = "active" if role in ("admin", "super_admin") else "pending"

    service = {
        "_id": str(uuid.uuid4()),
        **payload,
        "status": initial_status,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "created_by": current_user.get("_id") or current_user.get("id"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.package_services.insert_one(service)
    return {
        "message": "Service offering submitted for admin approval" if initial_status == "pending" else "Service offering created",
        "service_id": service["_id"],
        "status": initial_status,
    }


@router.get("/")
async def list_services(
    operator_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_active_user),
):
    """List service offerings (operator-scoped for non-admins)."""
    db = get_database()
    query: dict = {}

    role = current_user.get("role")
    if role not in ("super_admin", "admin"):
        # Operators see only their own offerings
        op_id = current_user.get("operator_id")
        if op_id:
            query["operator_id"] = op_id
    elif operator_id:
        query["operator_id"] = operator_id

    if status_filter:
        query["status"] = status_filter

    cursor = db.package_services.find(query).sort("created_at", -1).skip(skip).limit(limit)
    services = [_normalize(s) for s in await cursor.to_list(limit)]
    total = await db.package_services.count_documents(query)
    return {"services": services, "total": total}


@router.get("/search")
async def search_services(
    origin_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    weight_kg: float = Query(0, ge=0),
    length_cm: float = Query(0, ge=0),
    width_cm: float = Query(0, ge=0),
    height_cm: float = Query(0, ge=0),
    package_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """
    PUBLIC search: customer enters origin/destination/weight/dimensions; system
    returns active offerings that match, with **per-offering calculated price**.
    """
    db = get_database()
    query: dict = {"status": "active"}

    if origin_city:
        query["origin_city"] = {"$regex": _accent_insensitive_regex(origin_city), "$options": "i"}
    if destination_city:
        query["destination_city"] = {"$regex": _accent_insensitive_regex(destination_city), "$options": "i"}
    if package_type:
        query["$or"] = [
            {"accepted_types": {"$in": [package_type]}},
            {"accepted_types": {"$size": 0}},  # empty list = accepts everything
        ]

    cursor = db.package_services.find(query).skip(skip).limit(limit)
    raw_services = await cursor.to_list(limit)

    enriched = []
    for s in raw_services:
        normalized = _normalize(s)
        price_calc = calculate_price(s, weight_kg, length_cm, width_cm, height_cm)
        # Only include services that can fulfill the shipment (or weight=0 = browsing)
        if weight_kg > 0 and not price_calc["ok"]:
            continue
        normalized["calculated_price"] = price_calc["price"]
        normalized["price_ok"] = price_calc["ok"]
        normalized["price_reason"] = price_calc["reason"]
        enriched.append(normalized)

    # Sort by price (lowest first), then delivery time
    enriched.sort(key=lambda x: (x.get("calculated_price", 0) or 0, x.get("delivery_time_hours", 9999)))

    return {"services": enriched, "total": len(enriched)}


@router.get("/{service_id}")
async def get_service(service_id: str):
    """Get a single service offering (public view for booking page)."""
    db = get_database()
    service = await db.package_services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return _normalize(service)


@router.put("/{service_id}")
async def update_service(
    service_id: str,
    data: PackageServiceOfferingUpdate,
    current_user: dict = Depends(require_any_permission(["packages.edit", "operator.services.edit"]))
):
    """Operator updates their service offering."""
    db = get_database()
    service = await db.package_services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if current_user.get("role") == "operator" and service.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    # Operators cannot change activation status — that is admin-controlled via Validation
    if current_user.get("role") not in ("admin", "super_admin"):
        update_data.pop("status", None)
    update_data["updated_at"] = datetime.utcnow()
    await db.package_services.update_one({"_id": service_id}, {"$set": update_data})
    return {"message": "Service updated"}


@router.delete("/{service_id}")
async def delete_service(
    service_id: str,
    current_user: dict = Depends(require_any_permission(["packages.delete", "operator.services.delete"]))
):
    """Operator deletes their service offering."""
    db = get_database()
    service = await db.package_services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if current_user.get("role") == "operator" and service.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.package_services.delete_one({"_id": service_id})
    return {"message": "Service deleted"}


@router.post("/{service_id}/quote")
async def quote_price(
    service_id: str,
    weight_kg: float = Query(..., ge=0),
    length_cm: float = Query(0, ge=0),
    width_cm: float = Query(0, ge=0),
    height_cm: float = Query(0, ge=0),
):
    """
    PUBLIC quote endpoint — customer-side booking form calls this live as
    they type weight + dimensions to display the price.
    """
    db = get_database()
    service = await db.package_services.find_one({"_id": service_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    result = calculate_price(service, weight_kg, length_cm, width_cm, height_cm)
    return {
        "service_id": service_id,
        "weight_kg": weight_kg,
        "dimensions_cm": {"length": length_cm, "width": width_cm, "height": height_cm},
        **result,
    }

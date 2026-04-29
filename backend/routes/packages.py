"""
Package (physical shipment / logistics) routes.

Each "package" record in db.packages now represents a physical shipment
created/managed by a logistics operator: sender + receiver + dimensions +
weight + tracking + status.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.package import (
    PhysicalPackageCreate,
    PhysicalPackageUpdate,
    PackageStatus,
    PaymentStatus,
)
from typing import Optional
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


@router.post("/")
async def create_package(
    package_data: PhysicalPackageCreate,
    current_user: dict = Depends(require_any_permission(["packages.create", "operator.services.create"]))
):
    """Create a new physical package (shipment)."""
    db = get_database()

    operator_id = package_data.operator_id or current_user.get("operator_id")
    operator_name = package_data.operator_name or current_user.get("operator_name", "")

    package = {
        "_id": str(uuid.uuid4()),
        "tracking_number": _generate_tracking_number(),
        **package_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": PackageStatus.PENDING.value,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    await db.packages.insert_one(package)
    return {
        "message": "Package created",
        "package_id": package["_id"],
        "tracking_number": package["tracking_number"],
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
    """Public tracking endpoint by tracking number."""
    db = get_database()
    package = await db.packages.find_one({"tracking_number": tracking_number.upper()})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    return _normalize(package)


@router.get("/{package_id}")
async def get_package(package_id: str):
    """Get package details by id."""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
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
    current_user: dict = Depends(require_any_permission(["packages.edit", "operator.services.edit"]))
):
    """Quick endpoint to advance package status."""
    db = get_database()
    package = await db.packages.find_one({"_id": package_id})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    if current_user["role"] == "operator" and package.get("operator_id") != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.packages.update_one(
        {"_id": package_id},
        {"$set": {"status": status.value, "updated_at": datetime.utcnow()}},
    )
    return {"message": "Status updated", "status": status.value}


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

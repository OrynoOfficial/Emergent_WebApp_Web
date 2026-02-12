"""
Employee Access Scope Routes
Implements attribute-based scoping for platform employees
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.employee_scope import (
    EmployeeAccessScopeCreate, EmployeeAccessScopeUpdate,
    EmployeeScopeAssignmentCreate
)
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/employee-scopes", tags=["Employee Access Scopes"])


# ============== Access Scopes CRUD ==============

@router.get("")
async def list_access_scopes(
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("employee_scopes.view"))
):
    """List all employee access scopes"""
    db = get_database()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    
    scopes = await db.employee_access_scopes.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.employee_access_scopes.count_documents(query)
    
    # Add assignment count
    for scope in scopes:
        scope["assigned_users"] = await db.employee_scope_assignments.count_documents({
            "scope_id": scope["id"],
            "is_active": True
        })
    
    return {"scopes": scopes, "total": total, "skip": skip, "limit": limit}


@router.get("/{scope_id}")
async def get_access_scope(
    scope_id: str,
    current_user: dict = Depends(require_permission("employee_scopes.view"))
):
    """Get access scope details with assigned users"""
    db = get_database()
    
    scope = await db.employee_access_scopes.find_one({"id": scope_id}, {"_id": 0})
    if not scope:
        raise HTTPException(status_code=404, detail="Access scope not found")
    
    # Get assigned users
    assignments = await db.employee_scope_assignments.find(
        {"scope_id": scope_id, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    scope["assignments"] = assignments
    
    # Resolve attribute labels
    if scope.get("countries"):
        countries = await db.countries.find(
            {"code": {"$in": scope["countries"]}},
            {"_id": 0, "code": 1, "name": 1}
        ).to_list(100)
        scope["countries_resolved"] = countries
    
    if scope.get("regions"):
        regions = await db.regions.find(
            {"code": {"$in": scope["regions"]}},
            {"_id": 0, "code": 1, "name": 1}
        ).to_list(100)
        scope["regions_resolved"] = regions
    
    return scope


@router.post("")
async def create_access_scope(
    data: EmployeeAccessScopeCreate,
    current_user: dict = Depends(require_permission("employee_scopes.create"))
):
    """Create a new employee access scope"""
    db = get_database()
    
    # Check for duplicate name
    existing = await db.employee_access_scopes.find_one({"name": data.name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Scope with this name already exists")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    scope = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "countries": [c.upper() for c in data.countries] if data.countries else [],
        "regions": data.regions or [],
        "market_segments": data.market_segments or [],
        "service_types": data.service_types or [],
        "specific_operator_ids": data.specific_operator_ids or [],
        "assigned_pod_ids": data.assigned_pod_ids or [],
        "is_active": True,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_access_scopes.insert_one(scope)
    
    return {
        "message": "Access scope created",
        "scope_id": scope["id"],
        "scope": {k: v for k, v in scope.items() if k != "_id"}
    }


@router.put("/{scope_id}")
async def update_access_scope(
    scope_id: str,
    data: EmployeeAccessScopeUpdate,
    current_user: dict = Depends(require_permission("employee_scopes.edit"))
):
    """Update an access scope"""
    db = get_database()
    
    scope = await db.employee_access_scopes.find_one({"id": scope_id})
    if not scope:
        raise HTTPException(status_code=404, detail="Access scope not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Normalize country codes
    if "countries" in update_data and update_data["countries"]:
        update_data["countries"] = [c.upper() for c in update_data["countries"]]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.employee_access_scopes.update_one({"id": scope_id}, {"$set": update_data})
    
    return {"message": "Access scope updated"}


@router.delete("/{scope_id}")
async def delete_access_scope(
    scope_id: str,
    current_user: dict = Depends(require_permission("employee_scopes.delete"))
):
    """Soft delete an access scope"""
    db = get_database()
    
    scope = await db.employee_access_scopes.find_one({"id": scope_id})
    if not scope:
        raise HTTPException(status_code=404, detail="Access scope not found")
    
    # Check for active assignments
    active_assignments = await db.employee_scope_assignments.count_documents({
        "scope_id": scope_id,
        "is_active": True
    })
    
    if active_assignments > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete scope with {active_assignments} active assignments. Remove users first."
        )
    
    await db.employee_access_scopes.update_one(
        {"id": scope_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Access scope deactivated"}


# ============== Scope Assignments ==============

@router.post("/{scope_id}/assign")
async def assign_scope_to_user(
    scope_id: str,
    data: EmployeeScopeAssignmentCreate,
    current_user: dict = Depends(require_permission("employee_scopes.assign"))
):
    """Assign an access scope to a user"""
    db = get_database()
    
    # Verify scope exists
    scope = await db.employee_access_scopes.find_one({"id": scope_id, "is_active": True})
    if not scope:
        raise HTTPException(status_code=404, detail="Access scope not found")
    
    # Verify user exists and is a platform employee
    user = await db.users.find_one({"_id": data.user_id})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if user.get("role") not in ["admin", "super_admin", "employee"]:
        raise HTTPException(status_code=400, detail="Only platform employees can have access scopes")
    
    # Check if already assigned
    existing = await db.employee_scope_assignments.find_one({
        "user_id": data.user_id,
        "scope_id": scope_id,
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already has this scope assigned")
    
    assigner_id = str(current_user.get("_id") or current_user.get("id"))
    
    assignment = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "user_email": user.get("email", ""),
        "scope_id": scope_id,
        "scope_name": scope["name"],
        "assigned_by": assigner_id,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.employee_scope_assignments.insert_one(assignment)
    
    return {
        "message": "Scope assigned to user",
        "assignment_id": assignment["id"],
        "assignment": {k: v for k, v in assignment.items() if k != "_id"}
    }


@router.delete("/{scope_id}/users/{user_id}")
async def remove_scope_from_user(
    scope_id: str,
    user_id: str,
    current_user: dict = Depends(require_permission("employee_scopes.assign"))
):
    """Remove an access scope from a user"""
    db = get_database()
    
    result = await db.employee_scope_assignments.update_one(
        {"scope_id": scope_id, "user_id": user_id, "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {"message": "Scope removed from user"}


# ============== User's Scopes ==============

@router.get("/users/{user_id}/scopes")
async def get_user_scopes(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all access scopes assigned to a user"""
    db = get_database()
    
    # Users can see their own, admins can see anyone's
    current_id = str(current_user.get("_id") or current_user.get("id"))
    if current_id != user_id and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignments = await db.employee_scope_assignments.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get full scope details
    scope_ids = [a["scope_id"] for a in assignments]
    scopes = await db.employee_access_scopes.find(
        {"id": {"$in": scope_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "user_id": user_id,
        "assignments": assignments,
        "scopes": scopes
    }


@router.get("/my/scopes")
async def get_my_scopes(
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's access scopes"""
    db = get_database()
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    assignments = await db.employee_scope_assignments.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    if not assignments:
        return {"scopes": [], "has_global_access": False, "accessible_countries": [], "accessible_segments": []}
    
    # Get full scope details
    scope_ids = [a["scope_id"] for a in assignments]
    scopes = await db.employee_access_scopes.find(
        {"id": {"$in": scope_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate aggregate access
    all_countries = set()
    all_regions = set()
    all_segments = set()
    all_services = set()
    has_global_access = False
    
    for scope in scopes:
        if not scope.get("countries") and not scope.get("regions") and not scope.get("market_segments") and not scope.get("service_types") and not scope.get("specific_operator_ids"):
            has_global_access = True
        else:
            all_countries.update(scope.get("countries", []))
            all_regions.update(scope.get("regions", []))
            all_segments.update(scope.get("market_segments", []))
            all_services.update(scope.get("service_types", []))
    
    return {
        "scopes": scopes,
        "has_global_access": has_global_access,
        "accessible_countries": list(all_countries),
        "accessible_regions": list(all_regions),
        "accessible_segments": list(all_segments),
        "accessible_services": list(all_services)
    }


# ============== Predefined Scopes ==============

@router.post("/create-defaults")
async def create_default_scopes(
    current_user: dict = Depends(require_permission("employee_scopes.create"))
):
    """Create common predefined access scopes"""
    db = get_database()
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    now = datetime.now(timezone.utc).isoformat()
    
    default_scopes = [
        {
            "name": "Cameroon SME Manager",
            "description": "Access to SME operators in Cameroon",
            "countries": ["CM"],
            "regions": [],
            "market_segments": ["sme"],
            "service_types": [],
            "specific_operator_ids": []
        },
        {
            "name": "Cameroon Enterprise Manager",
            "description": "Access to Enterprise operators in Cameroon",
            "countries": ["CM"],
            "regions": [],
            "market_segments": ["enterprise"],
            "service_types": [],
            "specific_operator_ids": []
        },
        {
            "name": "Travel Services Manager",
            "description": "Access to all travel operators globally",
            "countries": [],
            "regions": [],
            "market_segments": [],
            "service_types": ["travel"],
            "specific_operator_ids": []
        },
        {
            "name": "Hotel Services Manager",
            "description": "Access to all hotel operators globally",
            "countries": [],
            "regions": [],
            "market_segments": [],
            "service_types": ["hotel"],
            "specific_operator_ids": []
        },
        {
            "name": "Douala Region Manager",
            "description": "Access to all operators in Littoral region (Douala)",
            "countries": ["CM"],
            "regions": ["CM-LT"],
            "market_segments": [],
            "service_types": [],
            "specific_operator_ids": []
        },
        {
            "name": "Yaoundé Region Manager",
            "description": "Access to all operators in Centre region (Yaoundé)",
            "countries": ["CM"],
            "regions": ["CM-CE"],
            "market_segments": [],
            "service_types": [],
            "specific_operator_ids": []
        },
        {
            "name": "Global Access",
            "description": "Full access to all operators (wildcard)",
            "countries": [],
            "regions": [],
            "market_segments": [],
            "service_types": [],
            "specific_operator_ids": []
        }
    ]
    
    created = 0
    for scope_data in default_scopes:
        existing = await db.employee_access_scopes.find_one({"name": scope_data["name"]})
        if existing:
            continue
        
        scope = {
            "id": str(uuid.uuid4()),
            **scope_data,
            "is_active": True,
            "created_by": user_id,
            "created_at": now,
            "updated_at": now
        }
        await db.employee_access_scopes.insert_one(scope)
        created += 1
    
    return {"message": f"Created {created} default scopes", "created": created}


@router.get("/{scope_id}/matching-operators")
async def get_operators_matching_scope(
    scope_id: str,
    current_user: dict = Depends(require_permission("employee_scopes.view"))
):
    """Get operators that match a scope's criteria. Used to filter the Pod operator assignment list."""
    db = get_database()
    
    scope = await db.employee_access_scopes.find_one({"id": scope_id, "is_active": True})
    if not scope:
        raise HTTPException(status_code=404, detail="Scope not found")
    
    # Build query from scope attributes (AND logic within scope)
    query = {"status": "active"}
    
    if scope.get("countries"):
        query["country"] = {"$in": [c.upper() for c in scope["countries"]]}
    if scope.get("regions"):
        query["region"] = {"$in": scope["regions"]}
    if scope.get("market_segments"):
        query["market_segment"] = {"$in": scope["market_segments"]}
    if scope.get("service_types"):
        query["$or"] = [
            {"operator_type": {"$in": scope["service_types"]}},
            {"service_types": {"$elemMatch": {"$in": scope["service_types"]}}}
        ]
    if scope.get("specific_operator_ids"):
        query["_id"] = {"$in": scope["specific_operator_ids"]}
    
    operators = await db.operators.find(query, {"password_hash": 0}).to_list(1000)
    for op in operators:
        op["id"] = op.pop("_id")
    
    return {"operators": operators, "total": len(operators), "scope_name": scope["name"]}


from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from models.operator import OperatorCreate, OperatorUpdate, OperatorStatus
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/operators", tags=["Operators"])


async def get_operator_access_filter(current_user: dict, db) -> dict:
    """
    Build MongoDB filter based on user's authorization context.
    - Super Admin: No filter (sees all)
    - Admin with global access: No filter
    - Admin with scopes: Filter by scope attributes
    - Admin in pod: Filter by pod's assigned operators
    - Operator: Filter by own operator_id
    """
    user_role = current_user.get("role")
    
    # Super admin sees all
    if user_role == "super_admin":
        return {}
    
    # Operator users see only their own operator
    if user_role == "operator":
        operator_id = current_user.get("operator_id")
        if operator_id:
            return {"_id": operator_id}
        return {"_id": "__no_access__"}
    
    # Platform employees (admins) - check authorization context
    auth_context = current_user.get("_authorization_context", {})
    
    # If has global access, no filter
    if auth_context.get("has_global_access"):
        return {}
    
    accessible_operator_ids = set()
    
    # Add operators from pod assignment
    pod_membership = auth_context.get("pod_membership")
    pod_has_operators = False
    if pod_membership:
        pod_id = pod_membership.get("pod_id")
        if pod_id:
            pod = await db.pods.find_one({"id": pod_id})
            if pod and pod.get("assigned_operator_ids"):
                accessible_operator_ids.update(pod["assigned_operator_ids"])
                pod_has_operators = True
    
    # Add operators from access scopes
    user_id = str(current_user.get("_id") or current_user.get("id"))
    scope_assignments = await db.employee_scope_assignments.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(100)
    
    if scope_assignments:
        scope_ids = [a["scope_id"] for a in scope_assignments]
        scopes = await db.employee_access_scopes.find({
            "id": {"$in": scope_ids},
            "is_active": True
        }).to_list(100)
        
        for scope in scopes:
            # Check for wildcard scope (global access)
            if not scope.get("countries") and not scope.get("regions") and \
               not scope.get("market_segments") and not scope.get("service_types") and \
               not scope.get("specific_operator_ids"):
                return {}  # Global access
            
            # Specific operator IDs override
            if scope.get("specific_operator_ids"):
                accessible_operator_ids.update(scope["specific_operator_ids"])
                continue
            
            # Build attribute-based query
            scope_query = {"status": "active"}
            
            if scope.get("countries"):
                scope_query["country"] = {"$in": [c.upper() for c in scope["countries"]]}
            
            if scope.get("regions"):
                scope_query["region"] = {"$in": scope["regions"]}
            
            if scope.get("market_segments"):
                scope_query["market_segment"] = {"$in": scope["market_segments"]}
            
            if scope.get("service_types"):
                scope_query["$or"] = [
                    {"operator_type": {"$in": scope["service_types"]}},
                    {"service_types": {"$in": scope["service_types"]}}
                ]
            
            # Query matching operators
            matching_ops = await db.operators.find(scope_query, {"_id": 1}).to_list(10000)
            for op in matching_ops:
                accessible_operator_ids.add(op["_id"])
    
    # If we have accessible operators, filter by them
    if accessible_operator_ids:
        return {"_id": {"$in": list(accessible_operator_ids)}}
    
    # If no scopes and no pod with operators, check if admin role has default access
    # For backwards compatibility, admins without specific scopes/operator assignments see all
    if user_role == "admin" and not scope_assignments and (not pod_membership or not pod_has_operators):
        return {}  # Legacy admin behavior - sees all
    
    # No access
    return {"_id": "__no_access__"}

@router.post("/")
async def create_operator(
    operator_data: OperatorCreate,
    current_user: dict = Depends(require_permission("operators.create"))
):
    """Create a new operator - requires operators.create permission. Optionally creates an owner user account."""
    db = get_database()
    
    # Check if email already exists
    existing = await db.operators.find_one({"email": operator_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Operator with this email already exists")
    
    operator_id = str(uuid.uuid4())
    owner_user_id = current_user["_id"]
    owner_account_created = False
    invite_email_status = None
    invite_email_link = None
    
    # Create owner user account if requested
    if operator_data.create_owner_account and operator_data.owner_email:
        # Check if owner email already exists
        existing_user = await db.users.find_one({"email": operator_data.owner_email})
        if existing_user:
            raise HTTPException(status_code=400, detail=f"User with email {operator_data.owner_email} already exists")

        # Single-owner invariant — this operator id is freshly minted above so a
        # collision should never happen at this point, but we still verify the
        # invariant defensively to lock in the contract for any future code
        # path (re-runs, race conditions, manual seeds, etc.).
        existing_owner = await db.users.find_one(
            {"operator_id": operator_id, "operator_role": "owner"},
            {"_id": 1, "email": 1},
        )
        if existing_owner:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"This operator already has an owner ({existing_owner.get('email')}). "
                    "Only one owner is allowed per operator."
                ),
            )

        from utils.auth import get_password_hash
        import secrets
        owner_user_id = str(uuid.uuid4())
        has_temp_password = bool(operator_data.owner_password)
        # If admin didn't set a starting password, store a strong random one;
        # the invitee will reset it during account confirmation.
        password = operator_data.owner_password or secrets.token_urlsafe(24)
        
        owner_user = {
            "_id": owner_user_id,
            "id": owner_user_id,
            "email": operator_data.owner_email,
            "full_name": operator_data.owner_full_name or operator_data.name,
            "phone": operator_data.owner_phone or operator_data.phone,
            "password_hash": get_password_hash(password),
            "role": "operator",
            "operator_id": operator_id,
            "operator_name": operator_data.name,
            "operator_role": "owner",
            "permissions": operator_data.owner_permissions or [],
            "status": "pending_verification",
            "email_verified": False,
            "country": operator_data.country,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        await db.users.insert_one(owner_user)
        owner_account_created = True

        # Create a verification token and try to send the invite email.
        # The link is always available in the response — useful as a manual fallback
        # while the Resend account is still in testing mode / a domain isn't verified.
        invite_token = secrets.token_urlsafe(32)
        from os import environ
        _public_url = environ.get("APP_PUBLIC_URL", "").rstrip("/")
        invite_email_link = f"{_public_url}/verify-account?token={invite_token}" if _public_url else None
        await db.verification_tokens.insert_one({
            "_id": invite_token,
            "user_id": owner_user_id,
            "user_email": operator_data.owner_email,
            "purpose": "account_invite",
            "operator_id": operator_id,
            "operator_name": operator_data.name,
            "has_temp_password": has_temp_password,
            "consumed_at": None,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=7),
        })
        try:
            from services.email_service import send_account_invite_email
            email_result = await send_account_invite_email(
                recipient_email=operator_data.owner_email,
                recipient_name=operator_data.owner_full_name or operator_data.name,
                invite_token=invite_token,
                operator_name=operator_data.name,
                inviter_name=current_user.get("full_name"),
                has_temp_password=has_temp_password,
            )
            invite_email_status = email_result.get("status", "sent")
        except Exception:
            import logging
            logging.exception("Failed to send operator owner invite email")
            invite_email_status = "failed"
    
    # Exclude owner fields from operator dict
    op_dict = operator_data.dict(exclude={"create_owner_account", "owner_full_name", "owner_email", "owner_phone", "owner_password", "owner_permissions"})
    
    operator = {
        "_id": operator_id,
        **op_dict,
        "status": OperatorStatus.ACTIVE.value if current_user["role"] == "super_admin" else OperatorStatus.PENDING.value,
        "owner_user_id": owner_user_id,
        "created_by": current_user["_id"],
        "created_by_role": current_user["role"],
        "documents": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.operators.insert_one(operator)
    
    # Update user with operator info if self-registering (non-admin)
    if current_user["role"] not in ["admin", "super_admin"]:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"operator_id": operator["_id"], "operator_name": operator["name"]}}
        )
    
    # If created by admin (not super_admin), create a validation request
    if current_user["role"] == "admin":
        validation_request = {
            "_id": str(uuid.uuid4()),
            "type": "operator_approval",
            "operator_id": operator["_id"],
            "operator_name": operator["name"],
            "operator_email": operator.get("email"),
            "operator_type": operator.get("operator_type"),
            "requested_by": current_user["_id"],
            "requested_by_name": current_user.get("full_name", current_user.get("email")),
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        await db.validation_requests.insert_one(validation_request)
        
        # Notify super admins
        super_admins = await db.users.find({"role": "super_admin"}).to_list(100)
        for sa in super_admins:
            notification = {
                "_id": str(uuid.uuid4()),
                "user_id": sa["_id"],
                "notification_type": "operator_approval_request",
                "title": "New Operator Approval Request",
                "message": f"Admin {current_user.get('full_name', current_user.get('email'))} has created operator '{operator['name']}' and requires your approval.",
                "data": {"operator_id": operator["_id"], "validation_request_id": validation_request["_id"]},
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(notification)
    
    result = {
        "message": "Operator created" + (" - pending super admin approval" if current_user["role"] == "admin" else ""),
        "operator_id": operator["_id"],
        "owner_account_created": owner_account_created,
    }
    if owner_account_created:
        result["owner_user_id"] = owner_user_id
        result["owner_email"] = operator_data.owner_email
        # Only echo the starting password back when the admin set it; if invitee
        # will reset it, we never expose the random placeholder.
        if operator_data.owner_password:
            result["default_password"] = operator_data.owner_password
        result["invite_email_status"] = invite_email_status  # "sent" | "failed"
        result["invite_link"] = invite_email_link
    
    return result


@router.get("/by-service")
async def get_operators_by_service(
    service_type: Optional[str] = Query(None, description="Filter by service type: travel, restaurant, cinema, hotel, pressing, banquet, packages, car_rental, events"),
    current_user: dict = Depends(require_any_permission(["operators.view", "operators.view_all"]))
):
    """Get operators filtered by service type for admin scope selectors."""
    db = get_database()
    query = {"status": "active"}
    
    if service_type and service_type != "all":
        # Match operators that have this service in their service_types array
        # OR whose operator_type matches, OR multi-service operators
        query["$or"] = [
            {"service_types": service_type},
            {"operator_type": service_type},
            {"operator_type": "multi"},
        ]
    
    operators = []
    async for op in db.operators.find(query).sort("name", 1):
        operators.append({
            "id": str(op["_id"]),
            "name": op.get("name", "Unknown"),
            "operator_type": op.get("operator_type", ""),
            "service_types": op.get("service_types", []),
        })
    return {"operators": operators}


@router.get("/")
async def get_operators(
    op_status: Optional[str] = None,
    operator_type: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    market_segment: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("operators.view"))
):
    """
    Get operators list - requires operators.view permission.
    Results are filtered based on user's authorization context:
    - Super Admin: Sees all operators
    - Admin with scopes: Sees operators matching their assigned scopes
    - Admin in pod: Sees operators assigned to their pod
    - Operator: Sees only their own operator
    """
    db = get_database()
    
    # Get authorization-based filter
    access_filter = await get_operator_access_filter(current_user, db)
    
    # Start with access filter
    query = {**access_filter}
    
    is_admin = current_user["role"] in ["admin", "super_admin"]
    
    # Non-super-admin users can only see active operators unless they have explicit permission
    if not is_admin:
        query["status"] = OperatorStatus.ACTIVE.value
    elif op_status:
        query["status"] = op_status
    
    # Additional filters
    if operator_type:
        query["operator_type"] = operator_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if country:
        query["country"] = country.upper()
    if region:
        query["region"] = region
    if market_segment:
        query["market_segment"] = market_segment
    # Text search across name/city/email when user is actively searching
    if search and len(search.strip()) >= 2:
        regex = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"city": regex},
            {"email": regex},
            {"operator_type": regex},
        ]
    
    operators = await db.operators.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.operators.count_documents(query)
    
    # Fetch owner info and calculate revenue for each operator
    for op in operators:
        op_id = str(op.get("_id", ""))
        op["id"] = op_id
        op.pop("_id", None)
        
        # Get owner info — ALWAYS prefer the live user with `operator_role='owner'`
        # (that's the single source of truth for ownership; `owner_user_id` on
        # the operator document can drift when ownership is transferred). Fall
        # back to the legacy `owner_user_id`/`created_by` only when no live
        # owner user exists.
        op["owner_name"] = ""
        op["owner_email"] = ""
        op_user = await db.users.find_one(
            {"operator_id": op_id, "operator_role": "owner"},
            {"_id": 0, "full_name": 1, "email": 1}
        )
        if op_user:
            op["owner_name"] = op_user.get("full_name", "")
            op["owner_email"] = op_user.get("email", "")
        else:
            legacy_owner_id = op.get("owner_user_id") or op.get("created_by")
            if legacy_owner_id:
                owner = await db.users.find_one({"_id": legacy_owner_id}, {"_id": 0, "full_name": 1, "email": 1})
                if owner:
                    op["owner_name"] = owner.get("full_name", "")
                    op["owner_email"] = owner.get("email", "")
        
        # Calculate total revenue from orders for this operator
        try:
            # Aggregate revenue from orders where operator_id matches
            revenue_pipeline = [
                {"$match": {"operator_id": op_id, "status": {"$in": ["completed", "confirmed", "pending"]}}},
                {"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}}}
            ]
            revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
            op["revenue"] = revenue_result[0]["total_revenue"] if revenue_result else 0
        except Exception:
            op["revenue"] = op.get("revenue", 0)
    
    # Include access context info in response for debugging/UI
    auth_context = current_user.get("_authorization_context", {})
    
    return {
        "operators": operators, 
        "total": total, 
        "skip": skip, 
        "limit": limit,
        "access_info": {
            "has_global_access": auth_context.get("has_global_access", current_user["role"] == "super_admin"),
            "pod_name": auth_context.get("pod_membership", {}).get("pod_name") if auth_context.get("pod_membership") else None,
            "scope_count": len(auth_context.get("access_scopes", []))
        }
    }

@router.get("/{operator_id}")
async def get_operator(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get operator details - checks authorization context"""
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Check access authorization
    user_role = current_user.get("role")
    
    # Super admin can see all
    if user_role != "super_admin":
        # Operator users can only see their own
        if user_role == "operator":
            if current_user.get("operator_id") != operator_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Admins - check if operator is in their accessible set
        elif user_role == "admin":
            access_filter = await get_operator_access_filter(current_user, db)
            if access_filter and "_id" in access_filter:
                if access_filter["_id"] == "__no_access__":
                    raise HTTPException(status_code=403, detail="Access denied")
                if "$in" in access_filter["_id"]:
                    if operator_id not in access_filter["_id"]["$in"]:
                        raise HTTPException(status_code=403, detail="Access denied - operator not in your scope")
    
    operator["id"] = operator_id
    operator.pop("_id", None)
    return operator

@router.put("/{operator_id}")
async def update_operator(
    operator_id: str,
    operator_data: OperatorUpdate,
    current_user: dict = Depends(require_permission("operators.edit"))
):
    """Update an operator - requires operators.edit permission"""
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Check authorization - non-super-admin can only edit their own operator
    is_super_admin = current_user["role"] == "super_admin"
    if not is_super_admin and operator["owner_user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own operator")
    
    # Only super_admin can change status
    update_data = {k: v for k, v in operator_data.dict().items() if v is not None}
    if "status" in update_data and not is_super_admin:
        del update_data["status"]
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.operators.update_one({"_id": operator_id}, {"$set": update_data})
    
    return {"message": "Operator updated"}

@router.delete("/{operator_id}")
async def delete_operator(
    operator_id: str,
    current_user: dict = Depends(require_permission("operators.delete"))
):
    """Delete an operator - requires operators.delete permission
    
    Cascades deletion to:
    - All users assigned to this operator (disabled, not deleted)
    - All travel routes
    - All vehicles
    - All hotels
    - All restaurants
    - All car rentals
    - All events
    - All banquets
    - All packages
    """
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    operator_name = operator.get("name", "Unknown")
    
    # 1. Disable all users assigned to this operator (don't delete - just disable)
    users_result = await db.users.update_many(
        {"operator_id": operator_id},
        {"$set": {
            "status": "disabled",
            "role": "customer",  # Demote to customer
            "operator_id": None,
            "operator_name": None,
            "disabled_reason": f"Operator '{operator_name}' was deleted",
            "disabled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 2. Delete all travel routes
    routes_result = await db.travel_routes.delete_many({"operator_id": operator_id})
    
    # 3. Delete all vehicles
    vehicles_result = await db.vehicles.delete_many({"operator_id": operator_id})
    
    # 4. Delete all hotels
    hotels_result = await db.hotels.delete_many({"operator_id": operator_id})
    
    # 5. Delete all restaurants
    restaurants_result = await db.restaurants.delete_many({"operator_id": operator_id})
    
    # 6. Delete all car rentals
    car_rentals_result = await db.car_rentals.delete_many({"operator_id": operator_id})
    
    # 7. Delete all events
    events_result = await db.events.delete_many({"operator_id": operator_id})
    
    # 8. Delete all banquets
    banquets_result = await db.banquets.delete_many({"operator_id": operator_id})
    
    # 9. Delete all packages
    packages_result = await db.packages.delete_many({"operator_id": operator_id})
    
    # 10. Delete the operator
    await db.operators.delete_one({"_id": operator_id})
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.deleted",
        "details": {
            "operator_name": operator_name,
            "users_disabled": users_result.modified_count,
            "routes_deleted": routes_result.deleted_count,
            "vehicles_deleted": vehicles_result.deleted_count,
            "hotels_deleted": hotels_result.deleted_count,
            "restaurants_deleted": restaurants_result.deleted_count,
            "car_rentals_deleted": car_rentals_result.deleted_count,
            "events_deleted": events_result.deleted_count,
            "banquets_deleted": banquets_result.deleted_count,
            "packages_deleted": packages_result.deleted_count
        },
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "Operator deleted",
        "cascade_summary": {
            "users_disabled": users_result.modified_count,
            "routes_deleted": routes_result.deleted_count,
            "vehicles_deleted": vehicles_result.deleted_count,
            "hotels_deleted": hotels_result.deleted_count,
            "restaurants_deleted": restaurants_result.deleted_count,
            "car_rentals_deleted": car_rentals_result.deleted_count,
            "events_deleted": events_result.deleted_count,
            "banquets_deleted": banquets_result.deleted_count,
            "packages_deleted": packages_result.deleted_count
        }
    }

@router.post("/{operator_id}/approve")
async def approve_operator(
    operator_id: str,
    current_user: dict = Depends(require_permission("operators.approve"))
):
    """Approve a pending operator - requires operators.approve permission"""
    db = get_database()
    
    # Get the operator to find owner_user_id
    operator = await db.operators.find_one({"_id": operator_id, "status": OperatorStatus.PENDING})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found or not pending")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.ACTIVE, 
            "approved_at": datetime.utcnow(),
            "approved_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update validation request if exists
    await db.validation_requests.update_one(
        {"operator_id": operator_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    # Update user role to 'operator' if owner_user_id exists and is not admin/super_admin
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        owner_user = await db.users.find_one({"_id": owner_user_id})
        if owner_user and owner_user.get("role") not in ["admin", "super_admin"]:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "operator",
                    "operator_id": operator_id,
                    "operator_name": operator.get("name"),
                    "updated_at": datetime.utcnow()
                }}
            )
    
    # Send notification to operator
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": owner_user_id,
        "notification_type": "operator_status",
        "title": "Operator Application Approved",
        "message": f"Congratulations! Your operator application for '{operator.get('name')}' has been approved. You can now start adding services.",
        "data": {"operator_id": operator_id, "status": "active"},
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.approved",
        "details": {"operator_name": operator.get("name"), "owner_user_id": owner_user_id},
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Operator approved", "operator_id": operator_id}

@router.post("/{operator_id}/suspend")
async def suspend_operator(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Suspend an operator (admin or super_admin only)
    
    Cascades suspension to:
    - All users assigned to this operator (status -> suspended)
    - All travel routes (status -> suspended)
    - All vehicles (maintenance_status -> suspended)
    - All hotels (status -> suspended)
    - All restaurants (status -> suspended)
    - All car rentals (status -> suspended)
    - All events (status -> suspended)
    - All banquets (status -> suspended)
    - All packages (status -> suspended)
    """
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the operator
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    operator_name = operator.get("name", "Unknown")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.SUSPENDED, 
            "suspended_at": datetime.utcnow(),
            "suspended_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 1. Suspend ALL users assigned to this operator
    users_result = await db.users.update_many(
        {"operator_id": operator_id},
        {"$set": {
            "status": "suspended",
            "suspended_reason": f"Operator '{operator_name}' was suspended",
            "suspended_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 2. Suspend travel routes
    routes_result = await db.travel_routes.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    # 3. Suspend vehicles
    vehicles_result = await db.vehicles.update_many(
        {"operator_id": operator_id},
        {"$set": {"maintenance_status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # 4. Suspend hotels
    hotels_result = await db.hotels.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # 5. Suspend car rentals
    car_rentals_result = await db.car_rentals.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # 6. Suspend restaurants
    restaurants_result = await db.restaurants.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # 7. Suspend events
    events_result = await db.events.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    # 8. Suspend banquets
    banquets_result = await db.banquets.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # 9. Suspend packages
    packages_result = await db.packages.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Send notification to all suspended users
    suspended_users = await db.users.find({"operator_id": operator_id}).to_list(100)
    for user in suspended_users:
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "notification_type": "operator_status",
            "title": "Account Suspended",
            "message": f"Your account has been suspended because operator '{operator_name}' was suspended. Please contact support for more information.",
            "data": {"operator_id": operator_id, "status": "suspended"},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.suspended",
        "details": {
            "operator_name": operator_name,
            "users_suspended": users_result.modified_count,
            "routes_suspended": routes_result.modified_count,
            "vehicles_suspended": vehicles_result.modified_count,
            "hotels_suspended": hotels_result.modified_count,
            "restaurants_suspended": restaurants_result.modified_count,
            "car_rentals_suspended": car_rentals_result.modified_count,
            "events_suspended": events_result.modified_count,
            "banquets_suspended": banquets_result.modified_count,
            "packages_suspended": packages_result.modified_count
        },
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "Operator suspended",
        "operator_id": operator_id,
        "cascade_summary": {
            "users_suspended": users_result.modified_count,
            "routes_suspended": routes_result.modified_count,
            "vehicles_suspended": vehicles_result.modified_count,
            "hotels_suspended": hotels_result.modified_count,
            "restaurants_suspended": restaurants_result.modified_count,
            "car_rentals_suspended": car_rentals_result.modified_count,
            "events_suspended": events_result.modified_count,
            "banquets_suspended": banquets_result.modified_count,
            "packages_suspended": packages_result.modified_count
        }
    }



@router.post("/{operator_id}/reactivate")
async def reactivate_operator(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Reactivate a suspended operator (admin or super_admin only)
    
    Cascades reactivation to:
    - All suspended users assigned to this operator (status -> active)
    - All suspended travel routes (status -> active)
    - All suspended vehicles (maintenance_status -> active)
    - All suspended hotels, restaurants, car rentals, events, banquets, packages
    """
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the operator
    operator = await db.operators.find_one({"_id": operator_id, "status": OperatorStatus.SUSPENDED})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found or not suspended")
    
    operator_name = operator.get("name", "Unknown")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.ACTIVE, 
            "reactivated_at": datetime.utcnow(),
            "reactivated_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 1. Reactivate ALL suspended users assigned to this operator
    users_result = await db.users.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {
            "status": "active",
            "suspended_reason": None,
            "suspended_at": None,
            "reactivated_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 2. Reactivate travel routes
    routes_result = await db.travel_routes.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "is_active": True, "updated_at": datetime.utcnow()}}
    )
    
    # 3. Reactivate vehicles
    vehicles_result = await db.vehicles.update_many(
        {"operator_id": operator_id, "maintenance_status": "suspended"},
        {"$set": {"maintenance_status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # 4. Reactivate hotels
    hotels_result = await db.hotels.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # 5. Reactivate car rentals
    car_rentals_result = await db.car_rentals.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # 6. Reactivate restaurants
    restaurants_result = await db.restaurants.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # 7. Reactivate events
    events_result = await db.events.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "is_active": True, "updated_at": datetime.utcnow()}}
    )
    
    # 8. Reactivate banquets
    banquets_result = await db.banquets.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # 9. Reactivate packages
    packages_result = await db.packages.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # Send notification to all reactivated users
    reactivated_users = await db.users.find({"operator_id": operator_id}).to_list(100)
    for user in reactivated_users:
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "notification_type": "operator_status",
            "title": "Account Reactivated",
            "message": f"Your account has been reactivated. Operator '{operator_name}' is now active. You can resume your work.",
            "data": {"operator_id": operator_id, "status": "active"},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.reactivated",
        "details": {
            "operator_name": operator_name,
            "users_reactivated": users_result.modified_count,
            "routes_reactivated": routes_result.modified_count,
            "vehicles_reactivated": vehicles_result.modified_count,
            "hotels_reactivated": hotels_result.modified_count,
            "restaurants_reactivated": restaurants_result.modified_count,
            "car_rentals_reactivated": car_rentals_result.modified_count,
            "events_reactivated": events_result.modified_count,
            "banquets_reactivated": banquets_result.modified_count,
            "packages_reactivated": packages_result.modified_count
        },
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "Operator reactivated",
        "operator_id": operator_id,
        "cascade_summary": {
            "users_reactivated": users_result.modified_count,
            "routes_reactivated": routes_result.modified_count,
            "vehicles_reactivated": vehicles_result.modified_count,
            "hotels_reactivated": hotels_result.modified_count,
            "restaurants_reactivated": restaurants_result.modified_count,
            "car_rentals_reactivated": car_rentals_result.modified_count,
            "events_reactivated": events_result.modified_count,
            "banquets_reactivated": banquets_result.modified_count,
            "packages_reactivated": packages_result.modified_count
        }
    }


# ==================== DOCUMENT VERIFICATION WORKFLOW ====================

class DocumentUpload(BaseModel):
    document_type: str  # "business_registration", "tax_certificate", "id_document", "license"
    document_url: str
    document_name: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{operator_id}/documents")
async def upload_operator_document(
    operator_id: str,
    document: DocumentUpload,
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a verification document for an operator"""
    db = get_database()
    
    # Check if user is the operator owner or admin
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    if operator.get("owner_user_id") != current_user["_id"] and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to upload documents for this operator")
    
    # Create document record
    doc_record = {
        "_id": str(uuid.uuid4()),
        "document_type": document.document_type,
        "document_url": document.document_url,
        "document_name": document.document_name or document.document_type,
        "notes": document.notes,
        "status": "pending",  # pending, approved, rejected
        "uploaded_by": current_user["_id"],
        "uploaded_at": datetime.utcnow(),
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": None
    }
    
    # Add to operator's documents array
    await db.operators.update_one(
        {"_id": operator_id},
        {
            "$push": {"documents": doc_record},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Send notification to admin
    admin_users = await db.users.find({"role": {"$in": ["admin", "super_admin"]}}).to_list(100)
    for admin in admin_users:
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": admin["_id"],
            "notification_type": "document_review",
            "title": "New Document for Review",
            "message": f"Operator '{operator.get('name')}' has uploaded a new {document.document_type} document.",
            "data": {"operator_id": operator_id, "document_id": doc_record["_id"]},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    return {
        "message": "Document uploaded successfully",
        "document_id": doc_record["_id"],
        "status": "pending"
    }


@router.get("/{operator_id}/documents")
async def get_operator_documents(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all documents for an operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Check authorization
    if operator.get("owner_user_id") != current_user["_id"] and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view documents for this operator")
    
    documents = operator.get("documents", [])
    
    return {
        "operator_id": operator_id,
        "operator_name": operator.get("name"),
        "documents": documents,
        "total": len(documents)
    }


class DocumentReview(BaseModel):
    status: str  # "approved" or "rejected"
    review_notes: Optional[str] = None


@router.put("/{operator_id}/documents/{document_id}/review")
async def review_operator_document(
    operator_id: str,
    document_id: str,
    review: DocumentReview,
    current_user: dict = Depends(get_current_active_user)
):
    """Review (approve/reject) an operator document (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if review.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Find and update the document
    documents = operator.get("documents", [])
    doc_found = False
    
    for doc in documents:
        if doc["_id"] == document_id:
            doc["status"] = review.status
            doc["reviewed_by"] = current_user["_id"]
            doc["reviewed_at"] = datetime.utcnow()
            doc["review_notes"] = review.review_notes
            doc_found = True
            break
    
    if not doc_found:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update operator with modified documents
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {"documents": documents, "updated_at": datetime.utcnow()}}
    )
    
    # Send notification to operator owner
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        status_msg = "approved" if review.status == "approved" else "rejected"
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": owner_user_id,
            "notification_type": "document_review",
            "title": f"Document {status_msg.title()}",
            "message": f"Your document has been {status_msg}. {review.review_notes or ''}",
            "data": {"operator_id": operator_id, "document_id": document_id, "status": review.status},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Check if all required documents are approved
    all_approved = all(doc.get("status") == "approved" for doc in documents) if documents else False
    
    # If all docs approved and operator is pending, auto-approve
    if all_approved and operator.get("status") == "pending" and len(documents) >= 2:
        # At least 2 approved documents required for auto-approval
        await db.operators.update_one(
            {"_id": operator_id},
            {"$set": {
                "status": OperatorStatus.ACTIVE,
                "approved_at": datetime.utcnow(),
                "approved_by": current_user["_id"],
                "auto_approved": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Update user role
        if owner_user_id:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "operator",
                    "operator_id": operator_id,
                    "operator_name": operator.get("name"),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            # Send approval notification
            approval_notification = {
                "_id": str(uuid.uuid4()),
                "user_id": owner_user_id,
                "notification_type": "operator_status",
                "title": "Operator Application Auto-Approved",
                "message": f"All your documents have been verified. Your operator account '{operator.get('name')}' is now active!",
                "data": {"operator_id": operator_id, "status": "active"},
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(approval_notification)
    
    return {
        "message": f"Document {review.status}",
        "document_id": document_id,
        "all_documents_approved": all_approved
    }


@router.get("/documents/pending")
async def get_pending_documents(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all pending documents across all operators (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find operators with pending documents
    pipeline = [
        {"$match": {"documents": {"$elemMatch": {"status": "pending"}}}},
        {"$project": {
            "_id": 1,
            "name": 1,
            "email": 1,
            "status": 1,
            "pending_documents": {
                "$filter": {
                    "input": "$documents",
                    "as": "doc",
                    "cond": {"$eq": ["$$doc.status", "pending"]}
                }
            }
        }},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    results = await db.operators.aggregate(pipeline).to_list(limit)
    
    # Format results
    pending_docs = []
    for op in results:
        for doc in op.get("pending_documents", []):
            pending_docs.append({
                "operator_id": op["_id"],
                "operator_name": op["name"],
                "operator_email": op.get("email"),
                "operator_status": op["status"],
                **doc
            })
    
    total = await db.operators.count_documents({"documents": {"$elemMatch": {"status": "pending"}}})
    
    return {
        "documents": pending_docs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

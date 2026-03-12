from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/validation", tags=["Validation"])

import uuid

class ApprovalRequest(BaseModel):
    reason: Optional[str] = None

class RejectionRequest(BaseModel):
    reason: str


async def log_validation_action(db, action: str, item_type: str, item_id: str, item_name: str, user: dict, reason: str = None, extra: dict = None):
    """Log a validation action to the validation_history collection."""
    entry = {
        "_id": str(uuid.uuid4()),
        "action": action,  # approved, rejected, verified, refunded
        "item_type": item_type,  # payment, ticket, service, promotion, operator
        "item_id": item_id,
        "item_name": item_name,
        "performed_by": user.get("_id"),
        "performed_by_name": user.get("full_name", user.get("email", "")),
        "performed_by_role": user.get("role"),
        "reason": reason,
        "created_at": datetime.now(timezone.utc),
    }
    if extra:
        entry.update(extra)
    await db.validation_history.insert_one(entry)

def check_validation_access(current_user: dict):
    """Check if user has validation access"""
    role = current_user.get("role")
    if role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Validation access required")

@router.get("/pending")
async def get_pending_validations(
    current_user: dict = Depends(require_permission("validation.view"))
):
    """Get all pending items for validation - requires validation.view permission"""
    db = get_database()
    
    is_super_admin = current_user.get("role") == "super_admin"
    operator_id = current_user.get("operator_id")
    
    # Check if user has full validation access
    from utils.permissions import check_user_permission
    has_full_access = await check_user_permission(current_user, "validation.view", db) or is_super_admin
    
    # Build query filter
    def build_filter(base_filter: dict) -> dict:
        if is_super_admin:
            return base_filter
        elif operator_id:
            return {**base_filter, "operator_id": operator_id}
        return base_filter
    
    # Get pending orders (tickets)
    order_filter = build_filter({"status": {"$in": ["pending", "cancel_pending", "cancel_confirmed"]}})
    orders_cursor = db.orders.find(order_filter).sort("created_at", -1)
    orders_raw = await orders_cursor.to_list(500)
    
    # Process orders to ensure they have an 'id' field
    orders = []
    for order in orders_raw:
        order_id = order.get("id") or str(order.get("_id", "")) or order.get("order_number")
        processed = {k: v for k, v in order.items() if k != "_id"}
        processed["id"] = order_id
        orders.append(processed)
    
    # Separate different ticket types
    general_tickets = [o for o in orders if o.get("status") == "pending" and o.get("payment_status") != "pending"]
    cancellation_tickets = [o for o in orders if o.get("status") in ["cancel_pending", "cancel_confirmed"]]
    pending_payments = [o for o in orders if o.get("status") == "pending" and o.get("payment_status") == "pending"] if has_full_access else []
    
    # Get pending services from each collection
    service_filter = build_filter({"status": "pending"})
    
    async def get_services_with_id(collection):
        items = await collection.find(service_filter).to_list(100)
        result = []
        for item in items:
            item_id = item.get("id") or str(item.get("_id", ""))
            processed = {k: v for k, v in item.items() if k != "_id"}
            processed["id"] = item_id
            result.append(processed)
        return result
    
    travel_routes = await get_services_with_id(db.travel_routes)
    hotels = await get_services_with_id(db.hotels)
    car_rentals = await get_services_with_id(db.car_rentals)
    restaurants = await get_services_with_id(db.restaurants)
    packages = await get_services_with_id(db.packages)
    events = await get_services_with_id(db.events)
    cinemas = await get_services_with_id(db.cinemas)
    pressing = await get_services_with_id(db.pressing)
    banquets = await get_services_with_id(db.banquets)
    
    # Get pending operators (only for super_admin)
    pending_operators = []
    if current_user.get("role") == "super_admin":
        operators_cursor = db.operators.find({"status": "pending"}).sort("created_at", -1)
        operators_raw = await operators_cursor.to_list(100)
        for op in operators_raw:
            op_id = op.get("id") or str(op.get("_id", ""))
            processed = {k: v for k, v in op.items() if k != "_id"}
            processed["id"] = op_id
            # Get creator info
            creator_id = op.get("created_by") or op.get("owner_user_id")
            if creator_id:
                creator = await db.users.find_one({"_id": creator_id}, {"full_name": 1, "email": 1, "role": 1})
                if creator:
                    processed["created_by_name"] = creator.get("full_name") or creator.get("email")
                    processed["created_by_role"] = creator.get("role")
            pending_operators.append(processed)
    
    # Get pending promotions
    pending_promotions_raw = await db.promotions.find({"status": "pending_approval"}).sort("created_at", -1).to_list(100)
    pending_promotions = []
    for p in pending_promotions_raw:
        p_id = str(p.get("_id", ""))
        processed = {k: v for k, v in p.items() if k != "_id"}
        processed["id"] = p_id
        pending_promotions.append(processed)
    
    return {
        "general_tickets": general_tickets,
        "cancellation_tickets": cancellation_tickets,
        "pending_payments": pending_payments,
        "pending_operators": pending_operators,
        "pending_promotions": pending_promotions,
        "services": {
            "travel_routes": travel_routes,
            "hotels": hotels,
            "car_rentals": car_rentals,
            "restaurants": restaurants,
            "packages": packages,
            "events": events,
            "cinemas": cinemas,
            "pressing": pressing,
            "banquets": banquets
        },
        "counts": {
            "general_tickets": len(general_tickets),
            "cancellation_tickets": len(cancellation_tickets),
            "pending_payments": len(pending_payments),
            "pending_operators": len(pending_operators),
            "pending_promotions": len(pending_promotions),
            "services": sum([
                len(travel_routes), len(hotels), len(car_rentals), len(restaurants),
                len(packages), len(events), len(cinemas), len(pressing), len(banquets)
            ])
        }
    }

@router.post("/tickets/{ticket_id}/approve")
async def approve_ticket(
    ticket_id: str,
    request: ApprovalRequest,
    current_user: dict = Depends(require_permission("validation.approve"))
):
    """Approve a pending ticket/order - requires validation.approve permission"""
    db = get_database()
    
    # Try to find by id, _id, or order_number
    order = await db.orders.find_one({"$or": [
        {"id": ticket_id}, 
        {"_id": ticket_id},
        {"order_number": ticket_id}
    ]})
    if not order:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    current_status = order.get("status")
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if current_status == "cancel_pending":
        # Approve cancellation
        update_data["status"] = "cancel_confirmed"
        update_data["cancellation_details"] = {
            **order.get("cancellation_details", {}),
            "approved_by_id": current_user.get("id"),
            "approved_by_name": current_user.get("full_name", current_user.get("email")),
            "approved_at": datetime.now(timezone.utc).isoformat()
        }
        message = "Cancellation approved"
    elif current_status == "cancel_confirmed":
        # Approve refund
        update_data["status"] = "money_refunded"
        update_data["payment_status"] = "refunded"
        update_data["cancellation_details"] = {
            **order.get("cancellation_details", {}),
            "refund_approved_by_id": current_user.get("id"),
            "refund_approved_by_name": current_user.get("full_name", current_user.get("email")),
            "refund_approved_at": datetime.now(timezone.utc).isoformat()
        }
        message = "Refund approved"
    else:
        # Regular approval - also auto-verify payment
        update_data["status"] = "confirmed"
        update_data["payment_status"] = "paid"
        update_data["payment_verified_at"] = datetime.now(timezone.utc).isoformat()
        update_data["payment_verified_by"] = current_user.get("id")
        update_data["payment_verification_notes"] = "Auto-verified with ticket approval"
        message = "Ticket approved and payment verified"
    
    # Update using the MongoDB _id
    await db.orders.update_one({"_id": order.get("_id")}, {"$set": update_data})
    
    await log_validation_action(db, "approved", "ticket", ticket_id, 
        order.get("service_name", order.get("order_number", ticket_id)),
        current_user, request.reason, {"order_status": update_data.get("status")})
    
    return {"message": message, "ticket_id": ticket_id}

@router.post("/tickets/{ticket_id}/reject")
async def reject_ticket(
    ticket_id: str,
    request: RejectionRequest,
    current_user: dict = Depends(require_permission("validation.reject"))
):
    """Reject a pending ticket/order - requires validation.reject permission"""
    db = get_database()
    
    # Try to find by id, _id, or order_number
    order = await db.orders.find_one({"$or": [
        {"id": ticket_id}, 
        {"_id": ticket_id},
        {"order_number": ticket_id}
    ]})
    if not order:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    current_status = order.get("status")
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    rejection_info = {
        "reason": request.reason,
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "rejected_by_id": current_user.get("id"),
        "rejected_by_name": current_user.get("full_name", current_user.get("email"))
    }
    
    if current_status == "cancel_pending":
        update_data["status"] = "confirmed"  # Revert to confirmed
        update_data["cancellation_details"] = {
            **order.get("cancellation_details", {}),
            **rejection_info
        }
        message = "Cancellation rejected"
    elif current_status == "cancel_confirmed":
        update_data["cancellation_details"] = {
            **order.get("cancellation_details", {}),
            "refund_rejection_reason": request.reason,
            "refund_rejected_at": datetime.now(timezone.utc).isoformat(),
            "refund_rejected_by_id": current_user.get("id"),
            "refund_rejected_by_name": current_user.get("full_name", current_user.get("email"))
        }
        message = "Refund rejected"
    else:
        update_data["status"] = "not_confirmed"
        update_data["rejection_details"] = rejection_info
        message = "Ticket rejected"
    
    # Update using the MongoDB _id
    await db.orders.update_one({"_id": order.get("_id")}, {"$set": update_data})
    
    await log_validation_action(db, "rejected", "ticket", ticket_id,
        order.get("service_name", order.get("order_number", ticket_id)),
        current_user, request.reason)
    
    return {"message": message, "ticket_id": ticket_id}

@router.post("/payments/{order_id}/verify")
async def verify_payment(
    order_id: str,
    verified: bool,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Manually verify a payment"""
    check_validation_access(current_user)
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Try to find by id, _id, or order_number
    order = await db.orders.find_one({"$or": [
        {"id": order_id}, 
        {"_id": order_id},
        {"order_number": order_id}
    ]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if verified:
        update_data = {
            "payment_status": "paid",
            "status": "confirmed",
            "payment_verified_at": datetime.now(timezone.utc).isoformat(),
            "payment_verified_by": current_user.get("id"),
            "payment_verification_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        message = "Payment verified successfully"
    else:
        update_data = {
            "payment_status": "failed",
            "status": "not_confirmed",
            "payment_rejection_reason": notes,
            "payment_rejected_at": datetime.now(timezone.utc).isoformat(),
            "payment_rejected_by": current_user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        message = "Payment rejected"
    
    # Update using the MongoDB _id
    await db.orders.update_one({"_id": order.get("_id")}, {"$set": update_data})
    
    await log_validation_action(db, "approved" if verified else "rejected", "payment", order_id,
        order.get("service_name", order.get("order_number", order_id)),
        current_user, notes, {"amount": order.get("total_amount")})
    
    return {"message": message, "order_id": order_id}

@router.post("/payments/bulk-verify")
async def bulk_verify_payments(
    current_user: dict = Depends(get_current_active_user)
):
    """Bulk verify all pending payments"""
    check_validation_access(current_user)
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Find all orders with pending payment status
    pending_orders = await db.orders.find({
        "$or": [
            {"payment_status": "pending"},
            {"payment_status": {"$exists": False}},
            {"status": "pending", "payment_status": {"$ne": "paid"}}
        ]
    }).to_list(1000)
    
    verified_count = 0
    for order in pending_orders:
        update_data = {
            "payment_status": "paid",
            "status": "confirmed",
            "payment_verified_at": datetime.now(timezone.utc).isoformat(),
            "payment_verified_by": current_user.get("id"),
            "payment_verification_notes": "Bulk verified by admin",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.orders.update_one({"_id": order.get("_id")}, {"$set": update_data})
        verified_count += 1
    
    return {"message": f"Successfully verified {verified_count} payments", "verified_count": verified_count}

@router.post("/services/{service_type}/{service_id}/approve")
async def approve_service(
    service_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Approve a pending service submission"""
    check_validation_access(current_user)
    db = get_database()
    
    # Map service types to collections
    collection_map = {
        "travel_route": "travel_routes",
        "hotel": "hotels",
        "car_rental": "car_rentals",
        "restaurant": "restaurants",
        "package": "packages",
        "event": "events",
        "cinema": "cinemas",
        "pressing": "pressing",
        "banquet": "banquets"
    }
    
    collection_name = collection_map.get(service_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")
    
    collection = db[collection_name]
    
    # Try to find by id or _id
    service = await collection.find_one({"$or": [{"id": service_id}, {"_id": service_id}]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await collection.update_one(
        {"_id": service.get("_id")},
        {"$set": {
            "status": "active",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"{service_type.replace('_', ' ').title()} approved", "service_id": service_id}

@router.post("/services/{service_type}/{service_id}/reject")
async def reject_service(
    service_type: str,
    service_id: str,
    request: RejectionRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Reject a pending service submission"""
    check_validation_access(current_user)
    db = get_database()
    
    collection_map = {
        "travel_route": "travel_routes",
        "hotel": "hotels",
        "car_rental": "car_rentals",
        "restaurant": "restaurants",
        "package": "packages",
        "event": "events",
        "cinema": "cinemas",
        "pressing": "pressing",
        "banquet": "banquets"
    }
    
    collection_name = collection_map.get(service_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")
    
    collection = db[collection_name]
    
    # Try to find by id or _id
    service = await collection.find_one({"$or": [{"id": service_id}, {"_id": service_id}]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await collection.update_one(
        {"_id": service.get("_id")},
        {"$set": {
            "status": "rejected",
            "rejection_reason": request.reason,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": current_user.get("id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"{service_type.replace('_', ' ').title()} rejected", "service_id": service_id}


COLLECTION_MAP = {
    "travel_route": "travel_routes", "hotel": "hotels", "car_rental": "car_rentals",
    "restaurant": "restaurants", "package": "packages", "event": "events",
    "cinema": "cinemas", "pressing": "pressing", "banquet": "banquets"
}

@router.post("/services/{service_type}/{service_id}/suspend")
async def suspend_service(
    service_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Suspend (pause) an active service. Operators can suspend their own services."""
    db = get_database()
    collection_name = COLLECTION_MAP.get(service_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")

    service = await db[collection_name].find_one({"$or": [{"id": service_id}, {"_id": service_id}]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Operators can only suspend their own services
    if current_user["role"] == "operator":
        if service.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized to suspend this service")

    await db[collection_name].update_one(
        {"_id": service.get("_id")},
        {"$set": {"status": "suspended", "suspended_at": datetime.now(timezone.utc).isoformat(),
                  "suspended_by": current_user.get("_id") or current_user.get("id"),
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_validation_action(db, "suspended", "service", service_id,
        service.get("name", service.get("title", service_id)), current_user)

    return {"message": f"{service_type.replace('_', ' ').title()} suspended", "service_id": service_id}


@router.post("/services/{service_type}/{service_id}/reinstate")
async def reinstate_service(
    service_type: str,
    service_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Reinstate a suspended service. Sets status back to 'pending' for admin re-approval."""
    db = get_database()
    collection_name = COLLECTION_MAP.get(service_type)
    if not collection_name:
        raise HTTPException(status_code=400, detail=f"Invalid service type: {service_type}")

    service = await db[collection_name].find_one({"$or": [{"id": service_id}, {"_id": service_id}]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Operators can only reinstate their own services
    if current_user["role"] == "operator":
        if service.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized to reinstate this service")

    await db[collection_name].update_one(
        {"_id": service.get("_id")},
        {"$set": {"status": "pending", "reinstated_at": datetime.now(timezone.utc).isoformat(),
                  "reinstated_by": current_user.get("_id") or current_user.get("id"),
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_validation_action(db, "reinstated", "service", service_id,
        service.get("name", service.get("title", service_id)), current_user)

    return {"message": f"{service_type.replace('_', ' ').title()} reinstated (pending approval)", "service_id": service_id}


@router.post("/operators/{operator_id}/approve")
async def approve_operator_validation(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Approve a pending operator (super_admin only)"""
    # Only super_admin can approve operators
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can approve operators"
        )
    
    db = get_database()
    
    # Find the pending operator
    operator = await db.operators.find_one({"$or": [{"id": operator_id}, {"_id": operator_id}], "status": "pending"})
    if not operator:
        raise HTTPException(status_code=404, detail="Pending operator not found")
    
    # Update operator status to active
    await db.operators.update_one(
        {"_id": operator.get("_id")},
        {"$set": {
            "status": "active",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.get("_id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update validation request if exists
    await db.validation_requests.update_one(
        {"operator_id": operator.get("_id"), "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.get("_id"),
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update user role to 'operator' if owner is not admin/super_admin
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        owner_user = await db.users.find_one({"_id": owner_user_id})
        if owner_user and owner_user.get("role") not in ["admin", "super_admin"]:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "operator",
                    "operator_id": operator.get("_id"),
                    "operator_name": operator.get("name"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    # Notify the creator
    created_by = operator.get("created_by") or operator.get("owner_user_id")
    if created_by:
        notification = {
            "_id": str(datetime.now().timestamp()).replace('.', ''),
            "user_id": created_by,
            "notification_type": "operator_approved",
            "title": "Operator Approved",
            "message": f"Operator '{operator.get('name')}' has been approved and is now active.",
            "data": {"operator_id": operator.get("_id")},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {"message": "Operator approved and activated", "operator_id": operator_id}

@router.post("/operators/{operator_id}/reject")
async def reject_operator_validation(
    operator_id: str,
    request: RejectionRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Reject a pending operator (super_admin only)"""
    # Only super_admin can reject operators
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can reject operators"
        )
    
    db = get_database()
    
    # Find the pending operator
    operator = await db.operators.find_one({"$or": [{"id": operator_id}, {"_id": operator_id}], "status": "pending"})
    if not operator:
        raise HTTPException(status_code=404, detail="Pending operator not found")
    
    # Update operator status to rejected
    await db.operators.update_one(
        {"_id": operator.get("_id")},
        {"$set": {
            "status": "rejected",
            "rejection_reason": request.reason,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": current_user.get("_id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update validation request if exists
    await db.validation_requests.update_one(
        {"operator_id": operator.get("_id"), "status": "pending"},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user.get("_id"),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": request.reason
        }}
    )
    
    # Notify the creator
    created_by = operator.get("created_by") or operator.get("owner_user_id")
    if created_by:
        notification = {
            "_id": str(datetime.now().timestamp()).replace('.', ''),
            "user_id": created_by,
            "notification_type": "operator_rejected",
            "title": "Operator Rejected",
            "message": f"Operator '{operator.get('name')}' has been rejected. Reason: {request.reason}",
            "data": {"operator_id": operator.get("_id"), "reason": request.reason},
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {"message": "Operator rejected", "operator_id": operator_id}


# ---- Promotion Approval/Rejection ----

@router.post("/promotions/{promotion_id}/approve")
async def approve_promotion_validation(
    promotion_id: str,
    current_user: dict = Depends(require_permission("validation.view"))
):
    """Approve a pending promotion and send notifications to subscribers."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    promo = await db.promotions.find_one({"_id": promotion_id})
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    if promo.get("status") != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Promotion is already {promo.get('status')}")
    
    await db.promotions.update_one(
        {"_id": promotion_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user.get("_id"),
            "approved_by_name": current_user.get("full_name", ""),
            "approved_at": datetime.now(timezone.utc),
        }}
    )
    
    # Send notifications to subscribers
    import uuid
    operator_id = promo.get("operator_id")
    operator_name = promo.get("operator_name", "Operator")
    subscribers = await db.subscriptions.find({"operator_id": operator_id}).to_list(10000)
    
    notifications = []
    for sub in subscribers:
        notifications.append({
            "_id": str(uuid.uuid4()),
            "user_id": sub["user_id"],
            "title": f"New from {operator_name}: {promo['title']}",
            "message": promo.get("message", ""),
            "type": "promotion",
            "source": "operator_promotion",
            "promotion_id": promotion_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    # Notify the operator that their promotion was approved
    created_by = promo.get("created_by")
    if created_by:
        await db.notifications.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": created_by,
            "title": "Promotion Approved",
            "message": f"Your promotion '{promo['title']}' has been approved and sent to {len(subscribers)} subscribers.",
            "type": "promotion_approved",
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    
    await log_validation_action(db, "approved", "promotion", promotion_id,
        promo.get("title", ""), current_user, None,
        {"operator_name": promo.get("operator_name", ""), "subscribers_notified": len(subscribers)})
    
    return {
        "message": f"Promotion approved and sent to {len(subscribers)} subscribers",
        "notified_count": len(subscribers),
    }


@router.post("/promotions/{promotion_id}/reject")
async def reject_promotion_validation(
    promotion_id: str,
    request: RejectionRequest,
    current_user: dict = Depends(require_permission("validation.view"))
):
    """Reject a pending promotion."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get promo first for logging
    promo = await db.promotions.find_one({"_id": promotion_id})
    
    result = await db.promotions.update_one(
        {"_id": promotion_id, "status": "pending_approval"},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user.get("_id"),
            "rejected_by_name": current_user.get("full_name", ""),
            "rejected_at": datetime.now(timezone.utc),
            "rejection_reason": request.reason,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Promotion not found or already processed")
    
    await log_validation_action(db, "rejected", "promotion", promotion_id,
        promo.get("title", "") if promo else "", current_user, request.reason,
        {"operator_name": promo.get("operator_name") if promo else ""})
    
    # Notify the operator
    if promo and promo.get("created_by"):
        await db.notifications.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": promo["created_by"],
            "title": "Promotion Rejected",
            "message": f"Your promotion '{promo.get('title', '')}' was rejected. Reason: {request.reason}",
            "type": "promotion_rejected",
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    
    return {"message": "Promotion rejected"}


# ---- Validation History ----

@router.get("/history")
async def get_validation_history(
    item_type: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(require_permission("validation.view"))
):
    """Get validation history — all approved/rejected items with who performed the action."""
    db = get_database()

    query = {}
    if item_type:
        query["item_type"] = item_type
    if action:
        query["action"] = action

    entries = await db.validation_history.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.validation_history.count_documents(query)

    # If search, filter client-side
    if search:
        s = search.lower()
        entries = [e for e in entries if s in (e.get("item_name", "") or "").lower() or s in (e.get("performed_by_name", "") or "").lower()]

    # Count by type
    type_counts = {}
    for t in ["payment", "ticket", "service", "promotion", "operator"]:
        type_counts[t] = await db.validation_history.count_documents({"item_type": t})

    return {"entries": entries, "total": total, "type_counts": type_counts}

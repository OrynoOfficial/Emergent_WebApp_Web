from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/ratings", tags=["Ratings"])

class RatingCreate(BaseModel):
    entity_type: str  # service, hotel, restaurant, car, etc.
    entity_id: str
    rating: float  # 1-5
    review: Optional[str] = None
    # Enriched metadata so the operator-side review feed can route + display
    # the review against the correct service/operator without N+1 lookups.
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    entity_name: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    service_type: Optional[str] = None

class RatingResponse(BaseModel):
    message: str
    responder_name: str

class RatingUpdate(BaseModel):
    comment: Optional[str] = None
    rating: Optional[float] = None

@router.post("/")
async def create_rating(
    rating_data: RatingCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a rating/review.

    Ratings can ONLY be left after the customer has been checked in for the
    service. The frontend "Awaiting rating" list surfaces exactly those
    checked-in orders to encourage post-service reviews.
    """
    db = get_database()

    # ── Check-in gate ──────────────────────────────────────────────────────
    # The customer must have a checked-in order matching this entity. We
    # accept either `order_id` (preferred — directly linked) or fall back to
    # "any checked-in order this user has for this entity/service".
    check_in_query = {
        "user_id": current_user["_id"],
        "checked_in": True,
    }
    if rating_data.order_id:
        check_in_query["_id"] = rating_data.order_id
    else:
        check_in_query["$or"] = [
            {"service_id": rating_data.entity_id},
            {"booking_details.service_id": rating_data.entity_id},
            {"booking_details.operator_id": rating_data.entity_id},
        ]
    checked_in_order = await db.orders.find_one(check_in_query)
    if not checked_in_order:
        raise HTTPException(
            status_code=400,
            detail="You can only rate a service after being checked in for it."
        )

    # Resolve enriched metadata from the order if the frontend didn't send it
    operator_id = rating_data.operator_id or checked_in_order.get("operator_id")
    operator_name = rating_data.operator_name or checked_in_order.get("operator_name")
    entity_name = rating_data.entity_name or checked_in_order.get("service_name")
    service_type = rating_data.service_type or checked_in_order.get("service_type") or checked_in_order.get("service_category")
    order_id = rating_data.order_id or checked_in_order.get("_id") or checked_in_order.get("id")
    order_number = rating_data.order_number or checked_in_order.get("order_number")

    # One review per (user, entity)
    existing = await db.ratings.find_one({
        "user_id": current_user["_id"],
        "entity_type": rating_data.entity_type,
        "entity_id": rating_data.entity_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already rated")

    rating = {
        "_id": str(uuid.uuid4()),
        "entity_type": rating_data.entity_type,
        "entity_id": rating_data.entity_id,
        "rating": rating_data.rating,
        "review": rating_data.review,
        # Enriched metadata so operator-side filtering works at query-time
        "order_id": order_id,
        "order_number": order_number,
        "entity_name": entity_name,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "service_type": service_type,
        "user_id": current_user["_id"],
        "user_name": current_user.get("full_name", "Anonymous"),
        "created_at": datetime.now(timezone.utc),
        "checked_in_at": checked_in_order.get("checked_in_at"),
    }

    await db.ratings.insert_one(rating)

    # Update entity average rating
    collection_name = rating_data.entity_type + "s" if not rating_data.entity_type.endswith('s') else rating_data.entity_type
    ratings = await db.ratings.find({
        "entity_type": rating_data.entity_type,
        "entity_id": rating_data.entity_id
    }).to_list(1000)
    if ratings:
        avg_rating = sum(r["rating"] for r in ratings) / len(ratings)
        await db[collection_name].update_one(
            {"_id": rating_data.entity_id},
            {"$set": {"average_rating": avg_rating, "total_ratings": len(ratings)}}
        )

    return {"message": "Rating submitted", "rating_id": rating["_id"]}


@router.get("/pending")
async def get_pending_ratings(current_user: dict = Depends(get_current_active_user)):
    """Return the user's checked-in orders that have NOT been rated yet.

    Surfaced as the "Awaiting rating / review" section on the customer
    Ratings page.
    """
    db = get_database()
    # All checked-in orders for this user
    checked_in_orders = await db.orders.find(
        {"user_id": current_user["_id"], "checked_in": True},
        {
            "_id": 1, "order_number": 1, "service_id": 1, "service_name": 1,
            "service_type": 1, "service_category": 1, "operator_id": 1,
            "operator_name": 1, "checked_in_at": 1, "created_at": 1,
            "booking_details": 1,
        }
    ).sort("checked_in_at", -1).to_list(200)

    if not checked_in_orders:
        return {"pending": []}

    # All entity_ids the user has already rated — exclude those
    user_ratings = await db.ratings.find(
        {"user_id": current_user["_id"]},
        {"_id": 0, "entity_id": 1, "entity_type": 1, "order_id": 1}
    ).to_list(1000)
    rated_keys = {(r.get("entity_type"), r.get("entity_id")) for r in user_ratings}
    rated_order_ids = {r.get("order_id") for r in user_ratings if r.get("order_id")}

    pending = []
    for o in checked_in_orders:
        order_id = o.get("_id")
        if order_id in rated_order_ids:
            continue
        service_id = o.get("service_id") or (o.get("booking_details") or {}).get("service_id")
        service_type = o.get("service_type") or o.get("service_category") or "service"
        entity_type = service_type  # canonical entity_type maps to service_type
        if service_id and (entity_type, service_id) in rated_keys:
            continue
        pending.append({
            "order_id": order_id,
            "order_number": o.get("order_number"),
            "entity_id": service_id,
            "entity_type": entity_type,
            "service_name": o.get("service_name") or "Service",
            "service_type": service_type,
            "operator_id": o.get("operator_id"),
            "operator_name": o.get("operator_name"),
            "checked_in_at": (o.get("checked_in_at").isoformat() if hasattr(o.get("checked_in_at", ""), "isoformat") else o.get("checked_in_at")),
            "created_at": (o.get("created_at").isoformat() if hasattr(o.get("created_at", ""), "isoformat") else o.get("created_at")),
        })
    return {"pending": pending}

@router.get("/")
async def get_ratings(
    entity_type: str,
    entity_id: str,
    skip: int = 0,
    limit: int = 20
):
    """Get ratings for an entity"""
    db = get_database()
    
    query = {"entity_type": entity_type, "entity_id": entity_id}
    ratings = await db.ratings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.ratings.count_documents(query)
    
    return {"ratings": ratings, "total": total}

@router.get("/my")
async def get_my_ratings(
    current_user: dict = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 50
):
    """Get current user's ratings"""
    db = get_database()
    
    ratings = await db.ratings.find(
        {"user_id": current_user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with service details
    enriched_ratings = []
    for rating in ratings:
        enriched = {
            "id": rating.get("id", str(uuid.uuid4())),
            "service_name": rating.get("entity_name", "Service"),
            "service_category": rating.get("service_type") or rating.get("entity_type", "service"),
            "rating": rating.get("rating", 0),
            "comment": rating.get("review", ""),
            "created_at": rating.get("created_at"),
            "helpful_count": rating.get("helpful_count", 0),
            "operator_response": rating.get("operator_response"),
            # Metadata so the operator-side feed can filter / drill in
            "operator_id": rating.get("operator_id"),
            "operator_name": rating.get("operator_name"),
            "order_id": rating.get("order_id"),
            "order_number": rating.get("order_number"),
        }
        enriched_ratings.append(enriched)
    
    return {"ratings": enriched_ratings}

@router.put("/{rating_id}")
async def update_rating(
    rating_id: str,
    update_data: RatingUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a rating (user can only update their own)"""
    db = get_database()
    
    # Find the rating
    rating = await db.ratings.find_one({"_id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    # Check ownership
    if rating.get("user_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this rating")
    
    # Update fields
    update_fields = {}
    if update_data.comment is not None:
        update_fields["review"] = update_data.comment
    if update_data.rating is not None:
        update_fields["rating"] = update_data.rating
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await db.ratings.update_one(
            {"_id": rating_id},
            {"$set": update_fields}
        )
    
    return {"message": "Rating updated"}

@router.get("/operator")
async def get_operator_ratings(
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 50
):
    """Get ratings for services assigned to an operator"""
    db = get_database()
    
    # Get operator info
    op_id = operator_id or current_user.get("operator_id")
    if not op_id:
        return {"ratings": []}
    
    # Get operator to find their service types
    operator = await db.operators.find_one({"_id": op_id})
    if not operator:
        return {"ratings": []}
    
    service_types = operator.get("service_types", [])
    operator_type = operator.get("type")
    
    if operator_type and operator_type not in service_types:
        service_types.append(operator_type)
    
    if not service_types:
        return {"ratings": []}
    
    # Find ratings for these service types
    query = {"entity_type": {"$in": service_types}}
    
    ratings = await db.ratings.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with service and customer details
    enriched_ratings = []
    for rating in ratings:
        enriched = {
            "id": rating.get("_id") or rating.get("id"),
            "service_name": rating.get("entity_name", "Service"),
            "service_id": rating.get("entity_id"),
            "service_category": rating.get("entity_type"),
            "customer_name": rating.get("user_name", "Customer"),
            "rating": rating.get("rating", 0),
            "comment": rating.get("review", ""),
            "created_at": rating.get("created_at"),
            "helpful_count": rating.get("helpful_count", 0),
            "operator_response": rating.get("operator_response")
        }
        enriched_ratings.append(enriched)
    
    return {"ratings": enriched_ratings}

@router.post("/{rating_id}/respond")
async def respond_to_rating(
    rating_id: str,
    response_data: RatingResponse,
    current_user: dict = Depends(get_current_active_user)
):
    """Operator responds to a customer rating"""
    db = get_database()
    
    # Verify user is an operator
    if not current_user.get("operator_id") and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only operators can respond to ratings")
    
    # Find the rating
    rating = await db.ratings.find_one({"_id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    # Add operator response
    operator_response = {
        "message": response_data.message,
        "responder_name": response_data.responder_name,
        "responder_id": current_user["_id"],
        "responded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ratings.update_one(
        {"_id": rating_id},
        {"$set": {"operator_response": operator_response}}
    )
    
    return {"message": "Response submitted successfully"}


# ==================== ADMIN MODERATION ENDPOINTS ====================

class RatingModeration(BaseModel):
    action: str  # 'flag', 'unflag', 'hide', 'unhide', 'delete'
    reason: Optional[str] = None

@router.get("/all")
async def get_all_ratings(
    service_type: Optional[str] = None,
    rating: Optional[int] = None,
    flagged_only: bool = False,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all ratings across the platform (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Build query
    query = {}
    if service_type:
        query["entity_type"] = service_type
    if rating:
        query["rating"] = rating
    if flagged_only:
        query["is_flagged"] = True
    
    ratings = await db.ratings.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ratings.count_documents(query)
    
    # Enrich with user and operator info
    enriched_ratings = []
    for r in ratings:
        # Apply search filter
        if search:
            search_lower = search.lower()
            service_name = r.get("entity_name", "").lower()
            user_name = r.get("user_name", "").lower()
            comment = r.get("review", "").lower()
            if not (search_lower in service_name or search_lower in user_name or search_lower in comment):
                continue
        
        # Get operator info if available
        operator_name = None
        if r.get("operator_id"):
            operator = await db.operators.find_one({"_id": r["operator_id"]}, {"name": 1})
            operator_name = operator.get("name") if operator else None
        
        enriched = {
            "id": r.get("_id") or r.get("id", str(uuid.uuid4())),
            "service_name": r.get("entity_name", "Service"),
            "service_id": r.get("entity_id"),
            "service_category": r.get("entity_type"),
            "customer_name": r.get("user_name", "Customer"),
            "customer_id": r.get("user_id"),
            "operator_name": operator_name,
            "operator_id": r.get("operator_id"),
            "rating": r.get("rating", 0),
            "comment": r.get("review", ""),
            "created_at": r.get("created_at"),
            "helpful_count": r.get("helpful_count", 0),
            "operator_response": r.get("operator_response"),
            "is_flagged": r.get("is_flagged", False),
            "is_hidden": r.get("is_hidden", False),
            "moderation_notes": r.get("moderation_notes")
        }
        enriched_ratings.append(enriched)
    
    return {"ratings": enriched_ratings, "total": total}


@router.post("/{rating_id}/moderate")
async def moderate_rating(
    rating_id: str,
    moderation: RatingModeration,
    current_user: dict = Depends(get_current_active_user)
):
    """Moderate a rating (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Find the rating
    rating = await db.ratings.find_one({"_id": rating_id})
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    update_data = {"moderated_at": datetime.now(timezone.utc)}
    
    if moderation.action == "flag":
        update_data["is_flagged"] = True
        update_data["flag_reason"] = moderation.reason
    elif moderation.action == "unflag":
        update_data["is_flagged"] = False
        update_data["flag_reason"] = None
    elif moderation.action == "hide":
        update_data["is_hidden"] = True
        update_data["hide_reason"] = moderation.reason
    elif moderation.action == "unhide":
        update_data["is_hidden"] = False
        update_data["hide_reason"] = None
    elif moderation.action == "delete":
        await db.ratings.delete_one({"_id": rating_id})
        await db.moderation_audit.insert_one({
            "_id": str(uuid.uuid4()),
            "rating_id": rating_id,
            "action": "delete",
            "reason": moderation.reason,
            "performed_by": current_user.get("_id"),
            "performed_by_name": current_user.get("full_name", current_user.get("email", "")),
            "performed_by_role": current_user.get("role"),
            "created_at": datetime.now(timezone.utc),
            "bulk": False,
        })
        return {"message": "Rating deleted successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid moderation action")
    
    if moderation.reason:
        update_data["moderation_notes"] = moderation.reason
    
    await db.ratings.update_one({"_id": rating_id}, {"$set": update_data})
    
    # Log moderation audit
    await db.moderation_audit.insert_one({
        "_id": str(uuid.uuid4()),
        "rating_id": rating_id,
        "action": moderation.action,
        "reason": moderation.reason,
        "performed_by": current_user.get("_id"),
        "performed_by_name": current_user.get("full_name", current_user.get("email", "")),
        "performed_by_role": current_user.get("role"),
        "created_at": datetime.now(timezone.utc),
        "bulk": False,
    })
    
    return {"message": f"Rating {moderation.action}ged successfully"}


class BulkModeration(BaseModel):
    rating_ids: List[str]
    action: str  # 'flag', 'unflag', 'hide', 'unhide', 'delete'
    reason: Optional[str] = None


@router.post("/bulk-moderate")
async def bulk_moderate_ratings(
    moderation: BulkModeration,
    current_user: dict = Depends(get_current_active_user)
):
    """Bulk moderate ratings (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not moderation.rating_ids:
        raise HTTPException(status_code=400, detail="No ratings provided")
    
    db = get_database()
    
    update_data = {"moderated_at": datetime.now(timezone.utc)}
    deleted_count = 0
    updated_count = 0
    
    if moderation.action == "delete":
        # Delete all selected ratings
        result = await db.ratings.delete_many({"_id": {"$in": moderation.rating_ids}})
        deleted_count = result.deleted_count
        return {"message": f"{deleted_count} rating(s) deleted successfully", "count": deleted_count}
    
    # Build update based on action
    if moderation.action == "flag":
        update_data["is_flagged"] = True
        if moderation.reason:
            update_data["flag_reason"] = moderation.reason
    elif moderation.action == "unflag":
        update_data["is_flagged"] = False
        update_data["flag_reason"] = None
    elif moderation.action == "hide":
        update_data["is_hidden"] = True
        if moderation.reason:
            update_data["hide_reason"] = moderation.reason
    elif moderation.action == "unhide":
        update_data["is_hidden"] = False
        update_data["hide_reason"] = None
    else:
        raise HTTPException(status_code=400, detail="Invalid moderation action")
    
    if moderation.reason:
        update_data["moderation_notes"] = moderation.reason
    
    # Update all selected ratings
    result = await db.ratings.update_many(
        {"_id": {"$in": moderation.rating_ids}},
        {"$set": update_data}
    )
    updated_count = result.modified_count
    
    # Log moderation audit trail
    audit_entries = []
    for rid in moderation.rating_ids:
        audit_entries.append({
            "_id": str(uuid.uuid4()),
            "rating_id": rid,
            "action": moderation.action,
            "reason": moderation.reason,
            "performed_by": current_user.get("_id"),
            "performed_by_name": current_user.get("full_name", current_user.get("email", "")),
            "performed_by_role": current_user.get("role"),
            "created_at": datetime.now(timezone.utc),
            "bulk": True,
            "batch_size": len(moderation.rating_ids),
        })
    if audit_entries:
        await db.moderation_audit.insert_many(audit_entries)
    
    return {"message": f"{updated_count} rating(s) {moderation.action}ged successfully", "count": updated_count}


@router.get("/moderation-queue")
async def get_moderation_queue(
    status_filter: str = "all",
    sort_by: str = "newest",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get moderation queue — flagged, hidden, and reported ratings for review."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    query = {}
    if status_filter == "flagged":
        query["is_flagged"] = True
    elif status_filter == "hidden":
        query["is_hidden"] = True
    elif status_filter == "low":
        query["rating"] = {"$lte": 2}
    elif status_filter == "needs_review":
        query["$or"] = [{"is_flagged": True}, {"is_hidden": True}, {"rating": {"$lte": 1}}]
    else:
        query["$or"] = [{"is_flagged": True}, {"is_hidden": True}]

    sort_field = "created_at"
    sort_dir = -1
    if sort_by == "oldest":
        sort_dir = 1
    elif sort_by == "lowest":
        sort_field = "rating"
        sort_dir = 1
    elif sort_by == "highest":
        sort_field = "rating"
        sort_dir = -1

    items = await db.ratings.find(query).sort(sort_field, sort_dir).skip(skip).limit(limit).to_list(limit)
    total = await db.ratings.count_documents(query)

    queue = []
    for r in items:
        queue.append({
            "id": str(r.get("_id", "")),
            "service_name": r.get("entity_name", "Service"),
            "service_category": r.get("entity_type", ""),
            "customer_name": r.get("user_name", "Customer"),
            "customer_id": r.get("user_id", ""),
            "operator_id": r.get("operator_id"),
            "rating": r.get("rating", 0),
            "comment": r.get("review", ""),
            "created_at": r.get("created_at"),
            "is_flagged": r.get("is_flagged", False),
            "is_hidden": r.get("is_hidden", False),
            "flag_reason": r.get("flag_reason"),
            "moderation_notes": r.get("moderation_notes"),
            "moderated_at": r.get("moderated_at"),
            "operator_response": r.get("operator_response"),
        })

    # Counts for queue tabs
    flagged_count = await db.ratings.count_documents({"is_flagged": True})
    hidden_count = await db.ratings.count_documents({"is_hidden": True})
    low_rating_count = await db.ratings.count_documents({"rating": {"$lte": 2}})

    return {
        "queue": queue,
        "total": total,
        "counts": {
            "flagged": flagged_count,
            "hidden": hidden_count,
            "low_rating": low_rating_count,
        }
    }


@router.get("/moderation-audit")
async def get_moderation_audit(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """Get moderation audit log showing all moderation actions taken."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    entries = await db.moderation_audit.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.moderation_audit.count_documents({})

    return {"entries": entries, "total": total}


@router.get("/export")
async def export_ratings(
    format: str = "json",
    service_type: Optional[str] = None,
    flagged_only: bool = False,
    limit: int = Query(5000, ge=1, le=50000, description="Max ratings to export (cap=50000)"),
    current_user: dict = Depends(get_current_active_user)
):
    """Export ratings data as JSON for admin reporting."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    query = {}
    if service_type:
        query["entity_type"] = service_type
    if flagged_only:
        query["is_flagged"] = True

    ratings = await db.ratings.find(query).sort("created_at", -1).to_list(limit)

    export_data = []
    for r in ratings:
        export_data.append({
            "id": str(r.get("_id", "")),
            "service_name": r.get("entity_name", ""),
            "service_type": r.get("entity_type", ""),
            "customer_name": r.get("user_name", ""),
            "rating": r.get("rating", 0),
            "review": r.get("review", ""),
            "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
            "is_flagged": r.get("is_flagged", False),
            "is_hidden": r.get("is_hidden", False),
            "flag_reason": r.get("flag_reason"),
            "moderation_notes": r.get("moderation_notes"),
            "operator_response": r.get("operator_response"),
        })

    return {
        "ratings": export_data,
        "total": len(export_data),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "filters": {"service_type": service_type, "flagged_only": flagged_only},
    }


@router.get("/stats")
async def get_ratings_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get ratings statistics (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    total = await db.ratings.count_documents({})
    responded = await db.ratings.count_documents({"operator_response": {"$exists": True, "$ne": None}})
    flagged = await db.ratings.count_documents({"is_flagged": True})
    
    # Rating distribution
    rating_pipeline = [
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}}
    ]
    rating_counts = await db.ratings.aggregate(rating_pipeline).to_list(10)
    by_rating = {r["_id"]: r["count"] for r in rating_counts}
    
    # Average rating
    avg_pipeline = [
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}
    ]
    avg_result = await db.ratings.aggregate(avg_pipeline).to_list(1)
    avg_rating = avg_result[0]["avg"] if avg_result else 0
    
    return {
        "total": total,
        "responded": responded,
        "pending": total - responded,
        "flagged": flagged,
        "average": round(avg_rating, 1) if avg_rating else 0,
        "byRating": {
            5: by_rating.get(5, 0),
            4: by_rating.get(4, 0),
            3: by_rating.get(3, 0),
            2: by_rating.get(2, 0),
            1: by_rating.get(1, 0)
        }
    }


@router.get("/reports/analytics")
async def get_ratings_analytics(
    time_range: str = "30d",  # 7d, 30d, 90d, 1y, all
    current_user: dict = Depends(get_current_active_user)
):
    """Get advanced ratings analytics for reports (admin only)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Calculate date range
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    if time_range == "7d":
        start_date = now - timedelta(days=7)
    elif time_range == "30d":
        start_date = now - timedelta(days=30)
    elif time_range == "90d":
        start_date = now - timedelta(days=90)
    elif time_range == "1y":
        start_date = now - timedelta(days=365)
    else:
        start_date = None
    
    date_filter = {"created_at": {"$gte": start_date}} if start_date else {}
    
    # Get all ratings in time range
    ratings = await db.ratings.find(date_filter).to_list(10000)
    
    # 1. Rating Trends Over Time (daily aggregation)
    trend_pipeline = [
        {"$match": date_filter} if date_filter else {"$match": {}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1},
                "average": {"$avg": "$rating"},
                "flagged": {"$sum": {"$cond": [{"$eq": ["$is_flagged", True]}, 1, 0]}}
            }
        },
        {"$sort": {"_id": 1}},
        {"$limit": 90}
    ]
    trend_data = await db.ratings.aggregate(trend_pipeline).to_list(100)
    
    # 2. Breakdown by Service Category
    category_pipeline = [
        {"$match": date_filter} if date_filter else {"$match": {}},
        {
            "$group": {
                "_id": "$service_category",
                "count": {"$sum": 1},
                "average": {"$avg": "$rating"},
                "five_star": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
                "four_star": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
                "three_star": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
                "two_star": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
                "one_star": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
                "responded": {"$sum": {"$cond": [{"$ne": ["$operator_response", None]}, 1, 0]}},
                "flagged": {"$sum": {"$cond": [{"$eq": ["$is_flagged", True]}, 1, 0]}}
            }
        },
        {"$sort": {"count": -1}}
    ]
    category_data = await db.ratings.aggregate(category_pipeline).to_list(20)
    
    # 3. Flagged Reviews Analysis
    flagged_pipeline = [
        {"$match": {**date_filter, "is_flagged": True}},
        {
            "$group": {
                "_id": "$service_category",
                "count": {"$sum": 1},
                "average_rating": {"$avg": "$rating"}
            }
        },
        {"$sort": {"count": -1}}
    ]
    flagged_by_category = await db.ratings.aggregate(flagged_pipeline).to_list(20)
    
    # Recent flagged reviews
    recent_flagged = await db.ratings.find(
        {**date_filter, "is_flagged": True}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Clean up ObjectIds for JSON serialization
    for item in recent_flagged:
        item["id"] = str(item.get("_id", ""))
        if "_id" in item:
            del item["_id"]
        if "created_at" in item:
            item["created_at"] = item["created_at"].isoformat() if hasattr(item["created_at"], "isoformat") else str(item["created_at"])
    
    # 4. Response Rate Metrics
    total_ratings = len(ratings)
    responded_count = sum(1 for r in ratings if r.get("operator_response"))
    response_rate = (responded_count / total_ratings * 100) if total_ratings > 0 else 0
    
    # Average time to respond (for ratings with responses)
    response_times = []
    for r in ratings:
        if r.get("operator_response") and r.get("created_at"):
            resp = r.get("operator_response", {})
            if isinstance(resp, dict) and resp.get("responded_at"):
                try:
                    created = r["created_at"]
                    responded = resp["responded_at"]
                    if isinstance(responded, str):
                        responded = datetime.fromisoformat(responded.replace("Z", "+00:00"))
                    if isinstance(created, str):
                        created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    delta = (responded - created).total_seconds() / 3600  # Hours
                    if delta > 0:
                        response_times.append(delta)
                except Exception:
                    pass
    
    avg_response_time = sum(response_times) / len(response_times) if response_times else 0
    
    # 5. Top Operators by Response Rate
    operator_pipeline = [
        {"$match": date_filter} if date_filter else {"$match": {}},
        {
            "$group": {
                "_id": "$operator_name",
                "total": {"$sum": 1},
                "responded": {"$sum": {"$cond": [{"$ne": ["$operator_response", None]}, 1, 0]}},
                "average_rating": {"$avg": "$rating"}
            }
        },
        {"$match": {"total": {"$gte": 3}}},  # At least 3 ratings
        {"$addFields": {
            "response_rate": {"$multiply": [{"$divide": ["$responded", "$total"]}, 100]}
        }},
        {"$sort": {"response_rate": -1}},
        {"$limit": 10}
    ]
    top_operators = await db.ratings.aggregate(operator_pipeline).to_list(10)
    
    # 6. Summary Stats
    summary = {
        "total_ratings": total_ratings,
        "average_rating": round(sum(r.get("rating", 0) for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0,
        "response_rate": round(response_rate, 1),
        "avg_response_time_hours": round(avg_response_time, 1),
        "flagged_count": sum(1 for r in ratings if r.get("is_flagged")),
        "hidden_count": sum(1 for r in ratings if r.get("is_hidden")),
        "five_star_percent": round(sum(1 for r in ratings if r.get("rating") == 5) / total_ratings * 100, 1) if total_ratings > 0 else 0,
        "negative_percent": round(sum(1 for r in ratings if r.get("rating", 0) <= 2) / total_ratings * 100, 1) if total_ratings > 0 else 0
    }
    
    return {
        "summary": summary,
        "trends": [
            {"date": t["_id"], "count": t["count"], "average": round(t["average"], 2), "flagged": t["flagged"]}
            for t in trend_data
        ],
        "by_category": [
            {
                "category": c["_id"] or "unknown",
                "count": c["count"],
                "average": round(c["average"], 2) if c["average"] else 0,
                "distribution": {
                    5: c["five_star"],
                    4: c["four_star"],
                    3: c["three_star"],
                    2: c["two_star"],
                    1: c["one_star"]
                },
                "responded": c["responded"],
                "response_rate": round(c["responded"] / c["count"] * 100, 1) if c["count"] > 0 else 0,
                "flagged": c["flagged"]
            }
            for c in category_data
        ],
        "flagged_analysis": {
            "by_category": [
                {"category": f["_id"] or "unknown", "count": f["count"], "avg_rating": round(f["average_rating"], 2) if f["average_rating"] else 0}
                for f in flagged_by_category
            ],
            "recent": recent_flagged
        },
        "top_operators": [
            {
                "name": o["_id"] or "Unknown",
                "total": o["total"],
                "responded": o["responded"],
                "response_rate": round(o["response_rate"], 1),
                "avg_rating": round(o["average_rating"], 2) if o["average_rating"] else 0
            }
            for o in top_operators
        ]
    }

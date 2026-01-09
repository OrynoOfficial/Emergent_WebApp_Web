from fastapi import APIRouter, HTTPException, status, Depends
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
    """Create a rating/review"""
    db = get_database()
    
    # Check if user already rated this entity
    existing = await db.ratings.find_one({
        "user_id": current_user["_id"],
        "entity_type": rating_data.entity_type,
        "entity_id": rating_data.entity_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already rated")
    
    rating = {
        "_id": str(uuid.uuid4()),
        **rating_data.dict(),
        "user_id": current_user["_id"],
        "user_name": current_user.get("full_name", "Anonymous"),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.ratings.insert_one(rating)
    
    # Update entity average rating
    collection_name = rating_data.entity_type + "s" if not rating_data.entity_type.endswith('s') else rating_data.entity_type
    
    # Calculate new average
    ratings = await db.ratings.find({
        "entity_type": rating_data.entity_type,
        "entity_id": rating_data.entity_id
    }).to_list(1000)
    
    avg_rating = sum(r["rating"] for r in ratings) / len(ratings)
    
    await db[collection_name].update_one(
        {"_id": rating_data.entity_id},
        {"$set": {"average_rating": avg_rating, "total_ratings": len(ratings)}}
    )
    
    return {"message": "Rating submitted", "rating_id": rating["_id"]}

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
            "service_category": rating.get("entity_type", "service"),
            "rating": rating.get("rating", 0),
            "comment": rating.get("review", ""),
            "created_at": rating.get("created_at"),
            "helpful_count": rating.get("helpful_count", 0),
            "operator_response": rating.get("operator_response")
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
    
    ratings = await db.ratings.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with service and customer details
    enriched_ratings = []
    for rating in ratings:
        enriched = {
            "id": rating.get("id", str(uuid.uuid4())),
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
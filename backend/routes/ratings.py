from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/ratings", tags=["Ratings"])

class RatingCreate(BaseModel):
    entity_type: str  # service, hotel, restaurant, car, etc.
    entity_id: str
    rating: float  # 1-5
    review: Optional[str] = None

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
        "created_at": datetime.utcnow()
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
    ratings = await db.ratings.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.ratings.count_documents(query)
    
    return {"ratings": ratings, "total": total}
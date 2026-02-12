"""
Favourites API — allows users to save/unsave any service item.
Each favourite stores the service_type, item_id, and a snapshot of key details
so the Settings/Favourites page can display them without re-fetching each service.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/favourites", tags=["Favourites"])


class FavouriteCreate(BaseModel):
    service_type: str  # hotels, travel, restaurants, car_rental, events, cinema, laundry, banquet, packages
    item_id: str
    item_name: str
    item_image: Optional[str] = None
    item_location: Optional[str] = None
    item_price: Optional[float] = None
    item_rating: Optional[float] = None
    extra: Optional[dict] = None  # Any extra metadata


@router.post("/")
async def add_favourite(
    data: FavouriteCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Add an item to favourites"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    # Check if already favourited
    existing = await db.favourites.find_one({
        "user_id": user_id,
        "service_type": data.service_type,
        "item_id": data.item_id
    })
    if existing:
        return {"message": "Already in favourites", "id": str(existing.get("_id", ""))}

    fav = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "service_type": data.service_type,
        "item_id": data.item_id,
        "item_name": data.item_name,
        "item_image": data.item_image,
        "item_location": data.item_location,
        "item_price": data.item_price,
        "item_rating": data.item_rating,
        "extra": data.extra,
        "created_at": datetime.now(timezone.utc),
    }
    await db.favourites.insert_one(fav)

    return {"message": "Added to favourites", "id": fav["_id"]}


@router.delete("/{service_type}/{item_id}")
async def remove_favourite(
    service_type: str,
    item_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Remove an item from favourites"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    result = await db.favourites.delete_one({
        "user_id": user_id,
        "service_type": service_type,
        "item_id": item_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favourite not found")

    return {"message": "Removed from favourites"}


@router.get("/")
async def get_favourites(
    service_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's favourites, optionally filtered by service type"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    query = {"user_id": user_id}
    if service_type:
        query["service_type"] = service_type

    favs = await db.favourites.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.favourites.count_documents(query)

    return {"favourites": favs, "total": total}


@router.get("/check")
async def check_favourite(
    service_type: str,
    item_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Check if an item is in the user's favourites"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    existing = await db.favourites.find_one({
        "user_id": user_id,
        "service_type": service_type,
        "item_id": item_id
    })

    return {"is_favourite": existing is not None}


@router.get("/ids")
async def get_favourite_ids(
    service_type: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all favourite item IDs for a service type (for bulk checking in result pages)"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")

    favs = await db.favourites.find(
        {"user_id": user_id, "service_type": service_type},
        {"item_id": 1, "_id": 0}
    ).to_list(500)

    return {"ids": [f["item_id"] for f in favs]}

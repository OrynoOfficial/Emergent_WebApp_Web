from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])

class RestaurantCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: str
    city: str
    country: str
    cuisine_type: list = []
    phone: Optional[str] = None
    accepts_reservations: bool = True
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    images: Optional[list] = []

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    price: float
    image: Optional[str] = None
    images: Optional[list] = []
    ingredients: Optional[list] = []
    allergens: Optional[list] = []
    available: bool = True

class OrderItem(BaseModel):
    item_id: str
    quantity: int
    price: float

class RestaurantOrderCreate(BaseModel):
    items: List[OrderItem]
    order_type: str = "dine-in"
    subtotal: float
    discount: float = 0
    total: float
    promo_code: Optional[str] = None
    reservation_date: Optional[str] = None
    reservation_time: Optional[str] = None
    guests: Optional[int] = None
    special_requests: Optional[str] = None

@router.post("/")
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    current_user: dict = Depends(require_any_permission(["restaurants.create", "operator.services.create"]))
):
    """Create a new restaurant - requires restaurants.create permission"""
    db = get_database()
    
    # Use provided operator_id or default to current user
    operator_id = restaurant_data.operator_id or current_user["_id"]
    operator_name = restaurant_data.operator_name or ""
    
    # If operator_id provided but no name, try to fetch it
    if operator_id and not operator_name:
        operator = await db.operators.find_one({"_id": operator_id})
        if operator:
            operator_name = operator.get("name", "")
    
    restaurant = {
        "_id": str(uuid.uuid4()),
        **restaurant_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "average_rating": 0.0,
        "total_ratings": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.restaurants.insert_one(restaurant)
    return {"message": "Restaurant created", "restaurant_id": restaurant["_id"]}

@router.get("/")
async def get_restaurants(
    city: Optional[str] = None,
    country: Optional[str] = None,
    cuisine: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get all restaurants - optionally filtered by country"""
    db = get_database()
    
    query = {"is_active": True}
    if operator_id:
        query["operator_id"] = operator_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if cuisine:
        query["cuisine_type"] = {"$regex": cuisine, "$options": "i"}
    
    # Apply country filter (restaurants have a direct country field + operator fallback)
    if country:
        from utils.location_filter import get_country_filter, get_operator_ids_for_country
        from utils.geolocation import is_african_country
        if is_african_country(country):
            direct = await get_country_filter(db, country)
            op_ids = await get_operator_ids_for_country(db, country)
            conditions = []
            if direct:
                conditions.append(direct)
            if op_ids:
                conditions.append({"operator_id": {"$in": op_ids}})
            if conditions:
                query["$or"] = conditions
    
    restaurants = await db.restaurants.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.restaurants.count_documents(query)
    
    # Compute live tables_available for today across all restaurants in one query.
    # Uses today's confirmed orders to subtract from total_tables -> drives AlmostSoldOutBadge.
    from datetime import datetime as _dt
    today_iso = _dt.utcnow().strftime("%Y-%m-%d")
    restaurant_ids = [r["_id"] for r in restaurants]
    booked_today_by_restaurant: dict = {}
    if restaurant_ids:
        pipeline = [
            {"$match": {
                "service_type": "restaurant",
                "service_id": {"$in": restaurant_ids},
                "status": {"$nin": ["cancelled", "abandoned", "failed"]},
                "booking_details.date": today_iso,
            }},
            {"$group": {"_id": "$service_id", "count": {"$sum": 1}}},
        ]
        async for row in db.orders.aggregate(pipeline):
            booked_today_by_restaurant[row["_id"]] = row["count"]
    
    # Transform _id to id for each restaurant + attach tables_available
    for r in restaurants:
        rid = r["_id"]
        r["id"] = str(r.pop("_id", ""))
        total_tables = int(r.get("total_tables") or 0)
        booked = int(booked_today_by_restaurant.get(rid, 0))
        if total_tables > 0:
            r["tables_available"] = max(0, total_tables - booked)
    
    return {"restaurants": restaurants, "total": total}

@router.get("/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant details"""
    db = get_database()
    restaurant = await db.restaurants.find_one({"_id": restaurant_id})
    if not restaurant:
        # Return mock data for demo
        return {
            "id": restaurant_id,
            "name": "La Belle Époque",
            "cuisine_type": ["african", "french"],
            "city": "Yaoundé",
            "address": "Avenue Kennedy, Bastos",
            "rating": 4.7,
            "opening_hours": "11:00 - 22:00",
            "phone": "+237 699 123 456"
        }
    restaurant["id"] = str(restaurant.pop("_id", ""))
    return restaurant

@router.get("/{restaurant_id}/menu")
async def get_restaurant_menu(restaurant_id: str, exclude_allergens: Optional[str] = None, ingredient: Optional[str] = None):
    """Get restaurant menu with auto-derived popularity and optional dietary filters"""
    db = get_database()
    menu_items = await db.restaurant_menu.find(
        {"restaurant_id": restaurant_id, "is_available": {"$ne": False}}
    ).to_list(100)
    
    # Auto-derive popularity from order data
    # Count how often each item name appears in completed/confirmed orders
    popular_item_names = set()
    try:
        pipeline = [
            {"$match": {
                "restaurant_id": restaurant_id,
                "status": {"$in": ["confirmed", "completed", "delivered", "pending"]}
            }},
            {"$unwind": "$items"},
            {"$group": {"_id": "$items.name", "order_count": {"$sum": "$items.quantity"}}},
            {"$sort": {"order_count": -1}},
            {"$limit": 5}
        ]
        top_items = await db.orders.aggregate(pipeline).to_list(5)
        # Items ordered 2+ times are popular
        popular_item_names = {item["_id"] for item in top_items if item.get("order_count", 0) >= 2}
    except Exception:
        pass
    
    # Transform for frontend
    items = []
    for item in menu_items:
        item_name = item.get("name", "")
        # Build images array: use explicit images field, fall back to single image
        images_list = item.get("images") or []
        single_image = item.get("image", "")
        if single_image and single_image not in images_list:
            images_list = [single_image] + images_list
        items.append({
            "id": str(item.get("_id", item.get("id", ""))),
            "name": item_name,
            "category": item.get("category", "mains"),
            "price": item.get("price", 0),
            "description": item.get("description", ""),
            "image": single_image or (images_list[0] if images_list else ""),
            "images": images_list[:3],
            "ingredients": item.get("ingredients", []),
            "allergens": item.get("allergens", []),
            "is_available": item.get("is_available", True),
            "available": item.get("is_available", True),
            "popular": item_name in popular_item_names
        })
    
    # If no menu items, return demo data with ingredients and allergens
    if not items:
        demo_items = [
            {"id": "1", "name": "Ndolé with Plantains", "category": "mains", "price": 5500, "description": "Traditional Cameroonian dish with bitter leaves and peanuts", "image": "", "images": [], "ingredients": ["Bitter leaves", "Peanuts", "Crayfish", "Palm oil", "Plantains"], "allergens": ["Peanuts", "Shellfish"], "is_available": True, "available": True},
            {"id": "2", "name": "Grilled Fish (Braise)", "category": "mains", "price": 8000, "description": "Fresh tilapia grilled with spices and plantains", "image": "", "images": [], "ingredients": ["Tilapia", "Tomatoes", "Onions", "Pepper", "Plantains"], "allergens": ["Fish"], "is_available": True, "available": True},
            {"id": "3", "name": "Poulet DG", "category": "mains", "price": 7500, "description": "Chicken with plantains in a rich tomato sauce", "image": "", "images": [], "ingredients": ["Chicken", "Plantains", "Tomatoes", "Carrots", "Green beans"], "allergens": [], "is_available": True, "available": True},
            {"id": "4", "name": "Eru Soup", "category": "mains", "price": 6000, "description": "Spinach-like vegetable soup with waterleaf", "image": "", "images": [], "ingredients": ["Eru leaves", "Waterleaf", "Crayfish", "Palm oil"], "allergens": ["Shellfish"], "is_available": True, "available": True},
            {"id": "5", "name": "Koki Beans", "category": "starters", "price": 2500, "description": "Steamed bean cake wrapped in banana leaves", "image": "", "images": [], "ingredients": ["Black-eyed beans", "Palm oil", "Banana leaves"], "allergens": [], "is_available": True, "available": True},
            {"id": "6", "name": "Accra Banana", "category": "starters", "price": 1500, "description": "Fried ripe banana fritters", "image": "", "images": [], "ingredients": ["Ripe bananas", "Flour", "Sugar"], "allergens": ["Gluten"], "is_available": True, "available": True},
            {"id": "7", "name": "Fresh Fruit Salad", "category": "desserts", "price": 2000, "description": "Seasonal tropical fruits", "image": "", "images": [], "ingredients": ["Mango", "Pineapple", "Papaya", "Passion fruit"], "allergens": [], "is_available": True, "available": True},
            {"id": "8", "name": "Gâteau de Manioc", "category": "desserts", "price": 2500, "description": "Traditional cassava cake", "image": "", "images": [], "ingredients": ["Cassava", "Coconut", "Sugar", "Eggs"], "allergens": ["Eggs"], "is_available": True, "available": True},
            {"id": "9", "name": "Fresh Juice", "category": "drinks", "price": 1500, "description": "Orange, pineapple, or passion fruit", "image": "", "images": [], "ingredients": [], "allergens": [], "is_available": True, "available": True},
            {"id": "10", "name": "Bissap (Hibiscus)", "category": "drinks", "price": 1000, "description": "Refreshing hibiscus drink", "image": "", "images": [], "ingredients": ["Hibiscus flowers", "Sugar", "Ginger"], "allergens": [], "is_available": True, "available": True},
            {"id": "11", "name": "Chef's Special Platter", "category": "specials", "price": 15000, "description": "Assortment of our best dishes for 2", "image": "", "images": [], "ingredients": [], "allergens": ["Peanuts", "Fish", "Shellfish"], "is_available": True, "available": True},
            {"id": "12", "name": "Suya Skewers", "category": "starters", "price": 3000, "description": "Spiced grilled meat skewers", "image": "", "images": [], "ingredients": ["Beef", "Suya spice", "Onions", "Tomatoes"], "allergens": ["Peanuts"], "is_available": True, "available": True}
        ]
        sorted_by_price = sorted(demo_items, key=lambda x: x["price"], reverse=True)
        top_names = {item["name"] for item in sorted_by_price[:3]}
        for item in demo_items:
            item["popular"] = item["name"] in top_names
        items = demo_items
    
    # Apply dietary filters
    if exclude_allergens:
        excluded = [a.strip().lower() for a in exclude_allergens.split(",") if a.strip()]
        items = [item for item in items if not any(
            a.lower() in excluded for a in item.get("allergens", [])
        )]
    
    if ingredient:
        ingredient_lower = ingredient.strip().lower()
        items = [item for item in items if any(
            ingredient_lower in ing.lower() for ing in item.get("ingredients", [])
        )]
    
    return {"items": items}

@router.post("/{restaurant_id}/menu")
async def add_menu_item(
    restaurant_id: str,
    item_data: MenuItemCreate,
    current_user: dict = Depends(require_any_permission(["restaurants.manage_menu", "operator.services.edit"]))
):
    """Add menu item to restaurant - requires restaurants.manage_menu permission"""
    db = get_database()
    
    menu_item = {
        "_id": str(uuid.uuid4()),
        "restaurant_id": restaurant_id,
        **item_data.dict(),
        "is_available": item_data.available,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.restaurant_menu.insert_one(menu_item)
    return {"message": "Menu item added", "item_id": menu_item["_id"]}

@router.post("/{restaurant_id}/orders")
async def create_restaurant_order(
    restaurant_id: str,
    order_data: RestaurantOrderCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a restaurant order/reservation"""
    db = get_database()
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "restaurant"})
    order_number = f"REST-{order_count + 1:06d}"
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": current_user["_id"],
        "restaurant_id": restaurant_id,
        "service_category": "restaurant",
        "service_name": "Restaurant Order",
        "order_type": order_data.order_type,
        "items": [item.dict() for item in order_data.items],
        "subtotal": order_data.subtotal,
        "discount": order_data.discount,
        "total_amount": order_data.total,
        "promo_code": order_data.promo_code,
        "reservation_date": order_data.reservation_date,
        "reservation_time": order_data.reservation_time,
        "guests": order_data.guests,
        "special_requests": order_data.special_requests,
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.orders.insert_one(order)
    
    return {
        "message": "Order created successfully",
        "order_id": order["_id"],
        "order_number": order_number
    }

@router.get("/{restaurant_id}/orders")
async def get_restaurant_orders(
    restaurant_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get orders for a restaurant"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        # Customers can only see their own orders
        orders = await db.orders.find({
            "restaurant_id": restaurant_id,
            "user_id": current_user["_id"]
        }, {"_id": 0}).to_list(100)
    else:
        orders = await db.orders.find({
            "restaurant_id": restaurant_id
        }, {"_id": 0}).to_list(100)
    
    return {"orders": orders}


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    cuisine_type: Optional[list] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    accepts_reservations: Optional[bool] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    images: Optional[list] = None
    price_range: Optional[str] = None
    features: Optional[list] = None
    opening_hours: Optional[dict] = None
    rating: Optional[float] = None
    is_active: Optional[bool] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    images: Optional[list] = None
    ingredients: Optional[list] = None
    allergens: Optional[list] = None
    available: Optional[bool] = None
    is_available: Optional[bool] = None


@router.put("/{restaurant_id}")
async def update_restaurant(
    restaurant_id: str,
    update_data: RestaurantUpdate,
    current_user: dict = Depends(require_any_permission(["restaurants.edit", "operator.services.edit"]))
):
    """Update a restaurant - requires restaurants.edit permission"""
    db = get_database()
    
    # Check if restaurant exists
    existing = await db.restaurants.find_one({"_id": restaurant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # For operator users, ensure they own this restaurant
    if current_user["role"] == "operator":
        operator_id = current_user.get("operator_id") or current_user.get("_id")
        if existing.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this restaurant")
    
    # Build update dict excluding None values
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    # Operators cannot set status to active; data changes reset to pending
    if current_user["role"] == "operator":
        update_dict.pop("status", None)
        data_fields = {k for k in update_dict if k not in ("updated_at",)}
        if data_fields:
            update_dict["status"] = "pending"
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.restaurants.update_one(
        {"_id": restaurant_id},
        {"$set": update_dict}
    )
    
    return {"message": "Restaurant updated successfully"}


@router.delete("/{restaurant_id}")
async def delete_restaurant(
    restaurant_id: str,
    current_user: dict = Depends(require_any_permission(["restaurants.delete", "operator.services.delete"]))
):
    """Delete a restaurant - requires restaurants.delete permission"""
    db = get_database()
    
    # Check if restaurant exists
    existing = await db.restaurants.find_one({"_id": restaurant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # For operator users, ensure they own this restaurant
    if current_user["role"] == "operator":
        operator_id = current_user.get("operator_id") or current_user.get("_id")
        if existing.get("operator_id") != operator_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this restaurant")
    
    # Delete the restaurant
    await db.restaurants.delete_one({"_id": restaurant_id})
    
    # Also delete associated menu items
    await db.restaurant_menu.delete_many({"restaurant_id": restaurant_id})
    
    return {"message": "Restaurant deleted successfully"}


@router.put("/{restaurant_id}/menu/{item_id}")
async def update_menu_item(
    restaurant_id: str,
    item_id: str,
    update_data: MenuItemUpdate,
    current_user: dict = Depends(require_any_permission(["restaurants.manage_menu", "operator.services.edit"]))
):
    """Update a menu item - requires restaurants.manage_menu permission"""
    db = get_database()
    
    # Check if menu item exists
    existing = await db.restaurant_menu.find_one({"_id": item_id, "restaurant_id": restaurant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Build update dict excluding None values
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    # Handle both 'available' and 'is_available' fields
    if "available" in update_dict:
        update_dict["is_available"] = update_dict.pop("available")
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.restaurant_menu.update_one(
        {"_id": item_id, "restaurant_id": restaurant_id},
        {"$set": update_dict}
    )
    
    return {"message": "Menu item updated successfully"}


@router.delete("/{restaurant_id}/menu/{item_id}")
async def delete_menu_item(
    restaurant_id: str,
    item_id: str,
    current_user: dict = Depends(require_any_permission(["restaurants.manage_menu", "operator.services.delete"]))
):
    """Delete a menu item - requires restaurants.manage_menu permission"""
    db = get_database()
    
    # Check if menu item exists
    existing = await db.restaurant_menu.find_one({"_id": item_id, "restaurant_id": restaurant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    await db.restaurant_menu.delete_one({"_id": item_id, "restaurant_id": restaurant_id})
    
    return {"message": "Menu item deleted successfully"}


@router.get("/management/my-restaurants")
async def get_my_restaurants(
    search: Optional[str] = None,
    city: Optional[str] = None,
    cuisine: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get restaurants for the current user's operator (operator-scoped).
    Super admin and admin can see all restaurants.
    Operator users can only see restaurants belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    # Admin override
    if operator_id and current_user.get("role") in ("super_admin", "admin"):
        query["operator_id"] = operator_id
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if cuisine:
        query["cuisine_type"] = {"$regex": cuisine, "$options": "i"}
    
    restaurants = await db.restaurants.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.restaurants.count_documents(query)
    
    # Transform _id to id
    for restaurant in restaurants:
        restaurant["id"] = str(restaurant.pop("_id", ""))
    
    return {
        "restaurants": restaurants, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }

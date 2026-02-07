from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
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
    available: bool = True
    popular: bool = False

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
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new restaurant"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin", "service_provider"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    skip: int = 0,
    limit: int = 20
):
    """Get all restaurants - optionally filtered by country"""
    db = get_database()
    
    query = {"is_active": True}
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
    
    # Transform _id to id for each restaurant
    for r in restaurants:
        r["id"] = str(r.pop("_id", ""))
    
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
async def get_restaurant_menu(restaurant_id: str):
    """Get restaurant menu"""
    db = get_database()
    menu_items = await db.restaurant_menu.find(
        {"restaurant_id": restaurant_id, "is_available": {"$ne": False}}
    ).to_list(100)
    
    # Transform for frontend
    items = []
    for item in menu_items:
        items.append({
            "id": str(item.get("_id", item.get("id", ""))),
            "name": item.get("name"),
            "category": item.get("category", "mains"),
            "price": item.get("price", 0),
            "description": item.get("description", ""),
            "image": item.get("image", ""),
            "is_available": item.get("is_available", True),
            "available": item.get("is_available", True),
            "popular": item.get("popular", False)
        })
    
    # If no menu items, return demo data
    if not items:
        items = [
            {"id": "1", "name": "Ndolé with Plantains", "category": "mains", "price": 5500, "description": "Traditional Cameroonian dish with bitter leaves and peanuts", "image": "", "is_available": True, "available": True, "popular": True},
            {"id": "2", "name": "Grilled Fish (Braise)", "category": "mains", "price": 8000, "description": "Fresh tilapia grilled with spices and plantains", "image": "", "is_available": True, "available": True, "popular": True},
            {"id": "3", "name": "Poulet DG", "category": "mains", "price": 7500, "description": "Chicken with plantains in a rich tomato sauce", "image": "", "is_available": True, "available": True, "popular": True},
            {"id": "4", "name": "Eru Soup", "category": "mains", "price": 6000, "description": "Spinach-like vegetable soup with waterleaf", "image": "", "is_available": True, "available": True},
            {"id": "5", "name": "Koki Beans", "category": "starters", "price": 2500, "description": "Steamed bean cake wrapped in banana leaves", "image": "", "is_available": True, "available": True},
            {"id": "6", "name": "Accra Banana", "category": "starters", "price": 1500, "description": "Fried ripe banana fritters", "image": "", "is_available": True, "available": True},
            {"id": "7", "name": "Fresh Fruit Salad", "category": "desserts", "price": 2000, "description": "Seasonal tropical fruits", "image": "", "is_available": True, "available": True},
            {"id": "8", "name": "Gâteau de Manioc", "category": "desserts", "price": 2500, "description": "Traditional cassava cake", "image": "", "is_available": True, "available": True},
            {"id": "9", "name": "Fresh Juice", "category": "drinks", "price": 1500, "description": "Orange, pineapple, or passion fruit", "image": "", "is_available": True, "available": True},
            {"id": "10", "name": "Bissap (Hibiscus)", "category": "drinks", "price": 1000, "description": "Refreshing hibiscus drink", "image": "", "is_available": True, "available": True},
            {"id": "11", "name": "Chef's Special Platter", "category": "specials", "price": 15000, "description": "Assortment of our best dishes for 2", "image": "", "is_available": True, "available": True, "popular": True},
            {"id": "12", "name": "Suya Skewers", "category": "starters", "price": 3000, "description": "Spiced grilled meat skewers", "image": "", "is_available": True, "available": True}
        ]
    
    return {"items": items}

@router.post("/{restaurant_id}/menu")
async def add_menu_item(
    restaurant_id: str,
    item_data: MenuItemCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Add menu item to restaurant"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    available: Optional[bool] = None
    is_available: Optional[bool] = None
    popular: Optional[bool] = None


@router.put("/{restaurant_id}")
async def update_restaurant(
    restaurant_id: str,
    update_data: RestaurantUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a restaurant"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.restaurants.update_one(
        {"_id": restaurant_id},
        {"$set": update_dict}
    )
    
    return {"message": "Restaurant updated successfully"}


@router.delete("/{restaurant_id}")
async def delete_restaurant(
    restaurant_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a restaurant"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    current_user: dict = Depends(get_current_active_user)
):
    """Update a menu item"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a menu item"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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

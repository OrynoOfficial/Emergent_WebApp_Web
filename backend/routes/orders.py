from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from models.order import Order, OrderCreate, OrderStatus, PaymentStatus
from config.database import get_database
from middleware.auth import get_current_active_user
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.post("/", response_model=dict)
async def create_order(
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new order"""
    db = get_database()
    
    # Get service details
    service = await db.services.find_one({"_id": order_data.service_id})
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    if not service["is_available"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service is not available"
        )
    
    # Calculate pricing
    subtotal = service["base_price"]
    tax = subtotal * 0.1  # 10% tax
    discount = 0.0
    
    # Apply promo code if provided
    if order_data.promo_code:
        promo = await db.promo_codes.find_one({"code": order_data.promo_code, "is_active": True})
        if promo:
            discount = subtotal * (promo["discount_percentage"] / 100)
    
    total_amount = subtotal + tax - discount
    
    # Generate order number
    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": current_user["_id"],
        "service_id": service["_id"],
        "service_name": service["name"],
        "service_category": service["category"],
        "subtotal": subtotal,
        "tax": tax,
        "discount": discount,
        "total_amount": total_amount,
        "currency": service["currency"],
        "payment_status": PaymentStatus.PENDING,
        "status": OrderStatus.PENDING,
        "order_details": order_data.order_details,
        "service_date": order_data.service_date,
        "customer_notes": order_data.customer_notes,
        "promo_code": order_data.promo_code,
        "promo_discount": discount,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    return {
        "message": "Order created successfully",
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "total_amount": total_amount
    }


class DirectOrderCreate(BaseModel):
    """Model for creating an order directly without service lookup"""
    service_type: str
    service_id: str
    service_name: str
    total_amount: float
    currency: str = "XAF"
    status: str = "pending"
    payment_status: str = "pending"
    booking_details: dict = {}


@router.post("/create", response_model=dict)
async def create_direct_order(
    order_data: DirectOrderCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create an order directly without service lookup.
    Used for booking flows where the frontend has all the details.
    """
    from datetime import timezone
    db = get_database()
    
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Generate order number based on service type
    service_prefix_map = {
        'hotel': 'HTL',
        'travel': 'TRV',
        'car_rental': 'CAR',
        'restaurant': 'RST',
        'event': 'EVT',
        'package': 'PKG',
        'cinema': 'CIN',
        'laundry': 'LND',
        'banquet': 'BQT'
    }
    service_prefix = service_prefix_map.get(order_data.service_type, 'ORD')
    order_number = f"{service_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Calculate subtotal (total before any fees)
    subtotal = order_data.total_amount
    
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": order_number,
        "user_id": user_id,
        "user_email": current_user.get("email", ""),
        "service_type": order_data.service_type,
        "service_category": order_data.service_type,  # Also store as service_category for consistency
        "service_id": order_data.service_id,
        "service_name": order_data.service_name,
        "subtotal": subtotal,
        "tax": 0,
        "discount": order_data.booking_details.get("promo_discount", 0) if order_data.booking_details else 0,
        "total_amount": order_data.total_amount,
        "final_amount": order_data.total_amount,
        "currency": order_data.currency,
        "status": order_data.status,
        "payment_status": order_data.payment_status,
        "booking_details": order_data.booking_details,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.orders.insert_one(order)
    
    return {
        "success": True,
        "message": "Order created successfully",
        "order_id": order["_id"],
        "order_number": order["order_number"],
        "total_amount": order_data.total_amount
    }


@router.get("/")
async def get_user_orders(
    current_user: dict = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 20
):
    """Get user's orders"""
    db = get_database()
    
    # Admin and operators can see all orders
    if current_user.get("role") in ["admin", "operator"]:
        query = {}
    else:
        query = {"user_id": current_user.get("id", current_user.get("_id"))}
    
    orders_cursor = db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = await orders_cursor.to_list(limit)
    total = await db.orders.count_documents(query)
    
    # Process orders to ensure they have an 'id' field and no '_id'
    processed_orders = []
    for order in orders:
        # Use 'id' if exists, otherwise use '_id' converted to string, or order_number as fallback
        order_id = order.get("id") or str(order.get("_id", "")) or order.get("order_number")
        processed_order = {k: v for k, v in order.items() if k != "_id"}
        processed_order["id"] = order_id
        processed_orders.append(processed_order)
    
    return {
        "orders": processed_orders,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific order"""
    db = get_database()
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check authorization
    if order["user_id"] != current_user["_id"] and current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this order"
        )
    
    return order

@router.put("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Cancel an order"""
    db = get_database()
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order["user_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this order"
        )
    
    if order["status"] in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel this order"
        )
    
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "status": OrderStatus.CANCELLED,
            "cancelled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Order cancelled successfully"}
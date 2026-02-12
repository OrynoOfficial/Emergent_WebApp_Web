from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from models.order import Order, OrderCreate, OrderStatus, PaymentStatus
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from datetime import datetime, timezone, timedelta
from typing import Optional
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
    limit: int = 100
):
    """Get orders - Admin sees all, others see their own"""
    db = get_database()
    
    user_role = current_user.get("role", "customer")
    user_id = current_user.get("id") or current_user.get("_id")
    
    # Admin and super_admin can see all orders
    if user_role in ["admin", "super_admin"]:
        query = {}
    # Operators see orders for their services
    elif user_role == "operator" or current_user.get("operator_id"):
        operator_id = current_user.get("operator_id")
        if operator_id:
            query = {"$or": [
                {"user_id": user_id},
                {"operator_id": operator_id}
            ]}
        else:
            query = {"user_id": user_id}
    else:
        # Customers see only their own orders
        query = {"user_id": user_id}
    
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
        
        # Get customer name for admin view
        if user_role in ["admin", "super_admin"] and order.get("user_id"):
            customer = await db.users.find_one({"_id": order["user_id"]}, {"full_name": 1, "email": 1})
            if customer:
                processed_order["customer_name"] = customer.get("full_name", "Unknown")
                processed_order["customer_email"] = customer.get("email", "")
        
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


@router.get("/analytics/payment-methods")
async def get_payment_methods_analytics(
    time_range: str = Query("30d", description="Time range: today, 7d, 30d, 90d, 1y"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get payment methods breakdown - role-filtered for operators"""
    db = get_database()
    
    # Calculate date range
    now = datetime.utcnow()
    days_map = {"today": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(time_range, 30)
    start_date = now - timedelta(days=days)
    
    # Build query based on user role
    user_role = current_user.get("role")
    query = {"created_at": {"$gte": start_date}}
    
    # Operators only see their orders
    if user_role == "operator":
        operator_id = current_user.get("operator_id")
        if operator_id:
            query["operator_id"] = operator_id
    
    # Aggregate payment methods
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$payment_method",
            "total_amount": {"$sum": "$total_amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total_amount": -1}}
    ]
    
    results = await db.orders.aggregate(pipeline).to_list(20)
    
    # Calculate totals
    grand_total = sum(r.get("total_amount", 0) for r in results)
    total_orders = sum(r.get("count", 0) for r in results)
    
    # Payment method display names and colors
    method_config = {
        "mtn_momo": {"name": "MTN Mobile Money", "color": "bg-yellow-500"},
        "orange_money": {"name": "Orange Money", "color": "bg-orange-500"},
        "stripe": {"name": "Card Payment", "color": "bg-blue-500"},
        "bank_transfer": {"name": "Bank Transfer", "color": "bg-gray-500"},
        "cash": {"name": "Cash", "color": "bg-green-500"},
        None: {"name": "Not Specified", "color": "bg-slate-400"},
    }
    
    payment_methods = []
    for r in results:
        method_key = r.get("_id")
        config = method_config.get(method_key, {"name": str(method_key or "Unknown").replace("_", " ").title(), "color": "bg-slate-400"})
        amount = r.get("total_amount", 0)
        percentage = round((amount / grand_total * 100), 1) if grand_total > 0 else 0
        
        payment_methods.append({
            "method": config["name"],
            "method_key": method_key,
            "amount": amount,
            "count": r.get("count", 0),
            "percentage": percentage,
            "color": config["color"]
        })
    
    # If no data, return default structure with zeros
    if not payment_methods:
        payment_methods = [
            {"method": "MTN Mobile Money", "method_key": "mtn_momo", "amount": 0, "count": 0, "percentage": 0, "color": "bg-yellow-500"},
            {"method": "Orange Money", "method_key": "orange_money", "amount": 0, "count": 0, "percentage": 0, "color": "bg-orange-500"},
            {"method": "Card Payment", "method_key": "stripe", "amount": 0, "count": 0, "percentage": 0, "color": "bg-blue-500"},
            {"method": "Bank Transfer", "method_key": "bank_transfer", "amount": 0, "count": 0, "percentage": 0, "color": "bg-gray-500"},
        ]
    
    return {
        "payment_methods": payment_methods,
        "total_revenue": grand_total,
        "total_orders": total_orders,
        "time_range": time_range
    }


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


@router.put("/{order_id}")
async def update_order(
    order_id: str,
    update_data: OrderUpdate,
    current_user: dict = Depends(require_any_permission(["orders.edit", "orders.view_all"]))
):
    """Update an order - requires orders.edit permission"""
    db = get_database()

    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()

    await db.orders.update_one({"_id": order_id}, {"$set": update_dict})

    return {"message": "Order updated successfully"}


@router.put("/{order_id}/process")
async def process_order(
    order_id: str,
    current_user: dict = Depends(require_permission("orders.process"))
):
    """Process/confirm a pending order - requires orders.process permission"""
    db = get_database()

    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be processed")

    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "status": OrderStatus.CONFIRMED,
            "processed_by": current_user.get("_id"),
            "processed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )

    return {"message": "Order processed successfully", "order_id": order_id}
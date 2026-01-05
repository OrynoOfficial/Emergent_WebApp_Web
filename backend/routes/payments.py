from fastapi import APIRouter, HTTPException, status, Depends, Request
from services.stripe_service import StripeService
from services.mtn_momo_service import MTNMoMoService
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["Payments"])

stripe_service = StripeService()
mtn_momo_service = MTNMoMoService()

class PaymentRequest(BaseModel):
    amount: float
    currency: str = "USD"
    payment_method: str  # "stripe" or "mtn_momo"
    order_id: str
    phone_number: Optional[str] = None  # For MTN MoMo

class PaymentInitiateRequest(BaseModel):
    amount: float
    payment_method: str  # "mtn_momo", "orange_money", "credit_card", "paypal"
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None


# ==================== CHAIN REACTION HELPERS ====================

async def award_loyalty_points(db, user_id: str, amount: float, order_id: str, service_type: str):
    """Award loyalty points after successful payment"""
    try:
        POINTS_PER_CURRENCY = 0.1  # 10 points per 100 XAF
        
        # Get or create loyalty program
        program = await db.loyalty_programs.find_one({"user_id": user_id})
        
        if not program:
            program = {
                "_id": str(uuid.uuid4()),
                "user_id": user_id,
                "total_points": 0,
                "available_points": 0,
                "tier": "bronze",
                "total_spent": 0,
                "total_bookings": 0,
                "joined_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await db.loyalty_programs.insert_one(program)
        
        # Calculate points
        base_points = int(amount * POINTS_PER_CURRENCY)
        
        # Create transaction
        transaction = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "loyalty_program_id": program["_id"],
            "transaction_type": "earn",
            "points": base_points,
            "description": f"Purchase reward for {service_type}",
            "order_id": order_id,
            "service_type": service_type,
            "created_at": datetime.now(timezone.utc)
        }
        await db.loyalty_transactions.insert_one(transaction)
        
        # Update program
        await db.loyalty_programs.update_one(
            {"_id": program["_id"]},
            {"$inc": {
                "total_points": base_points,
                "available_points": base_points,
                "total_spent": amount,
                "total_bookings": 1
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        
        logger.info(f"Awarded {base_points} loyalty points to user {user_id}")
        return base_points
    except Exception as e:
        logger.error(f"Failed to award loyalty points: {e}")
        return 0


async def calculate_and_record_commission(db, order_id: str, service_type: str, amount: float, operator_id: Optional[str] = None):
    """Calculate and record commission for the transaction"""
    try:
        # Get commission config
        config = None
        if operator_id:
            config = await db.commission_configs.find_one({
                "service_type": service_type,
                "operator_id": operator_id,
                "is_active": True
            })
        
        if not config:
            config = await db.commission_configs.find_one({
                "service_type": service_type,
                "operator_id": None,
                "is_active": True
            })
        
        # Default 5% if no config found
        rate = config.get("rate", 5.0) if config else 5.0
        commission_amount = amount * (rate / 100)
        
        # Record commission
        commission_record = {
            "_id": str(uuid.uuid4()),
            "order_id": order_id,
            "service_type": service_type,
            "operator_id": operator_id,
            "transaction_amount": amount,
            "commission_rate": rate,
            "commission_amount": commission_amount,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.commission_records.insert_one(commission_record)
        
        logger.info(f"Recorded commission of {commission_amount} for order {order_id}")
        return commission_amount
    except Exception as e:
        logger.error(f"Failed to record commission: {e}")
        return 0


async def send_booking_notification(db, user_id: str, order_id: str, service_name: str, status: str):
    """Send notification to user about booking status"""
    try:
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "notification_type": "booking",
            "title": f"Booking {status.title()}",
            "message": f"Your booking for {service_name} has been {status}.",
            "data": {"order_id": order_id},
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
        logger.info(f"Sent notification to user {user_id} for order {order_id}")
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


async def log_payment_activity(db, user_id: str, order_id: str, action: str, details: Dict[str, Any]):
    """Log payment activity"""
    try:
        activity = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "entity_type": "order",
            "entity_id": order_id,
            "action": action,
            "details": details,
            "ip_address": None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.activity_logs.insert_one(activity)
        logger.info(f"Logged activity: {action} for order {order_id}")
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")


async def process_payment_success(db, order_id: str, user_id: str, payment_method: str):
    """Process all chain reactions after successful payment"""
    try:
        # Get order details
        order = await db.orders.find_one({"_id": order_id})
        if not order:
            logger.error(f"Order {order_id} not found for chain reactions")
            return
        
        service_type = order.get("service_category", "general")
        service_name = order.get("service_name", "Service")
        amount = order.get("total_amount", 0)
        operator_id = order.get("operator_id")
        service_booking_id = order.get("service_booking_id")
        
        # 1. Update order status - keep as PENDING for admin validation
        # Payment is complete, but order awaits admin validation before "confirmed"
        await db.orders.update_one(
            {"_id": order_id},
            {"$set": {
                "status": "pending",  # Stays pending for admin validation
                "payment_status": "completed",  # Payment is done
                "payment_method": payment_method,
                "paid_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # 2. Update service-specific booking if linked
        if service_booking_id:
            collection_map = {
                "cinema": "cinema_bookings",
                "laundry": "laundry_orders",
                "pressing": "laundry_orders",
                "package": "package_bookings",
                "banquet": "banquet_bookings",
                "hotel": "room_bookings",
                "travel": "seat_bookings",
                "car_rental": "orders",
                "event": "orders",
                "restaurant": "orders"
            }
            collection_name = collection_map.get(service_type)
            if collection_name and collection_name != "orders":
                await db[collection_name].update_one(
                    {"_id": service_booking_id},
                    {"$set": {
                        "payment_status": "completed",
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
        
        # 3. Award loyalty points
        points_awarded = await award_loyalty_points(db, user_id, amount, order_id, service_type)
        
        # 4. Calculate and record commission
        commission = await calculate_and_record_commission(db, order_id, service_type, amount, operator_id)
        
        # 5. Send notification - payment received, awaiting validation
        await send_booking_notification(db, user_id, order_id, service_name, "payment received - awaiting validation")
        
        # 6. Log activity
        await log_payment_activity(db, user_id, order_id, "payment.success", {
            "payment_method": payment_method,
            "amount": amount,
            "points_awarded": points_awarded,
            "commission": commission
        })
        
        logger.info(f"Completed all chain reactions for order {order_id}")
        
    except Exception as e:
        logger.error(f"Error processing payment success chain reactions: {e}")

@router.post("/create-payment-intent")
async def create_payment_intent(
    payment_request: PaymentRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a payment intent"""
    db = get_database()
    
    # Verify order exists and belongs to user
    order = await db.orders.find_one({"_id": payment_request.order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order["user_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to pay for this order"
        )
    
    if payment_request.payment_method == "stripe":
        result = await stripe_service.create_payment_intent(
            amount=payment_request.amount,
            currency=payment_request.currency,
            metadata={"order_id": payment_request.order_id, "user_id": current_user["_id"]}
        )
        
        if result["success"]:
            # Update order with payment intent
            await db.orders.update_one(
                {"_id": payment_request.order_id},
                {"$set": {
                    "payment_intent_id": result["payment_intent_id"],
                    "payment_method": "stripe",
                    "payment_status": "processing"
                }}
            )
        
        return result
    
    elif payment_request.payment_method == "mtn_momo":
        if not payment_request.phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number required for MTN MoMo"
            )
        
        result = await mtn_momo_service.request_to_pay(
            amount=payment_request.amount,
            currency=payment_request.currency,
            phone_number=payment_request.phone_number,
            external_id=payment_request.order_id,
            payer_message=f"Payment for order {payment_request.order_id}",
            payee_note="Payment received"
        )
        
        if result["success"]:
            # Update order with MTN reference
            await db.orders.update_one(
                {"_id": payment_request.order_id},
                {"$set": {
                    "payment_id": result["reference_id"],
                    "payment_method": "mtn_momo",
                    "payment_status": "processing"
                }}
            )
        
        return result
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment method"
        )


@router.post("/initiate")
async def initiate_payment(
    payment_request: PaymentInitiateRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Initiate a payment - This is the endpoint called by PaymentMethodsSelection component.
    For now, this simulates payment success and triggers chain reactions.
    In production, this would integrate with actual payment providers.
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Generate a transaction reference
    transaction_ref = f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Get service details if provided
    service_details = payment_request.service_details or {}
    service_type = service_details.get("service_category", "general")
    service_name = service_details.get("service_title", "Service")
    order_id = service_details.get("order_id") or transaction_ref
    operator_id = service_details.get("operator_id")
    
    # Create or update order record
    existing_order = await db.orders.find_one({"_id": order_id})
    
    if not existing_order:
        # Create new order
        order = {
            "_id": order_id,
            "order_number": transaction_ref,
            "user_id": user_id,
            "service_category": service_type,
            "service_name": service_name,
            "operator_id": operator_id,
            "total_amount": payment_request.amount,
            "currency": "XAF",
            "payment_method": payment_request.payment_method,
            "payment_status": "pending",
            "status": "pending",
            "service_details": service_details,
            "customer_phone": payment_request.customer_phone,
            "customer_email": payment_request.customer_email,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.orders.insert_one(order)
    
    # Simulate payment processing based on method
    # In production, this would redirect to payment provider or process API calls
    payment_methods_mock = {
        "mtn_momo": {"success": True, "message": "MTN MoMo payment initiated"},
        "orange_money": {"success": True, "message": "Orange Money payment initiated"},
        "credit_card": {"success": True, "message": "Card payment processed"},
        "paypal": {"success": True, "message": "PayPal payment processed"},
    }
    
    method_response = payment_methods_mock.get(
        payment_request.payment_method, 
        {"success": True, "message": "Payment processed"}
    )
    
    if method_response["success"]:
        # Process chain reactions for successful payment
        await process_payment_success(db, order_id, user_id, payment_request.payment_method)
        
        return {
            "success": True,
            "transactionRef": transaction_ref,
            "order_id": order_id,
            "message": method_response["message"],
            "payment_method": payment_request.payment_method,
            "amount": payment_request.amount
        }
    else:
        # Update order as failed
        await db.orders.update_one(
            {"_id": order_id},
            {"$set": {
                "payment_status": "failed",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "success": False,
            "message": "Payment failed",
            "error": method_response.get("error", "Unknown error")
        }

@router.get("/status/{payment_id}")
async def get_payment_status(
    payment_id: str,
    payment_method: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get payment status"""
    if payment_method == "stripe":
        return await stripe_service.get_payment_status(payment_id)
    elif payment_method == "mtn_momo":
        return await mtn_momo_service.get_transaction_status(payment_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment method"
        )

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    event = stripe_service.verify_webhook_signature(payload, sig_header)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )
    
    db = get_database()
    
    # Handle the event
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        order_id = payment_intent["metadata"].get("order_id")
        user_id = payment_intent["metadata"].get("user_id")
        
        if order_id and user_id:
            # Process all chain reactions
            await process_payment_success(db, order_id, user_id, "stripe")
    
    elif event["type"] == "payment_intent.payment_failed":
        payment_intent = event["data"]["object"]
        order_id = payment_intent["metadata"].get("order_id")
        user_id = payment_intent["metadata"].get("user_id")
        
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": "failed",
                    "status": "pending",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            # Send failure notification
            if user_id:
                order = await db.orders.find_one({"_id": order_id})
                service_name = order.get("service_name", "Service") if order else "Service"
                await send_booking_notification(db, user_id, order_id, service_name, "payment failed")
                await log_payment_activity(db, user_id, order_id, "payment.failed", {
                    "payment_method": "stripe",
                    "error": payment_intent.get("last_payment_error", {}).get("message", "Unknown error")
                })
    
    return {"status": "success"}

@router.post("/mtn-momo/webhook")
async def mtn_momo_webhook(request: Request):
    """Handle MTN MoMo webhooks"""
    data = await request.json()
    db = get_database()
    
    # Extract payment details
    reference_id = data.get("referenceId") or data.get("externalId")
    status_value = data.get("status", "").upper()
    
    if not reference_id:
        return {"status": "error", "message": "Missing reference ID"}
    
    # Find the order by payment reference
    order = await db.orders.find_one({
        "$or": [
            {"payment_id": reference_id},
            {"_id": reference_id},
            {"order_number": reference_id}
        ]
    })
    
    if not order:
        logger.warning(f"Order not found for MTN MoMo reference: {reference_id}")
        return {"status": "error", "message": "Order not found"}
    
    order_id = order["_id"]
    user_id = order.get("user_id")
    
    if status_value == "SUCCESSFUL":
        # Process all chain reactions
        await process_payment_success(db, order_id, user_id, "mtn_momo")
        
    elif status_value in ["FAILED", "REJECTED", "TIMEOUT"]:
        await db.orders.update_one(
            {"_id": order_id},
            {"$set": {
                "payment_status": "failed",
                "status": "pending",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Send failure notification
        if user_id:
            service_name = order.get("service_name", "Service")
            await send_booking_notification(db, user_id, order_id, service_name, "payment failed")
            await log_payment_activity(db, user_id, order_id, "payment.failed", {
                "payment_method": "mtn_momo",
                "status": status_value,
                "error": data.get("reason", "Payment failed")
            })
    
    return {"status": "success"}
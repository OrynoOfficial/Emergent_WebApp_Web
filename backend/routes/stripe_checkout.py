"""
Stripe Checkout API Routes
Implements real Stripe Checkout integration for the booking platform
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from config.database import get_database
from middleware.auth import get_current_active_user
from services.stripe_checkout_service import stripe_checkout_service
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/checkout", tags=["Stripe Checkout"])


class CheckoutRequest(BaseModel):
    """Request to create a checkout session"""
    order_id: str
    origin_url: str  # Frontend origin URL for building success/cancel URLs


class CheckoutStatusRequest(BaseModel):
    """Request to check checkout status"""
    session_id: str


# ==================== CHECKOUT SESSION ENDPOINTS ====================

@router.post("/session")
async def create_checkout_session(
    request: Request,
    checkout_request: CheckoutRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create a Stripe Checkout session for an order
    
    - Amount is retrieved from the order (server-side) to prevent price manipulation
    - Success/Cancel URLs are built from the provided origin URL
    - Creates a payment_transactions record before redirecting to Stripe
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Get the order to retrieve amount (server-side validation)
    order = await db.orders.find_one({"_id": checkout_request.order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Verify order belongs to user
    if order.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to pay for this order"
        )
    
    # Check if order is already paid
    if order.get("payment_status") == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already paid"
        )
    
    # Get amount from order (server-side, prevents price manipulation)
    amount = float(order.get("total_amount", 0))
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order amount"
        )
    
    # Currency - default to USD for Stripe, convert from XAF if needed
    currency = "usd"
    # If amount is in XAF, convert to USD (approximate rate: 1 USD = 600 XAF)
    original_currency = order.get("currency", "XAF").upper()
    if original_currency == "XAF":
        # Convert to USD for Stripe (minimum $0.50 = 300 XAF)
        amount_usd = amount / 600.0
        amount = round(max(amount_usd, 0.50), 2)  # Stripe minimum is $0.50
    
    # Build URLs from frontend origin (never hardcode!)
    origin = checkout_request.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel?order_id={checkout_request.order_id}"
    
    # Build webhook URL from backend
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Prepare metadata
    metadata = {
        "order_id": checkout_request.order_id,
        "user_id": user_id,
        "user_email": current_user.get("email", ""),
        "service_category": order.get("service_category", "general"),
        "original_amount": str(order.get("total_amount", 0)),
        "original_currency": original_currency
    }
    
    # Create checkout session
    result = await stripe_checkout_service.create_checkout_session(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        webhook_url=webhook_url,
        metadata=metadata
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to create checkout session")
        )
    
    # Create payment_transactions record BEFORE redirecting to Stripe
    transaction_id = str(uuid.uuid4())
    payment_transaction = {
        "_id": transaction_id,
        "session_id": result["session_id"],
        "order_id": checkout_request.order_id,
        "user_id": user_id,
        "user_email": current_user.get("email", ""),
        "amount": amount,
        "currency": currency,
        "original_amount": order.get("total_amount", 0),
        "original_currency": original_currency,
        "payment_method": "stripe",
        "payment_status": "initiated",
        "metadata": metadata,
        "checkout_url": result["url"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.payment_transactions.insert_one(payment_transaction)
    
    # Update order with payment session info
    await db.orders.update_one(
        {"_id": checkout_request.order_id},
        {"$set": {
            "stripe_session_id": result["session_id"],
            "payment_status": "processing",
            "payment_method": "stripe",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    logger.info(f"Created checkout session {result['session_id']} for order {checkout_request.order_id}")
    
    return {
        "success": True,
        "url": result["url"],
        "session_id": result["session_id"],
        "transaction_id": transaction_id
    }


@router.get("/status/{session_id}")
async def get_checkout_status(
    request: Request,
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get the status of a Stripe checkout session
    
    - Polls Stripe for the current status
    - Updates payment_transactions and orders on status change
    - Returns status info for frontend to handle
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Find the payment transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment transaction not found"
        )
    
    # Verify user owns this transaction
    if transaction.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment"
        )
    
    # Build webhook URL
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Get status from Stripe
    result = await stripe_checkout_service.get_checkout_status(session_id, webhook_url)
    
    if not result.get("success"):
        # Return cached status if Stripe call fails
        return {
            "success": True,
            "session_id": session_id,
            "status": transaction.get("status", "unknown"),
            "payment_status": transaction.get("payment_status", "unknown"),
            "cached": True
        }
    
    stripe_status = result.get("status", "unknown")
    stripe_payment_status = result.get("payment_status", "unpaid")
    
    # Update transaction and order based on status
    order_id = transaction.get("order_id")
    
    # Only update if status changed and not already processed
    current_status = transaction.get("payment_status")
    
    if stripe_payment_status == "paid" and current_status != "completed":
        # Payment successful!
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": stripe_status,
                "payment_status": "completed",
                "paid_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Update order
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": "completed",
                    "status": "pending",  # Awaiting admin validation
                    "paid_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            # Trigger chain reactions (loyalty points, commission, notifications)
            await process_successful_payment(db, order_id, user_id)
        
        logger.info(f"Payment completed for session {session_id}")
        
    elif stripe_status == "expired" and current_status not in ["completed", "expired"]:
        # Session expired
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "expired",
                "payment_status": "expired",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": "expired",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        logger.info(f"Payment expired for session {session_id}")
    
    return {
        "success": True,
        "session_id": session_id,
        "status": stripe_status,
        "payment_status": stripe_payment_status,
        "amount_total": result.get("amount_total"),
        "currency": result.get("currency"),
        "metadata": result.get("metadata", {})
    }


# ==================== WEBHOOK ENDPOINT ====================

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhooks for payment events
    
    This endpoint is called by Stripe when payment events occur
    """
    db = get_database()
    
    # Get raw body and signature
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    # Build webhook URL
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Handle the webhook
    result = await stripe_checkout_service.handle_webhook(webhook_url, body, signature)
    
    if not result.get("success"):
        logger.error(f"Webhook handling failed: {result.get('error')}")
        # Return 200 to prevent Stripe from retrying on validation errors
        return {"status": "error", "message": result.get("error")}
    
    event_type = result.get("event_type", "")
    session_id = result.get("session_id", "")
    payment_status = result.get("payment_status", "")
    metadata = result.get("metadata", {})
    
    order_id = metadata.get("order_id")
    user_id = metadata.get("user_id")
    
    logger.info(f"Received webhook: {event_type} for session {session_id}")
    
    if event_type == "checkout.session.completed" and payment_status == "paid":
        # Payment successful
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "complete",
                "payment_status": "completed",
                "paid_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": "completed",
                    "status": "pending",
                    "paid_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            if user_id:
                await process_successful_payment(db, order_id, user_id)
    
    elif event_type == "checkout.session.expired":
        # Session expired
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "expired",
                "payment_status": "expired",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": "expired",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
    
    return {"status": "success"}


# ==================== HELPER FUNCTIONS ====================

async def process_successful_payment(db, order_id: str, user_id: str):
    """Process chain reactions after successful payment"""
    try:
        order = await db.orders.find_one({"_id": order_id})
        if not order:
            return
        
        service_type = order.get("service_category", "general")
        service_name = order.get("service_name", "Service")
        amount = order.get("total_amount", 0)
        
        # Award loyalty points (10 points per 100 currency)
        points = int(amount * 0.1)
        if points > 0:
            program = await db.loyalty_programs.find_one({"user_id": user_id})
            if program:
                await db.loyalty_programs.update_one(
                    {"user_id": user_id},
                    {"$inc": {"total_points": points, "available_points": points}}
                )
            else:
                await db.loyalty_programs.insert_one({
                    "_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "total_points": points,
                    "available_points": points,
                    "tier": "bronze",
                    "created_at": datetime.now(timezone.utc)
                })
        
        # Send notification
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "notification_type": "payment",
            "title": "Payment Successful",
            "message": f"Your payment for {service_name} has been received. Booking is pending confirmation.",
            "data": {"order_id": order_id, "points_earned": points},
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
        
        logger.info(f"Processed successful payment for order {order_id}")
        
    except Exception as e:
        logger.error(f"Error processing successful payment: {e}")


# ==================== USER TRANSACTIONS ====================

@router.get("/transactions")
async def get_user_transactions(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's payment transactions"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    transactions = await db.payment_transactions.find(
        {"user_id": user_id},
        {"_id": 0, "checkout_url": 0}  # Exclude sensitive fields
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.payment_transactions.count_documents({"user_id": user_id})
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

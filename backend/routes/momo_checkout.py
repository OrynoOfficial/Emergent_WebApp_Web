"""
MTN MoMo Mobile Money API Routes
Implements MTN MoMo payment integration for the booking platform
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from config.database import get_database
from middleware.auth import get_current_active_user
from services.momo_service import momo_service, MoMoPaymentStatus
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/momo", tags=["MTN MoMo Payments"])


# ==================== REQUEST MODELS ====================

class MoMoPaymentRequest(BaseModel):
    """Request to create a MoMo payment"""
    order_id: str
    phone_number: str = Field(..., min_length=9, max_length=15)
    payer_message: Optional[str] = ""
    payee_note: Optional[str] = ""
    # Optional V2 ledger correlation — when set, the status poll handler
    # will append `captured`/`failed` events to /api/v2/payments so the
    # ledger reflects the true outcome (not just the legacy txn row).
    v2_payment_id: Optional[str] = None


class MoMoStatusRequest(BaseModel):
    """Request to check MoMo payment status"""
    transaction_id: str


# ==================== PAYMENT ENDPOINTS ====================

@router.post("/request-to-pay")
async def initiate_momo_payment(
    request: Request,
    payment_request: MoMoPaymentRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Initiate a MTN MoMo payment request
    
    - Creates a payment transaction record
    - Sends request to MoMo API (sandbox or production)
    - Customer must authorize payment on their mobile device
    
    Test phone numbers (sandbox mode):
    - Ending in 1-5: Will succeed
    - Ending in 6-7: Will fail (insufficient funds)
    - Ending in 8-9: Will timeout
    - Ending in 0: Will be cancelled
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Get the order to retrieve amount (server-side validation)
    order = await db.orders.find_one({"_id": payment_request.order_id})
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
    
    # Get amount from order
    amount = float(order.get("total_amount", 0))
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order amount"
        )
    
    # Currency - use original order currency (XAF/XOF for MoMo)
    currency = order.get("currency", "XAF").upper()
    
    # Generate external ID for tracking
    external_id = str(uuid.uuid4())
    transaction_id = str(uuid.uuid4())
    
    # Create payment transaction record BEFORE calling MoMo
    payment_transaction = {
        "_id": transaction_id,
        "order_id": payment_request.order_id,
        "user_id": user_id,
        "user_email": current_user.get("email", ""),
        "amount": amount,
        "currency": currency,
        "phone_number": payment_request.phone_number,
        "external_id": external_id,
        "payment_method": "mtn_momo",
        "payment_status": "initiated",
        "payer_message": payment_request.payer_message,
        "payee_note": payment_request.payee_note,
        # V2 ledger correlation (optional). When present, status-poll
        # handler appends captured/failed to the immutable timeline.
        "v2_payment_id": payment_request.v2_payment_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.payment_transactions.insert_one(payment_transaction)
    
    # Call MoMo service to initiate payment
    result = await momo_service.request_to_pay(
        amount=amount,
        currency=currency,
        phone_number=payment_request.phone_number,
        external_id=external_id,
        payer_message=payment_request.payer_message or f"Payment for order {payment_request.order_id[:8]}",
        payee_note=payment_request.payee_note or ""
    )
    
    if not result.get("success"):
        # Update transaction as failed
        await db.payment_transactions.update_one(
            {"_id": transaction_id},
            {"$set": {
                "payment_status": "failed",
                "error": result.get("error"),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to initiate MoMo payment")
        )
    
    # Update transaction with MoMo reference
    momo_reference_id = result.get("reference_id")
    await db.payment_transactions.update_one(
        {"_id": transaction_id},
        {"$set": {
            "momo_reference_id": momo_reference_id,
            "payment_status": "pending",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update order with payment info
    await db.orders.update_one(
        {"_id": payment_request.order_id},
        {"$set": {
            "momo_reference_id": momo_reference_id,
            "payment_status": "processing",
            "payment_method": "mtn_momo",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    logger.info(f"Created MoMo payment request {momo_reference_id} for order {payment_request.order_id}")
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "momo_reference_id": momo_reference_id,
        "status": "pending",
        "message": "Payment request sent. Please authorize on your MTN MoMo app.",
        "instructions": [
            "1. You will receive a prompt on your phone",
            "2. Enter your MTN MoMo PIN to authorize",
            "3. Wait for confirmation"
        ]
    }


@router.get("/status/{transaction_id}")
async def get_momo_payment_status(
    transaction_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Check the status of a MoMo payment transaction
    
    Polls the MoMo API for the current status and updates the database
    """
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    # Find the payment transaction
    transaction = await db.payment_transactions.find_one({"_id": transaction_id})
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Verify user owns this transaction
    if transaction.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment"
        )
    
    # If already completed or failed, return cached status
    current_status = transaction.get("payment_status")
    if current_status in ["completed", "failed", "timed_out", "cancelled"]:
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": current_status,
            "amount": transaction.get("amount"),
            "currency": transaction.get("currency"),
            "phone_number": transaction.get("phone_number"),
            "reason": transaction.get("reason"),
            "completed_at": transaction.get("completed_at").isoformat() if transaction.get("completed_at") else None,
            "cached": True
        }
    
    # Get status from MoMo service
    momo_reference_id = transaction.get("momo_reference_id")
    if not momo_reference_id:
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": current_status,
            "message": "Payment reference not yet available"
        }
    
    result = await momo_service.get_transaction_status(momo_reference_id)
    
    if not result.get("success"):
        # Return cached status if MoMo call fails
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": current_status,
            "cached": True,
            "error": result.get("error")
        }
    
    momo_status = result.get("status", "pending")
    order_id = transaction.get("order_id")
    
    # Map MoMo status to our status
    if momo_status == MoMoPaymentStatus.SUCCESSFUL:
        # Payment successful!
        await db.payment_transactions.update_one(
            {"_id": transaction_id},
            {"$set": {
                "payment_status": "completed",
                "financial_id": result.get("financial_id"),
                "completed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )

        # V2 ledger correlation — append `captured` if this transaction was
        # initiated against a v2 payment intent.
        v2_payment_id = transaction.get("v2_payment_id")
        if v2_payment_id:
            try:
                from services.payment_ledger import append_event as _v2_append
                await _v2_append(
                    db,
                    payment_id=v2_payment_id,
                    event_type="captured",
                    provider="mtn_momo",
                    provider_event_id=f"{transaction_id}:SUCCESSFUL",  # dedup
                    amount=transaction.get("amount"),
                    currency=transaction.get("currency"),
                    payload={
                        "source": "momo_status_poll",
                        "financial_id": result.get("financial_id"),
                        "transaction_id": transaction_id,
                    },
                )
                logger.info("V2 ledger: appended captured for payment_id=%s", v2_payment_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("V2 ledger append (captured) failed: %s", exc)

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
            
            # Process successful payment (loyalty points, notifications)
            await process_successful_momo_payment(db, order_id, user_id)
        
        logger.info(f"MoMo payment completed for transaction {transaction_id}")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": "completed",
            "amount": result.get("amount"),
            "currency": result.get("currency"),
            "financial_id": result.get("financial_id"),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
    
    elif momo_status in [MoMoPaymentStatus.FAILED, MoMoPaymentStatus.TIMED_OUT, MoMoPaymentStatus.CANCELLED]:
        # Payment failed
        await db.payment_transactions.update_one(
            {"_id": transaction_id},
            {"$set": {
                "payment_status": momo_status,
                "reason": result.get("reason"),
                "updated_at": datetime.now(timezone.utc)
            }}
        )

        # V2 ledger correlation — append terminal `failed` or `voided`.
        v2_payment_id = transaction.get("v2_payment_id")
        if v2_payment_id:
            try:
                from services.payment_ledger import append_event as _v2_append
                v2_event_type = "voided" if momo_status == MoMoPaymentStatus.CANCELLED else "failed"
                await _v2_append(
                    db,
                    payment_id=v2_payment_id,
                    event_type=v2_event_type,
                    provider="mtn_momo",
                    provider_event_id=f"{transaction_id}:{momo_status}",
                    payload={
                        "source": "momo_status_poll",
                        "reason": result.get("reason"),
                        "momo_status": momo_status,
                    },
                )
                logger.info("V2 ledger: appended %s for payment_id=%s", v2_event_type, v2_payment_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("V2 ledger append (%s) failed: %s", momo_status, exc)
        
        if order_id:
            await db.orders.update_one(
                {"_id": order_id},
                {"$set": {
                    "payment_status": momo_status,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
        
        logger.info(f"MoMo payment {momo_status} for transaction {transaction_id}: {result.get('reason')}")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": momo_status,
            "reason": result.get("reason"),
            "message": get_failure_message(momo_status, result.get("reason"))
        }
    
    # Still pending
    return {
        "success": True,
        "transaction_id": transaction_id,
        "status": "pending",
        "amount": result.get("amount"),
        "currency": result.get("currency"),
        "message": "Waiting for payment authorization. Please check your phone."
    }


@router.post("/validate-account")
async def validate_momo_account(
    phone_number: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Validate if a phone number is registered for MTN Mobile Money
    """
    result = await momo_service.validate_account(phone_number)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Failed to validate account")
        )
    
    return result


@router.get("/sandbox-info")
async def get_sandbox_info():
    """
    Get sandbox testing instructions (available without authentication)
    """
    return momo_service.get_sandbox_instructions()


@router.get("/transactions")
async def get_momo_transactions(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's MoMo payment transactions"""
    db = get_database()
    user_id = current_user.get("_id") or current_user.get("id")
    
    transactions = await db.payment_transactions.find(
        {"user_id": user_id, "payment_method": "mtn_momo"},
        {"_id": 1, "order_id": 1, "amount": 1, "currency": 1, "payment_status": 1, 
         "phone_number": 1, "created_at": 1, "completed_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.payment_transactions.count_documents(
        {"user_id": user_id, "payment_method": "mtn_momo"}
    )
    
    # Convert ObjectIds to strings
    for t in transactions:
        t["id"] = t.pop("_id")
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# ==================== HELPER FUNCTIONS ====================

def get_failure_message(status: str, reason: str) -> str:
    """Get user-friendly failure message"""
    messages = {
        "failed": {
            "INSUFFICIENT_BALANCE": "Payment failed due to insufficient balance. Please top up your MoMo account and try again.",
            "default": "Payment failed. Please try again or use a different payment method."
        },
        "timed_out": {
            "TRANSACTION_TIMEOUT": "Payment request timed out. Please try again and respond promptly to the authorization prompt.",
            "default": "Payment request timed out. Please try again."
        },
        "cancelled": {
            "USER_CANCELLED": "Payment was cancelled. If this was not intentional, please try again.",
            "default": "Payment was cancelled."
        }
    }
    
    status_messages = messages.get(status, {})
    return status_messages.get(reason, status_messages.get("default", "Payment could not be completed."))


async def process_successful_momo_payment(db, order_id: str, user_id: str):
    """Process chain reactions after successful MoMo payment"""
    try:
        order = await db.orders.find_one({"_id": order_id})
        if not order:
            return
        
        service_name = order.get("service_name", "Service")
        amount = order.get("total_amount", 0)
        
        # Award loyalty points (10 points per 1000 currency for XAF)
        points = int(amount / 100)  # 1 point per 100 XAF
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
            "title": "MoMo Payment Successful",
            "message": f"Your MTN MoMo payment for {service_name} has been received. Booking is pending confirmation.",
            "data": {"order_id": order_id, "points_earned": points},
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
        
        logger.info(f"Processed successful MoMo payment for order {order_id}")
        
    except Exception as e:
        logger.error(f"Error processing successful MoMo payment: {e}")

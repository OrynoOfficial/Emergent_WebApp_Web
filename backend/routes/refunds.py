"""
Refund endpoints — three audiences:

Customer
    GET  /api/refunds/orders/{order_id}/eligibility
    POST /api/refunds/orders/{order_id}/request
    GET  /api/refunds/me                          # my refund history
    POST /api/refunds/{refund_id}/cancel          # withdraw before admin acts

Admin
    GET  /api/refunds                              # full queue
    POST /api/refunds/{refund_id}/approve
    POST /api/refunds/{refund_id}/reject

Money-side: when an admin APPROVES, we call Stripe's refund API for card
payments (the only gateway with a programmable refund). MoMo/Orange refunds
are marked as `requires_manual_processing=True` so the ops team handles the
bank-transfer side. Either way the booking stock is restored atomically.
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from config.database import get_database
from middleware.auth import get_current_active_user
from models.refund import (
    RefundCreate, RefundDecision, RefundStatus, EligibilityResult,
    compute_eligibility,
)
from services.stripe_service import StripeService

router = APIRouter(prefix="/api/refunds", tags=["refunds"])


# ── Helpers ─────────────────────────────────────────────────────────────────
async def _restore_event_stock(db, order: dict) -> None:
    """Atomically increment class.available_units AND remove any reserved
    seat_ids so the seats become bookable again."""
    bd = order.get("booking_details") or {}
    showtime_id = bd.get("showtime_id") or order.get("service_id")
    class_id = bd.get("class_id")
    qty = int(bd.get("quantity") or 0)
    seat_ids = bd.get("seat_ids") or []
    if not showtime_id or not class_id or qty <= 0:
        return
    update = {"$inc": {"classes.$.available_units": qty}}
    if seat_ids:
        update["$pull"] = {"classes.$.booked_seats": {"$in": seat_ids}}
    await db.event_showtimes.update_one(
        {"_id": showtime_id, "classes.id": class_id},
        update,
    )


def _is_admin(user: dict) -> bool:
    role = (user.get("role") or "").lower()
    return role in ("admin", "super_admin", "superadmin")


# ── Customer endpoints ──────────────────────────────────────────────────────
@router.get("/orders/{order_id}/eligibility", response_model=EligibilityResult)
async def check_eligibility(order_id: str, current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != current_user["_id"] and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("payment_status") != "completed":
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Order not paid — nothing to refund",
                                 refundable_pct=0)
    if order.get("status") in ("refunded", "cancelled"):
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Already refunded or cancelled",
                                 refundable_pct=0)
    return compute_eligibility(order)


@router.post("/orders/{order_id}/request")
async def request_refund(order_id: str, payload: RefundCreate,
                         current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("payment_status") != "completed":
        raise HTTPException(status_code=400, detail="Order is not paid")
    if order.get("status") in ("refunded", "cancelled"):
        raise HTTPException(status_code=400, detail="Order already refunded or cancelled")

    # Idempotency — one open refund per order.
    open_refund = await db.refunds.find_one({
        "order_id": order_id,
        "status": {"$in": [RefundStatus.PENDING, RefundStatus.APPROVED]},
    })
    if open_refund:
        return {"refund_id": open_refund["_id"], "status": open_refund["status"], "message": "Refund already in progress"}

    elig = compute_eligibility(order)
    requested = float(payload.requested_amount) if payload.requested_amount is not None else elig.eligible_amount
    requested = min(requested, float(order.get("total_amount") or 0))

    if not elig.eligible and requested > 0:
        # Customer can still submit, but flagged for admin attention only.
        pass

    refund_id = str(uuid.uuid4())
    await db.refunds.insert_one({
        "_id": refund_id,
        "order_id": order_id,
        "user_id": current_user["_id"],
        "operator_id": order.get("operator_id"),
        "service_type": order.get("service_type") or order.get("service_category"),
        "total_amount": float(order.get("total_amount") or 0),
        "requested_amount": requested,
        "approved_amount": None,
        "eligible_amount": elig.eligible_amount,
        "refundable_pct": elig.refundable_pct,
        "window_at_request": elig.window,
        "reason": payload.reason,
        "customer_notes": payload.customer_notes,
        "admin_notes": None,
        "status": RefundStatus.PENDING,
        "gateway_refund_id": None,
        "requires_manual_processing": (order.get("payment_method") != "stripe"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "completed_at": None,
    })
    return {"refund_id": refund_id, "status": RefundStatus.PENDING, "eligible_amount": elig.eligible_amount, "requested_amount": requested}


@router.get("/me")
async def my_refunds(current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    cursor = db.refunds.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    items = []
    async for r in cursor:
        r["id"] = r.pop("_id")
        items.append(r)
    return {"refunds": items}


@router.post("/{refund_id}/cancel")
async def cancel_refund(refund_id: str, current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    refund = await db.refunds.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    if refund["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not your refund")
    if refund["status"] != RefundStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending refunds can be cancelled")
    await db.refunds.update_one({"_id": refund_id},
                                {"$set": {"status": RefundStatus.CANCELLED, "updated_at": datetime.now(timezone.utc)}})
    return {"refund_id": refund_id, "status": RefundStatus.CANCELLED}


# ── Admin endpoints ─────────────────────────────────────────────────────────
@router.get("")
async def list_refunds(status_filter: Optional[str] = None,
                       current_user: dict = Depends(get_current_active_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_database()
    q = {}
    if status_filter:
        q["status"] = status_filter
    total = await db.refunds.count_documents(q)
    cursor = db.refunds.find(q).sort("created_at", -1).limit(200)
    items = []
    async for r in cursor:
        r["id"] = r.pop("_id")
        items.append(r)
    return {"refunds": items, "total": total}


@router.post("/{refund_id}/approve")
async def approve_refund(refund_id: str, payload: RefundDecision,
                         current_user: dict = Depends(get_current_active_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_database()
    refund = await db.refunds.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    if refund["status"] != RefundStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Refund is {refund['status']}")
    order = await db.orders.find_one({"_id": refund["order_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    approved = payload.approved_amount if payload.approved_amount is not None else refund["requested_amount"]
    approved = float(approved)
    if approved <= 0 or approved > float(order.get("total_amount") or 0):
        raise HTTPException(status_code=400, detail="Approved amount out of range")

    gateway_id = None
    requires_manual = refund.get("requires_manual_processing", False)
    final_status = RefundStatus.COMPLETED

    if order.get("payment_method") == "stripe" and order.get("payment_intent_id"):
        # Real gateway refund — only path that auto-settles.
        result = await StripeService.create_refund(order["payment_intent_id"], amount=approved)
        if not result.get("success"):
            await db.refunds.update_one({"_id": refund_id}, {"$set": {
                "status": RefundStatus.FAILED,
                "admin_notes": (payload.admin_notes or "") + f" | gateway error: {result.get('error')}",
                "updated_at": datetime.now(timezone.utc),
            }})
            raise HTTPException(status_code=502, detail=f"Stripe refund failed: {result.get('error')}")
        gateway_id = result["refund_id"]
    elif requires_manual:
        # MoMo / Orange / cash — keep status APPROVED until ops marks it complete.
        # We still restore the stock now because the customer's seat is being freed up.
        final_status = RefundStatus.APPROVED

    # Restore stock (events only for now — extend per service type as needed).
    if (order.get("service_type") or "").lower() in ("event", "events"):
        await _restore_event_stock(db, order)

    now = datetime.now(timezone.utc)
    await db.refunds.update_one({"_id": refund_id}, {"$set": {
        "status": final_status,
        "approved_amount": approved,
        "gateway_refund_id": gateway_id,
        "admin_notes": payload.admin_notes,
        "updated_at": now,
        "completed_at": now if final_status == RefundStatus.COMPLETED else None,
        "approved_by": current_user["_id"],
    }})
    # Update the order itself.
    is_full = abs(approved - float(order.get("total_amount") or 0)) < 0.01
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {
        "status": "refunded" if is_full else order.get("status"),
        "payment_status": "refunded" if is_full else "partially_refunded",
        "refunded_amount": approved,
        "updated_at": now,
    }})

    return {"refund_id": refund_id, "status": final_status, "approved_amount": approved, "gateway_refund_id": gateway_id}


@router.post("/{refund_id}/reject")
async def reject_refund(refund_id: str, payload: RefundDecision,
                        current_user: dict = Depends(get_current_active_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_database()
    refund = await db.refunds.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    if refund["status"] != RefundStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Refund is {refund['status']}")
    await db.refunds.update_one({"_id": refund_id}, {"$set": {
        "status": RefundStatus.REJECTED,
        "admin_notes": payload.admin_notes,
        "updated_at": datetime.now(timezone.utc),
        "rejected_by": current_user["_id"],
    }})
    return {"refund_id": refund_id, "status": RefundStatus.REJECTED}

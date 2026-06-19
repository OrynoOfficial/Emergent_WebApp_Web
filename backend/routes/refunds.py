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
from pydantic import BaseModel

from config.database import get_database
from middleware.auth import get_current_active_user
from models.refund import (
    RefundCreate, RefundDecision, RefundStatus, EligibilityResult,
    compute_eligibility, list_presets_for, PRESET_DEFINITIONS,
)
from services.stripe_service import StripeService
from utils.notifications import create_notification

router = APIRouter(prefix="/api/refunds", tags=["refunds"])


def _service_date_expired(order: dict) -> bool:
    """True when the booking's service date/time has already passed.
    Used on refund REJECTION to decide whether to revert the ticket to
    'valid' or leave it invalidated (because the show/flight/etc. is over).
    """
    bd = order.get("booking_details") or {}
    candidates = [
        bd.get("start_datetime"), bd.get("end_datetime"),
        bd.get("show_datetime"), bd.get("departure_datetime"),
        bd.get("show_date"), bd.get("date"), bd.get("check_out"),
        order.get("service_date"), order.get("scheduled_at"),
    ]
    now = datetime.now(timezone.utc)
    for c in candidates:
        if not c:
            continue
        try:
            dt = c if isinstance(c, datetime) else datetime.fromisoformat(str(c).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt < now
        except Exception:
            continue
    return False


# ── Public reference data ────────────────────────────────────────────────────
@router.get("/presets")
async def get_presets(service_type: Optional[str] = None):
    """Return preset packs available for a service (Strict / Standard / Flexible).

    Used by the operator settings & service editors to render the picker.
    Omitting ``service_type`` returns the full catalog.
    """
    if service_type:
        return {"service_type": service_type, "presets": list_presets_for(service_type)}
    return {st: list_presets_for(st) for st in PRESET_DEFINITIONS.keys()}


# ── Platform-default refund policies (admin / super-admin only) ─────────────
# Stored as a single doc in `system_settings` under key `refund_policy_defaults`.
# Shape: { service_type: { preset, custom_tiers? } }
# Read order at refund time: listing > operator > platform default > preset.
_DEFAULTS_KEY = "refund_policy_defaults"


@router.get("/platform-defaults")
async def get_platform_default_policies(
    current_user: dict = Depends(get_current_active_user),
):
    """Read the platform-wide default refund policy per service type.

    Anyone can read (operators need it to render the inheritance label).
    """
    db = get_database()
    doc = await db.system_settings.find_one({"_id": _DEFAULTS_KEY})
    return {"by_service": (doc or {}).get("by_service") or {}}


@router.put("/platform-defaults/{service_type}")
async def set_platform_default_policy(
    service_type: str,
    payload: dict,
    current_user: dict = Depends(get_current_active_user),
):
    """Set the platform-wide default for one service type. Admins only.

    Payload: { preset, custom_tiers? }  — preset=null clears the override.
    """
    if current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admins only")

    preset = (payload or {}).get("preset")
    custom_tiers = (payload or {}).get("custom_tiers") or []
    valid_presets = {"strict", "standard", "flexible", "custom", None, ""}
    if preset not in valid_presets:
        raise HTTPException(status_code=400, detail=f"Invalid preset '{preset}'")
    if preset == "custom" and not custom_tiers:
        raise HTTPException(status_code=400, detail="Custom preset requires at least one tier")

    db = get_database()
    if not preset:
        await db.system_settings.update_one(
            {"_id": _DEFAULTS_KEY},
            {"$unset": {f"by_service.{service_type}": ""},
             "$set": {"updated_at": datetime.now(timezone.utc), "updated_by": current_user.get("_id")}},
            upsert=True,
        )
        return {"message": f"Cleared platform default for {service_type}"}

    policy = {"preset": preset}
    if preset == "custom":
        policy["custom_tiers"] = custom_tiers
    await db.system_settings.update_one(
        {"_id": _DEFAULTS_KEY},
        {"$set": {f"by_service.{service_type}": policy,
                  "updated_at": datetime.now(timezone.utc),
                  "updated_by": current_user.get("_id")}},
        upsert=True,
    )
    return {"message": f"Platform default for {service_type} set to {preset}"}


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


# Statuses that represent a settled, refundable payment. The codebase
# emits "completed" from gateway webhooks (MoMo/Stripe), "paid" from the
# admin verification flow (cash/manual bookings), and "verified" from
# scanner validations — all three should be treated as refundable.
PAID_STATUSES = ("completed", "paid", "verified")


# Service-type → (collection, key field on order pointing to the listing)
_SERVICE_COLLECTIONS = {
    "hotel": ("hotels", "service_id"),
    "cinema": ("showtimes", "showtime_id"),
    "event": ("event_showtimes", "showtime_id"),
    "events": ("event_showtimes", "showtime_id"),
    "travel": ("travel_routes", "service_id"),
    "transport": ("travel_routes", "service_id"),
    "restaurant": ("restaurants", "service_id"),
    "car_rental": ("car_rentals", "service_id"),
    "rental": ("car_rentals", "service_id"),
    "banquet": ("banquets", "service_id"),
    "laundry": ("pressing_services", "service_id"),
    "pressing": ("pressing_services", "service_id"),
}


async def _load_policies(db, order: dict) -> tuple[Optional[dict], Optional[dict]]:
    """Fetch (operator_policy, listing_policy) for this order. Either can be
    None — in which case `compute_eligibility` falls through to the platform
    default. Lookups are best-effort: any DB hiccup just skips the override."""
    operator_policy: Optional[dict] = None
    listing_policy: Optional[dict] = None

    service_type = (order.get("service_type") or "").lower()

    # Operator-level — stored on `operators.refund_policies` keyed by service
    # type, with optional fallback `operators.default_refund_policy`. When the
    # operator hasn't set anything, fall through to the platform default
    # configured by admins under `system_settings.refund_policy_defaults`.
    op_id = order.get("operator_id")
    if op_id:
        try:
            op = await db.operators.find_one(
                {"_id": op_id},
                {"refund_policies": 1, "default_refund_policy": 1},
            )
            if op:
                per_service = (op.get("refund_policies") or {}).get(service_type)
                operator_policy = per_service or op.get("default_refund_policy")
        except Exception:
            pass
    if operator_policy is None:
        try:
            defaults_doc = await db.system_settings.find_one({"_id": _DEFAULTS_KEY})
            if defaults_doc:
                operator_policy = (defaults_doc.get("by_service") or {}).get(service_type)
        except Exception:
            pass

    # Listing-level — `service.refund_policy` (separate from the existing
    # free-text `cancellation_policy` summary field on hotel/banquet which is
    # shown to customers on the booking page).
    info = _SERVICE_COLLECTIONS.get(service_type)
    if info:
        coll_name, key_field = info
        listing_id = order.get(key_field) or (order.get("booking_details") or {}).get(key_field)
        if listing_id:
            try:
                listing = await db[coll_name].find_one(
                    {"_id": listing_id},
                    {"refund_policy": 1},
                )
                if listing:
                    listing_policy = listing.get("refund_policy")
            except Exception:
                pass

    return operator_policy, listing_policy


# ── Customer endpoints ──────────────────────────────────────────────────────
@router.get("/orders/{order_id}/eligibility", response_model=EligibilityResult)
async def check_eligibility(order_id: str, current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != current_user["_id"] and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("payment_status") not in PAID_STATUSES:
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Order not paid — nothing to refund",
                                 refundable_pct=0)
    if order.get("status") in ("refunded", "cancelled"):
        return EligibilityResult(eligible=False, eligible_amount=0.0,
                                 window="Already refunded or cancelled",
                                 refundable_pct=0)
    op_pol, listing_pol = await _load_policies(db, order)
    return compute_eligibility(order, operator_policy=op_pol, listing_policy=listing_pol)


@router.post("/orders/{order_id}/request")
async def request_refund(order_id: str, payload: RefundCreate,
                         current_user: dict = Depends(get_current_active_user)):
    db = get_database()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("payment_status") not in PAID_STATUSES:
        raise HTTPException(status_code=400, detail="Order is not paid")
    if order.get("status") in ("refunded", "cancelled"):
        raise HTTPException(status_code=400, detail="Order already refunded or cancelled")
    # iter 245: scanned/checked-in tickets cannot be refunded.
    if order.get("checked_in") or order.get("scanned_at"):
        raise HTTPException(
            status_code=400,
            detail="This ticket has already been scanned and cannot be refunded.",
        )

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

    # iter 245: invalidate the ticket and flip the order status.
    # We snapshot the previous status into `pre_refund_status` so rejection
    # can revert it (unless the service date has since elapsed).
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {
            "pre_refund_status": order.get("status"),
            "status": "refund_requested",
            "ticket_invalidated": True,
            "ticket_invalidated_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    # Confirmation to the customer.
    await create_notification(
        db,
        user_id=current_user["_id"],
        title="Refund request received",
        message=(
            f"We received your refund request for order #{order.get('order_number') or order_id[:8]}. "
            f"Your ticket has been invalidated while our team reviews it."
        ),
        notification_type="refund_submitted",
        dedupe_key=f"refund_submitted:{refund_id}",
        data={"refund_id": refund_id, "order_id": order_id, "status": RefundStatus.PENDING},
        action_url="/orders",
        source="refunds",
    )

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
async def _enrich_refund_with_customer(db, refund: dict) -> dict:
    """Attach a thin customer block to a refund row so the admin queue can
    render the booker without a second round-trip per row."""
    user_id = refund.get("user_id")
    if user_id:
        u = await db.users.find_one({"_id": user_id}, {
            "first_name": 1, "last_name": 1, "full_name": 1,
            "email": 1, "phone": 1, "created_at": 1, "country": 1, "city": 1,
        })
        if u:
            full = u.get("full_name") or " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip() or u.get("email")
            refund["customer"] = {
                "id": user_id,
                "name": full,
                "email": u.get("email"),
                "phone": u.get("phone"),
                "country": u.get("country"),
                "city": u.get("city"),
                "joined_at": u.get("created_at").isoformat() if hasattr(u.get("created_at", ""), "isoformat") else u.get("created_at"),
            }
    return refund


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
        await _enrich_refund_with_customer(db, r)
        items.append(r)

    # Single-pass risk-flag attachment — one aggregation across every unique
    # user_id in the response, so the queue rows can flag frequent refunders
    # without N+1 round-trips.
    user_ids = [r.get("user_id") for r in items if r.get("user_id")]
    if user_ids:
        unique_ids = list(set(user_ids))
        orders_agg = await db.orders.aggregate([
            {"$match": {"user_id": {"$in": unique_ids}, "payment_status": {"$in": ["paid", "completed", "verified"]}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ]).to_list(len(unique_ids))
        refunds_agg = await db.refunds.aggregate([
            {"$match": {"user_id": {"$in": unique_ids}, "status": {"$in": ["completed", "approved"]}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ]).to_list(len(unique_ids))
        order_counts = {x["_id"]: x["count"] for x in orders_agg}
        refund_counts = {x["_id"]: x["count"] for x in refunds_agg}
        for r in items:
            uid = r.get("user_id")
            if not uid or not r.get("customer"):
                continue
            oc = order_counts.get(uid, 0)
            rc = refund_counts.get(uid, 0)
            rate = (rc / oc) if oc > 0 else 0
            if rc >= 10 and rate > 0.5:
                r["customer"]["risk_flag"] = "suspicious"
            elif rc >= 5 or rate > 0.3:
                r["customer"]["risk_flag"] = "frequent_refunder"

    return {"refunds": items, "total": total}


@router.get("/{refund_id}/details")
async def refund_details(refund_id: str,
                          current_user: dict = Depends(get_current_active_user)):
    """Rich detail view used by the admin queue's per-row modal — joins the
    refund row to the originating order, the booker's user profile, and
    (when applicable) the customer's lifetime totals so the reviewer can make
    an informed decision without leaving the page."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_database()

    refund = await db.refunds.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    refund["id"] = refund.pop("_id")

    order = await db.orders.find_one({"_id": refund.get("order_id")})
    if order:
        order["id"] = order.pop("_id")

    customer = None
    user_id = refund.get("user_id")
    if user_id:
        u = await db.users.find_one({"_id": user_id})
        if u:
            full = u.get("full_name") or " ".join(filter(None, [u.get("first_name"), u.get("last_name")])).strip() or u.get("email")
            # Lifetime totals — cheap aggregate, scoped to confirmed orders.
            lifetime_pipeline = [
                {"$match": {"user_id": user_id, "payment_status": {"$in": ["paid", "completed", "verified"]}}},
                {"$group": {"_id": None, "spent": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
            ]
            lifetime = await db.orders.aggregate(lifetime_pipeline).to_list(1)
            refund_pipeline = [
                {"$match": {"user_id": user_id, "status": {"$in": ["completed", "approved"]}}},
                {"$group": {"_id": None, "amount": {"$sum": "$approved_amount"}, "count": {"$sum": 1}}},
            ]
            past_refunds = await db.refunds.aggregate(refund_pipeline).to_list(1)
            total_orders = int(lifetime[0]["count"]) if lifetime else 0
            refund_count = int(past_refunds[0]["count"]) if past_refunds else 0
            refund_rate = (refund_count / total_orders) if total_orders > 0 else 0
            # Heuristic risk flags surfaced to the admin UI.
            risk_flag = None
            if refund_count >= 10 and refund_rate > 0.5:
                risk_flag = "suspicious"
            elif refund_count >= 5 or refund_rate > 0.3:
                risk_flag = "frequent_refunder"
            customer = {
                "id": user_id,
                "name": full,
                "email": u.get("email"),
                "phone": u.get("phone"),
                "country": u.get("country"),
                "city": u.get("city"),
                "joined_at": u.get("created_at").isoformat() if hasattr(u.get("created_at", ""), "isoformat") else u.get("created_at"),
                "lifetime_spent": float(lifetime[0]["spent"]) if lifetime else 0,
                "total_orders": total_orders,
                "total_refunds_count": refund_count,
                "total_refunded_amount": float(past_refunds[0]["amount"]) if past_refunds else 0,
                "refund_rate": round(refund_rate, 3),
                "risk_flag": risk_flag,
            }

    return {"refund": refund, "order": order, "customer": customer}


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
        "status": "refunded" if is_full else order.get("pre_refund_status") or order.get("status"),
        "payment_status": "refunded" if is_full else "partially_refunded",
        "refunded_amount": approved,
        "ticket_invalidated": True,
        "updated_at": now,
    }})

    # iter 245: notify the customer that the refund was approved.
    await create_notification(
        db,
        user_id=order["user_id"],
        title="Refund approved",
        message=(
            f"Your refund of {approved:,.0f} {order.get('currency') or 'XAF'} for order "
            f"#{order.get('order_number') or order['_id'][:8]} has been approved. "
            f"{'Funds will arrive on your card shortly.' if order.get('payment_method') == 'stripe' else 'Our team will process the transfer manually.'}"
        ),
        notification_type="refund_approved",
        dedupe_key=f"refund_approved:{refund_id}",
        data={"refund_id": refund_id, "order_id": order["_id"], "approved_amount": approved, "status": final_status},
        action_url="/orders",
        source="refunds",
    )

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

    # iter 245: revert the ticket to valid IF the service date hasn't passed.
    order = await db.orders.find_one({"_id": refund["order_id"]})
    if order:
        expired = _service_date_expired(order)
        revert_status = order.get("pre_refund_status") or "confirmed"
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {
            "status": revert_status if not expired else "expired",
            "ticket_invalidated": expired,  # only stays invalid if the show is over
            "updated_at": datetime.now(timezone.utc),
        }})
        await create_notification(
            db,
            user_id=order["user_id"],
            title="Refund request declined",
            message=(
                f"Your refund request for order #{order.get('order_number') or order['_id'][:8]} was declined. "
                + (payload.admin_notes or "")
                + (" Your ticket is valid again." if not expired else " Note: the service date has already passed.")
            ).strip(),
            notification_type="refund_rejected",
            dedupe_key=f"refund_rejected:{refund_id}",
            data={"refund_id": refund_id, "order_id": order["_id"], "ticket_reverted": not expired},
            action_url="/orders",
            source="refunds",
        )

    return {"refund_id": refund_id, "status": RefundStatus.REJECTED}



# ── Manual completion (MoMo / Orange / Cash) ───────────────────────────────
class RefundCompletePayload(BaseModel):
    proof_reference: Optional[str] = None  # e.g. MoMo financial_id, bank ref, cash voucher
    admin_notes: Optional[str] = None


@router.post("/{refund_id}/complete")
async def complete_refund(
    refund_id: str,
    payload: RefundCompletePayload,
    current_user: dict = Depends(get_current_active_user),
):
    """Mark a manually-paid refund as COMPLETED.

    Used when a Stripe-less provider (MoMo, Orange, cash, bank transfer) has
    already been paid out by ops. Stripe refunds auto-transition to COMPLETED
    on approval and never hit this endpoint.
    """
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    db = get_database()
    refund = await db.refunds.find_one({"_id": refund_id})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    if refund["status"] != RefundStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Only approved refunds can be marked complete (current status: {refund['status']}).",
        )

    now = datetime.now(timezone.utc)
    await db.refunds.update_one({"_id": refund_id}, {"$set": {
        "status": RefundStatus.COMPLETED,
        "gateway_refund_id": payload.proof_reference or refund.get("gateway_refund_id"),
        "admin_notes": ((refund.get("admin_notes") or "") + " | " + (payload.admin_notes or "")).strip(" |"),
        "completed_at": now,
        "completed_by": current_user["_id"],
        "updated_at": now,
    }})

    order = await db.orders.find_one({"_id": refund["order_id"]})
    if order:
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {
            "status": "refunded",
            "payment_status": "refunded",
            "refunded_at": now,
            "updated_at": now,
        }})
        await create_notification(
            db,
            user_id=order["user_id"],
            title="Refund completed",
            message=(
                f"Your refund of {refund.get('approved_amount') or 0:,.0f} {order.get('currency') or 'XAF'} "
                f"for order #{order.get('order_number') or order['_id'][:8]} has been paid out. "
                f"Expect funds on your "
                + ("card within 5–10 business days." if order.get("payment_method") == "stripe"
                   else "MoMo / Orange wallet within 2–3 business days.")
            ),
            notification_type="refund_completed",
            dedupe_key=f"refund_completed:{refund_id}",
            data={"refund_id": refund_id, "order_id": order["_id"]},
            action_url="/orders",
            source="refunds",
        )

    return {"refund_id": refund_id, "status": RefundStatus.COMPLETED, "proof_reference": payload.proof_reference}

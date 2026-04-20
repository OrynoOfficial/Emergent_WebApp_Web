"""
Generic resource reassignment service.

When an operator replaces a resource (e.g. a broken-down bus, a closed hotel room,
a swapped car), this endpoint:

  1. Finds all active/future orders referencing the old resource.
  2. Updates their embedded snapshot (plate_number, images, etc.) to match the new one.
  3. Appends an entry to each order's `reassignment_history` audit trail.
  4. Logs a single `resource_reassignments` event document.
  5. Fires deduped notifications to customers, the operator's team, and all admins.

Currently wired for `service_type="travel"` / `resource_type="vehicle"`. The code is
intentionally generic so other services can be added by registering a new entry in
the SERVICE_SPECS mapping below — no new endpoint needed.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from config.database import get_database
from middleware.auth import get_current_active_user
from utils.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/operator/resources", tags=["Resource Reassignments"])


# ---------------------------------------------------------------------------
# Service specs — single source of truth for adapter logic per service.
# To onboard a new service, add an entry here. No other code changes required.
# ---------------------------------------------------------------------------
SERVICE_SPECS: Dict[str, Dict[str, Any]] = {
    "travel": {
        "resource_type": "vehicle",
        "resource_collection": "vehicles",
        # Field on the order that stores the referenced resource id.
        "order_resource_id_path": "booking_details.vehicle_id",
        # Embedded snapshot field on the order — replaced wholesale on reassignment.
        "order_snapshot_path": "booking_details.vehicle_info",
        # Extra top-level fields on the order that also mirror resource data
        # (kept for legacy/ticket-print compatibility) — updated alongside snapshot.
        "extra_order_mirrors": {
            "booking_details.vehicle_name": "vehicle_name",
            "booking_details.plate_number": "plate_number",
            "booking_details.vehicle_images": "images",
            "booking_details.vehicle_model": "model",
            "booking_details.vehicle_type": "vehicle_type",
        },
        # Fields copied from the resource doc into the snapshot.
        "snapshot_fields": [
            "plate_number", "vehicle_name", "name", "model",
            "manufacturer", "images", "vehicle_type", "year", "total_seats",
        ],
        # Labels for notification copy.
        "noun_singular": "vehicle",
        "noun_singular_title": "Vehicle",
        "booking_noun": "bus",
        # Field used to identify the resource in human-readable messages.
        "label_field": "plate_number",
        "secondary_label_field": "vehicle_name",
        # Compatibility check — both must match operator_id at minimum.
        "compat_fields": ["operator_id"],
    },
}


ALLOWED_STATUSES_DEFAULT = ["pending", "confirmed", "paid"]
ALLOWED_REASONS = {"breakdown", "maintenance", "upgrade", "overbooking", "weather", "other"}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class ReassignScope(BaseModel):
    date_from: Optional[str] = None   # ISO 8601
    date_to: Optional[str] = None
    status_in: Optional[List[str]] = None


class ReassignRequest(BaseModel):
    service_type: str = Field(..., description="e.g. 'travel'")
    old_resource_id: str
    new_resource_id: str
    reason: str
    reason_note: Optional[str] = None
    scope: Optional[ReassignScope] = None
    dry_run: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_spec(service_type: str) -> Dict[str, Any]:
    spec = SERVICE_SPECS.get(service_type)
    if not spec:
        raise HTTPException(
            status_code=400,
            detail=f"Reassignment not supported for service_type='{service_type}'",
        )
    return spec


def _build_snapshot(resource: dict, spec: Dict[str, Any]) -> dict:
    snap = {}
    for f in spec["snapshot_fields"]:
        if f in resource and resource[f] is not None:
            snap[f] = resource[f]
    return snap


def _label(resource: dict, spec: Dict[str, Any]) -> str:
    return (
        resource.get(spec["label_field"])
        or resource.get(spec["secondary_label_field"])
        or resource.get("_id", "")[:8]
    )


async def _get_affected_orders(
    db, spec: Dict[str, Any], service_type: str,
    old_resource_id: str, scope: Optional[ReassignScope],
    operator_id: Optional[str],
) -> List[dict]:
    statuses = (scope and scope.status_in) or ALLOWED_STATUSES_DEFAULT

    # Primary match: orders that explicitly reference the resource id.
    primary_clause: Dict[str, Any] = {
        spec["order_resource_id_path"]: old_resource_id,
    }

    # Secondary match (travel only): orders whose service_id points to a route
    # currently bound to the old vehicle — this covers historical orders whose
    # booking_details didn't store vehicle_id at creation time.
    or_clauses: List[Dict[str, Any]] = [primary_clause]
    if service_type == "travel":
        route_ids = await db.travel_routes.distinct(
            "_id", {"vehicle_id": old_resource_id}
        )
        if route_ids:
            or_clauses.append({"service_id": {"$in": route_ids}})

    query: Dict[str, Any] = {
        "service_type": service_type,
        "status": {"$in": statuses},
        "$or": or_clauses,
    }

    if operator_id:
        query["operator_id"] = operator_id

    if scope:
        date_q: Dict[str, Any] = {}
        if scope.date_from:
            date_q["$gte"] = scope.date_from
        if scope.date_to:
            date_q["$lte"] = scope.date_to
        if date_q:
            # AND the date filter with the rest — keep existing $or for primary/secondary match.
            query = {
                "$and": [
                    query,
                    {"$or": [
                        {"booking_details.travel_date": date_q},
                        {"booking_details.departure_time": date_q},
                    ]},
                ]
            }

    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=1000)


async def _fan_out_notifications(
    db, orders: List[dict], event: dict, spec: Dict[str, Any],
) -> Dict[str, int]:
    old_label = event["from"].get(spec["label_field"]) or "previous"
    new_label = event["to"].get(spec["label_field"]) or "new"
    reason = event["reason"]
    reason_note = event.get("reason_note") or ""
    noun = spec["booking_noun"]

    reason_suffix = f" Reason: {reason_note}" if reason_note else f" Reason: {reason}."

    customer_title = f"Your {noun} has been changed"
    if reason == "upgrade":
        customer_title = f"Good news — your {noun} has been upgraded"

    notified_customers = 0
    notified_operator_users = 0
    customer_msg_tpl = (
        f"We've replaced your {noun} ({old_label}) with {new_label}."
        f"{reason_suffix}"
    )

    operator_users = []
    operator_ids_seen = set()
    for o in orders:
        op_id = o.get("operator_id")
        if op_id and op_id not in operator_ids_seen:
            operator_ids_seen.add(op_id)
            async for u in db.users.find(
                {"operator_id": op_id, "role": {"$in": ["operator"]}},
                {"_id": 1},
            ):
                operator_users.append(u["_id"])

    for order in orders:
        user_id = order.get("user_id")
        order_number = order.get("order_number") or order.get("_id") or order.get("id")
        if user_id:
            await create_notification(
                db,
                user_id=user_id,
                title=customer_title,
                message=customer_msg_tpl + f" (Booking {order_number})",
                notification_type="booking_update",
                dedupe_key=f"reassign:{event['_id']}:{order_number}:customer",
                data={
                    "event_id": event["_id"],
                    "order_number": order_number,
                    "service_type": event["service_type"],
                    "from": event["from"],
                    "to": event["to"],
                    "reason": reason,
                },
                action_url=f"/orders/{order_number}",
                source="resource_reassignment",
            )
            notified_customers += 1

    for op_user_id in operator_users:
        await create_notification(
            db,
            user_id=op_user_id,
            title=f"{spec['noun_singular_title']} reassignment applied",
            message=(
                f"{event['affected_count']} booking(s) moved from {old_label} "
                f"to {new_label}.{reason_suffix}"
            ),
            notification_type="booking_update",
            dedupe_key=f"reassign:{event['_id']}:operator:{op_user_id}",
            data={"event_id": event["_id"], "service_type": event["service_type"]},
            action_url="/admin/bookings",
            source="resource_reassignment",
        )
        notified_operator_users += 1

    notified_admins = 0
    async for admin in db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}},
        {"_id": 1},
    ):
        await create_notification(
            db,
            user_id=admin["_id"],
            title=f"{event['service_type'].title()} {spec['noun_singular']} reassigned",
            message=(
                f"{event['affected_count']} booking(s) updated "
                f"({old_label} → {new_label}).{reason_suffix}"
            ),
            notification_type="booking_update",
            dedupe_key=f"reassign:{event['_id']}:admin:{admin['_id']}",
            data={"event_id": event["_id"]},
            action_url="/admin/bookings",
            source="resource_reassignment",
        )
        notified_admins += 1

    return {
        "customers": notified_customers,
        "operator_users": notified_operator_users,
        "admins": notified_admins,
    }


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------
@router.post("/reassign")
async def reassign_resource(
    body: ReassignRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Replace a resource across all active bookings.

    Operators can only reassign resources within their own operator_id.
    Admins/super_admins can reassign any.
    When `dry_run=true`, no writes are made — the response previews the blast radius.
    """
    role = current_user.get("role", "")
    if role not in ("operator", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if body.reason not in ALLOWED_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid reason. Allowed: {sorted(ALLOWED_REASONS)}",
        )

    if body.old_resource_id == body.new_resource_id:
        raise HTTPException(status_code=400, detail="Old and new resource must differ")

    spec = _get_spec(body.service_type)
    db = get_database()

    # Load both resources
    old_resource = await db[spec["resource_collection"]].find_one(
        {"_id": body.old_resource_id}
    )
    new_resource = await db[spec["resource_collection"]].find_one(
        {"_id": body.new_resource_id}
    )
    if not old_resource:
        raise HTTPException(status_code=404, detail="Old resource not found")
    if not new_resource:
        raise HTTPException(status_code=404, detail="New resource not found")

    # Authorization / compatibility
    operator_id_filter: Optional[str] = None
    if role == "operator":
        op_id = current_user.get("operator_id")
        if old_resource.get("operator_id") != op_id or new_resource.get("operator_id") != op_id:
            raise HTTPException(
                status_code=403,
                detail="Both resources must belong to your operator",
            )
        operator_id_filter = op_id
    else:
        # For admins: enforce same operator on both ends by default.
        if old_resource.get("operator_id") != new_resource.get("operator_id"):
            raise HTTPException(
                status_code=400,
                detail="Cross-operator reassignment is not allowed",
            )

    # Gather affected orders
    orders = await _get_affected_orders(
        db, spec, body.service_type, body.old_resource_id, body.scope,
        operator_id_filter,
    )

    # Build snapshots and event skeleton
    from_snap = _build_snapshot(old_resource, spec)
    to_snap = _build_snapshot(new_resource, spec)
    now = datetime.now(timezone.utc)
    event_id = str(uuid.uuid4())
    event = {
        "_id": event_id,
        "service_type": body.service_type,
        "resource_type": spec["resource_type"],
        "old_resource_id": body.old_resource_id,
        "new_resource_id": body.new_resource_id,
        "reason": body.reason,
        "reason_note": body.reason_note,
        "triggered_by": current_user.get("_id") or current_user.get("id"),
        "triggered_by_name": current_user.get("full_name") or current_user.get("email"),
        "operator_id": old_resource.get("operator_id"),
        "affected_order_ids": [o.get("order_number") or o.get("id") for o in orders],
        "affected_count": len(orders),
        "from": from_snap,
        "to": to_snap,
        "notifications_sent": {"customers": 0, "operator_users": 0, "admins": 0},
        "status": "preview",
        "created_at": now,
    }

    # Dry-run short-circuit
    if body.dry_run:
        preview_orders = [
            {
                "order_number": o.get("order_number") or o.get("id"),
                "customer_name": (
                    (o.get("guest_customer") or {}).get("name")
                    or o.get("customer_name")
                    or o.get("user_email")
                ),
                "travel_date": (o.get("booking_details") or {}).get("travel_date"),
                "departure_time": (o.get("booking_details") or {}).get("departure_time"),
                "seats": (o.get("booking_details") or {}).get("seat_numbers")
                or (o.get("booking_details") or {}).get("selected_seats"),
                "status": o.get("status"),
            }
            for o in orders[:50]
        ]
        return {
            "dry_run": True,
            "affected_count": event["affected_count"],
            "from": from_snap,
            "to": to_snap,
            "preview_orders": preview_orders,
            "preview_truncated": len(orders) > 50,
        }

    # ---- Commit ----
    # 1) Bulk-update each order (cannot use updateMany with $push + $set nested keys that vary per order easily)
    set_payload: Dict[str, Any] = {
        spec["order_resource_id_path"]: body.new_resource_id,
        spec["order_snapshot_path"]: to_snap,
        "updated_at": now,
    }
    for path, res_field in spec["extra_order_mirrors"].items():
        if res_field in new_resource and new_resource[res_field] is not None:
            set_payload[path] = new_resource[res_field]

    history_entry = {
        "event_id": event_id,
        "from": from_snap,
        "to": to_snap,
        "reason": body.reason,
        "reason_note": body.reason_note,
        "at": now,
        "by": event["triggered_by_name"] or event["triggered_by"],
    }

    update_filter = {
        "order_number": {"$in": [o.get("order_number") for o in orders if o.get("order_number")]},
    }
    if update_filter["order_number"]["$in"]:
        await db.orders.update_many(
            update_filter,
            {
                "$set": set_payload,
                "$push": {"reassignment_history": history_entry},
            },
        )

    # 2) Insert event doc
    event["status"] = "completed"
    await db.resource_reassignments.insert_one(event)

    # 3) Fan-out notifications
    try:
        notif_summary = await _fan_out_notifications(db, orders, event, spec)
        await db.resource_reassignments.update_one(
            {"_id": event_id},
            {"$set": {"notifications_sent": notif_summary}},
        )
        event["notifications_sent"] = notif_summary
    except Exception as e:
        logger.exception("Notification fan-out failed for event %s: %s", event_id, e)

    return {
        "dry_run": False,
        "event_id": event_id,
        "affected_count": event["affected_count"],
        "from": from_snap,
        "to": to_snap,
        "notifications_sent": event.get("notifications_sent", {}),
    }


@router.get("/reassignments")
async def list_reassignments(
    service_type: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    """List recent reassignment events, scoped to operator for operator users."""
    role = current_user.get("role", "")
    if role not in ("operator", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    db = get_database()
    query: Dict[str, Any] = {}
    if role == "operator":
        query["operator_id"] = current_user.get("operator_id")
    if service_type:
        query["service_type"] = service_type

    limit = max(1, min(limit, 200))
    # Motor's find() does not support aggregation expressions in projection, so use a
    # plain {"_id": 0} and remap in Python.
    cursor = db.resource_reassignments.find(query).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    for it in items:
        it["id"] = it.pop("_id", None)
        if isinstance(it.get("created_at"), datetime):
            it["created_at"] = it["created_at"].isoformat()
    return {"events": items, "total": len(items)}

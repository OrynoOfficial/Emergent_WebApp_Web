"""
Sync helpers between `orders` and `packages` collections.

When an order's payment / status changes for a service_type='package' booking,
the linked physical-shipment record (`db.packages`) must be kept in sync so
the operator's Shipments page and the public /api/packages/track endpoint
reflect reality. Also notifies the operator (in-app + email) when a payment
is verified so they can dispatch immediately.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from utils.notifications import create_notification
from utils.email import send_email

logger = logging.getLogger(__name__)


async def _resolve_package_id(db, order: dict) -> Optional[str]:
    """Find the package _id linked to an order (covers both legacy and current shapes)."""
    if not order:
        return None
    if order.get("service_type") != "package":
        return None
    booking_details = order.get("booking_details") or {}
    # Preferred: explicit package_id stored at booking time
    pkg_id = booking_details.get("package_id") or order.get("service_id")
    if pkg_id:
        # Confirm it exists
        if await db.packages.count_documents({"_id": pkg_id}, limit=1):
            return pkg_id
    # Fallback: try via tracking_number
    tracking = booking_details.get("tracking_number")
    if tracking:
        pkg = await db.packages.find_one({"tracking_number": tracking})
        if pkg:
            return pkg.get("_id")
    return None


async def sync_package_payment_from_order(db, order: dict, *, paid: bool = True, note: str = "Payment confirmed") -> Optional[str]:
    """Mirror the order's payment_status onto the linked physical package.

    Pushes a status_history event so the public tracking timeline shows
    'Payment confirmed' to the receiver.

    Returns the package id that was updated, or None if no link found.
    """
    package_id = await _resolve_package_id(db, order)
    if not package_id:
        return None

    now = datetime.now(timezone.utc)
    payment_status = "paid" if paid else "refunded"

    update = {
        "$set": {
            "payment_status": payment_status,
            "updated_at": now,
        }
    }

    # Only push the timeline event the first time we mark it paid
    pkg = await db.packages.find_one({"_id": package_id}, {"payment_status": 1})
    if pkg and pkg.get("payment_status") != payment_status:
        update["$push"] = {
            "status_history": {
                "status": pkg.get("status") or "pending",
                "title": "Payment confirmed" if paid else "Payment refunded",
                "description": note,
                "location": "",
                "timestamp": now,
            }
        }

    await db.packages.update_one({"_id": package_id}, update)
    return package_id


async def sync_package_cancellation_from_order(db, order: dict, *, reason: str = "Order cancelled") -> Optional[str]:
    """Mark the linked package as cancelled when its order is cancelled."""
    package_id = await _resolve_package_id(db, order)
    if not package_id:
        return None

    now = datetime.now(timezone.utc)
    await db.packages.update_one(
        {"_id": package_id},
        {
            "$set": {"status": "cancelled", "updated_at": now},
            "$push": {
                "status_history": {
                    "status": "cancelled",
                    "title": "Cancelled",
                    "description": reason,
                    "location": "",
                    "timestamp": now,
                }
            },
        },
    )
    return package_id

"""
Robust notification helper.

Solves the "notifications reappear after being marked as read" issue by:
  - Enforcing a compound unique-ish constraint via `dedupe_key` (user_id + dedupe_key).
  - If the dedupe_key already exists, the existing notification is updated in place
    — preserving its is_read state so users don't see the same event reappear.
  - When no dedupe_key is given, a plain insert is performed (legacy behaviour).

Every route that creates notifications should use `create_notification(...)`
instead of calling `db.notifications.insert_one` directly.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
import logging

logger = logging.getLogger(__name__)


async def create_notification(
    db,
    user_id: str,
    title: str,
    message: str,
    *,
    notification_type: str = "info",
    dedupe_key: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    action_url: Optional[str] = None,
    source: Optional[str] = None,
    category: str = "booking",
    **extra: Any,
) -> Optional[str]:
    """
    Create or upsert a notification.

    If `dedupe_key` is provided and a notification with the same (user_id, dedupe_key)
    already exists, we update its metadata (title/message/timestamp) but DO NOT reset
    the `is_read` flag — this is the fix for notifications reappearing as unread on
    subsequent logins.

    Respects the user's push_notifications + <category> toggles (see notification_gate).
    Transactional messages (OTP, password reset, invitations) bypass the gate.

    Returns the notification id, or None on error / gated-off.
    """
    if not user_id:
        logger.warning("create_notification: skipped — no user_id")
        return None

    # Gate in-app / push notifications on user preferences
    try:
        from utils.notification_gate import should_notify
        allowed = await should_notify(user_id, "push", category)
        if not allowed:
            logger.debug("create_notification: gated off for %s (%s)", user_id, category)
            return None
    except Exception:
        # If the gate check fails for any reason, err on the side of delivering
        # the notification so we don't silently drop critical alerts.
        pass

    now = datetime.now(timezone.utc)
    base_doc = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "type": notification_type,
        "data": data or {},
        "action_url": action_url,
        "source": source,
        **extra,
    }

    try:
        if dedupe_key:
            # Upsert: never overwrite is_read — only update content + last_updated.
            await db.notifications.update_one(
                {"user_id": user_id, "dedupe_key": dedupe_key},
                {
                    "$set": {
                        **base_doc,
                        "dedupe_key": dedupe_key,
                        "updated_at": now,
                    },
                    "$setOnInsert": {
                        "_id": str(uuid.uuid4()),
                        "is_read": False,
                        "created_at": now,
                    },
                },
                upsert=True,
            )
            existing = await db.notifications.find_one(
                {"user_id": user_id, "dedupe_key": dedupe_key},
                {"_id": 1},
            )
            return existing.get("_id") if existing else None
        else:
            doc = {
                "_id": str(uuid.uuid4()),
                **base_doc,
                "is_read": False,
                "created_at": now,
            }
            await db.notifications.insert_one(doc)
            return doc["_id"]
    except Exception as e:
        logger.exception("Failed to create notification: %s", e)
        return None


async def bulk_create_notifications(
    db,
    recipients: List[str],
    title: str,
    message: str,
    *,
    notification_type: str = "info",
    dedupe_key_prefix: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    action_url: Optional[str] = None,
    source: Optional[str] = None,
    category: str = "booking",
    **extra: Any,
) -> int:
    """Create the same notification for many users, with per-user dedupe."""
    count = 0
    for user_id in recipients:
        if not user_id:
            continue
        dk = f"{dedupe_key_prefix}:{user_id}" if dedupe_key_prefix else None
        nid = await create_notification(
            db,
            user_id,
            title,
            message,
            notification_type=notification_type,
            dedupe_key=dk,
            data=data,
            action_url=action_url,
            source=source,
            category=category,
            **extra,
        )
        if nid:
            count += 1
    return count


async def ensure_notification_indexes(db) -> None:
    """Idempotent index bootstrap — safe to call at startup."""
    try:
        await db.notifications.create_index("user_id")
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("is_read", 1)])

        # Legacy docs may have dedupe_key=null → convert to missing so sparse/partial
        # indexes work correctly.
        await db.notifications.update_many(
            {"dedupe_key": None},
            {"$unset": {"dedupe_key": ""}},
        )

        # Drop any stale definition, then recreate as a partial-unique index
        # that only indexes docs where dedupe_key is a string.
        try:
            await db.notifications.drop_index("user_dedupe_key_unique")
        except Exception:
            pass
        await db.notifications.create_index(
            [("user_id", 1), ("dedupe_key", 1)],
            unique=True,
            partialFilterExpression={"dedupe_key": {"$type": "string"}},
            name="user_dedupe_key_unique",
        )
        logger.info("Notification indexes ensured")
    except Exception as e:
        logger.warning("Notification index bootstrap failed: %s", e)


async def dedupe_existing_notifications(db) -> Dict[str, int]:
    """
    One-shot migration: collapse duplicate notifications with the same dedupe_key.
    Keeps the most recently-created one and OR's is_read across the group, so if
    the user already read any of the duplicates the surviving record stays read.
    """
    total_dedup = 0
    total_merged_read = 0
    pipeline = [
        {"$match": {"dedupe_key": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": {"user_id": "$user_id", "dedupe_key": "$dedupe_key"},
            "ids": {"$push": "$_id"},
            "any_read": {"$max": "$is_read"},
            "latest": {"$max": "$created_at"},
            "count": {"$sum": 1},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ]
    async for group in db.notifications.aggregate(pipeline):
        ids = group["ids"]
        keep_doc = await db.notifications.find(
            {"_id": {"$in": ids}},
        ).sort("created_at", -1).limit(1).to_list(1)
        keep_id = keep_doc[0]["_id"] if keep_doc else ids[0]
        del_ids = [i for i in ids if i != keep_id]
        if del_ids:
            result = await db.notifications.delete_many({"_id": {"$in": del_ids}})
            total_dedup += result.deleted_count
        if group["any_read"]:
            await db.notifications.update_one(
                {"_id": keep_id},
                {"$set": {"is_read": True}},
            )
            total_merged_read += 1

    return {"duplicates_removed": total_dedup, "merged_read_state": total_merged_read}

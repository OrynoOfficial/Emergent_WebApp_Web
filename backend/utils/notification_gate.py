"""
notification_gate.py — centralised policy check before dispatching any user
notification (email, SMS, push).

Every user document may carry the following boolean fields (all default True
except sms/promotional/newsletter which default False):
  - email_notifications
  - sms_notifications
  - push_notifications
  - booking_updates
  - promotional
  - newsletter

Usage:
    from utils.notification_gate import should_notify

    if await should_notify(user_id, channel="email", category="booking"):
        await email_service.send(...)

Categories:
  - "booking"      → order lifecycle (confirmation, refund, cancellation)
  - "promotional"  → discounts, deals
  - "newsletter"   → weekly/monthly digest
  - "transactional" → password reset, OTP, invite (ALWAYS allowed; ignores prefs)
"""
from typing import Literal, Optional
from config.database import get_database

Channel = Literal["email", "sms", "push"]
Category = Literal["booking", "promotional", "newsletter", "transactional"]

# Transactional messages (OTP, password reset, invitations) bypass the gate
# because they're required for account security/access.
_TRANSACTIONAL = {"transactional"}

# Per-channel master switch defaults
_CHANNEL_DEFAULTS = {
    "email": True,
    "sms": False,
    "push": True,
}

# Per-category user-facing toggle defaults
_CATEGORY_DEFAULTS = {
    "booking": True,       # booking_updates
    "promotional": False,  # promotional
    "newsletter": False,   # newsletter
}


async def _load_user_prefs(user_id: str) -> Optional[dict]:
    if not user_id:
        return None
    db = get_database()
    user = await db.users.find_one(
        {"_id": user_id},
        projection={
            "email_notifications": 1,
            "sms_notifications": 1,
            "push_notifications": 1,
            "booking_updates": 1,
            "promotional": 1,
            "newsletter": 1,
        },
    )
    return user


async def should_notify(
    user_id: str,
    channel: Channel,
    category: Category = "booking",
) -> bool:
    """Return True iff the user has opted-in to this channel + category.

    - Transactional messages always return True (skip user prefs).
    - Unknown user → return the default for that channel + category (safe fallback).
    - Missing pref fields → fall back to the documented defaults above.
    """
    if category in _TRANSACTIONAL:
        return True

    prefs = await _load_user_prefs(user_id)
    if not prefs:
        return _CHANNEL_DEFAULTS.get(channel, True) and _CATEGORY_DEFAULTS.get(category, True)

    channel_key = {
        "email": "email_notifications",
        "sms": "sms_notifications",
        "push": "push_notifications",
    }[channel]
    channel_enabled = bool(prefs.get(channel_key, _CHANNEL_DEFAULTS.get(channel, True)))

    category_key = {
        "booking": "booking_updates",
        "promotional": "promotional",
        "newsletter": "newsletter",
    }.get(category)
    category_enabled = bool(prefs.get(category_key, _CATEGORY_DEFAULTS.get(category, True)))

    return channel_enabled and category_enabled


async def should_notify_email(user_id: str, category: Category = "booking") -> bool:
    return await should_notify(user_id, "email", category)


async def should_notify_sms(user_id: str, category: Category = "booking") -> bool:
    return await should_notify(user_id, "sms", category)


async def should_notify_push(user_id: str, category: Category = "booking") -> bool:
    return await should_notify(user_id, "push", category)

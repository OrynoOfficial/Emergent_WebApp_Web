"""
Token revocation helpers — backs the rotating-refresh + JTI-blacklist auth.

Collections (created with TTL indexes in server.py startup):
    refresh_tokens          {jti, user_id, family_id, parent_jti, revoked_at, expires_at, created_at}
    revoked_access_tokens   {jti, user_id, expires_at}    # expires_at drives TTL purge

The revocation check on every protected request is fronted by an in-process
TTL cache so it costs O(1) for the hot path — Mongo is only hit on cache
miss (60s TTL, matching the existing user cache).
"""
from datetime import datetime
from typing import Optional

from config.database import get_database
from utils.cache import cache_get, cache_set, cache_delete

_NEG_VAL = "ok"     # sentinel meaning "verified NOT revoked"
_POS_VAL = "revoked"


# ── Refresh tokens ──────────────────────────────────────────────────────────
async def persist_refresh_token(*, user_id: str, jti: str, family_id: str,
                                parent_jti: Optional[str], expires_at: datetime) -> None:
    db = get_database()
    await db.refresh_tokens.insert_one({
        "_id": jti,
        "user_id": user_id,
        "family_id": family_id,
        "parent_jti": parent_jti,
        "revoked_at": None,
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
    })


async def get_refresh_token_record(jti: str) -> Optional[dict]:
    db = get_database()
    return await db.refresh_tokens.find_one({"_id": jti})


async def mark_refresh_token_revoked(jti: str) -> None:
    db = get_database()
    await db.refresh_tokens.update_one(
        {"_id": jti},
        {"$set": {"revoked_at": datetime.utcnow()}},
    )


async def revoke_refresh_family(family_id: str) -> int:
    """Revoke every refresh token in the family — used both on logout AND on
    reuse-attack detection (an already-revoked refresh presented again)."""
    db = get_database()
    res = await db.refresh_tokens.update_many(
        {"family_id": family_id, "revoked_at": None},
        {"$set": {"revoked_at": datetime.utcnow()}},
    )
    return res.modified_count


# ── Access tokens ───────────────────────────────────────────────────────────
async def revoke_access_token(*, jti: str, user_id: str, expires_at: datetime) -> None:
    db = get_database()
    await db.revoked_access_tokens.update_one(
        {"_id": jti},
        {"$set": {"_id": jti, "user_id": user_id, "expires_at": expires_at}},
        upsert=True,
    )
    # Prime the cache so the next /me call from this token sees revoked
    # immediately without a Mongo hit.
    await cache_set("revoked_jti", jti, _POS_VAL)


async def is_access_token_revoked(jti: str) -> bool:
    if not jti:
        return False
    cached = await cache_get("revoked_jti", jti)
    if cached == _POS_VAL:
        return True
    if cached == _NEG_VAL:
        return False
    db = get_database()
    doc = await db.revoked_access_tokens.find_one({"_id": jti}, {"_id": 1})
    if doc:
        await cache_set("revoked_jti", jti, _POS_VAL)
        return True
    await cache_set("revoked_jti", jti, _NEG_VAL)
    return False


async def revoke_all_user_access_tokens(user_id: str) -> None:
    """Best-effort wipe used during password resets / suspensions. Walks
    every still-issued refresh in this user's families and marks them all
    revoked; access tokens just expire naturally within the 30-min window."""
    db = get_database()
    await db.refresh_tokens.update_many(
        {"user_id": user_id, "revoked_at": None},
        {"$set": {"revoked_at": datetime.utcnow()}},
    )


# ── Index creation (called once on startup) ─────────────────────────────────
async def ensure_token_indexes() -> None:
    db = get_database()
    # TTL: refresh tokens self-purge once `expires_at` passes.
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.refresh_tokens.create_index("family_id")
    await db.refresh_tokens.create_index("user_id")
    # Revoked access tokens self-purge after the original `exp`.
    await db.revoked_access_tokens.create_index("expires_at", expireAfterSeconds=0)

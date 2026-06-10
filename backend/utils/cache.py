"""
Cache abstraction — Redis-first with in-process fallback.

If `REDIS_URL` is set and reachable, all reads/writes go to Redis (shared
across every pod and every uvicorn worker). If Redis is unreachable or the
env var is missing, we transparently fall back to a `cachetools.TTLCache`
so the application keeps running with a per-process cache.

Every call site uses the same async `cache_get/cache_set/cache_delete`
functions — backend swap is invisible to routes/middleware.

Keys are namespaced (`{namespace}:{key}`) so multiple categories can share
the same Redis instance without colliding.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# ── TTL + capacity per namespace (env-tunable) ──────────────────────────
_USER_CACHE_MAX = int(os.environ.get("USER_CACHE_MAX", "10000"))
_USER_CACHE_TTL = int(os.environ.get("USER_CACHE_TTL", "60"))  # seconds

_GENERAL_CACHE_MAX = int(os.environ.get("GENERAL_CACHE_MAX", "5000"))
_GENERAL_CACHE_TTL = int(os.environ.get("GENERAL_CACHE_TTL", "30"))

_NAMESPACE_TTL = {"user": _USER_CACHE_TTL, "general": _GENERAL_CACHE_TTL}

# In-process fallback stores (used when Redis isn't reachable)
_user_store: TTLCache = TTLCache(maxsize=_USER_CACHE_MAX, ttl=_USER_CACHE_TTL)
_general_store: TTLCache = TTLCache(maxsize=_GENERAL_CACHE_MAX, ttl=_GENERAL_CACHE_TTL)


# ── Redis client (singleton, lazy-init, async) ──────────────────────────
_redis_client = None
_redis_enabled: Optional[bool] = None  # tri-state: None=not checked, True/False=known


async def _get_redis():
    """Return the singleton async Redis client, or None if Redis is unavailable.

    First call performs a PING to confirm the instance answers; subsequent
    calls return the cached client. If PING fails we set `_redis_enabled =
    False` and never retry — falls back to the in-process store for the
    lifetime of the process. A process restart re-evaluates.
    """
    global _redis_client, _redis_enabled
    if _redis_enabled is False:
        return None
    if _redis_client is not None:
        return _redis_client

    url = os.environ.get("REDIS_URL")
    if not url:
        _redis_enabled = False
        return None

    try:
        # Local import keeps redis-py optional at install time.
        import redis.asyncio as aioredis
        client = aioredis.from_url(url, decode_responses=True, socket_timeout=2)
        await client.ping()
        _redis_client = client
        _redis_enabled = True
        logger.info("Redis cache enabled at %s", url)
        return client
    except Exception as e:  # noqa: BLE001
        logger.warning("Redis unreachable, falling back to in-process cache: %s", e)
        _redis_enabled = False
        return None


def _local_store_for(namespace: str) -> TTLCache:
    return _user_store if namespace == "user" else _general_store


def _redis_key(namespace: str, key: str) -> str:
    return f"{namespace}:{key}"


async def cache_get(namespace: str, key: str) -> Any | None:
    """Return a cached value or None. Tries Redis first, falls back locally."""
    client = await _get_redis()
    if client:
        try:
            raw = await client.get(_redis_key(namespace, key))
            return json.loads(raw) if raw else None
        except Exception as e:  # noqa: BLE001
            logger.warning("Redis GET miss-by-error %s — falling back local", e)
    try:
        return _local_store_for(namespace).get(key)
    except Exception:
        return None


async def cache_set(namespace: str, key: str, value: Any, ttl_s: int | None = None) -> None:
    """Store a value with namespace-default TTL (or override)."""
    ttl = ttl_s if ttl_s is not None else _NAMESPACE_TTL.get(namespace, _GENERAL_CACHE_TTL)
    client = await _get_redis()
    if client:
        try:
            await client.set(_redis_key(namespace, key), json.dumps(value, default=str), ex=ttl)
            return
        except Exception as e:  # noqa: BLE001
            logger.warning("Redis SET ignored %s — falling back local", e)
    try:
        _local_store_for(namespace)[key] = value
    except Exception:
        pass


async def cache_delete(namespace: str, key: str) -> None:
    """Invalidate one entry across both stores."""
    client = await _get_redis()
    if client:
        try:
            await client.delete(_redis_key(namespace, key))
        except Exception:
            pass
    try:
        _local_store_for(namespace).pop(key, None)
    except Exception:
        pass


async def cache_clear(namespace: str | None = None) -> None:
    """Nuke a namespace (or all) — admin tooling + tests only."""
    client = await _get_redis()
    if client:
        try:
            if namespace is None:
                await client.flushdb()
            else:
                # Walk keys under the namespace prefix and unlink in batches.
                async for k in client.scan_iter(match=f"{namespace}:*", count=500):
                    await client.delete(k)
        except Exception:
            pass
    if namespace is None:
        _user_store.clear()
        _general_store.clear()
    else:
        _local_store_for(namespace).clear()


def stats() -> dict:
    """Lightweight introspection — used by /healthz extensions."""
    return {
        "redis_enabled": _redis_enabled,
        "user_cache_size_local": len(_user_store),
        "general_cache_size_local": len(_general_store),
        "user_cache_max": _USER_CACHE_MAX,
        "user_cache_ttl_s": _USER_CACHE_TTL,
        "general_cache_max": _GENERAL_CACHE_MAX,
        "general_cache_ttl_s": _GENERAL_CACHE_TTL,
    }

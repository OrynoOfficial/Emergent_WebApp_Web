"""
Thin cache abstraction.

Phase-2 backing store: in-process TTL LRU (cachetools).
Phase-3 swap target: Redis (storage shared across pods).

All call sites use the async `cache_get/cache_set/cache_delete` functions so
that switching to Redis later requires editing ONLY this file — no route
changes. Each entry carries its own TTL and the cache is bounded so memory
cannot grow unbounded.

Why in-process today?
  - We don't have Redis in this environment yet.
  - With a single uvicorn worker per pod, in-process is correct.
  - The moment we scale to >1 pod or >1 worker per pod, this MUST move to
    Redis — a JWT validated on pod-A won't be cached on pod-B otherwise.

Keys are namespaced (`user:{user_id}`) so multiple categories can share the
same store without colliding.
"""
from __future__ import annotations

import logging
import os
from typing import Any

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# Two coarse buckets so we can tune size/TTL independently. Increase the
# maxsize for hot user lookups once we observe real production traffic.
_USER_CACHE_MAX = int(os.environ.get("USER_CACHE_MAX", "10000"))
_USER_CACHE_TTL = int(os.environ.get("USER_CACHE_TTL", "60"))  # seconds

_GENERAL_CACHE_MAX = int(os.environ.get("GENERAL_CACHE_MAX", "5000"))
_GENERAL_CACHE_TTL = int(os.environ.get("GENERAL_CACHE_TTL", "30"))

_user_store: TTLCache = TTLCache(maxsize=_USER_CACHE_MAX, ttl=_USER_CACHE_TTL)
_general_store: TTLCache = TTLCache(maxsize=_GENERAL_CACHE_MAX, ttl=_GENERAL_CACHE_TTL)


def _store_for(namespace: str) -> TTLCache:
    return _user_store if namespace == "user" else _general_store


async def cache_get(namespace: str, key: str) -> Any | None:
    """Return a cached value or None."""
    try:
        return _store_for(namespace).get(key)
    except Exception as e:  # noqa: BLE001
        logger.warning("cache_get miss-by-error %s:%s — %s", namespace, key, e)
        return None


async def cache_set(namespace: str, key: str, value: Any) -> None:
    """Store a value. TTL is bucket-default; swap to Redis to support per-key TTL."""
    try:
        _store_for(namespace)[key] = value
    except Exception as e:  # noqa: BLE001
        logger.warning("cache_set ignored %s:%s — %s", namespace, key, e)


async def cache_delete(namespace: str, key: str) -> None:
    """Invalidate one entry. Call this after mutating the underlying DB doc."""
    try:
        _store_for(namespace).pop(key, None)
    except Exception:
        pass


async def cache_clear(namespace: str | None = None) -> None:
    """Nuke the cache (or one namespace). Intended for tests + admin tooling."""
    if namespace is None:
        _user_store.clear()
        _general_store.clear()
    else:
        _store_for(namespace).clear()


def stats() -> dict:
    """Lightweight introspection — useful for /healthz extensions."""
    return {
        "user_cache_size": len(_user_store),
        "user_cache_max": _USER_CACHE_MAX,
        "user_cache_ttl_s": _USER_CACHE_TTL,
        "general_cache_size": len(_general_store),
        "general_cache_max": _GENERAL_CACHE_MAX,
        "general_cache_ttl_s": _GENERAL_CACHE_TTL,
    }

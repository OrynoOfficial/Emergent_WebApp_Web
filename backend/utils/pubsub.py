"""
Redis-backed Pub/Sub bridge for cross-pod WebSocket fan-out.

Problem this solves
-------------------
Today every pod keeps its WebSocket subscriber list in a local dict
(`_ws_connections`). If pod-A confirms a seat reservation, only its own
subscribers learn about it — subscribers on pod-B keep seeing stale seats.

Solution
--------
Each pod still owns its local subscriber dict (sockets can only be poked from
the process they live in). When a seat change happens on pod-A:
    1. Pod-A pokes its own local subscribers immediately (low-latency loopback).
    2. Pod-A publishes the same event to Redis channel `seats:{route}:{date}`.
    3. Every other pod has a long-lived subscriber loop that listens for
       `seats:*` events and forwards them to ITS own local subscribers.

When Redis is unavailable the bridge degrades gracefully — local fan-out
still works, just no cross-pod replication. This module is reusable for any
realtime event domain: just pick a new channel prefix.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

CHANNEL_PREFIX_SEATS = "seats"

# Local registry of pubsub subscriber tasks so we can cancel them on shutdown.
_subscriber_tasks: list[asyncio.Task] = []
_redis_client = None  # lazy
_disabled: bool = False


async def _get_client():
    """Return a singleton async Redis client, or None if unavailable."""
    global _redis_client, _disabled
    if _disabled:
        return None
    if _redis_client is not None:
        return _redis_client
    url = os.environ.get("REDIS_URL")
    if not url:
        _disabled = True
        return None
    try:
        import redis.asyncio as aioredis
        client = aioredis.from_url(url, decode_responses=True, socket_timeout=2)
        await client.ping()
        _redis_client = client
        logger.info("PubSub bridge Redis client ready at %s", url)
        return client
    except Exception as e:  # noqa: BLE001
        logger.warning("PubSub bridge Redis unreachable: %s — running pod-local only", e)
        _disabled = True
        return None


async def publish(channel: str, payload: dict) -> None:
    """Broadcast an event to every pod listening on `channel`.

    Falls back to a no-op (local-only) if Redis is unreachable. This is
    intentional: a network blip should not crash the booking flow.
    """
    client = await _get_client()
    if not client:
        return
    try:
        await client.publish(channel, json.dumps(payload, default=str))
    except Exception as e:  # noqa: BLE001
        logger.warning("Redis PUBLISH ignored on %s — %s", channel, e)


async def start_subscriber(
    channel_pattern: str,
    handler: Callable[[dict], Awaitable[None]],
) -> Optional[asyncio.Task]:
    """Start a background task that calls `handler(payload)` for every
    message matching `channel_pattern` (e.g. `seats:*`).

    Returns the task handle (so callers can `task.cancel()` on shutdown).
    Returns None if Redis is unavailable.
    """
    client = await _get_client()
    if not client:
        return None
    pubsub = client.pubsub()
    await pubsub.psubscribe(channel_pattern)

    async def _loop():
        try:
            async for msg in pubsub.listen():
                if msg.get("type") != "pmessage":
                    continue
                try:
                    data = json.loads(msg.get("data") or "{}")
                except Exception:
                    continue
                try:
                    await handler(data)
                except Exception as e:  # noqa: BLE001
                    logger.warning("pubsub handler raised on %s: %s", channel_pattern, e)
        except asyncio.CancelledError:
            await pubsub.unsubscribe()
            await pubsub.aclose()
            raise

    task = asyncio.create_task(_loop(), name=f"pubsub-{channel_pattern}")
    _subscriber_tasks.append(task)
    logger.info("PubSub subscriber started on pattern %s", channel_pattern)
    return task


async def stop_all() -> None:
    """Cancel every subscriber task. Call from app shutdown hook."""
    for t in _subscriber_tasks:
        t.cancel()
    _subscriber_tasks.clear()
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None

"""
Background task queue — Redis-backed (Arq), with a graceful no-op fallback.

What this gives us
------------------
Heavy or unreliable side-effects (Resend email, PDF generation, image
processing, fan-out notifications) currently run on the request thread.
A slow Resend response = slow API. A failed Resend = failed booking.

This module exposes one async function — `enqueue(func_name, **kwargs)` —
that drops work onto a Redis queue. A worker (in-process here, separate
container in production) drains it. The caller's request returns in
milliseconds regardless of how long the background work takes.

Available tasks (extend by adding new `async def` here):
    - send_email
    - send_promotion_fanout

Worker model
------------
For dev / single-pod, we run a worker IN the API process via
`start_worker_in_process()`. For prod, run `arq utils.task_queue.WorkerSettings`
in a sidecar container — same code path, just a separate process.

Graceful degradation
--------------------
If Redis / arq isn't reachable, `enqueue` falls back to running the task
inline (still async, still non-blocking-ish). This means dev environments
without Redis don't break — they just lose the durability benefit.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

# Module-level pool — created on first enqueue, reused after.
_pool = None
_pool_disabled = False
_in_process_worker: asyncio.Task | None = None


# ── Task registry ───────────────────────────────────────────────────────
# Add a new background task by:
#   1. Defining an `async def my_task(ctx, …)` below.
#   2. Adding it to `WorkerSettings.functions`.
#   3. Calling `await enqueue("my_task", …)` from anywhere.

async def send_email(ctx, *, to: str, subject: str, html: str, sender: str | None = None):
    """Send a transactional email via Resend. Heavy I/O — perfect for the queue."""
    try:
        from services.email_service import send_raw_email
        await send_raw_email(to=to, subject=subject, html=html, sender=sender)
    except Exception as e:  # noqa: BLE001
        # arq will retry on exception based on retry count. We don't re-raise
        # mail failures by default — they're best-effort.
        logger.warning("send_email task failed for %s: %s", to, e)


async def send_promotion_fanout(ctx, *, promotion_id: str):
    """Re-runs the per-subscriber notification fan-out outside the request path.

    Falls back to a no-op if the promotion has been deleted. Bounded memory:
    streams subscribers via async cursor + batched insert_many.
    """
    from datetime import datetime, timezone
    import uuid
    from config.database import get_database

    db = get_database()
    if db is None:
        return
    promo = await db.promotions.find_one({"_id": promotion_id})
    if not promo:
        return

    operator_id = promo.get("operator_id")
    operator_name = promo.get("operator_name", "Operator")

    BATCH = 500
    batch: list = []
    sent = 0
    async for sub in db.subscriptions.find({"operator_id": operator_id}):
        batch.append({
            "_id": str(uuid.uuid4()),
            "user_id": sub["user_id"],
            "title": f"New from {operator_name}: {promo['title']}",
            "message": promo.get("message", ""),
            "type": "promotion",
            "source": "operator_promotion",
            "promotion_id": promotion_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
        if len(batch) >= BATCH:
            await db.notifications.insert_many(batch)
            sent += len(batch)
            batch = []
    if batch:
        await db.notifications.insert_many(batch)
        sent += len(batch)
    logger.info("Promotion %s fanned out to %d subscribers (queued)", promotion_id, sent)


# Map of function name -> callable, so `enqueue("send_email", …)` works
# without needing to import the function reference everywhere.
_TASK_REGISTRY: dict[str, Callable[..., Awaitable[Any]]] = {
    "send_email": send_email,
    "send_promotion_fanout": send_promotion_fanout,
}


# ── Public API ──────────────────────────────────────────────────────────
async def enqueue(func_name: str, **kwargs) -> bool:
    """Drop a task on the queue. Returns True if it landed in Redis, False if
    we fell back to inline execution.

    The fallback runs the task on the current event loop — useful in dev
    where Redis is absent. In production we WANT this to land in Redis so
    the worker process handles it.
    """
    if func_name not in _TASK_REGISTRY:
        raise ValueError(f"Unknown task: {func_name}")

    pool = await _get_pool()
    if pool:
        try:
            await pool.enqueue_job(func_name, **kwargs)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("arq enqueue %s failed (running inline): %s", func_name, e)

    # Inline fallback — fire-and-forget so we don't block the caller.
    fn = _TASK_REGISTRY[func_name]
    asyncio.create_task(fn(None, **kwargs))
    return False


async def _get_pool():
    global _pool, _pool_disabled
    if _pool_disabled:
        return None
    if _pool is not None:
        return _pool
    url = os.environ.get("REDIS_URL")
    if not url:
        _pool_disabled = True
        return None
    try:
        from arq import create_pool
        from arq.connections import RedisSettings
        settings = RedisSettings.from_dsn(url)
        _pool = await create_pool(settings)
        logger.info("Background queue pool ready at %s", url)
        return _pool
    except Exception as e:  # noqa: BLE001
        logger.warning("arq pool unavailable, queue disabled: %s", e)
        _pool_disabled = True
        return None


# ── Worker definition (used by both in-process and sidecar) ─────────────
class WorkerSettings:
    """Arq worker settings — used by both modes.

    Sidecar (prod):
        $ arq utils.task_queue.WorkerSettings

    In-process (dev):
        await start_worker_in_process()
    """
    functions = list(_TASK_REGISTRY.values())
    keep_result = 60  # seconds
    max_jobs = 20
    job_timeout = 120

    @classmethod
    def redis_settings(cls):
        from arq.connections import RedisSettings
        url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        return RedisSettings.from_dsn(url)


async def start_worker_in_process() -> None:
    """Spawn an arq Worker as a background task on the API event loop.

    This is fine for single-pod dev. In production, spin a separate
    `arq utils.task_queue.WorkerSettings` container instead so worker
    crashes don't take the API down with them.
    """
    global _in_process_worker
    if _in_process_worker is not None:
        return  # already running
    url = os.environ.get("REDIS_URL")
    if not url:
        logger.info("Skipping in-process arq worker — REDIS_URL not set")
        return
    try:
        from arq.worker import Worker
        from arq.connections import RedisSettings
        worker = Worker(
            functions=WorkerSettings.functions,
            redis_settings=RedisSettings.from_dsn(url),
            keep_result=WorkerSettings.keep_result,
            max_jobs=WorkerSettings.max_jobs,
            job_timeout=WorkerSettings.job_timeout,
            handle_signals=False,  # the API process owns signal handling
        )
        _in_process_worker = asyncio.create_task(worker.async_run(), name="arq-inproc")
        logger.info("In-process arq worker started")
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to start in-process arq worker: %s", e)

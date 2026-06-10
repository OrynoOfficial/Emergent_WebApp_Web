"""
Daily analytics rollup — materialised view of orders → per-day, per-operator,
per-service-category aggregates.

Why:
    Every dashboard load today re-aggregates the entire `orders` collection
    over the requested time window. At 5M+ orders that becomes the hottest
    query in the system. Instead we maintain a small `analytics_daily_rollup`
    collection (one doc per day × operator × category × status) that the
    dashboards can sum over with O(days × ops) cardinality.

Shape of a rollup doc:
    {
        "_id": "2026-02-08:op-uuid:cinema:confirmed",
        "date":           "2026-02-08",
        "operator_id":    "op-uuid",
        "service_category": "cinema",
        "status":         "confirmed",
        "orders":          17,
        "revenue":         425_000.0,
        "updated_at":      <utc ts>,
    }

Strategies:
    1. Nightly cron — rebuild yesterday's rollup once at 00:05 UTC.
    2. Live increment — on every order create/status change, upsert one doc.

We implement (1) here as a function `rebuild_daily_rollup(db, days_back=7)`
that can be invoked from an admin endpoint or a scheduled task. The function
is idempotent: it deletes any existing rollups for the day window before
re-aggregating, so re-running covers backfills and corrections.

(2) — live incremental updates — is documented at the bottom and will land
in Phase 3 once we have a background queue. For Phase 2 the nightly rebuild
captures 99% of the win because dashboards typically look at >24h windows
where the freshness gap doesn't matter.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

ROLLUP_COLLECTION = "analytics_daily_rollup"


async def rebuild_daily_rollup(db, days_back: int = 7) -> dict:
    """Rebuild the rollup for the last `days_back` UTC days.

    Args:
        db: Motor AsyncIOMotorDatabase instance.
        days_back: Number of past days to recompute (default 7 — enough to
            self-heal any short outage, cheap to run on a daily cadence).

    Returns:
        Stats dict: {"rebuilt_days": N, "rollup_docs": M, "elapsed_s": float}
    """
    started_at = datetime.now(timezone.utc)
    day_floor = started_at.replace(hour=0, minute=0, second=0, microsecond=0)
    window_start = day_floor - timedelta(days=days_back)

    # 1) Drop any existing rollups in the window so we don't double-count.
    await db[ROLLUP_COLLECTION].delete_many({"date": {"$gte": window_start.strftime("%Y-%m-%d")}})

    # 2) Run a single aggregation that groups orders by day × op × category × status.
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "operator_id": "$operator_id",
                "service_category": {"$ifNull": ["$service_category", "$service_type"]},
                "status": "$status",
            },
            "orders": {"$sum": 1},
            "revenue": {"$sum": {"$ifNull": ["$total_amount", 0]}},
        }},
    ]

    docs = []
    async for row in db.orders.aggregate(pipeline, allowDiskUse=True):
        key = row["_id"] or {}
        date_str = key.get("date")
        op_id = key.get("operator_id") or "_"  # platform-wide orders use sentinel
        cat = key.get("service_category") or "other"
        st = key.get("status") or "unknown"
        docs.append({
            "_id": f"{date_str}:{op_id}:{cat}:{st}",
            "date": date_str,
            "operator_id": op_id if op_id != "_" else None,
            "service_category": cat,
            "status": st,
            "orders": row.get("orders", 0),
            "revenue": row.get("revenue", 0),
            "updated_at": datetime.now(timezone.utc),
        })

    if docs:
        # Single insert_many — keep batches modest to bound memory.
        BATCH = 2000
        for i in range(0, len(docs), BATCH):
            await db[ROLLUP_COLLECTION].insert_many(docs[i:i + BATCH])

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info(
        "Daily rollup rebuilt: days=%s docs=%s elapsed=%.2fs",
        days_back, len(docs), elapsed,
    )
    return {"rebuilt_days": days_back, "rollup_docs": len(docs), "elapsed_s": elapsed}


# ── Helpers consumed by dashboard endpoints ─────────────────────────────
async def get_rollup_summary(
    db,
    days: int,
    operator_id: str | None = None,
    service_category: str | None = None,
) -> dict:
    """Return aggregate orders + revenue across the rollup for the window.

    Dashboards can use this in place of scanning the full `orders` collection.
    Falls back to ZEROS when the rollup is empty (e.g. fresh deploy).
    """
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)
    match = {"date": {"$gte": start.strftime("%Y-%m-%d")}}
    if operator_id:
        match["operator_id"] = operator_id
    if service_category:
        match["service_category"] = service_category

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": None,
            "orders": {"$sum": "$orders"},
            "revenue": {"$sum": "$revenue"},
        }},
    ]
    result = await db[ROLLUP_COLLECTION].aggregate(pipeline).to_list(1)
    if not result:
        return {"orders": 0, "revenue": 0, "days": days}
    return {"orders": result[0].get("orders", 0), "revenue": result[0].get("revenue", 0), "days": days}


# ── Live incremental upserts ────────────────────────────────────────────
async def increment_rollup(
    db,
    *,
    operator_id: str | None,
    service_category: str,
    status: str,
    amount: float,
    created_at: datetime | None = None,
    orders_delta: int = 1,
) -> None:
    """Atomically bump the rollup bucket for a fresh order or status change.

    Call this on every order create. `orders_delta` lets us also handle
    status transitions by passing -1 on the OLD bucket and +1 on the NEW
    bucket inside the same request — keeping the rollup eventually
    consistent without re-running the nightly rebuild.

    Designed to never raise: any Mongo error is logged and swallowed because
    rollup drift is recoverable by a `POST /admin/rollup/rebuild` while
    booking errors are user-visible. Don't ruin a checkout over a rollup hiccup.
    """
    ts = created_at or datetime.now(timezone.utc)
    day = ts.strftime("%Y-%m-%d")
    op = operator_id or "_"
    cat = service_category or "other"
    st = status or "unknown"
    doc_id = f"{day}:{op}:{cat}:{st}"
    try:
        await db[ROLLUP_COLLECTION].update_one(
            {"_id": doc_id},
            {
                "$inc": {"orders": orders_delta, "revenue": float(amount or 0)},
                "$set": {"updated_at": datetime.now(timezone.utc)},
                "$setOnInsert": {
                    "date": day,
                    "operator_id": operator_id,
                    "service_category": cat,
                    "status": st,
                },
            },
            upsert=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("increment_rollup failed (%s): %s", doc_id, exc)

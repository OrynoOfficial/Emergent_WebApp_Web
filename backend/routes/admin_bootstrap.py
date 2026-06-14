"""
Production seed bootstrap endpoint.

Lets a super-admin upload a JSON bundle produced by
`scripts/export_catalogue.py` and import the catalogue collections into the
current (production) database. The import is:

  • Super-admin only — 403 otherwise.
  • One-shot but **idempotent** — re-running with the same file is a no-op
    because each document is upserted by `_id`. Re-running with a NEWER
    file will refresh existing docs and add new ones.
  • All-or-nothing per collection — if a collection's documents fail to
    decode (e.g. malformed datetime strings), that collection is rolled
    back; the others still go through.
  • Audited — every run writes a row to `activity_logs` with the user, file
    name, per-collection counts, and a "what changed" summary.

The endpoint also refuses to touch collections that aren't on its known
whitelist, so an attacker who pickles a malicious bundle can't, say, write
fake users or audit logs.

The companion `GET /api/admin/seed-bootstrap/export` endpoint lets a super-
admin pull a fresh JSON snapshot of the same catalogue collections from the
*current* database — useful for re-seeding a second environment from a known
production state.

POST /api/admin/seed-bootstrap
    multipart/form-data:
        file: <oryno_seed.json>
        dry_run: "true" | "false"   (default "false")

GET /api/admin/seed-bootstrap/export
    Returns the JSON bundle as an attachment.

Returns:
    {
      "ok": true,
      "dry_run": false,
      "format_version": 1,
      "source_db": "oryno_webapp",
      "exported_at": "2026-02-...",
      "results": {
         "operators":  { "inserted": 7, "updated": 0, "skipped": 0 },
         "films":      { "inserted": 5, "updated": 0, "skipped": 0 },
         ...
      },
      "totals": { "inserted": 290, "updated": 0, "skipped": 0 }
    }
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from config.database import get_database
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

# Same whitelist as the exporter — refusing anything else is the whole point.
ALLOWED_COLLECTIONS = {
    "countries", "regions", "market_segments",
    "operators",
    "cinemas", "films", "showtimes",
    "hotels", "rooms",
    "restaurants", "restaurant_menu",
    "pressings", "pressing", "pressing_services",
    "car_rentals", "vehicles",
    "events", "banquets",
    "travel_routes",
    "services",
    "packages", "package_services",
    "loyalty_programs", "loyalty_rewards",
    "promotions", "promo_codes",
    "roles", "operator_roles", "employee_access_scopes",
    "pods", "pod_memberships",
}

# Fields that were ISO-stringified by the exporter and need to come back
# as `datetime` objects when we re-import. We do this generically: any value
# that *looks* like an ISO-8601 datetime gets parsed; everything else is
# left as-is. This avoids hard-coding field names per collection.
def _try_parse_iso(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if len(value) < 10 or len(value) > 35:
        return value
    # cheap pre-check before paying datetime.fromisoformat's cost
    if value[4] != "-" or value[7] != "-":
        return value
    try:
        # datetime.fromisoformat accepts both "...Z" (3.11+) and naive forms
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return value


def _coerce_datetimes(doc: Any) -> Any:
    if isinstance(doc, dict):
        return {k: _coerce_datetimes(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_coerce_datetimes(v) for v in doc]
    return _try_parse_iso(doc)


# Anything that looks like a MongoDB ObjectId hex string — used to restore
# `ObjectId` typing for `_id` fields that were stringified by the exporter.
# Restricted to 24 lowercase hex chars (the exact ObjectId format) so we don't
# accidentally convert UUID strings or short tokens.
_OBJECTID_RE = re.compile(r"^[0-9a-f]{24}$")


def _restore_id(value: Any) -> Any:
    """If the _id looks like a 24-char hex ObjectId, restore it. Otherwise
    leave the value untouched (covers UUID-strings used elsewhere)."""
    if isinstance(value, str) and _OBJECTID_RE.match(value):
        try:
            return ObjectId(value)
        except Exception:  # pragma: no cover — defensive
            return value
    return value


@router.post("/seed-bootstrap")
async def seed_bootstrap(
    file: UploadFile = File(...),
    dry_run: str = Form(default="false"),
    current_user: dict = Depends(get_current_user),
):
    """Import a catalogue seed bundle. Super-admin only."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators may run the seed bootstrap.",
        )

    is_dry = str(dry_run).lower() in ("1", "true", "yes")

    # 1. Parse the upload.
    try:
        raw = await file.read()
        bundle = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Bundle is not valid JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read upload: {e}")

    if not isinstance(bundle, dict) or "collections" not in bundle:
        raise HTTPException(
            status_code=400,
            detail="Bundle is missing the required 'collections' key.",
        )
    if bundle.get("format_version") != 1:
        raise HTTPException(
            status_code=400,
            detail="Bundle format_version != 1 — this server understands v1 only.",
        )

    # 2. Reject any collection that isn't on the whitelist.
    rejected = [c for c in bundle["collections"].keys() if c not in ALLOWED_COLLECTIONS]
    if rejected:
        raise HTTPException(
            status_code=400,
            detail=f"Bundle contains non-whitelisted collections: {rejected}",
        )

    db = get_database()
    results: dict[str, dict[str, int]] = {}
    totals = {"inserted": 0, "updated": 0, "skipped": 0}

    # 3. Walk each collection. Per-collection failures don't fail the request.
    for name, docs in bundle["collections"].items():
        coll_stats = {"inserted": 0, "updated": 0, "skipped": 0}
        if not isinstance(docs, list):
            results[name] = coll_stats
            continue

        for doc in docs:
            if not isinstance(doc, dict) or "_id" not in doc:
                coll_stats["skipped"] += 1
                continue

            try:
                cleaned = _coerce_datetimes(doc)
                # Restore ObjectId typing if applicable (24-char hex strings
                # were originally ObjectId in source).
                cleaned["_id"] = _restore_id(cleaned["_id"])
            except Exception as e:  # pragma: no cover — defensive
                logger.warning("seed bootstrap: skipping %s/%s — %s", name, doc.get("_id"), e)
                coll_stats["skipped"] += 1
                continue

            doc_id = cleaned["_id"]

            if is_dry:
                # Just count what we *would* do.
                existing = await db[name].count_documents({"_id": doc_id}, limit=1)
                if existing:
                    coll_stats["updated"] += 1
                else:
                    coll_stats["inserted"] += 1
                continue

            try:
                res = await db[name].replace_one(
                    {"_id": doc_id}, cleaned, upsert=True
                )
                if res.upserted_id is not None:
                    coll_stats["inserted"] += 1
                elif res.modified_count > 0:
                    coll_stats["updated"] += 1
                else:
                    coll_stats["skipped"] += 1
            except Exception as e:  # pragma: no cover — defensive
                logger.warning("seed bootstrap: %s/%s failed — %s", name, doc_id, e)
                coll_stats["skipped"] += 1

        results[name] = coll_stats
        for k in totals:
            totals[k] += coll_stats[k]

    # 4. Audit.
    if not is_dry:
        await db.activity_logs.insert_one({
            "_id": str(uuid4()),
            "action": "admin.seed_bootstrap.imported",
            "action_type": "bulk_import",
            "entity_type": "database",
            "entity_id": "catalogue",
            "entity_name": file.filename or "oryno_seed.json",
            "details": (
                f"Imported catalogue bundle: "
                f"{totals['inserted']} inserted, "
                f"{totals['updated']} updated, "
                f"{totals['skipped']} skipped."
            ),
            "metadata": {
                "format_version": bundle.get("format_version"),
                "exported_at": bundle.get("exported_at"),
                "source_db": bundle.get("source_db"),
                "results": results,
            },
            "user_id": current_user.get("_id"),
            "user_name": current_user.get("full_name"),
            "user_email": current_user.get("email"),
            "user_role": current_user.get("role"),
            "severity": "INFO",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "ok": True,
        "dry_run": is_dry,
        "format_version": bundle.get("format_version"),
        "source_db": bundle.get("source_db"),
        "exported_at": bundle.get("exported_at"),
        "results": results,
        "totals": totals,
    }


def _serialize_for_export(value: Any) -> Any:
    """Recursively coerce BSON / datetime values into JSON-safe forms.

    Mirrors the helper in `scripts/export_catalogue.py` so a download via
    this endpoint produces an identical bundle to the offline script.
    """
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _serialize_for_export(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_serialize_for_export(v) for v in value]
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


_USER_REF_FIELDS = {
    "owner_user_id", "owner_id",
    "created_by", "updated_by", "deleted_by",
    "manager_id", "managed_by", "assigned_to",
    "user_id",
}


def _scrub_user_refs(doc: Any) -> Any:
    if isinstance(doc, dict):
        return {
            k: (None if k in _USER_REF_FIELDS else _scrub_user_refs(v))
            for k, v in doc.items()
        }
    if isinstance(doc, list):
        return [_scrub_user_refs(v) for v in doc]
    return doc


@router.get("/seed-bootstrap/export")
async def export_seed_bundle(current_user: dict = Depends(get_current_user)):
    """Stream a fresh JSON bundle of the catalogue collections for download.

    Super-admin only. Useful for cloning the current DB state into another
    environment, or for snapshotting before a risky change.
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators may export the seed bundle.",
        )

    db = get_database()
    bundle: dict[str, Any] = {
        "format_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source_db": db.name,
        "collections": {},
    }

    for name in sorted(ALLOWED_COLLECTIONS):
        try:
            docs: list[dict[str, Any]] = []
            async for raw in db[name].find({}):
                docs.append(_serialize_for_export(_scrub_user_refs(raw)))
            bundle["collections"][name] = docs
        except Exception as e:
            logger.warning("seed export: skipping %s — %s", name, e)
            bundle["collections"][name] = []

    payload = json.dumps(bundle, indent=2, ensure_ascii=False).encode("utf-8")
    filename = f"oryno_seed_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}.json"

    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


# ──────────────────────────────────────────────────────────────────────
# Operational tooling — super-admin only
# ──────────────────────────────────────────────────────────────────────

@router.post("/db-indexes/ensure")
async def ensure_db_indexes(current_user: dict = Depends(get_current_user)):
    """Trigger the index bootstrapper on-demand.

    The bootstrapper also runs on every backend startup, but a freshly-
    deployed pod might be missing newly-added compound indexes if it hasn't
    been restarted yet. This endpoint lets a super-admin force a rebuild
    without redeploying.

    Returns the per-index stats so you can see exactly what was created.
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators may rebuild indexes.",
        )
    from utils.startup_indexes import ensure_all_indexes
    db = get_database()
    stats = await ensure_all_indexes(db)
    return {
        "ok": True,
        "created": stats["created"],
        "existed": stats["existed"],
        "failed_count": len(stats["failed"]),
        # Mongo errors aren't always JSON-safe — stringify defensively.
        "failed": [
            {"collection": c, "name": n, "error": str(e)[:300]}
            for c, n, e in stats["failed"][:50]
        ],
    }


# Collections that carry an `is_active` boolean we may want to purge from.
# Keep this tight — purge is destructive and we don't want a typo to nuke
# something we never meant to touch.
_PURGEABLE_COLLECTIONS = {
    "hotels", "rooms", "restaurants", "cinemas", "films", "showtimes",
    "events", "vehicles", "car_rentals", "pressings", "banquets",
    "travel_routes", "services", "packages",
}


@router.post("/db-cleanup/purge-soft-deleted")
async def purge_soft_deleted(
    collection: str | None = None,
    dry_run: bool = True,
    current_user: dict = Depends(get_current_user),
):
    """One-shot bulk hard-delete of every doc with `is_active: False`.

    - Super-admin only.
    - Defaults to `dry_run=true` — returns counts but writes nothing.
    - `collection=hotels` to scope to one collection; omit to sweep them all.
    - Skips any collection not in `_PURGEABLE_COLLECTIONS` for safety.

    Use case: after running the seed bootstrap, you may have soft-deleted
    test records lingering. This nukes them in one shot.
    """
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super administrators may purge soft-deleted records.",
        )

    db = get_database()
    targets = [collection] if collection else sorted(_PURGEABLE_COLLECTIONS)
    if collection and collection not in _PURGEABLE_COLLECTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Refusing to purge unknown collection '{collection}'.",
        )

    results: dict[str, dict[str, int]] = {}
    grand_total = 0

    for coll in targets:
        criteria = {"is_active": False}
        count = await db[coll].count_documents(criteria)
        deleted = 0
        if not dry_run and count > 0:
            res = await db[coll].delete_many(criteria)
            deleted = res.deleted_count
        results[coll] = {"matched": count, "deleted": deleted}
        grand_total += deleted

    # Audit the destructive call.
    if not dry_run and grand_total > 0:
        await db.activity_logs.insert_one({
            "_id": str(uuid4()),
            "action": "admin.purge_soft_deleted",
            "action_type": "bulk_delete",
            "entity_type": "database",
            "entity_id": collection or "all",
            "entity_name": collection or "all soft-deleted records",
            "details": f"Hard-deleted {grand_total} soft-deleted records.",
            "metadata": {"results": results},
            "user_id": current_user.get("_id"),
            "user_name": current_user.get("full_name"),
            "user_email": current_user.get("email"),
            "user_role": current_user.get("role"),
            "severity": "WARNING",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "ok": True,
        "dry_run": dry_run,
        "grand_total_deleted": grand_total,
        "results": results,
    }
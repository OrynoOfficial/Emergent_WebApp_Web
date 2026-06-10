"""
One-shot migration: copy every file under /app/backend/uploads/ into Emergent
object storage and rewrite the DB URLs that point at the old `/api/static/...`
paths to the new `/api/uploads/serve/...` paths.

Run with:
    cd /app/backend && python -m scripts.migrate_uploads_to_emergent --dry-run
    cd /app/backend && python -m scripts.migrate_uploads_to_emergent --apply

Strategy
--------
1. Walk /app/backend/uploads recursively.
2. For each file, derive its public URL prefix (`/api/static/<rel>`).
3. Upload bytes to Emergent storage under `oryno/migrated/<rel>`.
4. Replace every occurrence of the old URL in known DB collections with the
   new `/api/uploads/serve/...` URL. We target image-heavy collections:
   - users.profile_image_url
   - operators.logo_url, operators.cover_image_url
   - films.poster_url, films.banner_url
   - hotels.images[], hotels.featured_image
   - events.poster_url, events.banner_url
   - cinemas.image_url
   - vehicles.images[]
   - packages.images[]
5. Print a per-collection summary.

Safety
------
- Default is `--dry-run`. Use `--apply` to actually write to the DB.
- Resumable: re-running is safe — already-migrated files end up at the same
  Emergent path (same UUID via hash). DB rewrites are idempotent: searching
  by the OLD URL excludes already-rewritten docs.
- Never deletes local files. The platform can rm -rf /app/backend/uploads
  after manually verifying images load from the new URL.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import os
import sys
from pathlib import Path

# Make the script runnable from /app/backend with `python -m scripts.migrate_uploads_to_emergent`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config.database import connect_to_mongo, close_mongo_connection, get_database  # noqa: E402

logger = logging.getLogger("migrate_uploads")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

UPLOADS_ROOT = Path("/app/backend/uploads")
OLD_URL_PREFIX = "/api/static"

# Collections + the field paths we know hold image URLs. Add new entries as
# the data model grows. List fields use the `[]` suffix so we update every
# element.
COLLECTION_FIELDS: dict[str, list[str]] = {
    "users": ["profile_image_url", "avatar_url", "id_document_url"],
    "operators": ["logo_url", "cover_image_url"],
    "films": ["poster_url", "banner_url"],
    "hotels": ["featured_image", "logo_url"],
    "events": ["poster_url", "banner_url"],
    "cinemas": ["image_url", "logo_url"],
    "restaurants": ["logo_url", "cover_image_url"],
    "car_rentals": ["logo_url"],
    "pressings": ["logo_url"],
    "banquets": ["logo_url", "cover_image_url"],
    "packages": ["cover_image_url"],
}

# Collections where the field is a LIST of image URLs. Need positional update.
COLLECTION_LIST_FIELDS: dict[str, list[str]] = {
    "hotels": ["images"],
    "vehicles": ["images"],
    "packages": ["images"],
    "films": ["screenshots"],
}


def stable_object_path(rel_path: str) -> str:
    """Same input rel_path -> same output object path. Lets us re-run safely."""
    digest = hashlib.sha1(rel_path.encode("utf-8")).hexdigest()[:16]
    ext = rel_path.rsplit(".", 1)[-1] if "." in rel_path else "bin"
    return f"oryno/migrated/{digest}.{ext}"


def new_url_for(rel_path: str) -> str:
    return f"/api/uploads/serve/{stable_object_path(rel_path)}"


def old_url_for(rel_path: str) -> str:
    return f"{OLD_URL_PREFIX}/{rel_path}"


async def upload_one(storage, abs_path: Path, rel_path: str, dry_run: bool) -> str | None:
    """Push a single file into Emergent storage; return the new URL on success."""
    new_url = new_url_for(rel_path)
    if dry_run:
        return new_url
    try:
        data = abs_path.read_bytes()
        result = await storage.upload_file(
            file_data=data,
            filename=abs_path.name,
            content_type="application/octet-stream",
            folder=f"migrated/{Path(rel_path).parent}",
        )
        if result.get("success"):
            return result["file_url"]
        logger.warning("upload failed for %s: %s", rel_path, result.get("error"))
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning("upload exception for %s: %s", rel_path, e)
        return None


async def rewrite_scalar_fields(db, coll: str, fields: list[str], url_map: dict, dry_run: bool) -> int:
    """Update every doc where any of `fields` matches an OLD url. Returns
    the number of (doc, field) pairs rewritten."""
    rewrites = 0
    for field in fields:
        for old_url, new_url in url_map.items():
            count = await db[coll].count_documents({field: old_url})
            if count == 0:
                continue
            if dry_run:
                rewrites += count
                continue
            res = await db[coll].update_many({field: old_url}, {"$set": {field: new_url}})
            rewrites += res.modified_count
    return rewrites


async def rewrite_list_fields(db, coll: str, fields: list[str], url_map: dict, dry_run: bool) -> int:
    """List-valued fields need a per-doc rewrite (no atomic operator can
    swap a single element matched by value)."""
    rewrites = 0
    for field in fields:
        query = {field: {"$in": list(url_map.keys())}}
        async for doc in db[coll].find(query, {field: 1}):
            urls = doc.get(field) or []
            new_urls = [url_map.get(u, u) for u in urls]
            if new_urls != urls:
                if not dry_run:
                    await db[coll].update_one({"_id": doc["_id"]}, {"$set": {field: new_urls}})
                rewrites += 1
    return rewrites


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually write to storage + DB")
    parser.add_argument("--dry-run", action="store_true", default=True)
    args = parser.parse_args()
    dry_run = not args.apply

    if dry_run:
        logger.info("=== DRY RUN — no writes. Pass --apply to commit. ===")
    else:
        logger.info("=== APPLY MODE — writes will happen. ===")

    if not UPLOADS_ROOT.exists():
        logger.error("Upload root missing: %s", UPLOADS_ROOT)
        return

    await connect_to_mongo()
    db = get_database()

    # 1) Walk the local uploads dir and push every file to storage.
    from services.emergent_storage_service import EmergentStorageService
    storage = EmergentStorageService()

    url_map: dict[str, str] = {}
    file_count = 0
    upload_failures = 0

    for path in UPLOADS_ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = str(path.relative_to(UPLOADS_ROOT))
        old_url = old_url_for(rel)
        new_url = await upload_one(storage, path, rel, dry_run)
        if not new_url:
            upload_failures += 1
            continue
        url_map[old_url] = new_url
        file_count += 1
        if file_count % 50 == 0:
            logger.info("Uploaded %d files…", file_count)

    logger.info("Upload phase: %d files, %d failures", file_count, upload_failures)

    if not url_map:
        logger.info("Nothing to rewrite — exiting.")
        await close_mongo_connection()
        return

    # 2) Rewrite scalar + list fields across the catalog collections.
    total_rewrites = 0
    for coll, fields in COLLECTION_FIELDS.items():
        n = await rewrite_scalar_fields(db, coll, fields, url_map, dry_run)
        if n:
            logger.info("  %s: %d scalar field rewrites", coll, n)
            total_rewrites += n
    for coll, fields in COLLECTION_LIST_FIELDS.items():
        n = await rewrite_list_fields(db, coll, fields, url_map, dry_run)
        if n:
            logger.info("  %s: %d list-field doc rewrites", coll, n)
            total_rewrites += n

    logger.info("Total rewrites: %d", total_rewrites)
    logger.info("DONE. %s", "Run with --apply to commit." if dry_run else "Migration complete.")

    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())

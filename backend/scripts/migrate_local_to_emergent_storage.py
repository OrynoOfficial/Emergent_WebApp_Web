#!/usr/bin/env python3
"""
One-time migration: local pod disk → Emergent Object Storage.

What it does
============
1. Walks ``/app/backend/uploads/<folder>/<uuid>.<ext>``.
2. Uploads each file to Emergent storage at ``oryno/<folder>/<uuid>.<ext>``,
   preserving the original UUID-based name (so URLs stay deterministic).
3. After every successful upload, rewrites every string in MongoDB that
   contains ``/api/static/<folder>/<uuid>.<ext>`` to point at the new
   ``/api/uploads/serve/oryno/<folder>/<uuid>.<ext>`` URL. Walks all
   collections; doesn't care about column names — depth-first string
   replace on every doc.

Safety
======
* Idempotent. Re-running skips files already uploaded (HTTP 409) and skips
  URLs already rewritten.
* Dry-run mode: ``--dry-run``.
* Per-folder filter: ``--folder hotels`` runs only the hotels sub-tree.
* Reads ``MONGO_URL`` / ``MONGO_DB_NAME`` / ``EMERGENT_LLM_KEY`` /
  ``APP_NAME`` from /app/backend/.env (loaded the same way the server does).

Usage
=====
    python3 /app/backend/scripts/migrate_local_to_emergent_storage.py
    python3 /app/backend/scripts/migrate_local_to_emergent_storage.py --dry-run
    python3 /app/backend/scripts/migrate_local_to_emergent_storage.py --folder hotels
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import mimetypes
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path("/app/backend")
load_dotenv(ROOT / ".env")

UPLOADS_DIR = Path(os.environ.get("LOCAL_STORAGE_PATH", ROOT / "uploads"))
APP_NAME = os.environ.get("APP_NAME", "oryno")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("MONGO_DB_NAME") or os.environ.get("DB_NAME") or "oryno_webapp"
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("migrate")


async def init_storage(client: httpx.AsyncClient) -> str:
    resp = await client.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    return resp.json()["storage_key"]


async def upload_one(client: httpx.AsyncClient, key: str, path: Path, object_path: str) -> bool:
    """Upload one file. Returns True on success (or already-exists)."""
    ctype, _ = mimetypes.guess_type(path.name)
    ctype = ctype or "application/octet-stream"
    data = path.read_bytes()
    resp = await client.put(
        f"{STORAGE_URL}/objects/{object_path}",
        headers={"X-Storage-Key": key, "Content-Type": ctype},
        content=data,
        timeout=120,
    )
    if resp.status_code == 409:
        log.info("  skip (already exists): %s", object_path)
        return True
    if resp.status_code >= 400:
        log.error("  FAIL %s: %s %s", object_path, resp.status_code, resp.text[:200])
        return False
    return True


def rewrite_strings(value, mapping: dict[str, str]) -> tuple[object, int]:
    """Recursively replace any string containing a key from ``mapping`` with
    its mapped value. Returns ``(new_value, num_replacements)``."""
    count = 0
    if isinstance(value, str):
        new = value
        for old, replacement in mapping.items():
            if old in new:
                new = new.replace(old, replacement)
                count += 1
        return new, count
    if isinstance(value, list):
        out = []
        for item in value:
            r, c = rewrite_strings(item, mapping)
            out.append(r)
            count += c
        return out, count
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            r, c = rewrite_strings(v, mapping)
            out[k] = r
            count += c
        return out, count
    return value, 0


async def rewrite_urls_in_db(db, mapping: dict[str, str], dry_run: bool) -> int:
    """Walk every collection and rewrite any string containing an old URL."""
    if not mapping:
        return 0
    total = 0
    collections = await db.list_collection_names()
    for col_name in collections:
        if col_name.startswith("system."):
            continue
        col = db[col_name]
        col_count = 0
        async for doc in col.find({}):
            new_doc, count = rewrite_strings(doc, mapping)
            if count and not dry_run:
                await col.replace_one({"_id": doc["_id"]}, new_doc)
            col_count += count
        if col_count:
            log.info("  rewrites in %s: %d", col_name, col_count)
        total += col_count
    log.info("DB rewrites: %s (across all collections)", total)
    return total


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Don't upload or rewrite anything")
    ap.add_argument("--folder", default=None, help="Restrict to one sub-folder (e.g. hotels)")
    args = ap.parse_args()

    if not UPLOADS_DIR.exists():
        log.error("Local uploads dir not found: %s", UPLOADS_DIR)
        sys.exit(1)

    folders = [args.folder] if args.folder else sorted(
        p.name for p in UPLOADS_DIR.iterdir() if p.is_dir()
    )
    log.info("Will migrate %d folder(s): %s", len(folders), folders)

    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]

    async with httpx.AsyncClient(timeout=120.0) as client:
        storage_key = "<dry>" if args.dry_run else await init_storage(client)
        log.info("Storage key obtained.")

        url_map: dict[str, str] = {}
        uploaded = 0
        failed = 0
        for folder in folders:
            folder_path = UPLOADS_DIR / folder
            if not folder_path.is_dir():
                continue
            files = [p for p in folder_path.iterdir() if p.is_file()]
            log.info("[%s] %d file(s)", folder, len(files))
            for f in files:
                old_url = f"/api/static/{folder}/{f.name}"
                object_path = f"{APP_NAME}/{folder}/{f.name}"
                new_url = f"/api/uploads/serve/{object_path}"

                if args.dry_run:
                    log.info("  would upload %s → %s", f, object_path)
                    uploaded += 1
                else:
                    ok = await upload_one(client, storage_key, f, object_path)
                    if ok:
                        uploaded += 1
                    else:
                        failed += 1
                        continue
                url_map[old_url] = new_url

        log.info("Uploads: %d ok, %d failed", uploaded, failed)
        await rewrite_urls_in_db(db, url_map, args.dry_run)

    log.info("Done.")
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())

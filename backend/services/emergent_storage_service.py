"""
Emergent Object Storage adapter.

Drop-in replacement for `LocalStorageService` / `S3Service`. Selected via
`STORAGE_BACKEND=emergent` in backend/.env. Falls back to local storage if
the storage init fails so a misconfigured key never takes uploads offline.

Files are written to:
    {APP_NAME}/{folder}/{uuid}.{ext}

Downloads must go through the backend — Emergent storage has no presigned
URLs, so we expose `GET /api/uploads/serve/{path}` which streams the bytes
back to the browser. Image tags use `?auth=<token>` since `<img src>` cannot
carry an Authorization header.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "oryno")


class EmergentStorageService:
    _storage_key: Optional[str] = None  # session-scoped, set on first call

    def __init__(self):
        # Init lazily on first use so server boot doesn't block on a slow
        # remote call. The first uploader pays a ~500ms latency cost; from
        # then on `_storage_key` is reused for every subsequent request.
        self._client = httpx.AsyncClient(timeout=120.0)

    async def _init_storage_key(self) -> str:
        if EmergentStorageService._storage_key:
            return EmergentStorageService._storage_key
        emergent_key = os.environ.get("EMERGENT_LLM_KEY")
        if not emergent_key:
            raise RuntimeError("EMERGENT_LLM_KEY not set — cannot init object storage")
        resp = await self._client.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": emergent_key},
            timeout=30,
        )
        resp.raise_for_status()
        EmergentStorageService._storage_key = resp.json()["storage_key"]
        logger.info("Emergent object storage initialised")
        return EmergentStorageService._storage_key

    async def upload_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        folder: str = "uploads",
    ) -> Dict[str, Any]:
        """Upload bytes to Emergent storage. Returns a dict matching the
        LocalStorageService contract so `routes/uploads.py` can swap us in
        transparently."""
        try:
            key = await self._init_storage_key()
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
            object_path = f"{APP_NAME}/{folder}/{uuid.uuid4()}.{ext}"
            resp = await self._client.put(
                f"{STORAGE_URL}/objects/{object_path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                content=file_data,
            )
            if resp.status_code == 403:
                # Storage key expired — re-init once and retry.
                EmergentStorageService._storage_key = None
                key = await self._init_storage_key()
                resp = await self._client.put(
                    f"{STORAGE_URL}/objects/{object_path}",
                    headers={"X-Storage-Key": key, "Content-Type": content_type},
                    content=file_data,
                )
            resp.raise_for_status()
            payload = resp.json()
            # All downloads go through `GET /api/uploads/serve/{path}` so the
            # frontend can use one URL shape regardless of backend.
            file_url = f"/api/uploads/serve/{payload['path']}"
            return {
                "success": True,
                "file_url": file_url,
                "filename": object_path.rsplit("/", 1)[-1],
                "storage_path": payload["path"],
                "size": payload.get("size"),
            }
        except Exception as e:  # noqa: BLE001
            logger.error("Emergent storage upload failed: %s", e)
            return {"success": False, "error": str(e)}

    async def get_object(self, path: str) -> tuple[bytes, str]:
        """Fetch raw bytes + content-type for a previously-uploaded object."""
        key = await self._init_storage_key()
        resp = await self._client.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if resp.status_code == 403:
            EmergentStorageService._storage_key = None
            key = await self._init_storage_key()
            resp = await self._client.get(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=60,
            )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

    async def delete_file(self, file_key: str) -> Dict[str, Any]:
        # Emergent storage has no delete API. We simply return success and
        # rely on the caller (or DB layer) to mark the doc soft-deleted.
        # Eventually a sweeper job can rewrite or overwrite stale objects.
        return {"success": True, "message": "Emergent storage has no delete; soft-delete in DB."}

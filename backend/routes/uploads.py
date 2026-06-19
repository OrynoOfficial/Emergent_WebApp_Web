from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header, Request
from fastapi.responses import Response
from services.s3_service import S3Service
from services.local_storage_service import LocalStorageService
from services.emergent_storage_service import EmergentStorageService
from middleware.auth import get_current_active_user
from utils.auth import decode_token
from utils.rate_limit import limiter, user_or_ip_key, WRITE_UPLOAD_RATE
from config.settings import settings
from typing import List, Optional
import os
import logging

router = APIRouter(prefix="/api/uploads", tags=["File Uploads"])
logger = logging.getLogger(__name__)


# Backend selection priority (env-driven so prod can swap without code change):
#   STORAGE_BACKEND=emergent   → Emergent object storage (durable, multi-pod safe)
#   STORAGE_BACKEND=s3         → AWS S3
#   STORAGE_BACKEND=local      → Local disk (DEV ONLY — lost on redeploy)
#   (unset)                    → legacy: USE_LOCAL_STORAGE=true/false toggle
def _select_backend():
    backend = os.environ.get("STORAGE_BACKEND", "").lower()
    if backend == "emergent":
        return EmergentStorageService(), "emergent"
    if backend == "s3":
        return S3Service(), "s3"
    if backend == "local":
        return LocalStorageService(), "local"
    # Legacy fallback
    if settings.USE_LOCAL_STORAGE.lower() == "true":
        return LocalStorageService(), "local"
    return S3Service(), "s3"


storage_service, storage_label = _select_backend()
logger.info("Upload backend = %s", storage_label)


@router.post("/")
@limiter.limit(WRITE_UPLOAD_RATE, key_func=user_or_ip_key)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None),
    folder_query: Optional[str] = Query(None, alias="folder"),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a file. Returns `{file_url}` that the frontend can use directly
    in <img src="…"> or download links. URL shape depends on the active
    backend but all are routed under /api/static or /api/uploads/serve so
    ingress + auth flow transparently."""
    try:
        target_folder = folder or folder_query or "uploads"
        file_data = await file.read()
        result = await storage_service.upload_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type,
            folder=target_folder,
        )

        if result["success"]:
            return {
                "success": True,
                "file_url": result["file_url"],
                "filename": result["filename"],
                "storage": storage_label,
            }
        raise HTTPException(status_code=500, detail=result.get("error", "Upload failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/multiple")
@limiter.limit(WRITE_UPLOAD_RATE, key_func=user_or_ip_key)
async def upload_multiple_files(
    request: Request,
    files: List[UploadFile] = File(...),
    folder: str = "uploads",
    current_user: dict = Depends(get_current_active_user)
):
    """Upload multiple files."""
    uploaded_files = []
    for file in files:
        file_data = await file.read()
        result = await storage_service.upload_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type,
            folder=folder,
        )
        if result["success"]:
            uploaded_files.append({
                "file_url": result["file_url"],
                "filename": result["filename"],
            })
    return {"success": True, "files": uploaded_files, "storage": storage_label}


@router.get("/serve/{path:path}")
async def serve_object(
    path: str,
    request: Request,
    authorization: str = Header(default=None),
    auth: str = Query(default=None),
):
    """Stream a previously-uploaded object back to the browser.

    Only used when STORAGE_BACKEND=emergent because Emergent storage has no
    presigned URLs — every read must go through us. Local/S3 backends serve
    their files through `/api/static/...` and never hit this route.

    CDN-friendly behaviour:
      • Files are content-addressed (UUID-named) so the response is **safe
        to cache forever**. We set ``Cache-Control: public, max-age=1y,
        immutable`` so a CDN edge (or browser) never re-fetches.
      • Returns a strong ETag = the object path. If the client sends
        ``If-None-Match`` we short-circuit with a 304.
      • Auth is **optional**: paths are 128-bit UUIDs (effectively
        unguessable) and we want the CDN to serve them without
        ``Authorization`` headers. If a token IS provided we still validate
        it so accidentally-leaked URLs from authed flows don't become a
        downgrade. To enforce auth on a per-path basis, set
        ``REQUIRE_AUTH_FOR_SERVE=1`` and pass tokens.
    """
    if not isinstance(storage_service, EmergentStorageService):
        raise HTTPException(status_code=404, detail="Not found")

    require_auth = os.environ.get("REQUIRE_AUTH_FOR_SERVE", "0") == "1"
    if require_auth:
        token = None
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1]
        elif auth:
            token = auth
        if not token or not decode_token(token):
            raise HTTPException(status_code=401, detail="Authentication required")

    # 304 short-circuit (saves the upstream fetch entirely).
    etag = f'"{path}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=31536000, immutable",
        })

    try:
        data, content_type = await storage_service.get_object(path)
        return Response(
            content=data,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": etag,
                # Tell intermediaries the response can be shared across users.
                "Vary": "Accept-Encoding",
            },
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"File not found: {e}")


@router.delete("/{file_key:path}")
async def delete_file(
    file_key: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete (or soft-delete) a file. Emergent backend has no real delete,
    so this returns success and the caller is expected to flip an
    `is_deleted` flag in the DB."""
    result = await storage_service.delete_file(file_key)
    if result["success"]:
        return {"success": True, "message": result.get("message", "File deleted")}
    raise HTTPException(status_code=500, detail=result.get("error", "Delete failed"))

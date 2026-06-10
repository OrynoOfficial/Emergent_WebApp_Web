from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header
from fastapi.responses import Response
from services.s3_service import S3Service
from services.local_storage_service import LocalStorageService
from services.emergent_storage_service import EmergentStorageService
from middleware.auth import get_current_active_user
from utils.auth import decode_token
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
async def upload_file(
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
async def upload_multiple_files(
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
    authorization: str = Header(default=None),
    auth: str = Query(default=None),
):
    """Stream a previously-uploaded object back to the browser.

    Only used when STORAGE_BACKEND=emergent because Emergent storage has no
    presigned URLs — every read must go through us. Local/S3 backends serve
    their files through `/api/static/...` and never hit this route.

    Auth: accepts either `Authorization: Bearer …` (XHR/fetch) or `?auth=…`
    (img tags). At least one must validate.
    """
    if not isinstance(storage_service, EmergentStorageService):
        raise HTTPException(status_code=404, detail="Not found")

    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token or not decode_token(token):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        data, content_type = await storage_service.get_object(path)
        return Response(content=data, media_type=content_type)
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

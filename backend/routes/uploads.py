from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, Query
from services.s3_service import S3Service
from services.local_storage_service import LocalStorageService
from middleware.auth import get_current_active_user
from config.settings import settings
from typing import List, Optional

router = APIRouter(prefix="/api/uploads", tags=["File Uploads"])

# Use local storage if configured, otherwise use S3
USE_LOCAL = settings.USE_LOCAL_STORAGE.lower() == "true"
storage_service = LocalStorageService() if USE_LOCAL else S3Service()

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None),
    folder_query: Optional[str] = Query(None, alias="folder"),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a file to S3 or local storage"""
    try:
        file_data = await file.read()
        result = await storage_service.upload_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type,
            folder=folder
        )
        
        if result["success"]:
            return {
                "success": True,
                "file_url": result["file_url"],
                "filename": result["filename"],
                "storage": "local" if USE_LOCAL else "s3"
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/multiple")
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    folder: str = "uploads",
    current_user: dict = Depends(get_current_active_user)
):
    """Upload multiple files to S3 or local storage"""
    uploaded_files = []
    
    for file in files:
        file_data = await file.read()
        result = await storage_service.upload_file(
            file_data=file_data,
            filename=file.filename,
            content_type=file.content_type,
            folder=folder
        )
        
        if result["success"]:
            uploaded_files.append({
                "file_url": result["file_url"],
                "filename": result["filename"]
            })
    
    return {"success": True, "files": uploaded_files, "storage": "local" if USE_LOCAL else "s3"}

@router.delete("/{file_key:path}")
async def delete_file(
    file_key: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a file from S3 or local storage"""
    result = await storage_service.delete_file(file_key)
    
    if result["success"]:
        return {"success": True, "message": "File deleted"}
    else:
        raise HTTPException(status_code=500, detail=result["error"])
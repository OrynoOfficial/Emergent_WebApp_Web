import os
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from config.settings import settings

class LocalStorageService:
    def __init__(self):
        self.storage_path = getattr(settings, 'LOCAL_STORAGE_PATH', '/app/webapp-backend/uploads')
        # Create storage directory if it doesn't exist
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
    
    async def upload_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        folder: str = "uploads"
    ) -> Dict[str, Any]:
        """Upload a file to local storage"""
        try:
            # Create folder if it doesn't exist
            folder_path = os.path.join(self.storage_path, folder)
            Path(folder_path).mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            file_extension = filename.split('.')[-1] if '.' in filename else ''
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join(folder_path, unique_filename)
            
            # Write file
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            # Generate file URL (relative path - must use /api prefix for ingress routing)
            file_url = f"/api/static/{folder}/{unique_filename}"
            
            return {
                "success": True,
                "file_url": file_url,
                "filename": unique_filename,
                "file_path": file_path
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_file(self, file_key: str) -> Dict[str, Any]:
        """Delete a file from local storage"""
        try:
            file_path = os.path.join(self.storage_path, file_key.lstrip('/'))
            if os.path.exists(file_path):
                os.remove(file_path)
                return {
                    "success": True,
                    "message": "File deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "File not found"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_file_path(self, file_key: str) -> Optional[str]:
        """Get the local file path"""
        file_path = os.path.join(self.storage_path, file_key.lstrip('/'))
        if os.path.exists(file_path):
            return file_path
        return None
    
    async def list_files(self, prefix: str = "") -> Dict[str, Any]:
        """List files in local storage"""
        try:
            search_path = os.path.join(self.storage_path, prefix)
            files = []
            
            if os.path.exists(search_path):
                for root, dirs, filenames in os.walk(search_path):
                    for filename in filenames:
                        file_path = os.path.join(root, filename)
                        relative_path = os.path.relpath(file_path, self.storage_path)
                        file_stat = os.stat(file_path)
                        
                        files.append({
                            "key": relative_path,
                            "size": file_stat.st_size,
                            "last_modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                        })
            
            return {
                "success": True,
                "files": files
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
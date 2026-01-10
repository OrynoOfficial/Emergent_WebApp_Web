"""
Database Management API
Provides real-time database statistics and CRUD operations for collections
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime
from config.database import get_database
from middleware.auth import get_current_active_user
import json

router = APIRouter(prefix="/api/database", tags=["Database Management"])

# Collections that can be managed
MANAGEABLE_COLLECTIONS = [
    "users", "orders", "hotels", "rooms", "restaurants", "travel_routes",
    "vehicles", "events", "operators", "employees", "loyalty_programs",
    "loyalty_rewards", "promo_codes", "ratings", "banquets", "car_rentals",
    "cinema_halls", "packages", "pressing_services", "support_tickets",
    "notifications", "activity_logs", "document_templates"
]


class DocumentCreate(BaseModel):
    data: Dict[str, Any]


class DocumentUpdate(BaseModel):
    data: Dict[str, Any]


class QueryRequest(BaseModel):
    collection: str
    query: Dict[str, Any] = {}
    projection: Optional[Dict[str, Any]] = None
    sort: Optional[Dict[str, int]] = None
    limit: int = 50


@router.get("/stats")
async def get_database_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get overall database statistics"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    
    # Get all collection names
    collection_names = await db.list_collection_names()
    
    # Calculate stats for each collection
    collections = []
    total_documents = 0
    
    for name in sorted(collection_names):
        try:
            count = await db[name].count_documents({})
            total_documents += count
            
            # Get a sample document to estimate size
            sample = await db[name].find_one({})
            estimated_doc_size = len(json.dumps(sample, default=str)) if sample else 0
            estimated_size = count * estimated_doc_size
            
            # Get indexes
            indexes = await db[name].index_information()
            
            # Get last modified (from last document)
            last_doc = await db[name].find_one({}, sort=[("updated_at", -1)])
            if not last_doc:
                last_doc = await db[name].find_one({}, sort=[("created_at", -1)])
            
            last_modified = None
            if last_doc:
                last_modified = last_doc.get("updated_at") or last_doc.get("created_at")
            
            collections.append({
                "name": name,
                "documents": count,
                "size": f"{estimated_size / 1024:.1f} KB" if estimated_size < 1024*1024 else f"{estimated_size / (1024*1024):.2f} MB",
                "sizeBytes": estimated_size,
                "indexes": len(indexes),
                "lastModified": last_modified.isoformat() if last_modified else None
            })
        except Exception as e:
            collections.append({
                "name": name,
                "documents": 0,
                "size": "0 KB",
                "sizeBytes": 0,
                "indexes": 0,
                "lastModified": None,
                "error": str(e)
            })
    
    # Calculate total size
    total_size_bytes = sum(c.get("sizeBytes", 0) for c in collections)
    total_size = f"{total_size_bytes / (1024*1024):.2f} MB" if total_size_bytes >= 1024*1024 else f"{total_size_bytes / 1024:.1f} KB"
    
    return {
        "totalCollections": len(collections),
        "totalDocuments": total_documents,
        "totalSize": total_size,
        "totalSizeBytes": total_size_bytes,
        "collections": collections
    }


@router.get("/collections")
async def list_collections(
    current_user: dict = Depends(get_current_active_user)
):
    """List all collections with document counts"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    collection_names = await db.list_collection_names()
    
    collections = []
    for name in sorted(collection_names):
        count = await db[name].count_documents({})
        collections.append({"name": name, "count": count})
    
    return {"collections": collections}


@router.get("/collections/{collection_name}")
async def get_collection_documents(
    collection_name: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get documents from a collection"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    
    # Verify collection exists
    if collection_name not in await db.list_collection_names():
        raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")
    
    # Build query
    query = {}
    if search:
        # Search in common fields
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"_id": {"$regex": search, "$options": "i"}}
        ]
    
    # Get documents
    try:
        cursor = db[collection_name].find(query).sort("_id", -1).skip(skip).limit(limit)
        documents = await cursor.to_list(limit)
        total = await db[collection_name].count_documents(query)
        
        # Convert ObjectId and datetime to strings
        for doc in documents:
            doc["id"] = str(doc.pop("_id", ""))
            for key, value in doc.items():
                if isinstance(value, datetime):
                    doc[key] = value.isoformat()
        
        return {
            "collection": collection_name,
            "documents": documents,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")


@router.get("/collections/{collection_name}/{document_id}")
async def get_document(
    collection_name: str,
    document_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific document"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    
    document = await db[collection_name].find_one({"_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document["id"] = str(document.pop("_id", ""))
    for key, value in document.items():
        if isinstance(value, datetime):
            document[key] = value.isoformat()
    
    return document


@router.post("/collections/{collection_name}")
async def create_document(
    collection_name: str,
    document: DocumentCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new document in a collection"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if collection_name not in MANAGEABLE_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection '{collection_name}' is not manageable")
    
    db = get_database()
    
    # Add metadata
    import uuid
    doc_data = document.data.copy()
    if "_id" not in doc_data:
        doc_data["_id"] = str(uuid.uuid4())
    doc_data["created_at"] = datetime.utcnow()
    doc_data["updated_at"] = datetime.utcnow()
    doc_data["created_by"] = current_user["_id"]
    
    try:
        await db[collection_name].insert_one(doc_data)
        doc_data["id"] = doc_data.pop("_id")
        return {"message": "Document created successfully", "document": doc_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insert error: {str(e)}")


@router.put("/collections/{collection_name}/{document_id}")
async def update_document(
    collection_name: str,
    document_id: str,
    document: DocumentUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a document"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if collection_name not in MANAGEABLE_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection '{collection_name}' is not manageable")
    
    db = get_database()
    
    existing = await db[collection_name].find_one({"_id": document_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update data
    update_data = document.data.copy()
    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = current_user["_id"]
    
    # Remove _id if present to avoid conflicts
    update_data.pop("_id", None)
    update_data.pop("id", None)
    
    try:
        await db[collection_name].update_one(
            {"_id": document_id},
            {"$set": update_data}
        )
        return {"message": "Document updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update error: {str(e)}")


@router.delete("/collections/{collection_name}/{document_id}")
async def delete_document(
    collection_name: str,
    document_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a document"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if collection_name not in MANAGEABLE_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection '{collection_name}' is not manageable")
    
    db = get_database()
    
    existing = await db[collection_name].find_one({"_id": document_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        await db[collection_name].delete_one({"_id": document_id})
        return {"message": "Document deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete error: {str(e)}")


@router.post("/query")
async def run_query(
    request: QueryRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Run a custom query on a collection"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    
    if request.collection not in await db.list_collection_names():
        raise HTTPException(status_code=404, detail=f"Collection '{request.collection}' not found")
    
    try:
        cursor = db[request.collection].find(
            request.query,
            request.projection
        )
        
        if request.sort:
            sort_list = [(k, v) for k, v in request.sort.items()]
            cursor = cursor.sort(sort_list)
        
        cursor = cursor.limit(request.limit)
        documents = await cursor.to_list(request.limit)
        
        # Convert ObjectId and datetime
        for doc in documents:
            doc["id"] = str(doc.pop("_id", ""))
            for key, value in doc.items():
                if isinstance(value, datetime):
                    doc[key] = value.isoformat()
        
        return {
            "collection": request.collection,
            "query": request.query,
            "count": len(documents),
            "documents": documents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query error: {str(e)}")


@router.get("/recent-operations")
async def get_recent_operations(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get recent database operations from activity logs"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = get_database()
    
    # Get recent activity logs related to database operations
    operations = await db.activity_logs.find({
        "action": {"$regex": "^(create|update|delete)", "$options": "i"}
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    result = []
    for op in operations:
        result.append({
            "id": str(op.get("_id", "")),
            "type": op.get("action", "").split(".")[0].upper() if "." in op.get("action", "") else op.get("action", "").upper(),
            "collection": op.get("entity_type", "unknown"),
            "timestamp": op.get("created_at").isoformat() if op.get("created_at") else None,
            "user": op.get("user_id"),
            "details": op.get("details", {})
        })
    
    return {"operations": result}

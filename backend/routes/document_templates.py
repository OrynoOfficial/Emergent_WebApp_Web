"""
Document Templates API for HR Documents
Handles CRUD operations for employment documents like contracts, termination letters, etc.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from config.database import get_database
from middleware.auth import get_current_active_user
import uuid

router = APIRouter(prefix="/api/document-templates", tags=["Document Templates"])

# Document Categories
DOCUMENT_CATEGORIES = [
    "employment_contract",
    "sick_leave",
    "termination",
    "promotion",
    "warning_letter",
    "salary_revision",
    "probation_completion",
    "transfer_letter",
    "experience_certificate",
    "appointment_letter",
    "other"
]

class DocumentTemplateCreate(BaseModel):
    name: str
    category: str
    content: str
    description: Optional[str] = None
    variables: Optional[List[str]] = []  # Placeholders like {{employee_name}}, {{date}}, etc.

class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("/categories")
async def get_document_categories(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all available document categories"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "categories": [
            {"id": "employment_contract", "name": "Employment Contract", "description": "Standard employment agreements"},
            {"id": "sick_leave", "name": "Sick Leave", "description": "Sick leave application and approval forms"},
            {"id": "termination", "name": "Termination", "description": "Employment termination letters"},
            {"id": "promotion", "name": "Promotion", "description": "Promotion and advancement letters"},
            {"id": "warning_letter", "name": "Warning Letter", "description": "Disciplinary warning notices"},
            {"id": "salary_revision", "name": "Salary Revision", "description": "Salary adjustment letters"},
            {"id": "probation_completion", "name": "Probation Completion", "description": "Probation period confirmation"},
            {"id": "transfer_letter", "name": "Transfer Letter", "description": "Department or location transfer"},
            {"id": "experience_certificate", "name": "Experience Certificate", "description": "Work experience certification"},
            {"id": "appointment_letter", "name": "Appointment Letter", "description": "Official job appointment"},
            {"id": "other", "name": "Other", "description": "Miscellaneous HR documents"}
        ]
    }


@router.get("/")
async def get_document_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get all document templates"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    templates = await db.document_templates.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.document_templates.count_documents(query)
    
    # Convert _id to id
    for t in templates:
        t["id"] = str(t.pop("_id", ""))
    
    return {
        "templates": templates,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/{template_id}")
async def get_document_template(
    template_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific document template"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    template = await db.document_templates.find_one({"_id": template_id})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template["id"] = str(template.pop("_id", ""))
    return template


@router.post("/")
async def create_document_template(
    template_data: DocumentTemplateCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new document template"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if template_data.category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {DOCUMENT_CATEGORIES}")
    
    db = get_database()
    
    template = {
        "_id": str(uuid.uuid4()),
        "name": template_data.name,
        "category": template_data.category,
        "content": template_data.content,
        "description": template_data.description,
        "variables": template_data.variables or [],
        "is_active": True,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.document_templates.insert_one(template)
    
    template["id"] = template.pop("_id")
    return {"message": "Template created successfully", "template": template}


@router.put("/{template_id}")
async def update_document_template(
    template_id: str,
    template_data: DocumentTemplateUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a document template"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    existing = await db.document_templates.find_one({"_id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template_data.category and template_data.category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {DOCUMENT_CATEGORIES}")
    
    update_dict = {"updated_at": datetime.utcnow()}
    
    if template_data.name is not None:
        update_dict["name"] = template_data.name
    if template_data.category is not None:
        update_dict["category"] = template_data.category
    if template_data.content is not None:
        update_dict["content"] = template_data.content
    if template_data.description is not None:
        update_dict["description"] = template_data.description
    if template_data.variables is not None:
        update_dict["variables"] = template_data.variables
    if template_data.is_active is not None:
        update_dict["is_active"] = template_data.is_active
    
    await db.document_templates.update_one({"_id": template_id}, {"$set": update_dict})
    
    return {"message": "Template updated successfully"}


@router.delete("/{template_id}")
async def delete_document_template(
    template_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a document template"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    existing = await db.document_templates.find_one({"_id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await db.document_templates.delete_one({"_id": template_id})
    
    return {"message": "Template deleted successfully"}


@router.post("/{template_id}/duplicate")
async def duplicate_document_template(
    template_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Duplicate an existing template"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    existing = await db.document_templates.find_one({"_id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_template = {
        "_id": str(uuid.uuid4()),
        "name": f"{existing['name']} (Copy)",
        "category": existing["category"],
        "content": existing["content"],
        "description": existing.get("description"),
        "variables": existing.get("variables", []),
        "is_active": True,
        "created_by": current_user["_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.document_templates.insert_one(new_template)
    
    new_template["id"] = new_template.pop("_id")
    return {"message": "Template duplicated successfully", "template": new_template}

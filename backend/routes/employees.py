from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.employee import EmployeeCreate, EmployeeUpdate, EmployeeStatus
from utils.auth import get_password_hash
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/employees", tags=["Employees"])

DEFAULT_PASSWORD = "Oryno@2024"

@router.post("/")
async def create_employee(
    employee_data: EmployeeCreate,
    current_user: dict = Depends(require_permission("employees.create"))
):
    """Create a new employee - requires employees.create permission"""
    db = get_database()
    
    # Use role as position if position not provided
    position = employee_data.position or employee_data.role or "employee"
    
    employee_id = str(uuid.uuid4())
    user_id = None
    
    # Create user account if requested
    if employee_data.create_user_account and employee_data.email:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": employee_data.email.lower()})
        if existing_user:
            raise HTTPException(status_code=400, detail="A user with this email already exists")
        
        # Hash the default password
        hashed_password = get_password_hash(DEFAULT_PASSWORD)
        
        # Determine user role
        system_role = employee_data.system_role if employee_data.system_role in ["employee", "admin"] else "employee"
        
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "full_name": f"{employee_data.first_name} {employee_data.last_name}",
            "email": employee_data.email.lower(),
            "password_hash": hashed_password,
            "role": system_role,
            "phone": employee_data.phone,
            "status": "active",
            "email_verified": True,
            "two_fa_enabled": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user)
    
    employee = {
        "id": employee_id,
        "operator_id": employee_data.operator_id or current_user.get("operator_id"),
        "operator_name": employee_data.operator_name or "Oryno",
        "user_id": user_id,
        "first_name": employee_data.first_name,
        "last_name": employee_data.last_name,
        "email": employee_data.email,
        "phone": employee_data.phone,
        "position": position,
        "role": position,
        "department": employee_data.department,
        "hire_date": employee_data.hire_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "salary": employee_data.salary or 0,
        "city": employee_data.city,
        "address": employee_data.address,
        "status": "active",
        "documents": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Generate employee code if not provided
    if not employee_data.employee_code:
        count = await db.employees.count_documents({})
        employee["employee_code"] = f"EMP-{count + 1:04d}"
    else:
        employee["employee_code"] = employee_data.employee_code
    
    await db.employees.insert_one(employee)
    
    return {
        "message": "Employee created successfully",
        "employee": {**employee, "_id": employee_id},
        "user_account_created": user_id is not None,
        "default_password": DEFAULT_PASSWORD if user_id else None
    }

@router.get("/")
async def get_employees(
    operator_id: Optional[str] = None,
    emp_status: Optional[str] = None,
    department: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get employees"""
    db = get_database()
    
    query = {}
    
    # Filter by operator for non-admin
    if current_user["role"] == "operator":
        query["operator_id"] = current_user.get("operator_id")
    elif operator_id:
        query["operator_id"] = operator_id
    
    if emp_status:
        query["status"] = emp_status
    if department:
        query["department"] = department
    
    employees = await db.employees.find(query, {"_id": 0}).sort("last_name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.employees.count_documents(query)
    
    return {"employees": employees, "total": total}

@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get employee details"""
    db = get_database()
    
    # Support both 'id' and '_id' fields
    employee = await db.employees.find_one({"$or": [{"id": employee_id}, {"_id": employee_id}]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    if current_user["role"] == "operator":
        if employee.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    employee["id"] = employee.get("id", employee_id)
    return employee

@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    employee_data: EmployeeUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an employee"""
    db = get_database()
    
    # Support both 'id' and '_id' fields
    employee = await db.employees.find_one({"$or": [{"id": employee_id}, {"_id": employee_id}]})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    if current_user["role"] == "operator":
        if employee.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in employee_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.employees.update_one({"$or": [{"id": employee_id}, {"_id": employee_id}]}, {"$set": update_data})
    
    return {"message": "Employee updated successfully"}

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete an employee"""
    db = get_database()
    
    # Support both 'id' and '_id' fields
    employee = await db.employees.find_one({"$or": [{"id": employee_id}, {"_id": employee_id}]})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    if current_user["role"] == "operator":
        if employee.get("operator_id") != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete using both possible id fields
    result = await db.employees.delete_one({"$or": [{"id": employee_id}, {"_id": employee_id}]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found or already deleted")
    
    return {"message": "Employee deleted successfully", "deleted_employee_id": employee_id}

@router.post("/{employee_id}/documents")
async def add_employee_document(
    employee_id: str,
    name: str,
    document_type: str,
    file_url: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a document to an employee"""
    db = get_database()
    
    employee = await db.employees.find_one({"_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    if current_user["role"] == "operator":
        if employee["operator_id"] != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    document = {
        "_id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "name": name,
        "document_type": document_type,
        "file_url": file_url,
        "uploaded_by": current_user["_id"],
        "notes": notes,
        "created_at": datetime.utcnow()
    }
    
    await db.employee_documents.insert_one(document)
    
    # Add to employee's documents list
    await db.employees.update_one(
        {"_id": employee_id},
        {"$push": {"documents": {"name": name, "type": document_type, "url": file_url, "uploaded_at": datetime.utcnow().isoformat()}}}
    )
    
    return {"message": "Document added", "document_id": document["_id"]}

@router.get("/{employee_id}/documents")
async def get_employee_documents(
    employee_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get employee documents"""
    db = get_database()
    
    employee = await db.employees.find_one({"_id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check access
    if current_user["role"] == "operator":
        if employee["operator_id"] != current_user.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    documents = await db.employee_documents.find({"employee_id": employee_id}, {"_id": 0}).to_list(100)
    
    return {"documents": documents}

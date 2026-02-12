from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class EmployeeStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"

class Employee(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    operator_id: str
    operator_name: str
    user_id: Optional[str] = None  # Link to user account if exists
    employee_code: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: str
    department: Optional[str] = None
    hire_date: Optional[str] = None
    salary: Optional[float] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, str]] = None
    documents: List[Dict[str, Any]] = []  # [{name, url, type, uploaded_at}]
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class EmployeeCreate(BaseModel):
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    employee_code: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None  # position alias
    department: Optional[str] = None
    hire_date: Optional[str] = None
    salary: Optional[float] = None
    city: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, str]] = None
    notes: Optional[str] = None
    # User account creation fields
    create_user_account: bool = False
    system_role: Optional[str] = "employee"  # employee or admin

class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    salary: Optional[float] = None
    status: Optional[EmployeeStatus] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, str]] = None
    notes: Optional[str] = None

class EmployeeDocument(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    employee_id: str
    name: str
    document_type: str  # contract, id, certificate, payslip, etc.
    file_url: str
    file_size: Optional[int] = None
    uploaded_by: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from models.operator import OperatorCreate, OperatorUpdate, OperatorStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/operators", tags=["Operators"])

@router.post("/")
async def create_operator(
    operator_data: OperatorCreate,
    current_user: dict = Depends(require_permission("operators.create"))
):
    """Create a new operator - requires operators.create permission"""
    db = get_database()
    
    # Check if email already exists
    existing = await db.operators.find_one({"email": operator_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Operator with this email already exists")
    
    operator = {
        "_id": str(uuid.uuid4()),
        **operator_data.dict(),
        "status": OperatorStatus.ACTIVE.value if current_user["role"] == "super_admin" else OperatorStatus.PENDING.value,
        "owner_user_id": current_user["_id"],
        "created_by": current_user["_id"],
        "created_by_role": current_user["role"],
        "documents": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.operators.insert_one(operator)
    
    # Update user with operator info if self-registering (non-admin)
    if current_user["role"] not in ["admin", "super_admin"]:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"operator_id": operator["_id"], "operator_name": operator["name"]}}
        )
    
    # If created by admin (not super_admin), create a validation request
    if current_user["role"] == "admin":
        validation_request = {
            "_id": str(uuid.uuid4()),
            "type": "operator_approval",
            "operator_id": operator["_id"],
            "operator_name": operator["name"],
            "operator_email": operator.get("email"),
            "operator_type": operator.get("operator_type"),
            "requested_by": current_user["_id"],
            "requested_by_name": current_user.get("full_name", current_user.get("email")),
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        await db.validation_requests.insert_one(validation_request)
        
        # Notify super admins
        super_admins = await db.users.find({"role": "super_admin"}).to_list(100)
        for sa in super_admins:
            notification = {
                "_id": str(uuid.uuid4()),
                "user_id": sa["_id"],
                "notification_type": "operator_approval_request",
                "title": "New Operator Approval Request",
                "message": f"Admin {current_user.get('full_name', current_user.get('email'))} has created operator '{operator['name']}' and requires your approval.",
                "data": {"operator_id": operator["_id"], "validation_request_id": validation_request["_id"]},
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(notification)
    
    return {"message": "Operator created" + (" - pending super admin approval" if current_user["role"] == "admin" else ""), "operator_id": operator["_id"]}

@router.get("/")
async def get_operators(
    op_status: Optional[str] = None,
    operator_type: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("operators.view"))
):
    """Get operators list - requires operators.view permission"""
    db = get_database()
    
    query = {}
    is_admin = current_user["role"] in ["admin", "super_admin"]
    
    # Non-super-admin users can only see active operators unless they have explicit permission
    if not is_admin:
        query["status"] = OperatorStatus.ACTIVE.value
    elif op_status:
        query["status"] = op_status
    
    if operator_type:
        query["operator_type"] = operator_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    operators = await db.operators.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.operators.count_documents(query)
    
    # Fetch owner info and calculate revenue for each operator
    for op in operators:
        op_id = str(op.get("_id", ""))
        op["id"] = op_id
        op.pop("_id", None)
        
        # Get owner user info
        owner_user_id = op.get("owner_user_id")
        if owner_user_id:
            owner = await db.users.find_one({"_id": owner_user_id}, {"_id": 0, "full_name": 1, "email": 1})
            if owner:
                op["owner_name"] = owner.get("full_name", "")
                op["owner_email"] = owner.get("email", "")
            else:
                op["owner_name"] = ""
                op["owner_email"] = ""
        else:
            op["owner_name"] = ""
            op["owner_email"] = ""
        
        # Calculate total revenue from orders for this operator
        try:
            # Aggregate revenue from orders where operator_id matches
            revenue_pipeline = [
                {"$match": {"operator_id": op_id, "status": {"$in": ["completed", "confirmed", "pending"]}}},
                {"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}}}
            ]
            revenue_result = await db.orders.aggregate(revenue_pipeline).to_list(1)
            op["revenue"] = revenue_result[0]["total_revenue"] if revenue_result else 0
        except Exception:
            op["revenue"] = op.get("revenue", 0)
    
    return {"operators": operators, "total": total, "skip": skip, "limit": limit}

@router.get("/{operator_id}")
async def get_operator(operator_id: str):
    """Get operator details"""
    db = get_database()
    operator = await db.operators.find_one({"_id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    operator["id"] = operator_id
    return operator

@router.put("/{operator_id}")
async def update_operator(
    operator_id: str,
    operator_data: OperatorUpdate,
    current_user: dict = Depends(require_permission("operators.edit"))
):
    """Update an operator - requires operators.edit permission"""
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Check authorization - non-super-admin can only edit their own operator
    is_super_admin = current_user["role"] == "super_admin"
    if not is_super_admin and operator["owner_user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own operator")
    
    # Only super_admin can change status
    update_data = {k: v for k, v in operator_data.dict().items() if v is not None}
    if "status" in update_data and not is_super_admin:
        del update_data["status"]
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.operators.update_one({"_id": operator_id}, {"$set": update_data})
    
    return {"message": "Operator updated"}

@router.delete("/{operator_id}")
async def delete_operator(
    operator_id: str,
    current_user: dict = Depends(require_permission("operators.delete"))
):
    """Delete an operator - requires operators.delete permission
    
    Cascades deletion to:
    - All users assigned to this operator (disabled, not deleted)
    - All travel routes
    - All vehicles
    - All hotels
    - All restaurants
    - All car rentals
    - All events
    - All banquets
    - All packages
    """
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    operator_name = operator.get("name", "Unknown")
    
    # 1. Disable all users assigned to this operator (don't delete - just disable)
    users_result = await db.users.update_many(
        {"operator_id": operator_id},
        {"$set": {
            "status": "disabled",
            "role": "customer",  # Demote to customer
            "operator_id": None,
            "operator_name": None,
            "disabled_reason": f"Operator '{operator_name}' was deleted",
            "disabled_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    # 2. Delete all travel routes
    routes_result = await db.travel_routes.delete_many({"operator_id": operator_id})
    
    # 3. Delete all vehicles
    vehicles_result = await db.vehicles.delete_many({"operator_id": operator_id})
    
    # 4. Delete all hotels
    hotels_result = await db.hotels.delete_many({"operator_id": operator_id})
    
    # 5. Delete all restaurants
    restaurants_result = await db.restaurants.delete_many({"operator_id": operator_id})
    
    # 6. Delete all car rentals
    car_rentals_result = await db.car_rentals.delete_many({"operator_id": operator_id})
    
    # 7. Delete all events
    events_result = await db.events.delete_many({"operator_id": operator_id})
    
    # 8. Delete all banquets
    banquets_result = await db.banquets.delete_many({"operator_id": operator_id})
    
    # 9. Delete all packages
    packages_result = await db.packages.delete_many({"operator_id": operator_id})
    
    # 10. Delete the operator
    await db.operators.delete_one({"_id": operator_id})
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.deleted",
        "details": {
            "operator_name": operator_name,
            "users_disabled": users_result.modified_count,
            "routes_deleted": routes_result.deleted_count,
            "vehicles_deleted": vehicles_result.deleted_count,
            "hotels_deleted": hotels_result.deleted_count,
            "restaurants_deleted": restaurants_result.deleted_count,
            "car_rentals_deleted": car_rentals_result.deleted_count,
            "events_deleted": events_result.deleted_count,
            "banquets_deleted": banquets_result.deleted_count,
            "packages_deleted": packages_result.deleted_count
        },
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {
        "message": "Operator deleted",
        "cascade_summary": {
            "users_disabled": users_result.modified_count,
            "routes_deleted": routes_result.deleted_count,
            "vehicles_deleted": vehicles_result.deleted_count,
            "hotels_deleted": hotels_result.deleted_count,
            "restaurants_deleted": restaurants_result.deleted_count,
            "car_rentals_deleted": car_rentals_result.deleted_count,
            "events_deleted": events_result.deleted_count,
            "banquets_deleted": banquets_result.deleted_count,
            "packages_deleted": packages_result.deleted_count
        }
    }

@router.post("/{operator_id}/approve")
async def approve_operator(
    operator_id: str,
    current_user: dict = Depends(require_permission("operators.approve"))
):
    """Approve a pending operator - requires operators.approve permission"""
    db = get_database()
    
    # Get the operator to find owner_user_id
    operator = await db.operators.find_one({"_id": operator_id, "status": OperatorStatus.PENDING})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found or not pending")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.ACTIVE, 
            "approved_at": datetime.utcnow(),
            "approved_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Update validation request if exists
    await db.validation_requests.update_one(
        {"operator_id": operator_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    # Update user role to 'operator' if owner_user_id exists and is not admin/super_admin
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        owner_user = await db.users.find_one({"_id": owner_user_id})
        if owner_user and owner_user.get("role") not in ["admin", "super_admin"]:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "operator",
                    "operator_id": operator_id,
                    "operator_name": operator.get("name"),
                    "updated_at": datetime.utcnow()
                }}
            )
    
    # Send notification to operator
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": owner_user_id,
        "notification_type": "operator_status",
        "title": "Operator Application Approved",
        "message": f"Congratulations! Your operator application for '{operator.get('name')}' has been approved. You can now start adding services.",
        "data": {"operator_id": operator_id, "status": "active"},
        "is_read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.approved",
        "details": {"operator_name": operator.get("name"), "owner_user_id": owner_user_id},
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Operator approved", "operator_id": operator_id}

@router.post("/{operator_id}/suspend")
async def suspend_operator(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Suspend an operator (admin or super_admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the operator
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.SUSPENDED, 
            "suspended_at": datetime.utcnow(),
            "suspended_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Cascade suspend to operator's services
    # Suspend travel routes
    await db.travel_routes.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Suspend hotels
    await db.hotels.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Suspend car rentals
    await db.car_rentals.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Suspend restaurants
    await db.restaurants.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Suspend events
    await db.events.update_many(
        {"operator_id": operator_id},
        {"$set": {"status": "suspended", "updated_at": datetime.utcnow()}}
    )
    
    # Update owner user role back to customer if exists (only for non-admin users)
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        # Check if owner is admin/super_admin - don't change their role
        owner_user = await db.users.find_one({"_id": owner_user_id})
        if owner_user and owner_user.get("role") not in ["admin", "super_admin"]:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "customer",
                    "updated_at": datetime.utcnow()
                }}
            )
        
        # Send notification
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": owner_user_id,
            "notification_type": "operator_status",
            "title": "Operator Account Suspended",
            "message": f"Your operator account '{operator.get('name')}' has been suspended. Please contact support for more information.",
            "data": {"operator_id": operator_id, "status": "suspended"},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.suspended",
        "details": {"operator_name": operator.get("name"), "owner_user_id": owner_user_id},
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Operator suspended", "operator_id": operator_id}



@router.post("/{operator_id}/reactivate")
async def reactivate_operator(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Reactivate a suspended operator (admin or super_admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the operator
    operator = await db.operators.find_one({"_id": operator_id, "status": OperatorStatus.SUSPENDED})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found or not suspended")
    
    # Update operator status
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {
            "status": OperatorStatus.ACTIVE, 
            "reactivated_at": datetime.utcnow(),
            "reactivated_by": current_user["_id"],
            "updated_at": datetime.utcnow()
        }}
    )
    
    # Reactivate operator's services
    await db.travel_routes.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    await db.hotels.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    await db.car_rentals.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    await db.restaurants.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    await db.events.update_many(
        {"operator_id": operator_id, "status": "suspended"},
        {"$set": {"status": "active", "updated_at": datetime.utcnow()}}
    )
    
    # Update owner user role back to operator
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        await db.users.update_one(
            {"_id": owner_user_id},
            {"$set": {
                "role": "operator",
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Send notification
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": owner_user_id,
            "notification_type": "operator_status",
            "title": "Operator Account Reactivated",
            "message": f"Your operator account '{operator.get('name')}' has been reactivated. You can now manage your services.",
            "data": {"operator_id": operator_id, "status": "active"},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Log activity
    activity = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "entity_type": "operator",
        "entity_id": operator_id,
        "action": "operator.reactivated",
        "details": {"operator_name": operator.get("name"), "owner_user_id": owner_user_id},
        "created_at": datetime.utcnow()
    }
    await db.activity_logs.insert_one(activity)
    
    return {"message": "Operator reactivated", "operator_id": operator_id}


# ==================== DOCUMENT VERIFICATION WORKFLOW ====================

class DocumentUpload(BaseModel):
    document_type: str  # "business_registration", "tax_certificate", "id_document", "license"
    document_url: str
    document_name: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{operator_id}/documents")
async def upload_operator_document(
    operator_id: str,
    document: DocumentUpload,
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a verification document for an operator"""
    db = get_database()
    
    # Check if user is the operator owner or admin
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    if operator.get("owner_user_id") != current_user["_id"] and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to upload documents for this operator")
    
    # Create document record
    doc_record = {
        "_id": str(uuid.uuid4()),
        "document_type": document.document_type,
        "document_url": document.document_url,
        "document_name": document.document_name or document.document_type,
        "notes": document.notes,
        "status": "pending",  # pending, approved, rejected
        "uploaded_by": current_user["_id"],
        "uploaded_at": datetime.utcnow(),
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": None
    }
    
    # Add to operator's documents array
    await db.operators.update_one(
        {"_id": operator_id},
        {
            "$push": {"documents": doc_record},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Send notification to admin
    admin_users = await db.users.find({"role": {"$in": ["admin", "super_admin"]}}).to_list(100)
    for admin in admin_users:
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": admin["_id"],
            "notification_type": "document_review",
            "title": "New Document for Review",
            "message": f"Operator '{operator.get('name')}' has uploaded a new {document.document_type} document.",
            "data": {"operator_id": operator_id, "document_id": doc_record["_id"]},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    return {
        "message": "Document uploaded successfully",
        "document_id": doc_record["_id"],
        "status": "pending"
    }


@router.get("/{operator_id}/documents")
async def get_operator_documents(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all documents for an operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Check authorization
    if operator.get("owner_user_id") != current_user["_id"] and current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view documents for this operator")
    
    documents = operator.get("documents", [])
    
    return {
        "operator_id": operator_id,
        "operator_name": operator.get("name"),
        "documents": documents,
        "total": len(documents)
    }


class DocumentReview(BaseModel):
    status: str  # "approved" or "rejected"
    review_notes: Optional[str] = None


@router.put("/{operator_id}/documents/{document_id}/review")
async def review_operator_document(
    operator_id: str,
    document_id: str,
    review: DocumentReview,
    current_user: dict = Depends(get_current_active_user)
):
    """Review (approve/reject) an operator document (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if review.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    operator = await db.operators.find_one({"_id": operator_id})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Find and update the document
    documents = operator.get("documents", [])
    doc_found = False
    
    for doc in documents:
        if doc["_id"] == document_id:
            doc["status"] = review.status
            doc["reviewed_by"] = current_user["_id"]
            doc["reviewed_at"] = datetime.utcnow()
            doc["review_notes"] = review.review_notes
            doc_found = True
            break
    
    if not doc_found:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update operator with modified documents
    await db.operators.update_one(
        {"_id": operator_id},
        {"$set": {"documents": documents, "updated_at": datetime.utcnow()}}
    )
    
    # Send notification to operator owner
    owner_user_id = operator.get("owner_user_id")
    if owner_user_id:
        status_msg = "approved" if review.status == "approved" else "rejected"
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": owner_user_id,
            "notification_type": "document_review",
            "title": f"Document {status_msg.title()}",
            "message": f"Your document has been {status_msg}. {review.review_notes or ''}",
            "data": {"operator_id": operator_id, "document_id": document_id, "status": review.status},
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
    
    # Check if all required documents are approved
    all_approved = all(doc.get("status") == "approved" for doc in documents) if documents else False
    
    # If all docs approved and operator is pending, auto-approve
    if all_approved and operator.get("status") == "pending" and len(documents) >= 2:
        # At least 2 approved documents required for auto-approval
        await db.operators.update_one(
            {"_id": operator_id},
            {"$set": {
                "status": OperatorStatus.ACTIVE,
                "approved_at": datetime.utcnow(),
                "approved_by": current_user["_id"],
                "auto_approved": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Update user role
        if owner_user_id:
            await db.users.update_one(
                {"_id": owner_user_id},
                {"$set": {
                    "role": "operator",
                    "operator_id": operator_id,
                    "operator_name": operator.get("name"),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            # Send approval notification
            approval_notification = {
                "_id": str(uuid.uuid4()),
                "user_id": owner_user_id,
                "notification_type": "operator_status",
                "title": "Operator Application Auto-Approved",
                "message": f"All your documents have been verified. Your operator account '{operator.get('name')}' is now active!",
                "data": {"operator_id": operator_id, "status": "active"},
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(approval_notification)
    
    return {
        "message": f"Document {review.status}",
        "document_id": document_id,
        "all_documents_approved": all_approved
    }


@router.get("/documents/pending")
async def get_pending_documents(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all pending documents across all operators (admin only)"""
    db = get_database()
    
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find operators with pending documents
    pipeline = [
        {"$match": {"documents": {"$elemMatch": {"status": "pending"}}}},
        {"$project": {
            "_id": 1,
            "name": 1,
            "email": 1,
            "status": 1,
            "pending_documents": {
                "$filter": {
                    "input": "$documents",
                    "as": "doc",
                    "cond": {"$eq": ["$$doc.status", "pending"]}
                }
            }
        }},
        {"$skip": skip},
        {"$limit": limit}
    ]
    
    results = await db.operators.aggregate(pipeline).to_list(limit)
    
    # Format results
    pending_docs = []
    for op in results:
        for doc in op.get("pending_documents", []):
            pending_docs.append({
                "operator_id": op["_id"],
                "operator_name": op["name"],
                "operator_email": op.get("email"),
                "operator_status": op["status"],
                **doc
            })
    
    total = await db.operators.count_documents({"documents": {"$elemMatch": {"status": "pending"}}})
    
    return {
        "documents": pending_docs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

from fastapi import APIRouter, HTTPException, status as http_status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import uuid

router = APIRouter(prefix="/api/support-tickets", tags=["Support Tickets"])

# ==================== MODELS ====================

class TicketCreate(BaseModel):
    subject: str
    description: str
    category: str = "general"  # booking, payment, refund, technical, complaint, inquiry, operator, general
    priority: str = "medium"  # low, medium, high, urgent
    source: str = "web"  # web, mobile, email, phone, chat
    related_order_id: Optional[str] = None
    related_service_type: Optional[str] = None
    # New fields for operator support integration
    service_tag: Optional[str] = None  # Hotels, Travel, Restaurants, Car Rental, Events, Laundry, Banquet, Cinema, Packages
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    internal_notes: Optional[str] = None
    resolution: Optional[str] = None

class TicketAssignment(BaseModel):
    assignee_id: str
    assignee_name: str
    notes: Optional[str] = None

class TicketReply(BaseModel):
    message: str
    is_internal: bool = False  # Internal notes vs customer-visible replies

class TicketBulkAction(BaseModel):
    ticket_ids: List[str]
    action: str  # assign, update_status, update_priority
    value: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None

# ==================== TICKET ENDPOINTS ====================

@router.post("/")
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new support ticket"""
    db = get_database()
    
    # Generate ticket number
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.support_tickets.count_documents({})
    ticket_number = f"TKT-{today}-{str(count + 1).zfill(5)}"
    
    # Determine if ticket is from operator or customer
    user_type = "operator" if current_user.get("role") == "operator" else "customer"
    
    ticket = {
        "_id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "subject": ticket_data.subject,
        "description": ticket_data.description,
        "category": ticket_data.category,
        "priority": ticket_data.priority,
        "status": "open",
        "source": ticket_data.source,
        "user_type": user_type,
        # Customer/Operator info
        "customer_id": current_user["_id"],
        "customer_name": current_user.get("full_name") or current_user.get("username", "Unknown"),
        "customer_email": current_user.get("email", ""),
        "customer_phone": current_user.get("phone", ""),
        # Related info
        "related_order_id": ticket_data.related_order_id,
        "related_service_type": ticket_data.related_service_type,
        # Service and operator info for operator support integration
        "service_tag": ticket_data.service_tag,
        "operator_id": ticket_data.operator_id,
        "operator_name": ticket_data.operator_name,
        # Assignment
        "assigned_to": None,
        "assigned_to_name": None,
        "assigned_at": None,
        "assigned_by": None,
        # Tracking
        "internal_notes": "",
        "resolution": None,
        "resolved_at": None,
        "resolved_by": None,
        "first_response_at": None,
        "last_response_at": None,
        "response_count": 0,
        # Messages/Conversation
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_type": "customer",
            "sender_id": current_user["_id"],
            "sender_name": current_user.get("full_name") or current_user.get("username", "Customer"),
            "message": ticket_data.description,
            "is_internal": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }],
        # Timestamps
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    
    # Create notification for support team
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": "support_team",  # Special ID for team notifications
        "title": f"New Support Ticket: {ticket_number}",
        "message": f"{ticket['customer_name']} submitted a {ticket_data.priority} priority ticket: {ticket_data.subject}",
        "type": "support_ticket",
        "reference_id": ticket["_id"],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    ticket["id"] = ticket.pop("_id")
    return {"message": "Ticket created successfully", "ticket": ticket}


@router.get("/")
async def get_tickets(
    status: Optional[List[str]] = Query(None),
    priority: Optional[str] = None,
    category: Optional[str] = None,
    user_type: Optional[str] = None,  # customer or operator
    assigned_to: Optional[str] = None,
    unassigned: Optional[bool] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all support tickets with filters - requires support permissions"""
    db = get_database()
    
    # Build query
    query = {}
    
    # For non-admin users, show only their tickets
    if current_user.get("role") not in ["admin", "super_admin", "employee"]:
        query["customer_id"] = current_user["_id"]
    
    # Handle multiple statuses (for sub-tabs)
    if status:
        if len(status) == 1:
            query["status"] = status[0]
        else:
            query["status"] = {"$in": status}
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    if user_type:
        query["user_type"] = user_type
    if assigned_to:
        query["assigned_to"] = assigned_to
    if unassigned:
        query["assigned_to"] = None
    
    # Search in subject, description, customer name, ticket number
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}},
            {"ticket_number": {"$regex": search, "$options": "i"}}
        ]
    
    # Date range filter
    if date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        query["created_at"] = date_query
    
    # Sort direction
    sort_dir = -1 if sort_order == "desc" else 1
    
    # Execute query
    tickets = await db.support_tickets.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    total = await db.support_tickets.count_documents(query)
    
    # Transform _id to id
    for ticket in tickets:
        ticket["id"] = str(ticket.pop("_id", ""))
    
    return {
        "tickets": tickets,
        "total": total,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit
    }


@router.get("/my")
async def get_my_tickets(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's support tickets"""
    db = get_database()
    
    query = {"customer_id": current_user["_id"]}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.support_tickets.count_documents(query)
    
    # Transform _id to id
    for ticket in tickets:
        ticket["id"] = str(ticket.pop("_id", ""))
    
    return {"tickets": tickets, "total": total}


@router.get("/stats")
async def get_ticket_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get ticket statistics for dashboard"""
    db = get_database()
    
    # Overall stats
    total = await db.support_tickets.count_documents({})
    open_count = await db.support_tickets.count_documents({"status": "open"})
    pending_count = await db.support_tickets.count_documents({"status": "pending"})
    in_progress_count = await db.support_tickets.count_documents({"status": "in_progress"})
    resolved_count = await db.support_tickets.count_documents({"status": "resolved"})
    closed_count = await db.support_tickets.count_documents({"status": "closed"})
    
    # Unassigned tickets
    unassigned_count = await db.support_tickets.count_documents({"assigned_to": None, "status": {"$nin": ["resolved", "closed"]}})
    
    # Priority breakdown
    urgent_count = await db.support_tickets.count_documents({"priority": "urgent", "status": {"$nin": ["resolved", "closed"]}})
    high_count = await db.support_tickets.count_documents({"priority": "high", "status": {"$nin": ["resolved", "closed"]}})
    
    # User type breakdown
    customer_tickets = await db.support_tickets.count_documents({"user_type": "customer"})
    operator_tickets = await db.support_tickets.count_documents({"user_type": "operator"})
    
    # Category breakdown
    categories = ["booking", "payment", "refund", "technical", "complaint", "inquiry", "operator", "general"]
    category_stats = {}
    for cat in categories:
        category_stats[cat] = await db.support_tickets.count_documents({"category": cat})
    
    # Recent activity - tickets created in last 7 days
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_count = await db.support_tickets.count_documents({"created_at": {"$gte": week_ago}})
    
    # Today's tickets
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_count = await db.support_tickets.count_documents({"created_at": {"$gte": today_start}})
    
    # Get team members with assigned ticket counts
    pipeline = [
        {"$match": {"assigned_to": {"$ne": None}}},
        {"$group": {"_id": "$assigned_to", "name": {"$first": "$assigned_to_name"}, "count": {"$sum": 1}}}
    ]
    team_stats = await db.support_tickets.aggregate(pipeline).to_list(100)
    
    return {
        "total": total,
        "by_status": {
            "open": open_count,
            "pending": pending_count,
            "in_progress": in_progress_count,
            "resolved": resolved_count,
            "closed": closed_count
        },
        "unassigned": unassigned_count,
        "urgent": urgent_count,
        "high_priority": high_count,
        "by_user_type": {
            "customer": customer_tickets,
            "operator": operator_tickets
        },
        "by_category": category_stats,
        "recent_7_days": recent_count,
        "today": today_count,
        "team_workload": team_stats
    }


@router.get("/team-members")
async def get_team_members(
    current_user: dict = Depends(get_current_active_user)
):
    """Get list of team members who can be assigned tickets"""
    db = get_database()
    
    # First, get the support team members from the dedicated collection
    support_team = await db.support_team_members.find({}, {"_id": 0}).to_list(100)
    
    if support_team:
        return {"team_members": support_team}
    
    # Fallback to auto-discovery if no explicit team is set up
    team_members = []
    
    # Get employees
    employees = await db.employees.find(
        {"status": "active"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "position": 1, "department": 1}
    ).to_list(100)
    
    for emp in employees:
        team_members.append({
            "id": emp.get("id", ""),
            "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "email": emp.get("email", ""),
            "role": emp.get("position", "Employee"),
            "department": emp.get("department", "Support"),
            "type": "employee",
            "is_auto": True
        })
    
    # Get admins
    admins = await db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}, "status": "active"},
        {"_id": 1, "full_name": 1, "username": 1, "email": 1, "role": 1}
    ).to_list(100)
    
    for admin in admins:
        team_members.append({
            "id": str(admin.get("_id", "")),
            "name": admin.get("full_name") or admin.get("username", "Admin"),
            "email": admin.get("email", ""),
            "role": admin.get("role", "admin").replace("_", " ").title(),
            "department": "Administration",
            "type": "admin",
            "is_auto": True
        })
    
    return {"team_members": team_members}


@router.get("/available-members")
async def get_available_members(
    current_user: dict = Depends(get_current_active_user)
):
    """Get list of all users/employees who can be added to the support team"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get existing support team member IDs
    existing_team = await db.support_team_members.find({}, {"id": 1}).to_list(100)
    existing_ids = [m.get("id") for m in existing_team]
    
    available = []
    
    # Get all employees
    employees = await db.employees.find(
        {"status": "active"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "position": 1, "department": 1}
    ).to_list(100)
    
    for emp in employees:
        emp_id = emp.get("id", "")
        if emp_id and emp_id not in existing_ids:
            available.append({
                "id": emp_id,
                "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
                "email": emp.get("email", ""),
                "role": emp.get("position", "Employee"),
                "department": emp.get("department", "General"),
                "type": "employee"
            })
    
    # Get all users with appropriate roles
    users = await db.users.find(
        {"role": {"$in": ["admin", "super_admin", "employee", "operator"]}, "status": "active"},
        {"_id": 1, "full_name": 1, "username": 1, "email": 1, "role": 1}
    ).to_list(100)
    
    for user in users:
        user_id = str(user.get("_id", ""))
        if user_id and user_id not in existing_ids:
            available.append({
                "id": user_id,
                "name": user.get("full_name") or user.get("username", "User"),
                "email": user.get("email", ""),
                "role": user.get("role", "user").replace("_", " ").title(),
                "department": "System Users",
                "type": "user"
            })
    
    return {"available_members": available}


@router.get("/operators-by-service")
async def get_operators_by_service(
    service_type: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get operators filtered by service type for support ticket creation"""
    db = get_database()
    
    # Map service types to operator types
    service_operator_map = {
        "Hotels": "hotels",
        "Travel": "travel",
        "Restaurants": "restaurants",
        "Car Rental": "car_rental",
        "Events": "events",
        "Laundry": "pressing",  # Laundry is called pressing in the system
        "Banquet": "banquets",
        "Cinema": "cinema",
        "Packages": "packages"
    }
    
    operator_type = service_operator_map.get(service_type)
    
    query = {"status": "active"}
    if operator_type:
        query["operator_type"] = operator_type
    
    operators = await db.operators.find(query, {"_id": 1, "name": 1, "email": 1, "operator_type": 1}).to_list(1000)
    
    for op in operators:
        op["id"] = str(op.pop("_id", ""))
    
    return {"operators": operators, "service_type": service_type}


class SupportTeamMemberAdd(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: str
    type: str  # employee, admin, user


@router.post("/team-members")
async def add_team_member(
    member: SupportTeamMemberAdd,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a member to the support team"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage support team")
    
    # Check if already exists
    existing = await db.support_team_members.find_one({"id": member.id})
    if existing:
        raise HTTPException(status_code=400, detail="Member already in support team")
    
    team_member = {
        "id": member.id,
        "name": member.name,
        "email": member.email,
        "role": member.role,
        "department": member.department,
        "type": member.type,
        "added_by": str(current_user.get("_id", "")),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_team_members.insert_one(team_member)
    
    # Remove _id from response
    team_member.pop("_id", None)
    
    return {"message": f"{member.name} added to support team", "member": team_member}


@router.delete("/team-members/{member_id}")
async def remove_team_member(
    member_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Remove a member from the support team"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage support team")
    
    result = await db.support_team_members.delete_one({"id": member_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    return {"message": "Team member removed successfully"}


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific ticket by ID"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Check permission - only owner or support staff can view
    if current_user.get("role") not in ["admin", "super_admin", "employee"]:
        if ticket.get("customer_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
    
    ticket["id"] = str(ticket.pop("_id", ""))
    return ticket


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    ticket_data: TicketUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a ticket"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = {k: v for k, v in ticket_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Track status changes
    if ticket_data.status and ticket_data.status != ticket.get("status"):
        if ticket_data.status == "resolved":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
            update_data["resolved_by"] = current_user["_id"]
    
    await db.support_tickets.update_one({"_id": ticket_id}, {"$set": update_data})
    
    return {"message": "Ticket updated successfully"}


@router.post("/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str,
    assignment: TicketAssignment,
    current_user: dict = Depends(get_current_active_user)
):
    """Assign a ticket to a team member"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = {
        "assigned_to": assignment.assignee_id,
        "assigned_to_name": assignment.assignee_name,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "assigned_by": current_user["_id"],
        "status": "in_progress" if ticket.get("status") == "open" else ticket.get("status"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.update_one({"_id": ticket_id}, {"$set": update_data})
    
    # Add internal note about assignment
    if assignment.notes:
        new_message = {
            "id": str(uuid.uuid4()),
            "sender_type": "agent",
            "sender_id": current_user["_id"],
            "sender_name": current_user.get("full_name") or current_user.get("username", "Agent"),
            "message": f"[Assignment Note] {assignment.notes}",
            "is_internal": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.support_tickets.update_one(
            {"_id": ticket_id},
            {"$push": {"messages": new_message}}
        )
    
    # Create notification for assignee
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": assignment.assignee_id,
        "title": f"Ticket Assigned: {ticket.get('ticket_number')}",
        "message": f"You have been assigned ticket: {ticket.get('subject')}",
        "type": "ticket_assignment",
        "reference_id": ticket_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": f"Ticket assigned to {assignment.assignee_name}"}


@router.post("/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    reply: TicketReply,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a reply/message to a ticket"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Determine sender type
    is_agent = current_user.get("role") in ["admin", "super_admin", "employee"]
    sender_type = "agent" if is_agent else "customer"
    
    new_message = {
        "id": str(uuid.uuid4()),
        "sender_type": sender_type,
        "sender_id": current_user["_id"],
        "sender_name": current_user.get("full_name") or current_user.get("username", "User"),
        "message": reply.message,
        "is_internal": reply.is_internal if is_agent else False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_response_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Track first response time for agents
    if is_agent and not ticket.get("first_response_at") and not reply.is_internal:
        update_data["first_response_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {
            "$push": {"messages": new_message},
            "$set": update_data,
            "$inc": {"response_count": 1}
        }
    )
    
    # Create notification for the other party
    if is_agent and not reply.is_internal:
        # Notify customer
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": ticket.get("customer_id"),
            "title": f"New Reply: {ticket.get('ticket_number')}",
            "message": f"Support has replied to your ticket: {ticket.get('subject')}",
            "type": "ticket_reply",
            "reference_id": ticket_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    elif not is_agent:
        # Notify assigned agent or support team
        notify_user = ticket.get("assigned_to") or "support_team"
        notification = {
            "_id": str(uuid.uuid4()),
            "user_id": notify_user,
            "title": f"Customer Reply: {ticket.get('ticket_number')}",
            "message": f"{ticket.get('customer_name')} replied to ticket: {ticket.get('subject')}",
            "type": "ticket_reply",
            "reference_id": ticket_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {"message": "Reply added successfully", "reply": new_message}


@router.post("/bulk-action")
async def bulk_action(
    action_data: TicketBulkAction,
    current_user: dict = Depends(get_current_active_user)
):
    """Perform bulk actions on multiple tickets"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin", "employee"]:
        raise HTTPException(status_code=403, detail="Not authorized for bulk actions")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if action_data.action == "assign":
        if not action_data.assignee_id:
            raise HTTPException(status_code=400, detail="Assignee ID required for assign action")
        update_data["assigned_to"] = action_data.assignee_id
        update_data["assigned_to_name"] = action_data.assignee_name
        update_data["assigned_at"] = datetime.now(timezone.utc).isoformat()
        update_data["assigned_by"] = current_user["_id"]
    elif action_data.action == "update_status":
        if not action_data.value:
            raise HTTPException(status_code=400, detail="Value required for status update")
        update_data["status"] = action_data.value
        if action_data.value == "resolved":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
            update_data["resolved_by"] = current_user["_id"]
    elif action_data.action == "update_priority":
        if not action_data.value:
            raise HTTPException(status_code=400, detail="Value required for priority update")
        update_data["priority"] = action_data.value
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    result = await db.support_tickets.update_many(
        {"_id": {"$in": action_data.ticket_ids}},
        {"$set": update_data}
    )
    
    return {"message": f"Updated {result.modified_count} tickets"}


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a ticket (admin only)"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete tickets")
    
    result = await db.support_tickets.delete_one({"_id": ticket_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": "Ticket deleted successfully"}


# ==================== TEAM MANAGEMENT ENDPOINTS ====================

@router.get("/team/members")
async def get_team_members(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all current support team members"""
    if current_user.get("role") not in ["admin", "super_admin", "employee"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db = get_database()
    
    # Get team members from support_team collection
    team = await db.support_team.find({}).to_list(100)
    
    # Enrich with user details
    members = []
    for t in team:
        user = await db.users.find_one({"_id": t.get("user_id")}, {"password_hash": 0})
        if user:
            members.append({
                "id": t.get("_id") or t.get("user_id"),
                "user_id": t.get("user_id"),
                "name": user.get("full_name", "Unknown"),
                "email": user.get("email", ""),
                "role": user.get("role", "employee"),
                "department": t.get("department", "General"),
                "status": t.get("status", "active"),
                "joined_at": t.get("joined_at")
            })
    
    return {"members": members}


@router.get("/team/available")
async def get_available_team_members(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get users who can be added to the support team (not already members)"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get current team member user IDs
    team = await db.support_team.find({}, {"user_id": 1}).to_list(500)
    existing_member_ids = [t.get("user_id") for t in team]
    
    # Find eligible users not in team (admins, employees)
    query = {
        "_id": {"$nin": existing_member_ids},
        "role": {"$in": ["admin", "super_admin", "employee"]},
        "status": "active"
    }
    
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"password_hash": 0}).limit(50).to_list(50)
    
    available = []
    for user in users:
        available.append({
            "id": user.get("_id"),
            "name": user.get("full_name", "Unknown"),
            "email": user.get("email", ""),
            "role": user.get("role", "employee"),
            "department": user.get("department", "General"),
            "is_existing_member": False
        })
    
    return {"available": available, "existing_member_ids": existing_member_ids}


@router.post("/team/add")
async def add_team_member(
    member_data: dict,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a user to the support team"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    user_id = member_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Check if already a team member
    existing = await db.support_team.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    # Verify user exists
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to team
    team_member = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "department": member_data.get("department", "General"),
        "status": "active",
        "added_by": current_user["_id"],
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_team.insert_one(team_member)
    
    return {
        "message": f"{user.get('full_name', 'User')} added to support team",
        "member": {
            "id": team_member["_id"],
            "user_id": user_id,
            "name": user.get("full_name", "Unknown"),
            "email": user.get("email", ""),
            "department": team_member["department"]
        }
    }


@router.delete("/team/{member_id}")
async def remove_team_member(
    member_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Remove a user from the support team"""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Try to find by _id or user_id
    result = await db.support_team.delete_one({"$or": [{"_id": member_id}, {"user_id": member_id}]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    return {"message": "Team member removed successfully"}

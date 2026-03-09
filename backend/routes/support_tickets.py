from fastapi import APIRouter, HTTPException, status as http_status, Depends, Query, UploadFile, File, Form
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
    category: str = "general"
    priority: str = "medium"
    source: str = "web"
    related_order_id: Optional[str] = None
    related_service_type: Optional[str] = None
    service_tag: Optional[str] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    product_involved: Optional[str] = None
    product_id: Optional[str] = None
    tags: Optional[List[str]] = None

class TicketCreateOnBehalf(BaseModel):
    subject: str
    description: str
    category: str = "general"
    priority: str = "medium"
    source: str = "admin"
    on_behalf_of_id: str
    on_behalf_of_type: str = "customer"  # customer or operator
    product_involved: Optional[str] = None
    product_id: Optional[str] = None
    service_tag: Optional[str] = None
    tags: Optional[List[str]] = None

class TicketFromChat(BaseModel):
    session_id: str
    subject: str
    category: str = "general"
    product_involved: Optional[str] = None
    service_tag: Optional[str] = None

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

# ==================== HELPERS ====================

def generate_tags(category: str, service_tag: str = None, product: str = None) -> list:
    """Auto-generate tags based on category and service"""
    tags = []
    if category:
        tags.append(category)
    if service_tag:
        tags.append(service_tag.lower().replace(" ", "-"))
    if product:
        tags.append(f"product:{product[:30]}")
    return tags

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
    
    # Auto-generate tags
    tags = ticket_data.tags or generate_tags(ticket_data.category, ticket_data.service_tag, ticket_data.product_involved)
    # Add waiting-for-admin tag on creation (user/operator created this ticket)
    if "waiting-for-admin" not in tags:
        tags.append("waiting-for-admin")
    
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
        # Product and service info
        "product_involved": ticket_data.product_involved,
        "product_id": ticket_data.product_id,
        "service_tag": ticket_data.service_tag,
        "operator_id": ticket_data.operator_id,
        "operator_name": ticket_data.operator_name,
        "tags": tags,
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
        }, {
            "id": str(uuid.uuid4()),
            "sender_type": "system",
            "sender_id": "system",
            "sender_name": "System",
            "message": "Waiting for admin response",
            "is_internal": False,
            "is_system": True,
            "tag": "Waiting for Admin Response",
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


@router.post("/create-on-behalf")
async def create_ticket_on_behalf(
    ticket_data: TicketCreateOnBehalf,
    current_user: dict = Depends(get_current_active_user)
):
    """Admin/SuperAdmin creates a ticket on behalf of a customer or operator"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can create tickets on behalf of users")
    
    # Find the target user - check users collection first, then operators, then employees
    target_user = await db.users.find_one({"_id": ticket_data.on_behalf_of_id})
    target_name = None
    target_email = ""
    target_phone = ""
    
    if target_user:
        target_name = target_user.get("full_name") or target_user.get("username", "Unknown")
        target_email = target_user.get("email", "")
        target_phone = target_user.get("phone", "")
    else:
        # Check operators collection
        target_op = await db.operators.find_one({"_id": ticket_data.on_behalf_of_id})
        if target_op:
            target_name = target_op.get("name", "Unknown Operator")
            target_email = target_op.get("email", "")
            target_phone = target_op.get("phone", "")
        else:
            # Check employees collection
            target_emp = await db.employees.find_one({"id": ticket_data.on_behalf_of_id})
            if target_emp:
                target_name = f"{target_emp.get('first_name', '')} {target_emp.get('last_name', '')}".strip()
                target_email = target_emp.get("email", "")
                target_phone = target_emp.get("phone", "")
            else:
                raise HTTPException(status_code=404, detail="Target user not found")
    
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.support_tickets.count_documents({})
    ticket_number = f"TKT-{today}-{str(count + 1).zfill(5)}"
    
    tags = ticket_data.tags or generate_tags(ticket_data.category, ticket_data.service_tag, ticket_data.product_involved)
    
    ticket = {
        "_id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "subject": ticket_data.subject,
        "description": ticket_data.description,
        "category": ticket_data.category,
        "priority": ticket_data.priority,
        "status": "open",
        "source": "admin",
        "user_type": ticket_data.on_behalf_of_type,
        "customer_id": ticket_data.on_behalf_of_id,
        "customer_name": target_name,
        "customer_email": target_email,
        "customer_phone": target_phone,
        "product_involved": ticket_data.product_involved,
        "product_id": ticket_data.product_id,
        "service_tag": ticket_data.service_tag,
        "tags": tags,
        "created_by_admin": current_user["_id"],
        "created_by_admin_name": current_user.get("full_name") or current_user.get("username", "Admin"),
        "related_order_id": None,
        "related_service_type": None,
        "operator_id": None,
        "operator_name": None,
        "assigned_to": None,
        "assigned_to_name": None,
        "assigned_at": None,
        "assigned_by": None,
        "internal_notes": "",
        "resolution": None,
        "resolved_at": None,
        "resolved_by": None,
        "first_response_at": None,
        "last_response_at": None,
        "response_count": 0,
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_type": "agent",
            "sender_id": current_user["_id"],
            "sender_name": current_user.get("full_name") or "Admin",
            "message": ticket_data.description,
            "is_internal": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }, {
            "id": str(uuid.uuid4()),
            "sender_type": "system",
            "sender_id": "system",
            "sender_name": "System",
            "message": "Waiting for user response",
            "is_internal": False,
            "is_system": True,
            "tag": "Waiting for User Response",
            "created_at": datetime.now(timezone.utc).isoformat()
        }],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    ticket["id"] = ticket.pop("_id")
    return {"message": "Ticket created on behalf of user", "ticket": ticket}


@router.post("/from-chat")
async def create_ticket_from_chat(
    data: TicketFromChat,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a support ticket from an AI chat session, attaching the conversation context"""
    db = get_database()
    
    # Get the chat session
    session = await db.chat_sessions.find_one({"_id": data.session_id, "user_id": current_user["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Build description from chat context
    chat_messages = session.get("messages", [])
    context_lines = []
    for msg in chat_messages:
        role = "Customer" if msg["role"] == "user" else "AI Assistant"
        context_lines.append(f"[{role}]: {msg['content']}")
    
    chat_context = "\n".join(context_lines)
    description = f"--- Conversation Context ---\n{chat_context}\n--- End of Conversation ---"
    
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.support_tickets.count_documents({})
    ticket_number = f"TKT-{today}-{str(count + 1).zfill(5)}"
    
    user_type = "operator" if current_user.get("role") == "operator" else "customer"
    tags = generate_tags(data.category, data.service_tag, data.product_involved)
    tags.append("from-chat")
    
    ticket = {
        "_id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "subject": data.subject,
        "description": description,
        "category": data.category,
        "priority": "medium",
        "status": "open",
        "source": "chat",
        "user_type": user_type,
        "customer_id": current_user["_id"],
        "customer_name": current_user.get("full_name") or current_user.get("username", "Unknown"),
        "customer_email": current_user.get("email", ""),
        "customer_phone": current_user.get("phone", ""),
        "product_involved": data.product_involved,
        "product_id": None,
        "service_tag": data.service_tag,
        "tags": tags,
        "chat_session_id": data.session_id,
        "related_order_id": None,
        "related_service_type": None,
        "operator_id": None,
        "operator_name": None,
        "assigned_to": None,
        "assigned_to_name": None,
        "assigned_at": None,
        "assigned_by": None,
        "internal_notes": "",
        "resolution": None,
        "resolved_at": None,
        "resolved_by": None,
        "first_response_at": None,
        "last_response_at": None,
        "response_count": 0,
        "messages": [{
            "id": str(uuid.uuid4()),
            "sender_type": "customer",
            "sender_id": current_user["_id"],
            "sender_name": current_user.get("full_name") or "Customer",
            "message": f"[Escalated from AI Chat]\n\n{data.subject}",
            "is_internal": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }, {
            "id": str(uuid.uuid4()),
            "sender_type": "system",
            "sender_id": "system",
            "sender_name": "System",
            "message": "Waiting for admin response",
            "is_internal": False,
            "is_system": True,
            "tag": "Waiting for Admin Response",
            "created_at": datetime.now(timezone.utc).isoformat()
        }],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket)
    
    # Mark chat session as escalated
    await db.chat_sessions.update_one(
        {"_id": data.session_id},
        {"$set": {"escalated": True, "ticket_id": ticket["_id"]}}
    )
    
    ticket["id"] = ticket.pop("_id")
    return {"message": "Ticket created from chat", "ticket": ticket}


@router.get("/products")
async def get_products_for_tickets(
    current_user: dict = Depends(get_current_active_user)
):
    """Get available products/services for the product_involved field in ticket creation"""
    db = get_database()
    
    products = []
    
    # Service categories (static list)
    service_categories = [
        {"value": "Hotels", "label": "Hotels"},
        {"value": "Travel", "label": "Travel / Transport"},
        {"value": "Restaurants", "label": "Restaurants"},
        {"value": "Car Rental", "label": "Car Rental"},
        {"value": "Events", "label": "Events"},
        {"value": "Cinema", "label": "Cinema"},
        {"value": "Banquet", "label": "Banquet Halls"},
        {"value": "Laundry", "label": "Laundry / Pressing"},
        {"value": "Packages", "label": "Package Delivery"},
    ]
    
    # Get actual service names from each collection
    for cat in service_categories:
        collection_map = {
            "Hotels": "hotels",
            "Restaurants": "restaurants",
            "Car Rental": "car_rentals",
            "Events": "events",
            "Cinema": "cinemas",
        }
        col_name = collection_map.get(cat["value"])
        if col_name:
            items = await db[col_name].find(
                {},
                {"_id": 1, "name": 1}
            ).limit(50).to_list(50)
            for item in items:
                products.append({
                    "id": str(item.get("_id", "")),
                    "name": item.get("name", "Unknown"),
                    "category": cat["value"]
                })
    
    return {"categories": service_categories, "products": products}


@router.get("/users-for-behalf")
async def get_users_for_behalf(
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get customers and operators that admins can create tickets on behalf of"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"status": "active"}
    
    if user_type == "customer":
        query["role"] = "customer"
    elif user_type == "operator":
        query["role"] = "operator"
    else:
        query["role"] = {"$in": ["customer", "operator"]}
    
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 1, "full_name": 1, "username": 1, "email": 1, "role": 1}).limit(50).to_list(50)
    
    result = []
    for u in users:
        result.append({
            "id": str(u["_id"]),
            "name": u.get("full_name") or u.get("username", "Unknown"),
            "email": u.get("email", ""),
            "role": u.get("role", "customer")
        })
    
    return {"users": result}


@router.get("/operators-search")
async def search_operators_for_behalf(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Search operators from the operators collection for creating tickets on behalf"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"status": "active"}
    if search and len(search) >= 3:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    elif not search or len(search) < 3:
        return {"operators": []}
    
    operators = await db.operators.find(query, {"_id": 1, "name": 1, "email": 1, "operator_type": 1}).limit(10).to_list(10)
    
    result = []
    for op in operators:
        result.append({
            "id": str(op.get("_id", "")),
            "name": op.get("name", "Unknown"),
            "email": op.get("email", ""),
            "operator_type": op.get("operator_type", "")
        })
    
    return {"operators": result}


@router.get("/operator-users/{operator_id}")
async def get_operator_users(
    operator_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get employees/users of a specific operator"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find(
        {"operator_id": operator_id, "status": "active"},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "position": 1}
    ).to_list(50)
    
    result = []
    for emp in employees:
        result.append({
            "id": emp.get("id", ""),
            "name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
            "email": emp.get("email", ""),
            "position": emp.get("position", "")
        })
    
    return {"users": result, "operator_id": operator_id}


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


@router.get("/stats/detailed")
async def get_detailed_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed ticket statistics with team workload breakdown"""
    db = get_database()
    
    if current_user.get("role") not in ["admin", "super_admin", "employee"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Team workload with status breakdown
    team_pipeline = [
        {"$match": {"assigned_to": {"$ne": None}}},
        {"$group": {
            "_id": {"assignee": "$assigned_to", "status": "$status"},
            "name": {"$first": "$assigned_to_name"},
            "count": {"$sum": 1}
        }}
    ]
    team_raw = await db.support_tickets.aggregate(team_pipeline).to_list(500)
    
    # Build team workload structure
    team_map = {}
    for item in team_raw:
        assignee = item["_id"]["assignee"]
        status = item["_id"]["status"]
        if assignee not in team_map:
            team_map[assignee] = {"id": assignee, "name": item.get("name", "Unknown"), "open": 0, "in_progress": 0, "resolved": 0, "total": 0}
        team_map[assignee]["total"] += item["count"]
        if status in ("open", "pending"):
            team_map[assignee]["open"] += item["count"]
        elif status == "in_progress":
            team_map[assignee]["in_progress"] += item["count"]
        elif status in ("resolved", "closed"):
            team_map[assignee]["resolved"] += item["count"]
    
    # Customer tickets breakdown by category
    cust_pipeline = [
        {"$match": {"user_type": "customer"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1},
                    "open": {"$sum": {"$cond": [{"$in": ["$status", ["open", "pending"]]}, 1, 0]}},
                    "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["resolved", "closed"]]}, 1, 0]}}
        }}
    ]
    customer_by_cat = await db.support_tickets.aggregate(cust_pipeline).to_list(50)
    
    # Operator tickets breakdown by category
    op_pipeline = [
        {"$match": {"user_type": "operator"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1},
                    "open": {"$sum": {"$cond": [{"$in": ["$status", ["open", "pending"]]}, 1, 0]}},
                    "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["resolved", "closed"]]}, 1, 0]}}
        }}
    ]
    operator_by_cat = await db.support_tickets.aggregate(op_pipeline).to_list(50)
    
    # Priority breakdown with status
    priority_pipeline = [
        {"$group": {"_id": "$priority", "count": {"$sum": 1},
                    "open": {"$sum": {"$cond": [{"$in": ["$status", ["open", "pending"]]}, 1, 0]}},
                    "in_progress": {"$sum": {"$cond": [{"$eq": ["$status", "in_progress"]}, 1, 0]}},
                    "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["resolved", "closed"]]}, 1, 0]}}
        }}
    ]
    by_priority = await db.support_tickets.aggregate(priority_pipeline).to_list(10)
    
    total = await db.support_tickets.count_documents({})
    customer_total = await db.support_tickets.count_documents({"user_type": "customer"})
    operator_total = await db.support_tickets.count_documents({"user_type": "operator"})
    
    return {
        "total": total,
        "customer_total": customer_total,
        "operator_total": operator_total,
        "team_workload": list(team_map.values()),
        "customer_by_category": [{"category": c["_id"], "count": c["count"], "open": c["open"], "resolved": c["resolved"]} for c in customer_by_cat],
        "operator_by_category": [{"category": c["_id"], "count": c["count"], "open": c["open"], "resolved": c["resolved"]} for c in operator_by_cat],
        "by_priority": [{"priority": p["_id"], "count": p["count"], "open": p["open"], "in_progress": p["in_progress"], "resolved": p["resolved"]} for p in by_priority]
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
    
    # Get existing support team member IDs from the dedicated collection
    existing_team = await db.support_team_members.find({}, {"id": 1}).to_list(100)
    existing_ids = set(m.get("id") for m in existing_team if m.get("id"))
    
    # If no explicit team exists, also get auto-discovered team member IDs
    # This mirrors the logic in get_team_members for consistency
    if not existing_team:
        # Get employee IDs
        employees = await db.employees.find(
            {"status": "active"},
            {"id": 1}
        ).to_list(100)
        for emp in employees:
            if emp.get("id"):
                existing_ids.add(emp.get("id"))
        
        # Get admin user IDs
        admins = await db.users.find(
            {"role": {"$in": ["admin", "super_admin"]}, "status": "active"},
            {"_id": 1}
        ).to_list(100)
        for admin in admins:
            if admin.get("_id"):
                existing_ids.add(str(admin.get("_id")))
    
    available = []
    
    # Get all employees who are NOT already in the team
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
    
    # Get all users with appropriate roles who are NOT already in the team
    # Only include operators (admins are auto-added to team)
    users = await db.users.find(
        {"role": {"$in": ["operator"]}, "status": "active"},
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
    
    system_messages = []
    
    # Track status changes with auto-tags
    if ticket_data.status and ticket_data.status != ticket.get("status"):
        current_tags = ticket.get("tags", [])
        # Remove old status tags
        new_tags = [t for t in current_tags if t not in ("resolved", "closed", "re-opened")]
        
        if ticket_data.status == "resolved":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
            update_data["resolved_by"] = current_user["_id"]
            if "resolved" not in new_tags:
                new_tags.append("resolved")
            # Remove waiting tags
            new_tags = [t for t in new_tags if t not in ("waiting-for-admin", "waiting-for-user")]
            system_messages.append({
                "id": str(uuid.uuid4()),
                "sender_type": "system",
                "sender_id": "system",
                "sender_name": "System",
                "message": f"Ticket marked as resolved by {current_user.get('full_name', 'Admin')}",
                "is_internal": False,
                "is_system": True,
                "tag": "Resolved",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        elif ticket_data.status == "closed":
            if "closed" not in new_tags:
                new_tags.append("closed")
            new_tags = [t for t in new_tags if t not in ("waiting-for-admin", "waiting-for-user")]
            system_messages.append({
                "id": str(uuid.uuid4()),
                "sender_type": "system",
                "sender_id": "system",
                "sender_name": "System",
                "message": f"Ticket closed by {current_user.get('full_name', 'Admin')}",
                "is_internal": False,
                "is_system": True,
                "tag": "Closed",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        update_data["tags"] = new_tags
    
    update_ops = {"$set": update_data}
    if system_messages:
        update_ops["$push"] = {"messages": {"$each": system_messages}}
    
    await db.support_tickets.update_one({"_id": ticket_id}, update_ops)
    
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
    
    # === AUTO-TAG LOGIC ===
    current_status = ticket.get("status", "open")
    messages_to_push = [new_message]
    tags_to_add = []
    tags_to_remove = []
    
    # Auto re-open if resolved/closed and someone replies
    if current_status in ("resolved", "closed") and not reply.is_internal:
        update_data["status"] = "open"
        update_data["resolved_at"] = None
        update_data["resolved_by"] = None
        tags_to_add.append("re-opened")
        # Add system message about re-opening
        messages_to_push.append({
            "id": str(uuid.uuid4()),
            "sender_type": "system",
            "sender_id": "system",
            "sender_name": "System",
            "message": f"Ticket re-opened by {current_user.get('full_name', 'user')}",
            "is_internal": False,
            "is_system": True,
            "tag": "Re-Opened",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Waiting tag logic (only for non-internal replies)
    if not reply.is_internal:
        if is_agent:
            # Admin replied → waiting for user
            tags_to_remove.extend(["waiting-for-admin", "re-opened"])
            tags_to_add.append("waiting-for-user")
            messages_to_push.append({
                "id": str(uuid.uuid4()),
                "sender_type": "system",
                "sender_id": "system",
                "sender_name": "System",
                "message": "Waiting for user response",
                "is_internal": False,
                "is_system": True,
                "tag": "Waiting for User Response",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            # User replied → waiting for admin
            tags_to_remove.extend(["waiting-for-user", "re-opened"])
            tags_to_add.append("waiting-for-admin")
            messages_to_push.append({
                "id": str(uuid.uuid4()),
                "sender_type": "system",
                "sender_id": "system",
                "sender_name": "System",
                "message": "Waiting for admin response",
                "is_internal": False,
                "is_system": True,
                "tag": "Waiting for Admin Response",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Update tags
    current_tags = ticket.get("tags", [])
    new_tags = [t for t in current_tags if t not in tags_to_remove]
    for t in tags_to_add:
        if t not in new_tags:
            new_tags.append(t)
    update_data["tags"] = new_tags
    
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {
            "$push": {"messages": {"$each": messages_to_push}},
            "$set": update_data,
            "$inc": {"response_count": 1}
        }
    )
    
    # Create notification for the other party
    if is_agent and not reply.is_internal:
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


@router.post("/{ticket_id}/reply-with-attachments")
async def reply_with_attachments(
    ticket_id: str,
    message: str = Form(""),
    is_internal: bool = Form(False),
    files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_active_user)
):
    """Add a reply with image attachments (JPEG/PNG only)"""
    from services.local_storage_service import LocalStorageService
    storage = LocalStorageService()
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Validate and upload files
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}
    attachments = []
    for f in files:
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"Only JPEG and PNG images allowed. Got: {f.content_type}")
        file_data = await f.read()
        if len(file_data) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        result = await storage.upload_file(file_data=file_data, filename=f.filename, content_type=f.content_type, folder="ticket-attachments")
        if result["success"]:
            attachments.append({"url": result["file_url"], "name": result["filename"], "type": f.content_type})
    
    if not message.strip() and not attachments:
        raise HTTPException(status_code=400, detail="Provide a message or at least one image")
    
    is_agent = current_user.get("role") in ["admin", "super_admin", "employee"]
    sender_type = "agent" if is_agent else "customer"
    
    new_message = {
        "id": str(uuid.uuid4()),
        "sender_type": sender_type,
        "sender_id": current_user["_id"],
        "sender_name": current_user.get("full_name") or current_user.get("username", "User"),
        "message": message.strip() if message.strip() else f"[{len(attachments)} image(s) attached]",
        "is_internal": is_internal if is_agent else False,
        "attachments": attachments,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_response_at": datetime.now(timezone.utc).isoformat()
    }
    
    if is_agent and not ticket.get("first_response_at") and not is_internal:
        update_data["first_response_at"] = datetime.now(timezone.utc).isoformat()
    
    # Auto-tag and re-open logic (same as regular reply)
    current_status = ticket.get("status", "open")
    messages_to_push = [new_message]
    tags_to_add = []
    tags_to_remove = []
    
    if current_status in ("resolved", "closed") and not is_internal:
        update_data["status"] = "open"
        update_data["resolved_at"] = None
        update_data["resolved_by"] = None
        tags_to_add.append("re-opened")
        messages_to_push.append({
            "id": str(uuid.uuid4()), "sender_type": "system", "sender_id": "system",
            "sender_name": "System", "message": f"Ticket re-opened by {current_user.get('full_name', 'user')}",
            "is_internal": False, "is_system": True, "tag": "Re-Opened",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if not is_internal:
        if is_agent:
            tags_to_remove.extend(["waiting-for-admin", "re-opened"])
            tags_to_add.append("waiting-for-user")
            messages_to_push.append({
                "id": str(uuid.uuid4()), "sender_type": "system", "sender_id": "system",
                "sender_name": "System", "message": "Waiting for user response",
                "is_internal": False, "is_system": True, "tag": "Waiting for User Response",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            tags_to_remove.extend(["waiting-for-user", "re-opened"])
            tags_to_add.append("waiting-for-admin")
            messages_to_push.append({
                "id": str(uuid.uuid4()), "sender_type": "system", "sender_id": "system",
                "sender_name": "System", "message": "Waiting for admin response",
                "is_internal": False, "is_system": True, "tag": "Waiting for Admin Response",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    current_tags = ticket.get("tags", [])
    new_tags = [t for t in current_tags if t not in tags_to_remove]
    for t in tags_to_add:
        if t not in new_tags:
            new_tags.append(t)
    update_data["tags"] = new_tags
    
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$push": {"messages": {"$each": messages_to_push}}, "$set": update_data, "$inc": {"response_count": 1}}
    )
    
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

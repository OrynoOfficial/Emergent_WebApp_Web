"""
Pod Routes - Pod Management for Internal Team Structure
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.pod import (
    PodCreate, PodUpdate, PodMemberAdd, PodOperatorAssign, PodRole
)
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/pods", tags=["Pods"])


# ============== Pod CRUD ==============

@router.get("")
async def list_pods(
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("pods.view"))
):
    """List all pods"""
    db = get_database()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    
    pods = await db.pods.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.pods.count_documents(query)
    
    # Enrich with member counts
    for pod in pods:
        pod["total_members"] = await db.pod_memberships.count_documents({
            "pod_id": pod["id"],
            "is_active": True
        })
    
    return {"pods": pods, "total": total, "skip": skip, "limit": limit}


@router.get("/{pod_id}")
async def get_pod(
    pod_id: str,
    current_user: dict = Depends(require_permission("pods.view"))
):
    """Get pod details with members and assigned operators"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id}, {"_id": 0})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    # Get members
    members = await db.pod_memberships.find(
        {"pod_id": pod_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get assigned operators summary
    if pod.get("assigned_operator_ids"):
        operators = await db.operators.find(
            {"_id": {"$in": pod["assigned_operator_ids"]}},
            {"_id": 1, "name": 1, "operator_type": 1, "status": 1}
        ).to_list(1000)
        pod["assigned_operators"] = [
            {"id": op["_id"], "name": op.get("name"), "type": op.get("operator_type"), "status": op.get("status")}
            for op in operators
        ]
    else:
        pod["assigned_operators"] = []
    
    pod["members"] = members
    
    return pod


@router.post("")
async def create_pod(
    data: PodCreate,
    current_user: dict = Depends(require_permission("pods.create"))
):
    """Create a new pod"""
    db = get_database()
    
    # Check for duplicate name
    existing = await db.pods.find_one({"name": data.name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Pod with this name already exists")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    pod = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "team_lead_id": None,
        "team_lead_name": None,
        "member_ids": [],
        "assigned_operator_ids": [],
        "total_operators": 0,
        "total_members": 0,
        "is_active": True,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If team lead specified, validate and assign
    if data.team_lead_id:
        team_lead = await db.users.find_one({"_id": data.team_lead_id})
        if not team_lead:
            raise HTTPException(status_code=400, detail="Team lead user not found")
        
        # Check team lead isn't in another pod
        existing_membership = await db.pod_memberships.find_one({
            "user_id": data.team_lead_id,
            "is_active": True
        })
        if existing_membership:
            raise HTTPException(status_code=400, detail="Team lead is already in another pod")
        
        pod["team_lead_id"] = data.team_lead_id
        pod["team_lead_name"] = team_lead.get("full_name") or team_lead.get("email")
    
    await db.pods.insert_one(pod)
    
    # Create team lead membership if specified
    if data.team_lead_id:
        membership = {
            "id": str(uuid.uuid4()),
            "pod_id": pod["id"],
            "pod_name": pod["name"],
            "user_id": data.team_lead_id,
            "user_name": pod["team_lead_name"],
            "user_email": team_lead.get("email", ""),
            "pod_role": "team_lead",
            "is_active": True,
            "assigned_by": user_id,
            "assigned_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pod_memberships.insert_one(membership)
        
        await db.pods.update_one(
            {"id": pod["id"]},
            {"$push": {"member_ids": data.team_lead_id}, "$set": {"total_members": 1}}
        )
    
    return {
        "message": "Pod created",
        "pod_id": pod["id"],
        "pod": {k: v for k, v in pod.items() if k != "_id"}
    }


@router.put("/{pod_id}")
async def update_pod(
    pod_id: str,
    data: PodUpdate,
    current_user: dict = Depends(require_permission("pods.edit"))
):
    """Update pod details"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Handle team lead change
    if "team_lead_id" in update_data and update_data["team_lead_id"] != pod.get("team_lead_id"):
        new_lead_id = update_data["team_lead_id"]
        
        if new_lead_id:
            # Verify new lead exists
            new_lead = await db.users.find_one({"_id": new_lead_id})
            if not new_lead:
                raise HTTPException(status_code=400, detail="New team lead not found")
            
            # Check not in another pod
            existing = await db.pod_memberships.find_one({
                "user_id": new_lead_id,
                "is_active": True,
                "pod_id": {"$ne": pod_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail="New team lead is in another pod")
            
            update_data["team_lead_name"] = new_lead.get("full_name") or new_lead.get("email")
        else:
            update_data["team_lead_name"] = None
    
    await db.pods.update_one({"id": pod_id}, {"$set": update_data})
    
    return {"message": "Pod updated"}


@router.delete("/{pod_id}")
async def delete_pod(
    pod_id: str,
    current_user: dict = Depends(require_permission("pods.delete"))
):
    """Soft delete a pod"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    # Check for active members
    active_members = await db.pod_memberships.count_documents({"pod_id": pod_id, "is_active": True})
    if active_members > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete pod with {active_members} active members")
    
    await db.pods.update_one(
        {"id": pod_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Pod deactivated"}


# ============== Pod Members ==============

@router.get("/{pod_id}/members")
async def get_pod_members(
    pod_id: str,
    current_user: dict = Depends(require_permission("pods.view"))
):
    """Get all members of a pod"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    members = await db.pod_memberships.find(
        {"pod_id": pod_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"pod_id": pod_id, "pod_name": pod["name"], "members": members, "total": len(members)}


@router.post("/{pod_id}/members")
async def add_pod_member(
    pod_id: str,
    data: PodMemberAdd,
    current_user: dict = Depends(require_permission("pods.manage_members"))
):
    """Add a member to a pod (one employee = one pod rule enforced)"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    # Verify user exists and is a platform employee (admin role)
    user = await db.users.find_one({"_id": data.user_id})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    if user.get("role") not in ["admin", "super_admin", "employee"]:
        raise HTTPException(status_code=400, detail="Only platform employees can be added to pods")
    
    # Check one employee = one pod rule
    existing_membership = await db.pod_memberships.find_one({
        "user_id": data.user_id,
        "is_active": True
    })
    if existing_membership:
        raise HTTPException(
            status_code=400,
            detail=f"User is already a member of pod '{existing_membership['pod_name']}'. Remove them first."
        )
    
    # Enforce one team lead per pod
    if data.pod_role == PodRole.TEAM_LEAD:
        if pod.get("team_lead_id"):
            raise HTTPException(status_code=400, detail="Pod already has a team lead")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    membership = {
        "id": str(uuid.uuid4()),
        "pod_id": pod_id,
        "pod_name": pod["name"],
        "user_id": data.user_id,
        "user_name": user.get("full_name") or user.get("email"),
        "user_email": user.get("email", ""),
        "pod_role": data.pod_role.value,
        "is_active": True,
        "assigned_by": user_id,
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pod_memberships.insert_one(membership)
    
    # Update pod
    update_ops = {
        "$push": {"member_ids": data.user_id},
        "$inc": {"total_members": 1},
        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
    }
    
    if data.pod_role == PodRole.TEAM_LEAD:
        update_ops["$set"]["team_lead_id"] = data.user_id
        update_ops["$set"]["team_lead_name"] = membership["user_name"]
    
    await db.pods.update_one({"id": pod_id}, update_ops)
    
    return {
        "message": "Member added to pod",
        "membership_id": membership["id"],
        "membership": {k: v for k, v in membership.items() if k != "_id"}
    }


@router.delete("/{pod_id}/members/{user_id}")
async def remove_pod_member(
    pod_id: str,
    user_id: str,
    current_user: dict = Depends(require_permission("pods.manage_members"))
):
    """Remove a member from a pod"""
    db = get_database()
    
    membership = await db.pod_memberships.find_one({
        "pod_id": pod_id,
        "user_id": user_id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    remover_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Deactivate membership
    await db.pod_memberships.update_one(
        {"id": membership["id"]},
        {"$set": {
            "is_active": False,
            "removed_at": datetime.now(timezone.utc).isoformat(),
            "removed_by": remover_id
        }}
    )
    
    # Update pod
    update_ops = {
        "$pull": {"member_ids": user_id},
        "$inc": {"total_members": -1},
        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
    }
    
    # If removing team lead, clear team lead fields
    if membership.get("pod_role") == "team_lead":
        update_ops["$set"]["team_lead_id"] = None
        update_ops["$set"]["team_lead_name"] = None
    
    await db.pods.update_one({"id": pod_id}, update_ops)
    
    return {"message": "Member removed from pod"}


# ============== Pod Operators ==============

@router.get("/{pod_id}/operators")
async def get_pod_operators(
    pod_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_permission("pods.view"))
):
    """Get operators assigned to a pod"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    operator_ids = pod.get("assigned_operator_ids", [])
    
    if not operator_ids:
        return {"pod_id": pod_id, "operators": [], "total": 0}
    
    operators = await db.operators.find(
        {"_id": {"$in": operator_ids}},
        {"password_hash": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Convert _id to id
    for op in operators:
        op["id"] = op.pop("_id")
    
    return {
        "pod_id": pod_id,
        "pod_name": pod["name"],
        "operators": operators,
        "total": len(operator_ids)
    }


@router.post("/{pod_id}/operators")
async def assign_operators_to_pod(
    pod_id: str,
    data: PodOperatorAssign,
    current_user: dict = Depends(require_permission("pods.manage_operators"))
):
    """Assign operators to a pod"""
    db = get_database()
    
    pod = await db.pods.find_one({"id": pod_id})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    
    # Verify operators exist
    valid_operators = await db.operators.find(
        {"_id": {"$in": data.operator_ids}},
        {"_id": 1}
    ).to_list(10000)
    valid_ids = [op["_id"] for op in valid_operators]
    
    if len(valid_ids) != len(data.operator_ids):
        invalid = set(data.operator_ids) - set(valid_ids)
        raise HTTPException(status_code=400, detail=f"Invalid operator IDs: {invalid}")
    
    # Check if operators are already in other pods
    other_pods = await db.pods.find({
        "id": {"$ne": pod_id},
        "assigned_operator_ids": {"$in": data.operator_ids},
        "is_active": True
    }).to_list(100)
    
    if other_pods:
        conflicts = []
        for op_id in data.operator_ids:
            for p in other_pods:
                if op_id in p.get("assigned_operator_ids", []):
                    conflicts.append(f"Operator {op_id} is in pod '{p['name']}'")
        if conflicts:
            raise HTTPException(status_code=400, detail=f"Conflicts: {', '.join(conflicts)}")
    
    # Add operators (merge with existing)
    current_operators = set(pod.get("assigned_operator_ids", []))
    new_operators = current_operators.union(set(data.operator_ids))
    
    await db.pods.update_one(
        {"id": pod_id},
        {"$set": {
            "assigned_operator_ids": list(new_operators),
            "total_operators": len(new_operators),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Assigned {len(data.operator_ids)} operators to pod",
        "total_operators": len(new_operators)
    }


@router.delete("/{pod_id}/operators/{operator_id}")
async def remove_operator_from_pod(
    pod_id: str,
    operator_id: str,
    current_user: dict = Depends(require_permission("pods.manage_operators"))
):
    """Remove an operator from a pod"""
    db = get_database()
    
    result = await db.pods.update_one(
        {"id": pod_id, "assigned_operator_ids": operator_id},
        {
            "$pull": {"assigned_operator_ids": operator_id},
            "$inc": {"total_operators": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pod or operator assignment not found")
    
    return {"message": "Operator removed from pod"}


# ============== My Pod ==============

@router.get("/my/membership")
async def get_my_pod_membership(
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's pod membership"""
    db = get_database()
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    membership = await db.pod_memberships.find_one(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    )
    
    if not membership:
        return {"membership": None, "pod": None}
    
    pod = await db.pods.find_one({"id": membership["pod_id"]}, {"_id": 0})
    
    return {"membership": membership, "pod": pod}


# ============== Team Lead Self-Management ==============

async def _get_team_lead_pod(user_id: str, db) -> dict:
    """Verify user is a team lead and return their pod."""
    membership = await db.pod_memberships.find_one({
        "user_id": user_id, "is_active": True, "pod_role": "team_lead"
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Only team leads can manage their pod members")
    pod = await db.pods.find_one({"id": membership["pod_id"]})
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    return pod


@router.get("/my/team")
async def get_my_team(
    current_user: dict = Depends(get_current_active_user)
):
    """Get members of the current user's pod (team lead view)."""
    db = get_database()
    user_id = str(current_user.get("_id") or current_user.get("id"))

    # Any pod member can see their team
    membership = await db.pod_memberships.find_one({
        "user_id": user_id, "is_active": True
    })
    if not membership:
        return {"members": [], "pod": None, "is_team_lead": False}

    pod = await db.pods.find_one({"id": membership["pod_id"]}, {"_id": 0})
    members = await db.pod_memberships.find(
        {"pod_id": membership["pod_id"], "is_active": True}, {"_id": 0}
    ).to_list(100)

    # Get assigned operators for the pod
    assigned_operators = []
    if pod and pod.get("assigned_operator_ids"):
        ops = await db.operators.find(
            {"_id": {"$in": pod["assigned_operator_ids"]}},
            {"_id": 1, "name": 1, "status": 1, "operator_type": 1, "country": 1}
        ).to_list(1000)
        assigned_operators = [{"id": o["_id"], **{k: o[k] for k in o if k != "_id"}} for o in ops]

    return {
        "pod": pod,
        "members": members,
        "assigned_operators": assigned_operators,
        "is_team_lead": membership.get("pod_role") == "team_lead",
        "my_role": membership.get("pod_role")
    }


@router.post("/my/team/members")
async def team_lead_add_member(
    data: PodMemberAdd,
    current_user: dict = Depends(get_current_active_user)
):
    """Team lead can add members to their own pod without needing pods.manage_members permission."""
    db = get_database()
    user_id = str(current_user.get("_id") or current_user.get("id"))
    pod = await _get_team_lead_pod(user_id, db)

    # Team leads cannot appoint another team lead
    if data.pod_role == PodRole.TEAM_LEAD:
        raise HTTPException(status_code=400, detail="Team leads cannot assign another team lead")

    # Verify target user exists and is a platform employee
    user = await db.users.find_one({"_id": data.user_id})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=400, detail="Only platform employees can be added to pods")

    # One employee = one pod rule
    existing = await db.pod_memberships.find_one({
        "user_id": data.user_id, "is_active": True
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User is already in pod '{existing['pod_name']}'"
        )

    membership = {
        "id": str(uuid.uuid4()),
        "pod_id": pod["id"],
        "pod_name": pod["name"],
        "user_id": data.user_id,
        "user_name": user.get("full_name") or user.get("email"),
        "user_email": user.get("email", ""),
        "pod_role": data.pod_role.value,
        "is_active": True,
        "assigned_by": user_id,
        "assigned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pod_memberships.insert_one(membership)
    await db.pods.update_one(
        {"id": pod["id"]},
        {
            "$push": {"member_ids": data.user_id},
            "$inc": {"total_members": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    return {"message": "Member added", "membership": {k: v for k, v in membership.items() if k != "_id"}}


@router.delete("/my/team/members/{target_user_id}")
async def team_lead_remove_member(
    target_user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Team lead can remove members from their own pod."""
    db = get_database()
    user_id = str(current_user.get("_id") or current_user.get("id"))
    pod = await _get_team_lead_pod(user_id, db)

    # Cannot remove self
    if target_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the pod")

    membership = await db.pod_memberships.find_one({
        "pod_id": pod["id"], "user_id": target_user_id, "is_active": True
    })
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found in your pod")

    await db.pod_memberships.update_one(
        {"id": membership["id"]},
        {"$set": {
            "is_active": False,
            "removed_at": datetime.now(timezone.utc).isoformat(),
            "removed_by": user_id
        }}
    )
    await db.pods.update_one(
        {"id": pod["id"]},
        {
            "$pull": {"member_ids": target_user_id},
            "$inc": {"total_members": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    return {"message": "Member removed from pod"}


@router.put("/my/team/members/{target_user_id}/role")
async def team_lead_change_member_role(
    target_user_id: str,
    new_role: PodRole,
    current_user: dict = Depends(get_current_active_user)
):
    """Team lead can change a member's role within the pod."""
    db = get_database()
    user_id = str(current_user.get("_id") or current_user.get("id"))
    pod = await _get_team_lead_pod(user_id, db)

    if new_role == PodRole.TEAM_LEAD:
        raise HTTPException(status_code=400, detail="Cannot assign team lead role")

    membership = await db.pod_memberships.find_one({
        "pod_id": pod["id"], "user_id": target_user_id, "is_active": True
    })
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found in your pod")
    if membership.get("pod_role") == "team_lead":
        raise HTTPException(status_code=400, detail="Cannot change team lead's role")

    await db.pod_memberships.update_one(
        {"id": membership["id"]},
        {"$set": {"pod_role": new_role.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"message": f"Role updated to {new_role.value}"}

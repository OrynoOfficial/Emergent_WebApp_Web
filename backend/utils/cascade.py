"""
Cascade utilities for cleaning up related records when users/employees are modified.
"""
from datetime import datetime, timezone


# Map employee statuses to user account statuses
EMPLOYEE_TO_USER_STATUS = {
    "active": "active",
    "on_leave": "active",       # On leave employees can still log in
    "suspended": "suspended",
    "terminated": "suspended",  # Terminated employees lose access
    "inactive": "suspended",
}


async def remove_user_from_pods(db, user_id: str, removed_by: str = "system"):
    """Remove a user from all active pod memberships and update pod records."""
    memberships = await db.pod_memberships.find(
        {"user_id": user_id, "is_active": True}
    ).to_list(100)

    for membership in memberships:
        pod_id = membership["pod_id"]

        # Deactivate membership
        await db.pod_memberships.update_one(
            {"id": membership["id"]},
            {"$set": {
                "is_active": False,
                "removed_at": datetime.now(timezone.utc).isoformat(),
                "removed_by": removed_by,
            }}
        )

        # Update pod counters / arrays
        update_ops = {
            "$pull": {"member_ids": user_id},
            "$inc": {"total_members": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        }

        # Clear team lead if this user was the team lead
        if membership.get("pod_role") == "team_lead":
            update_ops["$set"]["team_lead_id"] = None
            update_ops["$set"]["team_lead_name"] = None

        await db.pods.update_one({"id": pod_id}, update_ops)

    return len(memberships)


async def remove_user_from_scopes(db, user_id: str):
    """Deactivate all scope assignments for a user."""
    result = await db.employee_scope_assignments.update_many(
        {"user_id": user_id, "is_active": True},
        {"$set": {
            "is_active": False,
            "removed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return result.modified_count


async def cascade_delete_user(db, user_id: str, removed_by: str = "system"):
    """Full cascade cleanup when a user account is deleted."""
    pods_removed = await remove_user_from_pods(db, user_id, removed_by)
    scopes_removed = await remove_user_from_scopes(db, user_id)
    return {"pods_removed": pods_removed, "scopes_removed": scopes_removed}


async def sync_user_status(db, user_id: str, employee_status: str):
    """Sync user account status based on employee status change."""
    user_status = EMPLOYEE_TO_USER_STATUS.get(employee_status)
    if not user_status:
        return False

    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"status": user_status, "updated_at": datetime.now(timezone.utc)}}
    )
    return result.modified_count > 0

"""Email Invitation System for Oryno Platform."""
from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import os

router = APIRouter(prefix="/api/invitations", tags=["Invitations"])

INVITATION_EXPIRY_DAYS = 7


class InvitationRequest(BaseModel):
    email: EmailStr
    role: str = "customer"
    message: Optional[str] = None
    operator_id: Optional[str] = None


class InvitationAccept(BaseModel):
    token: str
    full_name: str
    password: str
    phone: Optional[str] = None


@router.post("/send")
async def send_invitation(
    req: InvitationRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Send an email invitation to join the platform."""
    db = get_database()

    # Only admins, super_admins, and operators can invite
    sender_role = current_user.get("role", "")
    if sender_role not in ("admin", "super_admin", "operator"):
        raise HTTPException(status_code=403, detail="Only admins and operators can send invitations")

    # Check if user already registered
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    # Check for pending invitation
    pending = await db.invitations.find_one({
        "email": req.email,
        "status": "pending",
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    if pending:
        raise HTTPException(status_code=400, detail="An invitation is already pending for this email")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRY_DAYS)

    frontend_url = os.environ.get("FRONTEND_URL", "")
    if not frontend_url:
        # Try to derive from common env vars
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
        # Strip /api if present
        frontend_url = frontend_url.replace("/api", "")
    invite_link = f"{frontend_url}/register?invite={token}"

    invitation = {
        "_id": str(uuid.uuid4()),
        "email": req.email,
        "role": req.role,
        "message": req.message,
        "operator_id": req.operator_id,
        "token": token,
        "status": "pending",
        "invited_by": current_user["_id"],
        "invited_by_name": current_user.get("full_name", current_user.get("email", "")),
        "invite_link": invite_link,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.invitations.insert_one(invitation)

    # Send email (mock or real)
    try:
        from utils.email import send_email

        html_body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; background: #f1f5f9;">
          <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #082c59 0%, #0a4a8f 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">You're Invited to Oryno</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                <strong>{current_user.get('full_name', 'Someone')}</strong> has invited you to join the Oryno platform{' as ' + req.role if req.role != 'customer' else ''}.
              </p>
              {f'<p style="color: #64748b; font-size: 14px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #082c59;">{req.message}</p>' if req.message else ''}
              <div style="text-align: center; margin: 28px 0;">
                <a href="{invite_link}" style="display: inline-block; background: #082c59; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                This invitation expires in {INVITATION_EXPIRY_DAYS} days.
              </p>
            </div>
          </div>
        </body>
        </html>
        """
        await send_email(req.email, "You're Invited to Oryno Platform", html_body, html=True)
    except Exception as e:
        print(f"Email send error (non-blocking): {e}")

    return {
        "message": "Invitation sent",
        "email": req.email,
        "invite_link": invite_link,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/validate/{token}")
async def validate_invitation(token: str):
    """Validate an invitation token (public endpoint for registration page)."""
    db = get_database()

    invitation = await db.invitations.find_one({"token": token}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation already {invitation['status']}")

    if datetime.fromisoformat(invitation["expires_at"]) < datetime.now(timezone.utc):
        await db.invitations.update_one({"token": token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invitation has expired")

    return {
        "valid": True,
        "email": invitation["email"],
        "role": invitation["role"],
        "message": invitation.get("message"),
        "invited_by_name": invitation.get("invited_by_name"),
    }


@router.post("/accept")
async def accept_invitation(req: InvitationAccept):
    """Accept an invitation and create the user account."""
    db = get_database()

    invitation = await db.invitations.find_one({"token": req.token})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation already {invitation['status']}")

    if datetime.fromisoformat(invitation["expires_at"]) < datetime.now(timezone.utc):
        await db.invitations.update_one({"token": req.token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Check if user already exists
    existing = await db.users.find_one({"email": invitation["email"]})
    if existing:
        await db.invitations.update_one({"token": req.token}, {"$set": {"status": "used"}})
        raise HTTPException(status_code=400, detail="User already exists")

    # Create user
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "email": invitation["email"],
        "password_hash": pwd_context.hash(req.password),
        "full_name": req.full_name,
        "phone": req.phone or "",
        "role": invitation["role"],
        "is_active": True,
        "invited_by": invitation.get("invited_by"),
        "operator_id": invitation.get("operator_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user)

    # Mark invitation as used
    await db.invitations.update_one(
        {"token": req.token},
        {"$set": {"status": "used", "used_at": datetime.now(timezone.utc).isoformat(), "user_id": user_id}},
    )

    return {"message": "Account created successfully", "email": invitation["email"], "role": invitation["role"]}


@router.get("/")
async def list_invitations(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """List invitations sent by or visible to the current user."""
    db = get_database()

    query = {}
    role = current_user.get("role", "")
    if role not in ("admin", "super_admin"):
        query["invited_by"] = current_user["_id"]
    if status_filter:
        query["status"] = status_filter

    invitations = (
        await db.invitations.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.invitations.count_documents(query)

    return {"invitations": invitations, "total": total}


@router.delete("/{token}")
async def revoke_invitation(
    token: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Revoke a pending invitation."""
    db = get_database()

    invitation = await db.invitations.find_one({"token": token})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Only the sender or admins can revoke
    if invitation["invited_by"] != current_user["_id"] and current_user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to revoke this invitation")

    if invitation["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot revoke – invitation is {invitation['status']}")

    await db.invitations.update_one({"token": token}, {"$set": {"status": "revoked"}})
    return {"message": "Invitation revoked"}

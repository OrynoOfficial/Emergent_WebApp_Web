"""
Email service powered by Resend.

Used for transactional emails such as the operator/staff "Confirm your account" invite.
The Resend SDK is synchronous, so we run each call in a thread to keep FastAPI non-blocking.
"""
import asyncio
import logging
import os
from typing import Optional

import resend
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("RESEND_SENDER_EMAIL", "onboarding@resend.dev")
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "").rstrip("/")


def _invite_html(
    *,
    recipient_name: str,
    invite_link: str,
    operator_name: Optional[str],
    inviter_name: Optional[str],
    has_temp_password: bool,
) -> str:
    """Render the HTML body for the operator/staff invite email."""
    safe_name = recipient_name or "there"
    operator_line = (
        f"You've been invited to join <strong>{operator_name}</strong> on Oryno."
        if operator_name
        else "You've been invited to join Oryno."
    )
    inviter_line = (
        f"<p style='margin:0 0 16px;color:#475569;font-size:14px;line-height:22px'>"
        f"{inviter_name} added you to the team.</p>"
        if inviter_name
        else ""
    )
    password_note = (
        "<p style='margin:0 0 16px;color:#475569;font-size:13px;line-height:20px'>"
        "Your temporary password has been set. You'll be asked to confirm your account before signing in.</p>"
        if has_temp_password
        else "<p style='margin:0 0 16px;color:#475569;font-size:13px;line-height:20px'>"
        "Click the button below to set your password and activate your account.</p>"
    )

    return f"""
<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#082c59;padding:24px 32px">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.2px">Oryno</h1>
      </td></tr>
      <tr><td style="padding:32px">
        <h2 style="margin:0 0 8px;color:#082c59;font-size:22px;line-height:28px">Hi {safe_name},</h2>
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:24px">{operator_line}</p>
        {inviter_line}
        {password_note}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
          <tr><td style="border-radius:8px;background:#082c59">
            <a href="{invite_link}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">Confirm your account</a>
          </td></tr>
        </table>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:18px">If the button doesn't work, paste this URL into your browser:<br>
          <a href="{invite_link}" style="color:#082c59;word-break:break-all">{invite_link}</a>
        </p>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;line-height:16px">This link expires in 7 days. If you didn't expect this email you can safely ignore it.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
"""


async def send_account_invite_email(
    *,
    recipient_email: str,
    recipient_name: str,
    invite_token: str,
    operator_name: Optional[str] = None,
    inviter_name: Optional[str] = None,
    has_temp_password: bool = False,
) -> dict:
    """
    Send a "Confirm your account" email containing a link to set/confirm credentials.

    Hot-path: builds the HTML synchronously (~1ms), enqueues the actual Resend
    call onto Arq, then returns the invite_link IMMEDIATELY so the caller can
    persist it / show it to the admin without blocking on Resend latency
    (300-800ms typical, 5s+ when Resend is degraded).

    The queued worker handles Resend retries. If the queue is unavailable
    (no Redis), `enqueue` transparently runs the send inline as a background
    asyncio task — slower start, same end state.

    Returns:
        {"status": "queued"|"sent", "invite_link": str, "id": Optional[str]}
    """
    if not APP_PUBLIC_URL:
        raise RuntimeError("APP_PUBLIC_URL is not configured")

    invite_link = f"{APP_PUBLIC_URL}/verify-account?token={invite_token}"

    # Resend not configured → return the link so the caller can copy/paste it.
    # This is the existing "sandbox mode" fallback documented in the handoff.
    if not resend.api_key:
        logger.info("RESEND_API_KEY not set — returning invite_link only for %s", recipient_email)
        return {"status": "skipped", "invite_link": invite_link, "id": None}

    html = _invite_html(
        recipient_name=recipient_name,
        invite_link=invite_link,
        operator_name=operator_name,
        inviter_name=inviter_name,
        has_temp_password=has_temp_password,
    )
    subject = f"Confirm your Oryno account{f' — {operator_name}' if operator_name else ''}"

    # Enqueue the Resend call (300-800ms cold, retried by arq on failure).
    # The caller's request returns in milliseconds regardless of how long
    # Resend takes to acknowledge.
    try:
        from utils.task_queue import enqueue
        landed = await enqueue("send_email", to=recipient_email, subject=subject, html=html)
        return {
            "status": "queued" if landed else "queued_inline",
            "invite_link": invite_link,
            "id": None,
        }
    except Exception as e:
        # Defensive: if even the enqueue fails (Redis + arq both down), fall
        # back to the synchronous send — same behaviour as before this refactor.
        logger.warning("Invite enqueue failed, falling back to sync send: %s", e)
        params = {
            "from": SENDER_EMAIL,
            "to": [recipient_email],
            "subject": subject,
            "html": html,
        }
        try:
            result = await asyncio.to_thread(resend.Emails.send, params)
            return {"status": "sent", "id": result.get("id") if isinstance(result, dict) else None,
                    "invite_link": invite_link}
        except Exception:
            logger.exception("Resend invite email failed for %s", recipient_email)
            # Don't kill the caller — invite_link still works as a manual fallback.
            return {"status": "failed", "invite_link": invite_link, "id": None}



async def send_raw_email(
    *,
    to: str,
    subject: str,
    html: str,
    sender: Optional[str] = None,
) -> dict:
    """Generic, fire-and-forget transactional email.

    Designed to be called from a background queue worker so the request
    thread never blocks on Resend. Errors are logged and re-raised so the
    queue can retry per its policy.
    """
    if not resend.api_key:
        logger.warning("send_raw_email skipped — RESEND_API_KEY not configured")
        return {"status": "skipped"}
    params = {
        "from": sender or SENDER_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "id": result.get("id") if isinstance(result, dict) else None}
    except Exception:
        logger.exception("send_raw_email failed for %s", to)
        raise

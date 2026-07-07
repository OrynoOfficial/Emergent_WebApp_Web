import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import settings
from jinja2 import Template
import logging
import os

logger = logging.getLogger(__name__)

# Check if we're in mock mode
MOCK_MODE = getattr(settings, 'SMTP_MOCK_MODE', 'false').lower() == 'true'


async def _smtp_send_raw(
    to_email: str,
    subject: str,
    body: str,
    html: bool = False
) -> bool:
    """Low-level SMTP delivery. This is what the queue worker calls.

    The public `send_email(...)` below enqueues onto Arq so the request
    thread doesn't block on a slow SMTP handshake. If you genuinely need
    inline delivery (rare), call `_smtp_send_raw` directly.
    """
    # Mock mode - just log the email
    if MOCK_MODE:
        print(f"\n{'='*60}")
        print("📧 MOCK EMAIL SENT")
        print(f"{'='*60}")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{body[:200]}..." if len(body) > 200 else f"Body:\n{body}")
        print(f"{'='*60}\n")
        return True

    # Real email sending
    try:
        message = MIMEMultipart("alternative")
        message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        message["To"] = to_email
        message["Subject"] = subject

        if html:
            part = MIMEText(body, "html")
        else:
            part = MIMEText(body, "plain")

        message.attach(part)

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True
        )
        return True
    except Exception as e:
        logger.warning("SMTP send failed for %s: %s", to_email, e)
        return False


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html: bool = False
) -> bool:
    """Public SMTP send helper — enqueues onto Arq so callers don't block.

    Returns True if the job landed in the queue (or ran inline successfully
    on fallback). Note: queued delivery is best-effort; the caller can't
    distinguish "queued + later sent" from "queued + later failed". For
    cases that need delivery confirmation (rare — usually compliance), call
    `_smtp_send_raw` directly.
    """
    # Mock mode preserves the immediate, deterministic feedback used by tests.
    if MOCK_MODE:
        return await _smtp_send_raw(to_email, subject, body, html=html)

    try:
        from utils.task_queue import enqueue
        await enqueue("send_email_smtp", to=to_email, subject=subject, html=body)
        return True
    except Exception as e:
        logger.warning("SMTP enqueue failed, falling back to inline send: %s", e)
        return await _smtp_send_raw(to_email, subject, body, html=html)


async def send_email_to_user(
    user_id: str,
    to_email: str,
    subject: str,
    body: str,
    *,
    html: bool = False,
    category: str = "booking",
) -> bool:
    """Send email respecting the user's notification preferences.

    Skips the send entirely when the user has opted out of `email_notifications`
    OR the specific `category` (booking / promotional / newsletter).
    Transactional messages (OTP, invite, password reset) should call `send_email`
    directly to bypass the gate.
    """
    try:
        from utils.notification_gate import should_notify
        if not await should_notify(user_id, "email", category):
            logger.debug("send_email_to_user: gated off for %s (%s)", user_id, category)
            return False
    except Exception:
        # On gate failure, deliver the email so we don't silently drop critical alerts.
        pass
    return await send_email(to_email, subject, body, html=html)

async def send_verification_email(to_email: str, verification_link: str) -> bool:
    """Send email verification link"""
    subject = "Verify Your Email - Oryno Platform"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Welcome to Oryno Platform!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verification_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p>{verification_link}</p>
            <p>This link will expire in 24 hours.</p>
            <br>
            <p>If you didn't create an account, please ignore this email.</p>
        </body>
    </html>
    """
    return await send_email(to_email, subject, body, html=True)

async def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send password reset link"""
    subject = "Reset Your Password - Oryno Platform"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the link below:</p>
            <p><a href="{reset_link}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>Or copy and paste this link in your browser:</p>
            <p>{reset_link}</p>
            <p>This link will expire in 1 hour.</p>
            <br>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
    </html>
    """
    return await send_email(to_email, subject, body, html=True)

async def send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP for 2FA"""
    subject = "Your Verification Code - Oryno Platform"
    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Your Verification Code</h2>
            <p>Your one-time verification code is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">{otp}</h1>
            <p>This code will expire in 10 minutes.</p>
            <br>
            <p>If you didn't request this code, please ignore this email.</p>
        </body>
    </html>
    """
    return await send_email(to_email, subject, body, html=True)
"""
Infobip SMS and Email Service
Uses httpx for API calls to avoid pydantic version conflicts
"""
import os
import random
import string
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict

class InfobipService:
    def __init__(self):
        self.base_url = os.environ.get("INFOBIP_BASE_URL", "").rstrip("/")
        self.api_key = os.environ.get("INFOBIP_API_KEY", "")
        self.sms_sender = os.environ.get("INFOBIP_SMS_SENDER", "Oryno")
        self.email_from = os.environ.get("INFOBIP_EMAIL_FROM", "")
        
        self.headers = {
            "Authorization": f"App {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def is_configured(self) -> bool:
        """Check if Infobip is properly configured"""
        return bool(self.base_url and self.api_key)
    
    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generate a random numeric OTP"""
        return ''.join(random.choices(string.digits, k=length))
    
    async def send_sms_otp(self, phone_number: str, otp_code: str) -> Dict:
        """Send OTP via SMS using Infobip API"""
        if not self.is_configured():
            return {"status": "error", "message": "Infobip not configured"}
        
        try:
            message_text = f"Your Oryno verification code is: {otp_code}. This code expires in 5 minutes. Do not share this code with anyone."
            
            payload = {
                "messages": [{
                    "destinations": [{"to": phone_number}],
                    "from": self.sms_sender,
                    "text": message_text
                }]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sms/2/text/advanced",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    messages = data.get("messages", [])
                    if messages:
                        return {
                            "status": "success",
                            "message_id": messages[0].get("messageId"),
                            "bulk_id": data.get("bulkId"),
                            "phone_number": phone_number
                        }
                    return {"status": "success", "phone_number": phone_number}
                else:
                    error_detail = response.text
                    return {
                        "status": "error",
                        "message": f"SMS API error: {response.status_code} - {error_detail}"
                    }
                    
        except httpx.TimeoutException:
            return {"status": "error", "message": "SMS service timeout"}
        except Exception as ex:
            return {"status": "error", "message": str(ex)}
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> Dict:
        """Send email via Infobip API"""
        if not self.is_configured():
            return {"status": "error", "message": "Infobip not configured"}
        
        try:
            # Infobip uses form-data for email API
            data = {
                "from": self.email_from,
                "to": to_email,
                "subject": subject,
                "html": html_content,
            }
            
            if text_content:
                data["text"] = text_content
            
            # Email API uses multipart form data
            headers = {
                "Authorization": f"App {self.api_key}",
                "Accept": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/email/3/send",
                    headers=headers,
                    data=data,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    messages = result.get("messages", [])
                    return {
                        "status": "success",
                        "message_id": messages[0].get("messageId") if messages else None,
                        "to_email": to_email
                    }
                else:
                    return {
                        "status": "error", 
                        "message": f"Email API error: {response.status_code} - {response.text}"
                    }
                    
        except httpx.TimeoutException:
            return {"status": "error", "message": "Email service timeout"}
        except Exception as ex:
            return {"status": "error", "message": str(ex)}
    
    async def send_email_otp(self, to_email: str, otp_code: str) -> Dict:
        """Send OTP via Email"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #082c59; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .otp-code {{ font-size: 32px; font-weight: bold; color: #082c59; letter-spacing: 8px; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Oryno Verification</h1>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>Your verification code is:</p>
                    <div class="otp-code">{otp_code}</div>
                    <p>This code will expire in <strong>5 minutes</strong>.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 Oryno. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"Your Oryno verification code is: {otp_code}. This code expires in 5 minutes."
        
        return await self.send_email(
            to_email=to_email,
            subject="Your Oryno Verification Code",
            html_content=html_content,
            text_content=text_content
        )


# Singleton instance
_infobip_service = None

def get_infobip_service() -> InfobipService:
    global _infobip_service
    if _infobip_service is None:
        _infobip_service = InfobipService()
    return _infobip_service

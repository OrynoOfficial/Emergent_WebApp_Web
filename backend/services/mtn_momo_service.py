import requests
import uuid
from typing import Dict, Any, Optional
from config.settings import settings
import base64
import json

class MTNMoMoService:
    BASE_URL = settings.MTN_MOMO_BASE_URL
    PRIMARY_KEY = settings.MTN_MOMO_PRIMARY_KEY
    SECONDARY_KEY = settings.MTN_MOMO_SECONDARY_KEY
    
    def __init__(self):
        self.collection_user_id = settings.MTN_MOMO_COLLECTION_USER_ID
        self.collection_api_key = settings.MTN_MOMO_COLLECTION_API_KEY
        self.disbursement_user_id = settings.MTN_MOMO_DISBURSEMENT_USER_ID
        self.disbursement_api_key = settings.MTN_MOMO_DISBURSEMENT_API_KEY
    
    def _get_headers(self, product: str = "collection") -> Dict[str, str]:
        """Get headers for MTN MoMo API requests"""
        headers = {
            "Ocp-Apim-Subscription-Key": self.PRIMARY_KEY,
            "Content-Type": "application/json",
            "X-Target-Environment": "sandbox"
        }
        return headers
    
    def _get_auth_headers(self, product: str = "collection") -> Dict[str, str]:
        """Get authenticated headers with access token"""
        headers = self._get_headers(product)
        access_token = self._get_access_token(product)
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers
    
    def _get_access_token(self, product: str = "collection") -> Optional[str]:
        """Get access token for MTN MoMo API"""
        try:
            url = f"{self.BASE_URL}/{product}/token/"
            
            if product == "collection":
                user_id = self.collection_user_id
                api_key = self.collection_api_key
            else:
                user_id = self.disbursement_user_id
                api_key = self.disbursement_api_key
            
            # Create basic auth string
            auth_string = f"{user_id}:{api_key}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            headers = {
                "Ocp-Apim-Subscription-Key": self.PRIMARY_KEY,
                "Authorization": f"Basic {auth_b64}"
            }
            
            response = requests.post(url, headers=headers)
            if response.status_code == 200:
                return response.json().get("access_token")
            return None
        except Exception as e:
            print(f"Error getting access token: {e}")
            return None
    
    async def request_to_pay(
        self,
        amount: float,
        currency: str,
        phone_number: str,
        external_id: str,
        payer_message: str = "Payment",
        payee_note: str = "Payment received"
    ) -> Dict[str, Any]:
        """Create a payment request"""
        try:
            url = f"{self.BASE_URL}/collection/v1_0/requesttopay"
            reference_id = str(uuid.uuid4())
            
            headers = self._get_auth_headers("collection")
            headers["X-Reference-Id"] = reference_id
            headers["X-Callback-Url"] = settings.MTN_MOMO_CALLBACK_URL
            
            payload = {
                "amount": str(amount),
                "currency": currency,
                "externalId": external_id,
                "payer": {
                    "partyIdType": "MSISDN",
                    "partyId": phone_number
                },
                "payerMessage": payer_message,
                "payeeNote": payee_note
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 202:
                return {
                    "success": True,
                    "reference_id": reference_id,
                    "status": "PENDING"
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_transaction_status(self, reference_id: str) -> Dict[str, Any]:
        """Get the status of a transaction"""
        try:
            url = f"{self.BASE_URL}/collection/v1_0/requesttopay/{reference_id}"
            headers = self._get_auth_headers("collection")
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "status": data.get("status"),
                    "amount": data.get("amount"),
                    "currency": data.get("currency"),
                    "external_id": data.get("externalId"),
                    "reason": data.get("reason")
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_account_balance(self) -> Dict[str, Any]:
        """Get account balance"""
        try:
            url = f"{self.BASE_URL}/collection/v1_0/account/balance"
            headers = self._get_auth_headers("collection")
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "available_balance": data.get("availableBalance"),
                    "currency": data.get("currency")
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def validate_account_holder(self, phone_number: str) -> Dict[str, Any]:
        """Validate an account holder"""
        try:
            url = f"{self.BASE_URL}/collection/v1_0/accountholder/msisdn/{phone_number}/active"
            headers = self._get_auth_headers("collection")
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "is_active": data.get("result", False)
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
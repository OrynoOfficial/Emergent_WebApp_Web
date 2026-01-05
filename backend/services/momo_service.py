"""
MTN MoMo Mobile Money Service - Mock/Sandbox Implementation
Provides MTN Mobile Money payment integration for the booking platform
"""
import os
import logging
import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from enum import Enum
import random

logger = logging.getLogger(__name__)


class MoMoPaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"


class MoMoService:
    """
    Mock/Sandbox MTN MoMo Mobile Money Service
    
    In sandbox mode, this simulates the MTN MoMo API behavior.
    For production, this would connect to the real MTN API endpoints.
    
    Sandbox test numbers:
    - Numbers ending in 1-5: Will succeed after a delay
    - Numbers ending in 6-7: Will fail (insufficient funds)
    - Numbers ending in 8-9: Will timeout
    - Numbers ending in 0: Will be cancelled by user
    """
    
    def __init__(self):
        self.environment = os.environ.get('MTN_ENVIRONMENT', 'sandbox')
        self.subscription_key = os.environ.get('MTN_SUBSCRIPTION_KEY', 'sandbox_key')
        self.callback_base_url = os.environ.get('CALLBACK_BASE_URL', '')
        
        # Simulated transaction store for sandbox mode
        self._sandbox_transactions: Dict[str, Dict[str, Any]] = {}
        
        logger.info(f"MoMo Service initialized in {self.environment} mode")
    
    async def request_to_pay(
        self,
        amount: float,
        currency: str,
        phone_number: str,
        external_id: str,
        payer_message: str = "",
        payee_note: str = ""
    ) -> Dict[str, Any]:
        """
        Request a payment from a customer's mobile money account
        
        Args:
            amount: Payment amount
            currency: Currency code (e.g., 'XAF', 'XOF')
            phone_number: Customer's phone number (MSISDN format)
            external_id: Your reference ID for this transaction
            payer_message: Message displayed to payer
            payee_note: Internal note for payee
        
        Returns:
            Dict with reference_id and status
        """
        try:
            # Generate reference ID
            reference_id = str(uuid.uuid4())
            
            # Validate phone number (basic validation)
            clean_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
            if len(clean_phone) < 9 or len(clean_phone) > 15:
                return {
                    "success": False,
                    "error": "Invalid phone number format"
                }
            
            # In sandbox mode, simulate the request
            if self.environment == 'sandbox':
                # Determine outcome based on last digit of phone number
                last_digit = int(clean_phone[-1])
                
                if last_digit in [1, 2, 3, 4, 5]:
                    initial_status = MoMoPaymentStatus.PENDING
                    # Will succeed after polling
                elif last_digit in [6, 7]:
                    initial_status = MoMoPaymentStatus.PENDING
                    # Will fail due to insufficient funds
                elif last_digit in [8, 9]:
                    initial_status = MoMoPaymentStatus.PENDING
                    # Will timeout
                else:  # 0
                    initial_status = MoMoPaymentStatus.PENDING
                    # Will be cancelled
                
                # Store transaction in sandbox store
                self._sandbox_transactions[reference_id] = {
                    "reference_id": reference_id,
                    "external_id": external_id,
                    "amount": amount,
                    "currency": currency,
                    "phone_number": clean_phone,
                    "payer_message": payer_message,
                    "payee_note": payee_note,
                    "status": initial_status,
                    "phone_last_digit": last_digit,
                    "created_at": datetime.now(timezone.utc),
                    "poll_count": 0
                }
                
                logger.info(f"Sandbox: Created MoMo payment request {reference_id} for {amount} {currency}")
                
                return {
                    "success": True,
                    "reference_id": reference_id,
                    "status": initial_status,
                    "message": "Payment request initiated. Customer must authorize on their device."
                }
            
            # Production implementation would go here
            # This would call the actual MTN MoMo API
            return {
                "success": False,
                "error": "Production mode not yet implemented"
            }
            
        except Exception as e:
            logger.error(f"Error creating MoMo payment request: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_transaction_status(
        self,
        reference_id: str
    ) -> Dict[str, Any]:
        """
        Get the status of a payment transaction
        
        Args:
            reference_id: The MoMo reference ID from request_to_pay
        
        Returns:
            Dict with transaction status information
        """
        try:
            # In sandbox mode, simulate status checking
            if self.environment == 'sandbox':
                if reference_id not in self._sandbox_transactions:
                    return {
                        "success": False,
                        "error": "Transaction not found"
                    }
                
                transaction = self._sandbox_transactions[reference_id]
                transaction["poll_count"] += 1
                poll_count = transaction["poll_count"]
                last_digit = transaction.get("phone_last_digit", 0)
                
                # Simulate async behavior - status changes after a few polls
                if poll_count >= 3:  # After 3 polls (15 seconds if polling every 5s)
                    if last_digit in [1, 2, 3, 4, 5]:
                        # Success case
                        transaction["status"] = MoMoPaymentStatus.SUCCESSFUL
                        transaction["completed_at"] = datetime.now(timezone.utc)
                        transaction["financial_id"] = f"FIN-{uuid.uuid4().hex[:12].upper()}"
                    elif last_digit in [6, 7]:
                        # Failure case - insufficient funds
                        transaction["status"] = MoMoPaymentStatus.FAILED
                        transaction["reason"] = "INSUFFICIENT_BALANCE"
                    elif last_digit in [8, 9]:
                        # Timeout case
                        transaction["status"] = MoMoPaymentStatus.TIMED_OUT
                        transaction["reason"] = "TRANSACTION_TIMEOUT"
                    else:  # 0
                        # Cancelled case
                        transaction["status"] = MoMoPaymentStatus.CANCELLED
                        transaction["reason"] = "USER_CANCELLED"
                
                return {
                    "success": True,
                    "reference_id": reference_id,
                    "external_id": transaction.get("external_id"),
                    "status": transaction["status"],
                    "amount": transaction.get("amount"),
                    "currency": transaction.get("currency"),
                    "phone_number": transaction.get("phone_number"),
                    "reason": transaction.get("reason"),
                    "financial_id": transaction.get("financial_id"),
                    "created_at": transaction.get("created_at").isoformat() if transaction.get("created_at") else None,
                    "completed_at": transaction.get("completed_at").isoformat() if transaction.get("completed_at") else None
                }
            
            # Production implementation would go here
            return {
                "success": False,
                "error": "Production mode not yet implemented"
            }
            
        except Exception as e:
            logger.error(f"Error getting MoMo transaction status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def validate_account(
        self,
        phone_number: str
    ) -> Dict[str, Any]:
        """
        Validate if a phone number is registered for MTN Mobile Money
        
        Args:
            phone_number: Customer's phone number
        
        Returns:
            Dict with validation result
        """
        try:
            clean_phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
            
            # In sandbox mode, simulate validation
            if self.environment == 'sandbox':
                # All numbers except those starting with 000 are valid in sandbox
                is_valid = not clean_phone.startswith('000')
                
                return {
                    "success": True,
                    "is_valid": is_valid,
                    "phone_number": clean_phone,
                    "message": "Account is active" if is_valid else "Account not found"
                }
            
            return {
                "success": False,
                "error": "Production mode not yet implemented"
            }
            
        except Exception as e:
            logger.error(f"Error validating MoMo account: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_sandbox_instructions(self) -> Dict[str, Any]:
        """
        Get instructions for testing in sandbox mode
        
        Returns:
            Dict with testing instructions
        """
        return {
            "environment": self.environment,
            "test_numbers": {
                "success": "Phone numbers ending in 1, 2, 3, 4, or 5 will succeed",
                "insufficient_funds": "Phone numbers ending in 6 or 7 will fail with insufficient funds",
                "timeout": "Phone numbers ending in 8 or 9 will timeout",
                "cancelled": "Phone numbers ending in 0 will be cancelled by user"
            },
            "example_numbers": [
                "237670000001 - Will succeed",
                "237670000006 - Will fail (insufficient funds)",
                "237670000008 - Will timeout",
                "237670000000 - Will be cancelled"
            ],
            "notes": [
                "Status changes after ~3 polling attempts (15 seconds)",
                "Use any valid phone number format (9-15 digits)",
                "Currency should be XAF, XOF, or EUR for CEMAC/UEMOA regions"
            ]
        }


# Create singleton instance
momo_service = MoMoService()

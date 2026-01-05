"""
Stripe Checkout Service using emergentintegrations library
Provides real Stripe Checkout integration for the booking platform
"""
import os
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest
)

load_dotenv()
logger = logging.getLogger(__name__)


class StripeCheckoutService:
    """Service for handling Stripe Checkout operations"""
    
    def __init__(self):
        self.api_key = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
        self._checkout = None
    
    def _get_checkout_instance(self, webhook_url: str) -> StripeCheckout:
        """Get a StripeCheckout instance with the webhook URL"""
        return StripeCheckout(api_key=self.api_key, webhook_url=webhook_url)
    
    async def create_checkout_session(
        self,
        amount: float,
        currency: str,
        success_url: str,
        cancel_url: str,
        webhook_url: str,
        metadata: Optional[Dict[str, str]] = None,
        payment_methods: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout session for a payment
        
        Args:
            amount: Payment amount (must be float, e.g., 100.00)
            currency: Currency code (e.g., 'xaf', 'usd')
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if payment is cancelled
            webhook_url: URL for Stripe webhooks
            metadata: Additional metadata to store with the session
            payment_methods: List of payment methods (default: ['card'])
        
        Returns:
            Dict with checkout URL and session ID, or error
        """
        try:
            stripe_checkout = self._get_checkout_instance(webhook_url)
            
            # Ensure amount is float
            amount = float(amount)
            
            # Build the checkout request
            checkout_request = CheckoutSessionRequest(
                amount=amount,
                currency=currency.lower(),
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata or {},
                payment_methods=payment_methods or ['card']
            )
            
            # Create the checkout session
            session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
            
            logger.info(f"Created Stripe checkout session: {session.session_id}")
            
            return {
                "success": True,
                "url": session.url,
                "session_id": session.session_id
            }
            
        except Exception as e:
            logger.error(f"Error creating Stripe checkout session: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_checkout_status(
        self,
        session_id: str,
        webhook_url: str
    ) -> Dict[str, Any]:
        """
        Get the status of a Stripe checkout session
        
        Args:
            session_id: The Stripe checkout session ID
            webhook_url: URL for Stripe webhooks
        
        Returns:
            Dict with session status information
        """
        try:
            stripe_checkout = self._get_checkout_instance(webhook_url)
            
            status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
            
            return {
                "success": True,
                "status": status.status,
                "payment_status": status.payment_status,
                "amount_total": status.amount_total,
                "currency": status.currency,
                "metadata": status.metadata
            }
            
        except Exception as e:
            logger.error(f"Error getting checkout status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_webhook(
        self,
        webhook_url: str,
        body: bytes,
        signature: str
    ) -> Dict[str, Any]:
        """
        Handle incoming Stripe webhook
        
        Args:
            webhook_url: URL for Stripe webhooks
            body: Raw request body bytes
            signature: Stripe-Signature header value
        
        Returns:
            Dict with webhook event information
        """
        try:
            stripe_checkout = self._get_checkout_instance(webhook_url)
            
            webhook_response = await stripe_checkout.handle_webhook(body, signature)
            
            return {
                "success": True,
                "event_type": webhook_response.event_type,
                "event_id": webhook_response.event_id,
                "session_id": webhook_response.session_id,
                "payment_status": webhook_response.payment_status,
                "metadata": webhook_response.metadata
            }
            
        except Exception as e:
            logger.error(f"Error handling webhook: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Create singleton instance
stripe_checkout_service = StripeCheckoutService()

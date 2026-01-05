import React, { useState } from 'react';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

/**
 * StripeCheckoutButton - Initiates Stripe Checkout session and redirects to Stripe
 * 
 * @param {string} orderId - The order ID to pay for
 * @param {number} amount - Display amount (actual amount is retrieved server-side)
 * @param {string} currency - Display currency
 * @param {function} onSuccess - Called when checkout session is created
 * @param {function} onError - Called when there's an error
 * @param {boolean} disabled - Whether the button is disabled
 */
const StripeCheckoutButton = ({
  orderId,
  amount,
  currency = 'XAF',
  onSuccess,
  onError,
  disabled = false,
  buttonText = 'Pay with Card'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const initiateCheckout = async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the current origin URL for success/cancel redirects
      const originUrl = window.location.origin;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          order_id: orderId,
          origin_url: originUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create checkout session');
      }

      if (data.success && data.url) {
        // Store session info for status checking
        sessionStorage.setItem('stripe_session_id', data.session_id);
        sessionStorage.setItem('stripe_order_id', orderId);
        
        if (onSuccess) {
          onSuccess(data);
        }
        
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }

    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError(err.message);
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={initiateCheckout}
        disabled={disabled || isLoading}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating checkout...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            {buttonText}
            <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
          </>
        )}
      </Button>

      {amount && currency && (
        <p className="text-xs text-center text-slate-500">
          You will be redirected to Stripe secure checkout to complete your payment of{' '}
          <span className="font-semibold">{amount.toLocaleString()} {currency}</span>
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default StripeCheckoutButton;

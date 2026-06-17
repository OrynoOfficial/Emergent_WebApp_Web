import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, Wallet, ExternalLink, Smartphone, Clock, CheckCircle, XCircle, RefreshCw, Info, X, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import StripeCheckoutModal from '../payment/StripeCheckoutModal';
import { formatCurrency } from '../../utils/currency';
import useIdempotencyKey from '../../hooks/useIdempotencyKey';

const PaymentMethodsSelection = ({ 
  amount, 
  customerPhone, 
  customerEmail, 
  serviceDetails,
  onPaymentInitiated,
  disabled = false,
  triggerPayment,
  onTrigger,
  orderId, // For Stripe and MoMo Checkout
  onMoMoDialogOpen, // Callback when MoMo dialog opens
  onProcessingChange, // Callback to inform parent about processing state
  onMethodSelected, // Callback when a payment method is selected
  onCheckoutAbandoned, // Called when the Stripe checkout modal is closed without paying
  onRequestCreateOrder, // Optional: async () => orderId. Lazy-create the order if MoMo/Stripe is triggered without one.
}) => {
  const [selectedMethodInternal, setSelectedMethodInternal] = useState(null);
  const [isProcessingInternal, setIsProcessingInternal] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // MoMo specific states
  const [momoDialogOpen, setMomoDialogOpen] = useState(false);
  const [momoPhoneNumber, setMomoPhoneNumber] = useState(customerPhone || '');
  const [momoTransactionId, setMomoTransactionId] = useState(null);
  const [momoStatus, setMomoStatus] = useState(null);
  const [momoPollCount, setMomoPollCount] = useState(0);
  const maxPolls = 18; // 90 seconds with 5-second intervals
  // Wall-clock fail-safe so the modal never gets stuck on "pending" if the
  // polling loop swallows errors. 90s mirrors the maxPolls budget above.
  const MOMO_WALL_CLOCK_TIMEOUT_MS = 90_000;

  // Stripe checkout modal — opens in the foreground instead of navigating away
  const [stripeModalOpen, setStripeModalOpen] = useState(false);

  // Idempotency key — stable across retries within one checkout attempt.
  // We send it on every payment-initiation request so if the network drops
  // the response and the user retries (Stripe modal close+reopen, MoMo "Try
  // Again", network blip), the backend recognises the duplicate and returns
  // the original payment_id instead of double-charging.
  // The key is reset only on successful completion or explicit "Start over".
  const { key: idempotencyKey, reset: resetIdempotencyKey } = useIdempotencyKey();

  // ── V2 LEDGER INTEGRATION ─────────────────────────────────────────────
  // Every payment attempt writes an `intent_created` event to the immutable
  // ledger BEFORE we call the provider (Stripe modal / MoMo request-to-pay).
  // That way the audit trail is preserved even if the provider call fails
  // or the user abandons the flow. The `Idempotency-Key` header ensures
  // retries reuse the same payment_id.
  const v2PaymentIdRef = useRef(null);

  const createV2Intent = useCallback(async (provider) => {
    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    const response = await fetch(`${import.meta.env.VITE_API_URL}/v2/payments/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount,
        currency: serviceDetails?.currency || 'XAF',
        provider,
        order_id: orderId || serviceDetails?.order_id || null,
        customer_phone: customerPhone || null,
        metadata: {
          service_category: serviceDetails?.service_category,
          service_title: serviceDetails?.service_title,
          customer_email: customerEmail,
          operator_id: serviceDetails?.operator_id,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.detail || 'Could not create payment intent');
    }
    v2PaymentIdRef.current = data.payment_id;
    return data;
  }, [amount, customerEmail, customerPhone, idempotencyKey, orderId, serviceDetails]);

  const paymentMethods = [
    {
      id: 'stripe',
      name: 'Pay with Card',
      description: 'Visa, Mastercard, etc.',
      icon: () => (
        <div className="w-12 h-12 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-white">
          <img src="/assets/payment-logos/card-payment.png" alt="Visa / Mastercard" className="w-10 h-10 object-contain" />
        </div>
      ),
      requiresPhone: false,
      isStripe: true
    },
    {
      id: 'mtn_momo',
      name: 'MTN MoMo',
      description: 'Mobile Money',
      icon: () => (
        <div className="w-12 h-12 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-[#FFCC00]">
          <img src="/assets/payment-logos/mtn-momo.png" alt="MTN MoMo" className="w-10 h-10 object-contain" />
        </div>
      ),
      requiresPhone: true,
      isMoMo: true
    },
    {
      id: 'orange_money',
      name: 'Orange Money',
      description: 'Coming Soon',
      icon: () => (
        <div className="w-12 h-12 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-black opacity-50">
          <img src="/assets/payment-logos/orange-money.png" alt="Orange Money" className="w-10 h-10 object-contain" />
        </div>
      ),
      requiresPhone: true,
      isDisabled: true
    }
  ];

  // Update phone number when customerPhone changes
  useEffect(() => {
    if (customerPhone) {
      setMomoPhoneNumber(customerPhone);
    }
  }, [customerPhone]);

  // After MoMo reaches a terminal state, route accordingly:
  //   • completed → navigate to /orders after 2.5s so the user sees the
  //     green confirmation before we redirect.
  //   • failed / timed_out / cancelled → STAY on the booking page so the
  //     user can retry, switch method, or fix their phone number. The
  //     parent's onPaymentInitiated already received the failure outcome
  //     and surfaced an inline error. Sending them to /orders would
  //     bury the booking they were 1 step away from completing.
  useEffect(() => {
    if (!momoTransactionId) return;
    if (momoStatus === 'completed') {
      const t = setTimeout(() => {
        setMomoDialogOpen(false);
        resetMoMoPayment();
        navigate('/orders');
      }, 2500);
      return () => clearTimeout(t);
    }
    // Intentionally no navigate on failed / timed_out / cancelled — the
    // user remains on the booking page with the gateway modal still open
    // (showing the error + Try Again / Cancel CTAs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momoStatus, momoTransactionId]);

  // Poll for MoMo payment status
  useEffect(() => {
    if (!momoTransactionId || momoStatus === 'completed' || momoStatus === 'failed' || 
        momoStatus === 'timed_out' || momoStatus === 'cancelled' || momoPollCount >= maxPolls) {
      return;
    }

    const checkStatus = async () => {
      // ALWAYS increment pollCount, even on transient errors, so we eventually
      // hit the wall-clock timeout instead of polling forever. Without this,
      // a flaky network or backend hiccup would keep the modal stuck on
      // "Waiting for authorization…" indefinitely.
      let bumpedPoll = false;
      const bumpPoll = () => {
        if (!bumpedPoll) {
          bumpedPoll = true;
          setMomoPollCount(prev => prev + 1);
        }
      };
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/momo/status/${momoTransactionId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          const status = data.status;
          setMomoStatus(status);
          bumpPoll();

          if (status === 'completed') {
            setIsProcessingInternal(false);
            // Reset the idempotency key now that this attempt is complete —
            // the next checkout will start fresh.
            resetIdempotencyKey();
            // Notify parent that processing has stopped
            if (onProcessingChange) {
              onProcessingChange(false);
            }
            if (onPaymentInitiated) {
              onPaymentInitiated({ 
                success: true, 
                transactionRef: momoTransactionId,
                message: 'Payment completed successfully!'
              });
            }
          } else if (status === 'failed' || status === 'timed_out' || status === 'cancelled') {
            setIsProcessingInternal(false);
            // Notify parent that processing has stopped
            if (onProcessingChange) {
              onProcessingChange(false);
            }
            const errorMessage = data.message || data.reason || 'Payment was not completed';
            setError(errorMessage);
            if (onPaymentInitiated) {
              onPaymentInitiated({ success: false, message: errorMessage });
            }
          }
        } else {
          // Backend returned success:false (e.g. transaction missing) — still
          // count this as a poll so we don't loop forever.
          bumpPoll();
        }
      } catch (err) {
        console.error('Status check failed:', err);
        bumpPoll();
      }
    };

    const timer = setTimeout(checkStatus, 5000);
    return () => clearTimeout(timer);
  }, [momoTransactionId, momoStatus, momoPollCount, onPaymentInitiated, onProcessingChange]);

  // Hard wall-clock fail-safe — if the modal sits in "pending" for longer
  // than the configured timeout, force a terminal `timed_out` state so the
  // user sees an actionable error and the modal can be closed/retried even
  // if the polling loop above never gets a definitive answer from the server.
  useEffect(() => {
    if (!momoTransactionId || momoStatus !== 'pending') return undefined;
    const id = setTimeout(() => {
      setMomoStatus(prev => (prev === 'pending' ? 'timed_out' : prev));
      setError('Payment confirmation timed out. Please try again or pick another method.');
      setIsProcessingInternal(false);
      onProcessingChange?.(false);
      onPaymentInitiated?.({ success: false, message: 'Payment confirmation timed out' });
    }, MOMO_WALL_CLOCK_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [momoTransactionId, momoStatus, onProcessingChange, onPaymentInitiated]);

  const initiateMoMoPayment = async () => {
    let effectiveOrderId = orderId;
    if (!effectiveOrderId && typeof onRequestCreateOrder === 'function') {
      try {
        effectiveOrderId = await onRequestCreateOrder();
      } catch (e) {
        setError(e?.message || 'Failed to prepare order for payment');
        return;
      }
    }
    if (!effectiveOrderId) {
      setError('Order ID is required for MoMo payment');
      return;
    }

    if (!momoPhoneNumber || momoPhoneNumber.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsProcessingInternal(true);
    setError(null);
    setMomoStatus(null);
    setMomoPollCount(0);
    
    // Notify parent that processing has started
    if (onProcessingChange) {
      onProcessingChange(true);
    }

    try {
      // 1. Write intent_created to the V2 ledger BEFORE calling MoMo.
      //    Idempotent: a retry with the same key returns the same payment_id.
      await createV2Intent('mtn_momo');

      // 2. Trigger the actual MoMo request-to-pay.
      const response = await fetch(`${import.meta.env.VITE_API_URL}/momo/request-to-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          order_id: effectiveOrderId,
          phone_number: momoPhoneNumber.replace(/\s/g, ''),
          payer_message: serviceDetails?.service_title ? `Payment for ${serviceDetails.service_title}` : 'Payment',
          payee_note: '',
          // V2 ledger correlation — status poll handler appends
          // captured/failed events to the same payment_id.
          v2_payment_id: v2PaymentIdRef.current || undefined,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to initiate payment');
      }

      if (data.success) {
        setMomoTransactionId(data.transaction_id);
        setMomoStatus('pending');
      } else {
        throw new Error(data.error || 'Failed to initiate payment');
      }

    } catch (err) {
      console.error('MoMo payment error:', err);
      setError(err.message);
      setIsProcessingInternal(false);
      // Notify parent that processing has stopped
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: err.message });
      }
    }
  };

  const resetMoMoPayment = () => {
    setMomoTransactionId(null);
    setMomoStatus(null);
    setMomoPollCount(0);
    setError(null);
    setIsProcessingInternal(false);
    // Notify parent that processing has stopped
    if (onProcessingChange) {
      onProcessingChange(false);
    }
  };

  const closeMoMoDialog = (force = false) => {
    // Allow closing during pending only when explicitly requested (e.g. user
    // hits the X / Cancel & change method while waiting for authorisation).
    // We treat that as an implicit cancellation so the dialog actually closes
    // and the parent can abandon the unpaid order.
    if (momoStatus === 'pending' && !force) {
      // Default behavior: outside-click while pending — keep modal open.
      return;
    }
    setMomoDialogOpen(false);
    const wasUnpaid = momoStatus !== 'completed';
    resetMoMoPayment();
    if (wasUnpaid && typeof onCheckoutAbandoned === 'function') {
      onCheckoutAbandoned({ orderId, method: 'momo' });
    }
  };

  // Explicit cancel during pending — wired to the X button + Cancel CTA.
  const cancelPendingPayment = () => closeMoMoDialog(true);

  const getMoMoStatusIcon = () => {
    switch (momoStatus) {
      case 'completed':
        return <CheckCircle className="h-10 w-10 text-emerald-400" />;
      case 'failed':
      case 'timed_out':
      case 'cancelled':
        return <XCircle className="h-10 w-10 text-red-400" />;
      case 'pending':
        return <Clock className="h-10 w-10 text-[#c9a74a] animate-pulse" />;
      default:
        return <Smartphone className="h-10 w-10 text-[#c9a74a]" />;
    }
  };

  const getMoMoStatusMessage = () => {
    switch (momoStatus) {
      case 'completed':
        return 'Payment completed successfully!';
      case 'failed':
        return 'Payment failed. Please try again.';
      case 'timed_out':
        return 'Payment request timed out. Please try again.';
      case 'cancelled':
        return 'Payment was cancelled.';
      case 'pending':
        return 'Waiting for authorization...';
      default:
        return '';
    }
  };

  const initiateStripeCheckout = async () => {
    if (!orderId) {
      setError('Order ID is required for card payment');
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: 'Order ID missing' });
      }
      return;
    }

    setIsProcessingInternal(true);
    setError(null);

    try {
      // 1. Write intent_created to the V2 ledger BEFORE opening the Stripe
      //    modal. If the user abandons or Stripe fails, the audit row
      //    persists so finance can reconcile.
      try {
        await createV2Intent('stripe');
      } catch (intentErr) {
        // Non-fatal — fall back to the legacy Stripe modal path so the
        // user can still pay even if the ledger write fails for any reason.
        console.warn('V2 intent failed (non-fatal), continuing to Stripe:', intentErr);
      }

      // Open the premium checkout modal in the foreground (no page navigation).
      // The user can review the booking summary + payment amount and either
      // continue to Stripe or click "Choose a different payment method" to
      // come back to the payment options without losing their booking.
      setStripeModalOpen(true);
      setIsProcessingInternal(false);
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      if (onPaymentInitiated) {
        // opening_modal: true tells the parent to clear loading state and
        // reset triggerPayment without surfacing a "Payment Failed" toast.
        onPaymentInitiated({ opening_modal: true, orderId });
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError(err.message);
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: err.message });
      }
    } finally {
      setIsProcessingInternal(false);
    }
  };

  const initiatePayment = useCallback(async () => {
    if (!selectedMethodInternal) {
      setError('Please select a payment method.');
      // Reset processing state when no method selected
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: 'No payment method selected.' });
      }
      return;
    }
    if (isProcessingInternal) {
      return;
    }

    const currentMethod = paymentMethods.find(m => m.id === selectedMethodInternal);
    
    // Check if method is disabled
    if (currentMethod.isDisabled) {
      setError('This payment method is not available yet.');
      // Reset processing state
      if (onProcessingChange) {
        onProcessingChange(false);
      }
      return;
    }
    
    // Handle Stripe Checkout
    if (currentMethod.isStripe) {
      await initiateStripeCheckout();
      return;
    }

    // Handle MTN MoMo
    if (currentMethod.isMoMo) {
      setMomoDialogOpen(true);
      // Inform parent that MoMo dialog is opening (so it can hide loading state)
      if (onMoMoDialogOpen) {
        onMoMoDialogOpen();
      }
      return;
    }

    if (currentMethod.requiresPhone && !customerPhone) {
      setError('Phone number is required for mobile money payments');
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: 'Phone number missing' });
      }
      return;
    }
    if (!amount || amount <= 0) {
      setError('Invalid payment amount');
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: 'Invalid amount' });
      }
      return;
    }

    setIsProcessingInternal(true);
    setError(null);

    try {
      // Fallback path (only reached for non-Stripe / non-MoMo methods —
      // e.g. future PayPal). Write the V2 ledger intent and signal success
      // to the parent so it can render its own post-intent UX. The
      // provider-specific call is intentionally skipped here because each
      // method has its own dedicated flow above.
      const data = await createV2Intent(selectedMethodInternal);

      // Mint a fresh key for the next attempt once the intent is recorded.
      resetIdempotencyKey();

      if (onPaymentInitiated) {
        onPaymentInitiated({
          success: true,
          payment_id: data.payment_id,
          transactionRef: data.provider_reference,
          order_id: orderId,
          message: data.idempotent_replay ? 'Replayed existing intent' : 'Payment intent created',
          v2: data,
        });
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initiate payment');
      if (onPaymentInitiated) {
        onPaymentInitiated({ success: false, message: err.message || 'Failed to initiate payment' });
      }
    } finally {
      setIsProcessingInternal(false);
    }
  }, [selectedMethodInternal, isProcessingInternal, customerPhone, amount, onPaymentInitiated, serviceDetails, customerEmail, orderId, onMoMoDialogOpen, onProcessingChange, createV2Intent, resetIdempotencyKey]);

  // Fire initiatePayment exactly ONCE per false→true transition of triggerPayment.
  // Using a ref instead of relying on dependency arrays avoids the prior race
  // where (a) `disabled` early-returned, (b) onProcessingChange flipped paymentInProgress
  // off, (c) initiatePayment re-rendered and the effect re-fired — a fragile 2-pass
  // cycle that broke when parent's `onTrigger` flipped `triggerPayment` mid-flow.
  const prevTriggerRef = useRef(false);
  useEffect(() => {
    if (triggerPayment && !prevTriggerRef.current) {
      prevTriggerRef.current = true;
      if (selectedMethodInternal && !isProcessingInternal) {
        if (onTrigger) {
          onTrigger();
        }
        initiatePayment();
      }
    } else if (!triggerPayment && prevTriggerRef.current) {
      // Reset so the next false→true transition can re-fire
      prevTriggerRef.current = false;
    }
  }, [triggerPayment, selectedMethodInternal, isProcessingInternal, onTrigger, initiatePayment]);

  return (
    <div className="space-y-4 mt-4">
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Payment Method</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              data-testid={`payment-method-${method.id}`}
              aria-label={`Select ${method.id} payment method`}
              onClick={() => {
                if (!method.isDisabled) {
                  setSelectedMethodInternal(method.id);
                  if (onMethodSelected) {
                    onMethodSelected(method.id);
                  }
                }
              }}
              disabled={disabled || isProcessingInternal || method.isDisabled}
              className={`
                flex items-center justify-center p-3 rounded-lg border-2 transition-all
                ${selectedMethodInternal === method.id 
                  ? 'border-[#052c59] bg-blue-50' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
                ${(disabled || isProcessingInternal || method.isDisabled) && 'opacity-50 cursor-not-allowed'}
              `}
            >
              {isProcessingInternal && selectedMethodInternal === method.id ? (
                <div className="w-12 h-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#052c59]" />
                </div>
              ) : (
                <method.icon />
              )}
            </button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isProcessingInternal && selectedMethodInternal !== 'mtn_momo' && (
          <div className="mt-3 text-sm text-slate-600 text-center">
            Processing your payment...
          </div>
        )}
      </div>

      {/* ============ MTN MoMo Payment Dialog — Premium Revamp ============ */}
      {/*
        Matches the Stripe checkout modal's theme: dark navy gradient backdrop
        (#071d3c → #051530), champagne-gold #c9a74a accents, glass-morphism
        cards, compact typography. All state logic below is unchanged.
      */}
      <Dialog open={momoDialogOpen} onOpenChange={(v) => { if (!v) closeMoMoDialog(true); }}>
        <DialogContent
          data-testid="momo-payment-modal"
          showCloseButton={false}
          /* Portrait-shaped layout — narrower (~360px) and taller, so the
             card reads top-to-bottom instead of stretching across desktop
             screens. Max-height lets the body scroll internally if the
             content overflows on smaller laptops. */
          className="!max-w-none w-[92vw] max-w-[360px] sm:max-w-[360px] max-h-[92vh] p-0 border-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#071d3c] via-[#0a2e5c] to-[#051530] flex flex-col"
          onPointerDownOutside={(e) => {
            // Block outside-click close while still pending so the user
            // doesn't accidentally cancel an in-flight authorisation.
            if (momoStatus === 'pending') e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (momoStatus === 'pending') e.preventDefault();
          }}
        >
          {/* Custom close button — visible on dark navy gradient (the default
              shadcn X is dark-on-dark and was invisible). Wired through
              cancelPendingPayment so closing during pending also abandons
              the in-flight order. */}
          <button
            type="button"
            onClick={cancelPendingPayment}
            data-testid="momo-close-btn"
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-[#c9a74a]"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Decorative overlays (match Stripe checkout) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
          />
          <div className="pointer-events-none absolute -top-32 -right-24 h-[380px] w-[380px] rounded-full bg-[#c9a74a]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full bg-[#082c59]/60 blur-3xl" />

          <div className="relative h-full overflow-y-auto px-4 sm:px-5 py-4">
            <DialogHeader className="space-y-1.5 mb-4 text-left">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a74a] font-semibold flex items-center gap-2">
                <Smartphone className="h-3 w-3" />
                Mobile Money · MTN MoMo
              </p>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-tight">
                Confirm on your phone
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Approve the payment request that's been sent to your MTN MoMo account.
              </DialogDescription>
            </DialogHeader>

            {/* Amount card — navy gradient band with gold glow */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#082c59] via-[#0a346c] to-[#071d3c] text-white mb-4 border border-white/10">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #c9a74a 0%, transparent 40%)' }} />
              <div className="relative px-4 py-4">
                <p className="text-[9px] uppercase tracking-[0.16em] text-[#c9a74a] font-semibold flex items-center gap-1.5">
                  <Wallet className="h-3 w-3" />
                  Amount to Pay
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold leading-none" data-testid="momo-amount">
                  {formatCurrency(amount || 0)}
                </p>
                <p className="mt-1 text-[10px] text-slate-300">FCFA (Central African CFA franc)</p>
              </div>
            </div>

            {/* Form or Status */}
            {!momoTransactionId ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.03] border border-white/10 backdrop-blur-xl p-4">
                  <Label htmlFor="momo-phone" className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="momo-phone"
                    data-testid="momo-phone-input"
                    type="tel"
                    placeholder="237670000001"
                    value={momoPhoneNumber}
                    onChange={(e) => setMomoPhoneNumber(e.target.value)}
                    disabled={isProcessingInternal}
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-[#c9a74a] focus:ring-[#c9a74a]/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Enter the MTN Mobile Money number registered to your SIM.
                  </p>
                </div>

                {/* Sandbox testing hints — dev mode only (hidden in production builds) */}
                {import.meta.env.MODE !== 'production' && (
                  <div className="rounded-2xl border border-[#c9a74a]/20 bg-[#c9a74a]/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#c9a74a] font-semibold flex items-center gap-1.5 mb-1.5">
                      <Info className="h-3 w-3" />
                      Sandbox Testing
                    </p>
                    <ul className="text-[11px] text-slate-300 space-y-0.5">
                      <li>• Ending 1-5 → succeeds</li>
                      <li>• Ending 6-7 → fails</li>
                      <li>• Ending 8-9 → times out</li>
                      <li>• Ending 0 → cancelled</li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.03] border border-white/10 backdrop-blur-xl p-4 text-center space-y-3">
                <div className="flex justify-center">
                  {getMoMoStatusIcon()}
                </div>
                <p className="text-sm font-semibold text-white" data-testid="momo-status-message">
                  {getMoMoStatusMessage()}
                </p>

                {momoStatus === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c9a74a]" />
                      Checking status… ({momoPollCount}/{maxPolls})
                    </div>
                    <div className="rounded-xl border border-[#c9a74a]/20 bg-[#c9a74a]/5 p-3 text-left">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#c9a74a] font-semibold flex items-center gap-1.5 mb-1.5">
                        <Smartphone className="h-3 w-3" />
                        Check your phone
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300">
                        <li>Open MTN MoMo or dial *126#</li>
                        <li>Approve the payment request</li>
                        <li>Enter your PIN to confirm</li>
                      </ol>
                    </div>

                    {/* Sticky-warning the user before they reload — payments
                        already in-flight can't be re-attached if the tab
                        refreshes mid-poll. */}
                    <div
                      className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-2.5 text-left flex items-start gap-2"
                      data-testid="momo-do-not-close-warning"
                    >
                      <ShieldAlert className="h-4 w-4 text-amber-300 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-100 leading-snug">
                        <span className="font-semibold">Do not close or refresh this window.</span> Your payment is being processed — if you leave, you&rsquo;ll have to start the authorisation over.
                      </p>
                    </div>

                    {/* Allow the user to abort without waiting for the
                        90-second wall-clock timeout — eg. they typed the
                        wrong sandbox number. */}
                    <Button
                      variant="outline"
                      onClick={cancelPendingPayment}
                      data-testid="momo-cancel-pending-btn"
                      className="w-full h-9 text-xs bg-white/5 hover:bg-white/15 text-white border-white/30 hover:border-[#c9a74a] hover:text-white"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-2" />
                      Cancel & change method
                    </Button>
                  </div>
                )}

                {momoStatus === 'completed' && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
                    <p className="text-sm text-white font-semibold">Payment confirmed</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">Your booking is now locked in.</p>
                  </div>
                )}

                {(momoStatus === 'failed' || momoStatus === 'timed_out' || momoStatus === 'cancelled') && (
                  <Button
                    variant="outline"
                    onClick={resetMoMoPayment}
                    data-testid="momo-try-again-btn"
                    className="w-full h-9 text-xs bg-white/5 hover:bg-white/15 text-white border-white/30 hover:border-[#c9a74a] hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Try Again
                  </Button>
                )}

                {momoPollCount >= maxPolls && momoStatus === 'pending' && (
                  <div className="space-y-2">
                    <Alert variant="destructive" className="bg-red-500/10 border-red-400/30 text-red-200">
                      <AlertDescription className="text-xs">
                        Payment status check timed out. The payment may still be processing.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      onClick={resetMoMoPayment}
                      className="w-full h-9 text-xs bg-white/5 hover:bg-white/15 text-white border-white/30 hover:text-white"
                    >
                      Start Over
                    </Button>
                  </div>
                )}
              </div>
            )}

            {error && momoDialogOpen && (
              <Alert variant="destructive" className="mt-3 bg-red-500/10 border-red-400/30 text-red-200">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Footer CTAs (same logic as before, just restyled) */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {!momoTransactionId ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setMomoDialogOpen(false)}
                    disabled={isProcessingInternal}
                    data-testid="momo-change-method-btn"
                    /* Explicit bg-white/5 so the button is visible on the
                       dark navy gradient BEFORE hover (the default shadcn
                       outline button uses bg-background which is white,
                       washing out white text & making the CTA invisible
                       until hover). */
                    className="w-full sm:w-auto h-9 text-xs bg-white/5 hover:bg-white/15 text-white border-white/30 hover:border-[#c9a74a] hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Choose a different payment method
                  </Button>
                  <Button
                    onClick={initiateMoMoPayment}
                    disabled={isProcessingInternal || !momoPhoneNumber}
                    data-testid="momo-request-payment-btn"
                    className="w-full sm:flex-1 h-10 text-sm font-semibold bg-[#082c59] hover:bg-[#0a346c] text-white shadow-lg shadow-[#082c59]/20"
                  >
                    {isProcessingInternal ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending request…</>
                    ) : (
                      <><Smartphone className="h-4 w-4 mr-2" /> Request Payment</>
                    )}
                  </Button>
                </>
              ) : (
                momoStatus === 'completed' && (
                  <Button
                    onClick={() => {
                      setMomoDialogOpen(false);
                      resetMoMoPayment();
                    }}
                    data-testid="momo-continue-btn"
                    className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Continue
                  </Button>
                )
              )}
            </div>

            {/* Trust footer (small) */}
            {!momoTransactionId && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  MTN MoMo is processed directly on your phone — we never see or store your PIN.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium in-foreground Stripe checkout modal (replaces the old /payment/checkout redirect) */}
      <StripeCheckoutModal
        open={stripeModalOpen}
        v2PaymentId={v2PaymentIdRef.current}
        onClose={() => {
          // If the modal is closing and we still have an unpaid order, tell
          // the parent so it can abandon (delete) it. Triggered both by the
          // dialog X / overlay click AND by "Choose a different payment
          // method" inside the panel.
          setStripeModalOpen(false);
          if (typeof onCheckoutAbandoned === 'function') {
            onCheckoutAbandoned({ orderId, method: 'stripe' });
          }
        }}
        orderId={orderId}
      />
    </div>
  );
};

export default PaymentMethodsSelection;

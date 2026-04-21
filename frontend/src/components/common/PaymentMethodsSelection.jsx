import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Loader2, Wallet, ExternalLink, Smartphone, Clock, CheckCircle, XCircle, RefreshCw, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import StripeCheckoutModal from '../payment/StripeCheckoutModal';
import { formatCurrency } from '../../utils/currency';

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
  onMethodSelected // Callback when a payment method is selected
}) => {
  const [selectedMethodInternal, setSelectedMethodInternal] = useState(null);
  const [isProcessingInternal, setIsProcessingInternal] = useState(false);
  const [error, setError] = useState(null);
  
  // MoMo specific states
  const [momoDialogOpen, setMomoDialogOpen] = useState(false);
  const [momoPhoneNumber, setMomoPhoneNumber] = useState(customerPhone || '');
  const [momoTransactionId, setMomoTransactionId] = useState(null);
  const [momoStatus, setMomoStatus] = useState(null);
  const [momoPollCount, setMomoPollCount] = useState(0);
  const maxPolls = 24; // 2 minutes with 5-second intervals

  // Stripe checkout modal — opens in the foreground instead of navigating away
  const [stripeModalOpen, setStripeModalOpen] = useState(false);

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

  // Poll for MoMo payment status
  useEffect(() => {
    if (!momoTransactionId || momoStatus === 'completed' || momoStatus === 'failed' || 
        momoStatus === 'timed_out' || momoStatus === 'cancelled' || momoPollCount >= maxPolls) {
      return;
    }

    const checkStatus = async () => {
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
          setMomoPollCount(prev => prev + 1);

          if (status === 'completed') {
            setIsProcessingInternal(false);
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
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    };

    const timer = setTimeout(checkStatus, 5000);
    return () => clearTimeout(timer);
  }, [momoTransactionId, momoStatus, momoPollCount, onPaymentInitiated, onProcessingChange]);

  const initiateMoMoPayment = async () => {
    if (!orderId) {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/momo/request-to-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          order_id: orderId,
          phone_number: momoPhoneNumber.replace(/\s/g, ''),
          payer_message: serviceDetails?.service_title ? `Payment for ${serviceDetails.service_title}` : 'Payment',
          payee_note: ''
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

  const closeMoMoDialog = () => {
    if (momoStatus !== 'pending') {
      setMomoDialogOpen(false);
      resetMoMoPayment();
    }
  };

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
    if (disabled || isProcessingInternal) {
      // Reset processing state if disabled
      if (onProcessingChange) {
        onProcessingChange(false);
      }
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          amount,
          payment_method: selectedMethodInternal,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          service_details: serviceDetails
        })
      });

      const data = await response.json();
      
      if (onPaymentInitiated) {
        onPaymentInitiated(data);
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
  }, [selectedMethodInternal, disabled, isProcessingInternal, customerPhone, amount, onPaymentInitiated, serviceDetails, customerEmail, orderId, onMoMoDialogOpen, onProcessingChange]);

  useEffect(() => {
    if (triggerPayment && selectedMethodInternal && !isProcessingInternal) {
      if (onTrigger) {
        onTrigger();
      }
      initiatePayment();
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
      <Dialog open={momoDialogOpen} onOpenChange={closeMoMoDialog}>
        <DialogContent
          data-testid="momo-payment-modal"
          className="!max-w-none w-screen h-screen sm:h-auto sm:max-h-[80vh] sm:w-[64vw] sm:max-w-md p-0 border-0 sm:rounded-2xl overflow-hidden bg-gradient-to-br from-[#071d3c] via-[#0a2e5c] to-[#051530]"
        >
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

                {/* Sandbox testing hints (kept for developer UX, visually restyled) */}
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
                    className="w-full h-9 text-xs border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-[#c9a74a]"
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
                      className="w-full h-9 text-xs border-white/20 text-white hover:bg-white/10 hover:text-white"
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
                    className="w-full sm:w-auto h-9 text-xs border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-[#c9a74a]"
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
        onClose={() => setStripeModalOpen(false)}
        orderId={orderId}
      />
    </div>
  );
};

export default PaymentMethodsSelection;

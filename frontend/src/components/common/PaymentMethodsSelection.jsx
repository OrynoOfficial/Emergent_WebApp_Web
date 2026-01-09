import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Loader2, Wallet, ExternalLink, Smartphone, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

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

  const paymentMethods = [
    {
      id: 'stripe',
      name: 'Pay with Card',
      description: 'Visa, Mastercard, etc.',
      icon: () => (
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
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
        <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-blue-900" />
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
        <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center opacity-50">
          <Wallet className="w-6 h-6 text-white" />
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
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'failed':
      case 'timed_out':
      case 'cancelled':
        return <XCircle className="h-12 w-12 text-red-500" />;
      case 'pending':
        return <Clock className="h-12 w-12 text-yellow-500 animate-pulse" />;
      default:
        return <Smartphone className="h-12 w-12 text-yellow-600" />;
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
      // Redirect to our custom checkout confirmation page
      // This page shows FCFA price with USD/EUR conversions before redirecting to Stripe
      sessionStorage.setItem('stripe_order_id', orderId);
      
      if (onPaymentInitiated) {
        onPaymentInitiated({ redirecting: true, redirectUrl: `/payment/checkout?order_id=${orderId}` });
      }
      
      // Navigate to checkout confirmation page
      window.location.href = `/payment/checkout?order_id=${orderId}`;

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
                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
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
              <div className="text-center">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  {method.name}
                  {method.isStripe && <ExternalLink className="w-3 h-3 opacity-50" />}
                </span>
                {method.description && (
                  <span className="text-xs text-slate-500">{method.description}</span>
                )}
              </div>
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
            {selectedMethodInternal === 'stripe' 
              ? 'Redirecting to secure checkout...' 
              : 'Processing your payment...'}
          </div>
        )}

        {selectedMethodInternal === 'stripe' && !isProcessingInternal && (
          <p className="mt-3 text-xs text-center text-slate-500">
            You will be redirected to Stripe secure checkout
          </p>
        )}

        {selectedMethodInternal === 'mtn_momo' && !isProcessingInternal && (
          <p className="mt-3 text-xs text-center text-slate-500">
            Pay securely with your MTN Mobile Money account
          </p>
        )}
      </div>

      {/* MTN MoMo Payment Dialog */}
      <Dialog open={momoDialogOpen} onOpenChange={closeMoMoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-yellow-600" />
              MTN Mobile Money Payment
            </DialogTitle>
            <DialogDescription>
              Pay securely using your MTN MoMo account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount Display */}
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-700">Amount to Pay</p>
              <p className="text-2xl font-bold text-yellow-900">
                {amount?.toLocaleString()} XAF
              </p>
            </div>

            {/* Payment Form or Status */}
            {!momoTransactionId ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="momo-phone">Phone Number</Label>
                  <Input
                    id="momo-phone"
                    type="tel"
                    placeholder="e.g., 237670000001"
                    value={momoPhoneNumber}
                    onChange={(e) => setMomoPhoneNumber(e.target.value)}
                    disabled={isProcessingInternal}
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500">
                    Enter your MTN Mobile Money phone number
                  </p>
                </div>

                {/* Sandbox Test Info */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-blue-800 mb-1">🧪 Sandbox Testing</p>
                  <ul className="text-blue-700 space-y-1">
                    <li>• Numbers ending in 1-5: Will succeed</li>
                    <li>• Numbers ending in 6-7: Will fail</li>
                    <li>• Numbers ending in 8-9: Will timeout</li>
                    <li>• Numbers ending in 0: Will be cancelled</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  {getMoMoStatusIcon()}
                </div>
                <p className="text-lg font-medium">{getMoMoStatusMessage()}</p>
                
                {momoStatus === 'pending' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking status... ({momoPollCount}/{maxPolls})
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
                      <p className="font-semibold mb-1">📱 Check your phone!</p>
                      <ol className="list-decimal list-inside space-y-1 text-left">
                        <li>Open MTN MoMo app or dial *126#</li>
                        <li>Approve the payment request</li>
                        <li>Enter your PIN to confirm</li>
                      </ol>
                    </div>
                  </div>
                )}

                {momoStatus === 'completed' && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">Your booking is now confirmed!</p>
                  </div>
                )}

                {(momoStatus === 'failed' || momoStatus === 'timed_out' || momoStatus === 'cancelled') && (
                  <Button 
                    variant="outline" 
                    onClick={resetMoMoPayment}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}

                {momoPollCount >= maxPolls && momoStatus === 'pending' && (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertDescription>
                        Payment status check timed out. The payment may still be processing.
                      </AlertDescription>
                    </Alert>
                    <Button variant="outline" onClick={resetMoMoPayment} className="w-full">
                      Start Over
                    </Button>
                  </div>
                )}
              </div>
            )}

            {error && momoDialogOpen && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!momoTransactionId ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setMomoDialogOpen(false)}
                  disabled={isProcessingInternal}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={initiateMoMoPayment}
                  disabled={isProcessingInternal || !momoPhoneNumber}
                  className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
                >
                  {isProcessingInternal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending request...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Request Payment
                    </>
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
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Continue
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsSelection;

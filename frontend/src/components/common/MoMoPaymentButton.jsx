import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';

/**
 * MoMoPaymentButton - Initiates MTN Mobile Money payment and monitors status
 * 
 * @param {string} orderId - The order ID to pay for
 * @param {number} amount - Display amount (actual amount is retrieved server-side)
 * @param {string} currency - Display currency (default XAF)
 * @param {function} onSuccess - Called when payment succeeds
 * @param {function} onError - Called when there's an error
 * @param {boolean} disabled - Whether the button is disabled
 */
const MoMoPaymentButton = ({
  orderId,
  amount,
  currency = 'XAF',
  onSuccess,
  onError,
  disabled = false,
  buttonText = 'Pay with MTN MoMo'
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Payment monitoring state
  const [transactionId, setTransactionId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 24; // 2 minutes with 5-second intervals

  // Poll for payment status
  useEffect(() => {
    if (!transactionId || paymentStatus === 'completed' || paymentStatus === 'failed' || 
        paymentStatus === 'timed_out' || paymentStatus === 'cancelled' || pollCount >= maxPolls) {
      return;
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/momo/status/${transactionId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          const status = data.status;
          setPaymentStatus(status);
          setPollCount(prev => prev + 1);

          if (status === 'completed') {
            toast.success('Payment successful!');
            if (onSuccess) {
              onSuccess(data);
            }
          } else if (status === 'failed' || status === 'timed_out' || status === 'cancelled') {
            const errorMessage = data.message || data.reason || 'Payment was not completed';
            setError(errorMessage);
            if (onError) {
              onError(new Error(errorMessage));
            }
          }
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    };

    const timer = setTimeout(checkStatus, 5000);
    return () => clearTimeout(timer);
  }, [transactionId, paymentStatus, pollCount, onSuccess, onError]);

  const initiatePayment = async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPaymentStatus(null);
    setPollCount(0);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/momo/request-to-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          order_id: orderId,
          phone_number: phoneNumber.replace(/\s/g, ''),
          payer_message: `Payment for order ${orderId.substring(0, 8)}`,
          payee_note: ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to initiate payment');
      }

      if (data.success) {
        setTransactionId(data.transaction_id);
        setPaymentStatus('pending');
        toast.info('Payment request sent. Please check your phone to authorize.');
      } else {
        throw new Error(data.error || 'Failed to initiate payment');
      }

    } catch (err) {
      console.error('MoMo payment error:', err);
      setError(err.message);
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetPayment = () => {
    setTransactionId(null);
    setPaymentStatus(null);
    setPollCount(0);
    setError(null);
  };

  const closeDialog = () => {
    if (paymentStatus !== 'pending') {
      setIsDialogOpen(false);
      resetPayment();
    }
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
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

  const getStatusMessage = () => {
    switch (paymentStatus) {
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

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled}
        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white py-3"
      >
        <Smartphone className="w-5 h-5 mr-2" />
        {buttonText}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
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
                {amount?.toLocaleString()} {currency}
              </p>
            </div>

            {/* Payment Form or Status */}
            {!transactionId ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g., 237670000001"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={isLoading}
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
                  {getStatusIcon()}
                </div>
                <p className="text-lg font-medium">{getStatusMessage()}</p>
                
                {paymentStatus === 'pending' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking status... ({pollCount}/{maxPolls})
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

                {paymentStatus === 'completed' && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <p className="text-green-800 font-medium">Your booking is now confirmed!</p>
                  </div>
                )}

                {(paymentStatus === 'failed' || paymentStatus === 'timed_out' || paymentStatus === 'cancelled') && (
                  <Button 
                    variant="outline" 
                    onClick={resetPayment}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}

                {pollCount >= maxPolls && paymentStatus === 'pending' && (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Payment status check timed out. The payment may still be processing.
                      </AlertDescription>
                    </Alert>
                    <Button variant="outline" onClick={resetPayment} className="w-full">
                      Start Over
                    </Button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!transactionId ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={initiatePayment}
                  disabled={isLoading || !phoneNumber}
                  className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
                >
                  {isLoading ? (
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
              paymentStatus === 'completed' && (
                <Button 
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetPayment();
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
    </>
  );
};

export default MoMoPaymentButton;

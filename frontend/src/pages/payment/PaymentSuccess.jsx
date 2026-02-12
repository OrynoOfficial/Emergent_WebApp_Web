import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle, Home, Receipt, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import api from '../../api/client';

/**
 * PaymentSuccess - Handles successful Stripe checkout return
 * Polls the backend to verify payment status
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking, success, failed, error
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session ID provided');
      return;
    }

    const checkPaymentStatus = async (attempts = 0) => {
      const maxAttempts = 8;
      const pollInterval = 2500;

      if (attempts >= maxAttempts) {
        setStatus('error');
        setError('Payment verification timed out. Please check your orders for confirmation.');
        return;
      }

      try {
        const response = await api.get(`/checkout/status/${sessionId}`);
        const data = response.data;
        setPaymentInfo(data);

        if (data.payment_status === 'paid') {
          setStatus('success');
          sessionStorage.removeItem('stripe_session_id');
          sessionStorage.removeItem('stripe_order_id');
          return;
        } else if (data.status === 'expired') {
          setStatus('failed');
          setError('Payment session expired. Please try again.');
          return;
        }

        // Continue polling if payment is still pending
        setTimeout(() => checkPaymentStatus(attempts + 1), pollInterval);

      } catch (err) {
        console.error('Error checking payment status:', err);
        if (attempts < maxAttempts - 1) {
          setTimeout(() => checkPaymentStatus(attempts + 1), pollInterval);
        } else {
          setStatus('error');
          setError('Error verifying payment. Please check your orders.');
        }
      }
    };

    checkPaymentStatus();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'checking' && (
            <>
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle>Verifying Payment</CardTitle>
              <CardDescription>Please wait while we confirm your payment...</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-green-700">Payment Successful!</CardTitle>
              <CardDescription>Your payment has been received</CardDescription>
            </>
          )}

          {(status === 'failed' || status === 'error') && (
            <>
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-red-700">
                {status === 'failed' ? 'Payment Failed' : 'Verification Error'}
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && paymentInfo && (
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Amount Paid</span>
                <span className="font-semibold">
                  {(paymentInfo.amount_total / 100).toFixed(2)} {paymentInfo.currency?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Status</span>
                <span className="text-green-600 font-medium">Completed</span>
              </div>
              {paymentInfo.metadata?.order_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Order ID</span>
                  <span className="font-mono text-xs">{paymentInfo.metadata.order_id}</span>
                </div>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Your booking is pending confirmation. You'll receive a notification once it's confirmed.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={() => navigate('/orders')}
              className="w-full"
            >
              <Receipt className="w-4 h-4 mr-2" />
              View My Orders
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;

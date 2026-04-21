import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { XCircle, Home, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

/**
 * PaymentCancel - Handles cancelled Stripe checkout
 */
const PaymentCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get('order_id');

  // Auto-redirect to /orders 5s after a cancelled payment — user has time to
  // read the message; the Retry button still navigates immediately on click.
  useEffect(() => {
    const t = setTimeout(() => navigate('/orders'), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  const handleRetry = () => {
    // Navigate back to the booking page or orders
    if (orderId) {
      navigate(`/orders`);
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle className="text-amber-700">Payment Cancelled</CardTitle>
          <CardDescription>
            Your payment was not completed. Your order has been saved and you can try again.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {orderId && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">
                Order ID: <span className="font-mono text-xs">{orderId}</span>
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              No charges have been made to your card. You can retry the payment at any time from your orders page.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={handleRetry}
              className="w-full bg-[#052c59] hover:bg-[#041d3a]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Payment
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="w-full text-slate-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;

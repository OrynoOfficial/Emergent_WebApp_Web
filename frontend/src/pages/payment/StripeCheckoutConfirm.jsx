import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { ArrowLeft, CreditCard, Shield, Loader2, ExternalLink, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import api from '../../api/client';

// Exchange rates (approximate)
const FCFA_TO_USD = 1 / 600;
const FCFA_TO_EUR = 1 / 655;

export default function StripeCheckoutConfirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        setError('No order ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get(`/orders/${orderId}`);
        setOrder(response.data);
      } catch (err) {
        console.error('Failed to load order:', err);
        setError('Failed to load order details');
      } finally {
        setIsLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  const handleProceedToStripe = async () => {
    setIsProcessing(true);
    try {
      const response = await api.post('/checkout/session', {
        order_id: orderId,
        origin_url: window.location.origin
      });

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.detail || 'Failed to initiate payment');
      setIsProcessing(false);
    }
  };

  const formatUSD = (fcfa) => {
    const usd = fcfa * FCFA_TO_USD;
    return `$${usd.toFixed(2)} USD`;
  };

  const formatEUR = (fcfa) => {
    const eur = fcfa * FCFA_TO_EUR;
    return `€${eur.toFixed(2)} EUR`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg flex items-center gap-3 shadow">
          <Loader2 className="h-6 w-6 animate-spin text-[#082c59]" />
          <span className="text-lg font-semibold">Loading order details...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <Info className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-slate-600 mb-4">{error || 'Order not found'}</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = order.total_amount || order.final_amount || 0;
  const bookingDetails = order.booking_details || {};

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Side - Logo, Booking Summary */}
          <div className="space-y-6">
            {/* Logo and Slogan */}
            <Card>
              <CardContent className="p-6 text-center">
                <img 
                  src="https://customer-assets.emergentagent.com/job_momobook-app/artifacts/syef01ek_f6726dae0_logo.png" 
                  alt="Logo" 
                  className="h-20 w-auto mx-auto mb-3"
                />
                <p className="text-slate-600 italic text-lg">Convenient, Reliable</p>
              </CardContent>
            </Card>

            {/* Booking Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Order Number</p>
                  <p className="font-semibold">{order.order_number}</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-500">Service</p>
                  <p className="font-semibold">{order.service_name}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Category</p>
                  <Badge variant="outline" className="capitalize">
                    {(order.service_category || order.service_type)?.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Travel-specific details */}
                {bookingDetails.departure_city && bookingDetails.destination_city && (
                  <div>
                    <p className="text-sm text-slate-500">Route</p>
                    <p className="font-semibold">
                      {bookingDetails.departure_city} → {bookingDetails.destination_city}
                    </p>
                  </div>
                )}

                {bookingDetails.travel_date && (
                  <div>
                    <p className="text-sm text-slate-500">Travel Date</p>
                    <p className="font-semibold">{bookingDetails.travel_date}</p>
                  </div>
                )}

                {/* Hotel-specific details */}
                {bookingDetails.check_in && (
                  <div>
                    <p className="text-sm text-slate-500">Check-in</p>
                    <p className="font-semibold">{bookingDetails.check_in}</p>
                  </div>
                )}

                {bookingDetails.check_out && (
                  <div>
                    <p className="text-sm text-slate-500">Check-out</p>
                    <p className="font-semibold">{bookingDetails.check_out}</p>
                  </div>
                )}

                {/* Passengers */}
                {bookingDetails.passengers?.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-500">Passengers</p>
                    <p className="font-semibold">{bookingDetails.passengers.length} passenger(s)</p>
                  </div>
                )}

                {/* Operator */}
                {bookingDetails.operator_name && (
                  <div>
                    <p className="text-sm text-slate-500">Operator</p>
                    <p className="font-semibold">{bookingDetails.operator_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Price and Payment */}
          <div className="space-y-6">
            {/* Price Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Amount
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Price in FCFA */}
                <div className="text-center py-4 bg-slate-50 rounded-lg">
                  <p className="text-4xl font-bold text-[#082c59]">
                    {formatCurrency(amount)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">FCFA (CFA Franc)</p>
                </div>

                {/* Currency Conversions */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2 flex items-center gap-1">
                    <Info className="h-4 w-4" /> Approximate Conversions
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-white rounded">
                      <p className="text-lg font-semibold text-slate-800">{formatUSD(amount)}</p>
                      <p className="text-xs text-slate-500">US Dollar</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <p className="text-lg font-semibold text-slate-800">{formatEUR(amount)}</p>
                      <p className="text-xs text-slate-500">Euro</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    * Stripe will charge in USD. Final amount may vary slightly due to exchange rates.
                  </p>
                </div>

                <Separator />

                {/* Security Notice */}
                <div className="flex items-start gap-3 text-sm text-slate-600">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Secure Payment</p>
                    <p>Your payment is processed securely by Stripe. We never store your card details.</p>
                  </div>
                </div>

                {/* Proceed Button */}
                <Button
                  onClick={handleProceedToStripe}
                  disabled={isProcessing}
                  className="w-full h-12 text-lg bg-[#082c59] hover:bg-[#0a3a75]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : (
                    <>
                      Proceed to Payment
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-slate-500">
                  You will be redirected to Stripe's secure checkout page
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

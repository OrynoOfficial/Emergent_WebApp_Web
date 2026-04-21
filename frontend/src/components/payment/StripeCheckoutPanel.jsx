import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ArrowLeft, CreditCard, Shield, Loader2, ExternalLink, Info, RefreshCw,
  MapPin, Calendar, Clock, Users, Bus, Hotel, Car, Utensils, Film, Package, PartyPopper, Sparkles,
  Lock, CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { formatDate as fmtDate } from '../../utils/dateUtils';
import api from '../../api/client';

// Stripe always charges in USD — approximate live-rate conversions shown to the user.
const FCFA_TO_USD = 1 / 600;
const FCFA_TO_EUR = 1 / 655;

const SERVICE_ICONS = {
  travel: Bus,
  hotel: Hotel,
  car_rental: Car,
  restaurant: Utensils,
  cinema: Film,
  package: Package,
  event: PartyPopper,
  banquet: Sparkles,
};

const PremiumRow = ({ label, value, icon: Icon, testid }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0" data-testid={testid}>
      {Icon && (
        <div className="h-8 w-8 rounded-lg bg-[#c9a74a]/10 border border-[#c9a74a]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-[#c9a74a]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium">{label}</p>
        <p className="text-sm text-white font-semibold mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
};

/**
 * Reusable premium checkout UI. Renders inside either the full-page route
 * (StripeCheckoutConfirm.jsx) or the in-app modal (StripeCheckoutModal.jsx).
 *
 * Props:
 *   orderId         — string, the order to pay for
 *   onBack          — called when the user clicks "Back" in the top-left (defaults to history.back())
 *   onChangeMethod  — called when the user clicks "Choose a different payment method"
 *                     (in modal context this should close the dialog)
 *   variant         — "page" | "modal". Only changes outer spacing, never the card styling.
 */
export default function StripeCheckoutPanel({ orderId, onBack, onChangeMethod, variant = 'page' }) {
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
        origin_url: window.location.origin,
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

  const formatUSD = (fcfa) => `$${(fcfa * FCFA_TO_USD).toFixed(2)}`;
  const formatEUR = (fcfa) => `€${(fcfa * FCFA_TO_EUR).toFixed(2)}`;

  const outerPadding = variant === 'modal'
    ? 'px-4 sm:px-6 lg:px-8 py-6 lg:py-8'
    : 'px-4 sm:px-6 lg:px-8 py-8 lg:py-12';

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="checkout-panel-loading">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl flex items-center gap-3 shadow-2xl">
          <Loader2 className="h-6 w-6 animate-spin text-[#c9a74a]" />
          <span className="text-base font-semibold text-white">Loading order details…</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl text-center shadow-2xl">
          <div className="h-14 w-14 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center mx-auto mb-5">
            <Info className="h-7 w-7 text-red-300" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">Something went wrong</h2>
          <p className="text-slate-300 mb-6">{error || 'Order not found'}</p>
          <Button
            onClick={onBack || (() => window.history.back())}
            className="bg-white text-[#071d3c] hover:bg-slate-100"
            data-testid="checkout-error-back-btn"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const amount = order.total_amount || order.final_amount || 0;
  const bd = order.booking_details || {};
  const ServiceIcon = SERVICE_ICONS[order.service_type] || CreditCard;

  const routeSummary = bd.departure_city && bd.destination_city
    ? `${bd.departure_city} → ${bd.destination_city}`
    : bd.check_in
      ? `Check-in ${fmtDate(bd.check_in)}`
      : null;

  return (
    <div className={`max-w-6xl mx-auto ${outerPadding}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={onBack || (() => window.history.back())}
          data-testid="checkout-back-btn"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Lock className="h-3.5 w-3.5 text-[#c9a74a]" />
          <span className="hidden sm:inline">Secured by Stripe · 256-bit TLS</span>
        </div>
      </div>

      {/* Page heading */}
      <div className="mb-8 lg:mb-10">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9a74a] font-semibold mb-3">Checkout · Card Payment</p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight" data-testid="checkout-heading">
          Review & pay<br className="hidden sm:inline" />
          <span className="text-[#c9a74a]">{formatCurrency(amount)}</span>
        </h1>
        <p className="mt-3 text-sm text-slate-300 max-w-xl">
          You're one step away from confirming <span className="font-semibold text-white">{order.service_name || 'your booking'}</span>.
          Review the summary below, then continue to Stripe's secure checkout.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Booking Summary */}
        <div className="lg:col-span-3">
          <div className="relative rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.03] border border-white/10 backdrop-blur-xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="px-6 sm:px-8 py-6 border-b border-white/10 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-[#c9a74a] flex items-center justify-center flex-shrink-0">
                  <ServiceIcon className="h-6 w-6 text-[#071d3c]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">Booking Summary</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{order.service_name || 'Your Booking'}</h2>
                  {routeSummary && (
                    <p className="text-sm text-[#c9a74a] font-medium mt-0.5 truncate">{routeSummary}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="border-[#c9a74a]/40 text-[#c9a74a] bg-[#c9a74a]/10 capitalize flex-shrink-0">
                {(order.service_category || order.service_type || '').replace('_', ' ')}
              </Badge>
            </div>

            <div className="px-6 sm:px-8 py-4">
              <PremiumRow label="Order Number" value={order.order_number} icon={CreditCard} testid="summary-order-number" />
              <PremiumRow label="Route" value={bd.departure_city && bd.destination_city ? `${bd.departure_city}  →  ${bd.destination_city}` : null} icon={MapPin} testid="summary-route" />
              <PremiumRow label="Travel Date" value={bd.travel_date ? fmtDate(bd.travel_date) : null} icon={Calendar} testid="summary-travel-date" />
              <PremiumRow label="Departure Time" value={bd.service_time || bd.travel_time || bd.departure_time} icon={Clock} testid="summary-departure-time" />
              <PremiumRow label="Check-in" value={bd.check_in ? fmtDate(bd.check_in) : null} icon={Calendar} testid="summary-check-in" />
              <PremiumRow label="Check-out" value={bd.check_out ? fmtDate(bd.check_out) : null} icon={Calendar} testid="summary-check-out" />
              <PremiumRow label="Travellers" value={bd.passengers?.length ? `${bd.passengers.length} passenger${bd.passengers.length > 1 ? 's' : ''}` : null} icon={Users} testid="summary-passengers" />
              <PremiumRow label="Operator" value={bd.operator_name} icon={Sparkles} testid="summary-operator" />
            </div>

            <div className="px-6 sm:px-8 py-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>Instant confirmation</span></div>
              <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>No hidden fees</span></div>
              <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>Free cancellation window</span></div>
            </div>
          </div>
        </div>

        {/* Payment Amount */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-3xl bg-gradient-to-b from-white to-slate-50 overflow-hidden shadow-[0_30px_80px_-20px_rgba(201,167,74,0.35)]">
            <div className="relative px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-br from-[#082c59] via-[#0a346c] to-[#071d3c] text-white">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #c9a74a 0%, transparent 40%)' }} />
              <div className="relative">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#c9a74a] font-semibold flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5" />
                  Payment Amount
                </p>
                <p className="mt-4 text-4xl sm:text-5xl font-bold leading-none" data-testid="checkout-total-amount">
                  {formatCurrency(amount)}
                </p>
                <p className="mt-2 text-xs text-slate-300">Total charged in FCFA (Central African CFA franc)</p>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium flex items-center gap-1.5 mb-3">
                  <Info className="h-3.5 w-3.5" />
                  Approximate in other currencies
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
                    <p className="text-lg font-bold text-slate-900">{formatUSD(amount)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">US Dollar</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
                    <p className="text-lg font-bold text-slate-900">{formatEUR(amount)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">Euro</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  Stripe will charge in USD. The final amount may vary slightly based on the live exchange rate at your bank.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium">Accepted cards</p>
                <div className="flex items-center gap-1.5">
                  {['VISA', 'MC', 'AMEX'].map((b) => (
                    <span key={b} className="inline-flex items-center justify-center px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] font-bold tracking-wide text-slate-700">{b}</span>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleProceedToStripe}
                disabled={isProcessing}
                className="w-full h-14 text-base font-semibold bg-[#082c59] hover:bg-[#0a346c] text-white shadow-lg shadow-[#082c59]/20 transition-all"
                data-testid="checkout-proceed-stripe-btn"
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecting to Stripe…</>
                ) : (
                  <>Continue to Stripe <ExternalLink className="ml-2 h-4 w-4" /></>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onChangeMethod || onBack || (() => window.history.back())}
                className="w-full h-11 border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-[#082c59] hover:border-[#082c59]"
                data-testid="checkout-change-payment-method-btn"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Choose a different payment method
              </Button>

              <div className="pt-4 border-t border-slate-200 flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Your payment is processed by <span className="font-semibold text-slate-700">Stripe</span>.
                  We never see, touch, or store your card details. PCI-DSS Level 1 certified.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-white/50">
        Need help? Contact support before completing the payment — we're happy to hold your booking.
      </p>
    </div>
  );
}

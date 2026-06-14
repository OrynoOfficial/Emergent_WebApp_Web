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

const PremiumRow = ({ label, value, icon: Icon, testid, compact = false }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div
      className={`flex items-start gap-2.5 border-b border-white/5 last:border-b-0 ${compact ? 'py-1.5' : 'py-3'}`}
      data-testid={testid}
    >
      {Icon && (
        <div className={`rounded-lg bg-[#c9a74a]/10 border border-[#c9a74a]/20 flex items-center justify-center flex-shrink-0 ${compact ? 'h-6 w-6 mt-0' : 'h-8 w-8 mt-0.5'}`}>
          <Icon className={`text-[#c9a74a] ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`uppercase text-slate-400 font-medium ${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[11px] tracking-[0.14em]'}`}>{label}</p>
        <p className={`text-white font-semibold break-words ${compact ? 'text-xs mt-0' : 'text-sm mt-0.5'}`}>{value}</p>
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
export default function StripeCheckoutPanel({ orderId, v2PaymentId, onBack, onChangeMethod, variant = 'page' }) {
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
        // V2 ledger correlation — backend webhook reads this back from
        // Stripe session metadata and appends the `captured` event.
        v2_payment_id: v2PaymentId || undefined,
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

  const isModal = variant === 'modal';
  const outerPadding = isModal
    ? 'px-4 sm:px-5 py-4'
    : 'px-4 sm:px-6 lg:px-8 py-8 lg:py-12';
  const maxW = isModal ? 'max-w-3xl' : 'max-w-6xl';

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
    <div className={`${maxW} mx-auto ${outerPadding}`}>
      {/* Top bar */}
      <div className={`flex items-center justify-between ${isModal ? 'mb-4' : 'mb-8'}`}>
        <Button
          variant="ghost"
          size={isModal ? 'sm' : 'default'}
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={onBack || (() => window.history.back())}
          data-testid="checkout-back-btn"
        >
          <ArrowLeft className={`mr-2 ${isModal ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} /> Back
        </Button>
        <div className={`flex items-center gap-2 ${isModal ? 'text-[10px]' : 'text-xs'} text-white/70`}>
          <Lock className={`${isModal ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-[#c9a74a]`} />
          <span className="hidden sm:inline">Secured by Stripe · 256-bit TLS</span>
        </div>
      </div>

      {/* Heading */}
      <div className={isModal ? 'mb-4' : 'mb-8 lg:mb-10'}>
        <p className={`uppercase text-[#c9a74a] font-semibold ${isModal ? 'text-[10px] tracking-[0.18em] mb-1.5' : 'text-xs tracking-[0.22em] mb-3'}`}>
          Checkout · Card Payment
        </p>
        <h1
          className={`font-bold text-white leading-tight ${isModal ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl lg:text-5xl'}`}
          data-testid="checkout-heading"
        >
          Review & pay {isModal ? <span className="text-[#c9a74a]">{formatCurrency(amount)}</span> : (
            <>
              <br className="hidden sm:inline" />
              <span className="text-[#c9a74a]">{formatCurrency(amount)}</span>
            </>
          )}
        </h1>
        {!isModal && (
          <p className="mt-3 text-sm text-slate-300 max-w-xl">
            You're one step away from confirming <span className="font-semibold text-white">{order.service_name || 'your booking'}</span>.
            Review the summary below, then continue to Stripe's secure checkout.
          </p>
        )}
      </div>

      <div className={`grid gap-4 ${isModal ? 'sm:grid-cols-2' : 'lg:grid-cols-5 gap-6 lg:gap-8'}`}>
        {/* Booking Summary */}
        <div className={isModal ? '' : 'lg:col-span-3'}>
          <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.03] border border-white/10 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
            <div className={`${isModal ? 'px-4 py-3' : 'px-6 sm:px-8 py-6'} border-b border-white/10 flex items-start justify-between gap-3`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`${isModal ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'} bg-[#c9a74a] flex items-center justify-center flex-shrink-0`}>
                  <ServiceIcon className={`${isModal ? 'h-4 w-4' : 'h-6 w-6'} text-[#071d3c]`} />
                </div>
                <div className="min-w-0">
                  <p className={`uppercase text-slate-400 font-medium ${isModal ? 'text-[9px] tracking-[0.14em]' : 'text-[11px] tracking-[0.16em]'}`}>Booking Summary</p>
                  <h2 className={`font-bold text-white truncate ${isModal ? 'text-sm' : 'text-xl sm:text-2xl'}`}>{order.service_name || 'Your Booking'}</h2>
                  {routeSummary && (
                    <p className={`text-[#c9a74a] font-medium mt-0.5 truncate ${isModal ? 'text-[11px]' : 'text-sm'}`}>{routeSummary}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={`border-[#c9a74a]/40 text-[#c9a74a] bg-[#c9a74a]/10 capitalize flex-shrink-0 ${isModal ? 'text-[10px] px-2 py-0' : ''}`}>
                {(order.service_category || order.service_type || '').replace('_', ' ')}
              </Badge>
            </div>

            <div className={isModal ? 'px-4 py-1' : 'px-6 sm:px-8 py-4'}>
              <PremiumRow label="Order Number" value={order.order_number} icon={CreditCard} testid="summary-order-number" compact={isModal} />
              <PremiumRow label="Route" value={bd.departure_city && bd.destination_city ? `${bd.departure_city}  →  ${bd.destination_city}` : null} icon={MapPin} testid="summary-route" compact={isModal} />
              <PremiumRow label="Travel Date" value={bd.travel_date ? fmtDate(bd.travel_date) : null} icon={Calendar} testid="summary-travel-date" compact={isModal} />
              <PremiumRow label="Departure Time" value={bd.service_time || bd.travel_time || bd.departure_time} icon={Clock} testid="summary-departure-time" compact={isModal} />
              <PremiumRow label="Check-in" value={bd.check_in ? fmtDate(bd.check_in) : null} icon={Calendar} testid="summary-check-in" compact={isModal} />
              <PremiumRow label="Check-out" value={bd.check_out ? fmtDate(bd.check_out) : null} icon={Calendar} testid="summary-check-out" compact={isModal} />
              <PremiumRow label="Travellers" value={bd.passengers?.length ? `${bd.passengers.length} passenger${bd.passengers.length > 1 ? 's' : ''}` : null} icon={Users} testid="summary-passengers" compact={isModal} />
              <PremiumRow label="Operator" value={bd.operator_name} icon={Sparkles} testid="summary-operator" compact={isModal} />
            </div>

            {!isModal && (
              <div className="px-6 sm:px-8 py-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>Instant confirmation</span></div>
                <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>No hidden fees</span></div>
                <div className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /><span>Free cancellation window</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Amount */}
        <div className={isModal ? '' : 'lg:col-span-2'}>
          <div className={`${isModal ? '' : 'sticky top-6'} rounded-2xl bg-gradient-to-b from-white to-slate-50 overflow-hidden shadow-[0_20px_60px_-20px_rgba(201,167,74,0.35)]`}>
            <div className={`relative ${isModal ? 'px-4 pt-5 pb-4' : 'px-6 sm:px-8 pt-8 pb-6'} bg-gradient-to-br from-[#082c59] via-[#0a346c] to-[#071d3c] text-white`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #c9a74a 0%, transparent 40%)' }} />
              <div className="relative">
                <p className={`uppercase text-[#c9a74a] font-semibold flex items-center gap-2 ${isModal ? 'text-[9px] tracking-[0.16em]' : 'text-[11px] tracking-[0.18em]'}`}>
                  <CreditCard className={isModal ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                  Payment Amount
                </p>
                <p className={`font-bold leading-none ${isModal ? 'mt-2.5 text-2xl sm:text-3xl' : 'mt-4 text-4xl sm:text-5xl'}`} data-testid="checkout-total-amount">
                  {formatCurrency(amount)}
                </p>
                <p className={`text-slate-300 ${isModal ? 'mt-1 text-[10px]' : 'mt-2 text-xs'}`}>
                  {isModal ? 'FCFA (Central African CFA franc)' : 'Total charged in FCFA (Central African CFA franc)'}
                </p>
              </div>
            </div>

            <div className={isModal ? 'px-4 py-4 space-y-3' : 'px-6 sm:px-8 py-6 space-y-5'}>
              <div className={`rounded-xl border border-slate-200 bg-slate-50/50 ${isModal ? 'p-3' : 'p-4'}`}>
                <p className={`uppercase text-slate-500 font-medium flex items-center gap-1.5 ${isModal ? 'text-[9px] tracking-[0.12em] mb-2' : 'text-[11px] tracking-[0.14em] mb-3'}`}>
                  <Info className={isModal ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                  Approx. in other currencies
                </p>
                <div className={`grid grid-cols-2 ${isModal ? 'gap-2' : 'gap-3'}`}>
                  <div className={`rounded-lg border border-slate-200 bg-white text-center ${isModal ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>
                    <p className={`font-bold text-slate-900 ${isModal ? 'text-sm' : 'text-lg'}`}>{formatUSD(amount)}</p>
                    <p className={`uppercase tracking-wider text-slate-500 mt-0.5 ${isModal ? 'text-[9px]' : 'text-[10px]'}`}>US Dollar</p>
                  </div>
                  <div className={`rounded-lg border border-slate-200 bg-white text-center ${isModal ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>
                    <p className={`font-bold text-slate-900 ${isModal ? 'text-sm' : 'text-lg'}`}>{formatEUR(amount)}</p>
                    <p className={`uppercase tracking-wider text-slate-500 mt-0.5 ${isModal ? 'text-[9px]' : 'text-[10px]'}`}>Euro</p>
                  </div>
                </div>
                {!isModal && (
                  <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                    Stripe will charge in USD. The final amount may vary slightly based on the live exchange rate at your bank.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className={`uppercase text-slate-500 font-medium ${isModal ? 'text-[9px] tracking-[0.12em]' : 'text-[11px] tracking-[0.14em]'}`}>Accepted cards</p>
                <div className="flex items-center gap-1">
                  {['VISA', 'MC', 'AMEX'].map((b) => (
                    <span key={b} className={`inline-flex items-center justify-center rounded-md border border-slate-200 bg-white font-bold tracking-wide text-slate-700 ${isModal ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}`}>{b}</span>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleProceedToStripe}
                disabled={isProcessing}
                className={`w-full font-semibold bg-[#082c59] hover:bg-[#0a346c] text-white shadow-lg shadow-[#082c59]/20 transition-all ${isModal ? 'h-10 text-sm' : 'h-14 text-base'}`}
                data-testid="checkout-proceed-stripe-btn"
              >
                {isProcessing ? (
                  <><Loader2 className={`mr-2 animate-spin ${isModal ? 'h-4 w-4' : 'h-5 w-5'}`} /> Redirecting to Stripe…</>
                ) : (
                  <>Continue to Stripe <ExternalLink className={`ml-2 ${isModal ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} /></>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onChangeMethod || onBack || (() => window.history.back())}
                className={`w-full border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-[#082c59] hover:border-[#082c59] ${isModal ? 'h-9 text-xs' : 'h-11'}`}
                data-testid="checkout-change-payment-method-btn"
              >
                <RefreshCw className={`mr-2 ${isModal ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                Choose a different payment method
              </Button>

              {!isModal && (
                <div className="pt-4 border-t border-slate-200 flex items-start gap-2.5">
                  <Shield className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Your payment is processed by <span className="font-semibold text-slate-700">Stripe</span>.
                    We never see, touch, or store your card details. PCI-DSS Level 1 certified.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isModal && (
        <p className="mt-10 text-center text-xs text-white/50">
          Need help? Contact support before completing the payment — we're happy to hold your booking.
        </p>
      )}
    </div>
  );
}

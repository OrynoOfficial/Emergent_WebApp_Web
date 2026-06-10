import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Film, Clock, MapPin, ArrowLeft, Calendar, Armchair, Plus, Minus, Loader2,
  CreditCard, User, CheckCircle2, Popcorn, Crown, Sparkles, Ticket, Monitor, X,
} from 'lucide-react';
import api from '@/api/client';
import { BookerInfoSection } from '@/components/booking/BookerInfoSection';
import { formatCurrency } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import OperatorBookingBlock from '@/components/shared/OperatorBookingBlock';
import { toast } from 'sonner';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import { rePayExisting } from '@/utils/paymentRetry';
import { useOrderAbandonment } from '@/hooks/useOrderAbandonment';
import PaymentProcessingOverlay from '@/components/common/PaymentProcessingOverlay';
import CinemaSeatMap, { buildDefaultLayout } from '@/components/cinema/CinemaSeatMap';
import { format, parseISO, isValid } from 'date-fns';

const TICKET_TYPES = [
  { id: 'adult',  name: 'Adult',  multiplier: 1,   description: 'Standard ticket' },
  { id: 'child',  name: 'Child',  multiplier: 0.5, description: '50% off' },
  { id: 'senior', name: 'Senior', multiplier: 0.7, description: '30% off' },
];

const STEPS = [
  { num: 1, label: 'Seats', icon: Armchair },
  { num: 2, label: 'Details', icon: User },
  { num: 3, label: 'Payment', icon: CreditCard },
];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const reached = currentStep >= step.num;
        const passed = currentStep > step.num;
        return (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  reached
                    ? 'bg-cyan-600 text-white shadow-[0_0_25px_rgba(34,211,238,0.35)]'
                    : 'bg-slate-200 text-slate-500 border border-slate-300'
                }`}
                data-testid={`booking-step-${step.num}`}
              >
                {passed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-[11px] mt-2 font-medium tracking-wide uppercase ${reached ? 'text-cyan-700' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 mt-[-18px] rounded-full transition-all ${
                passed ? 'bg-cyan-500' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function safeFmtDate(s) {
  if (!s) return '—';
  const d = parseISO(s);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy') : s;
}

// Resolve film poster URLs — backend stores `/api/static/...` which needs the
// page origin prefix so the kubernetes ingress can route it to the API.
function resolvePoster(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${window.location.origin}${url}`;
  return url;
}

export default function CinemaBooking() {
  const { showtimeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isOperatorUser } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [film, setFilm] = useState(null);
  const [seatLayout, setSeatLayout] = useState(buildDefaultLayout(8, 12));
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [ticketCounts, setTicketCounts] = useState({ adult: 1, child: 0, senior: 0 });
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [isSelf, setIsSelf] = useState(false);

  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [orderId, setOrderId] = useState(null);
  // Promo code (Hotel-style apply/clear)
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null); // {code, discount_percent?, discount_amount?}
  const [promoSubmitting, setPromoSubmitting] = useState(false);

  const applyPromoCode = async () => {
    const code = (promoCode || '').trim();
    if (!code) return;
    setPromoSubmitting(true);
    try {
      // Validate against the unified promo-codes endpoint. Pass the order_amount
      // so the backend computes the discount, and the operator_id so operator-scoped
      // codes accept the booking.
      const pricing = calculatePricing();
      const orderAmount = (pricing?.subtotal || 0) + (pricing?.vipSurcharge || 0);
      const operatorId = film?.operator_id || showtime?.operator_id;
      const res = await api.post('/promo-codes/validate', {
        code,
        service_type: 'cinema',
        order_amount: orderAmount,
        operator_id: operatorId,
      });
      const data = res.data || {};
      if (data.valid === false) {
        toast.error(data.message || 'Promo code is not valid');
        setPromoApplied(null);
      } else {
        setPromoApplied({
          code: data.code || code,
          discount_percent: data.discount_type === 'percentage' ? data.discount_value : null,
          discount_amount: data.discount_amount ?? (data.discount_type === 'fixed' ? data.discount_value : null),
          message: data.name || `Promo "${code}" applied`,
        });
        toast.success(data.name || `Promo "${code}" applied`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not validate promo code');
      setPromoApplied(null);
    } finally {
      setPromoSubmitting(false);
    }
  };

  const clearPromoCode = () => {
    setPromoApplied(null);
    setPromoCode('');
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [showtimeId]);

  useEffect(() => {
    if (user?.email) setFormData((p) => ({ ...p, email: user.email }));
  }, [user]);

  // Auto-trim selected seats if user reduces ticket count
  useEffect(() => {
    const total = ticketCounts.adult + ticketCounts.child + ticketCounts.senior;
    if (selectedSeats.length > total) {
      setSelectedSeats((prev) => prev.slice(0, total));
    }
  }, [ticketCounts]); // eslint-disable-line

  const loadData = async () => {
    try {
      setLoading(true);

      // 1) Prime UI immediately from sessionStorage (set by FilmDetails when the user
      //    picked the showtime) so the title/cinema/date/time match what they saw.
      let primed = null;
      try {
        const raw = sessionStorage.getItem('cinemaBookingData');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.showtime?.id === showtimeId) {
            primed = parsed;
            if (parsed.film) setFilm(parsed.film);
            if (parsed.showtime) setShowtime(parsed.showtime);
            if (parsed.showtime?.seat_layout) setSeatLayout(parsed.showtime.seat_layout);
          }
        }
      } catch { /* sessionStorage may be unavailable / malformed — ignore */ }

      // 2) Fetch the canonical showtime details (public endpoint) so seat_layout +
      //    booked_seats + freshly enriched cinema_name override the primed values.
      let data = null;
      try {
        const res = await api.get(`/cinema/showtimes/${showtimeId}/details`);
        data = res.data;
      } catch (err) {
        console.error('Failed to load showtime details:', err);
      }

      if (data) {
        const apiShowtime = data.showtime || data;
        // Prefer API values; backfill with `film_title` so we never end up with an empty title.
        setShowtime((prev) => ({ ...(prev || {}), ...apiShowtime }));
        setFilm((prev) => data.film || prev || { title: apiShowtime.film_title || 'Movie' });
        const layout = data.seat_layout || apiShowtime?.seat_layout;
        if (layout) setSeatLayout(layout);
        if (Array.isArray(data.booked_seats)) setBookedSeats(data.booked_seats);
      } else if (!primed) {
        // No primed data AND API failed — surface a recoverable empty state so we
        // don't render misleading "Black Panther" mock content.
        setShowtime(null);
        setFilm(null);
      }
    } catch (e) {
      console.error('Failed to load showtime:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfChange = async (checked) => {
    setIsSelf(checked);
    if (checked) {
      try {
        const res = await api.get('/auth/me');
        const profile = res.data;
        const fullName = profile.full_name || '';
        const parts = fullName.trim().split(/\s+/);
        setFormData((p) => ({
          ...p,
          firstName: profile.first_name || parts[0] || '',
          lastName:  profile.last_name  || parts.slice(1).join(' ') || '',
          email:     profile.email      || p.email,
          phone:     profile.phone      || p.phone || '',
        }));
      } catch { /* user already in context */ }
    } else {
      setFormData((p) => ({ ...p, firstName: '', lastName: '', phone: '' }));
    }
  };

  const totalTickets = ticketCounts.adult + ticketCounts.child + ticketCounts.senior;

  // Conditional ticket types — Child / Senior only appear when the showtime
  // has a price configured for them (showtime.child_price / senior_price).
  // When absent we hide the counter entirely so customers don't see options
  // that the operator didn't price up.
  const hasChildTier = showtime?.child_price != null;
  const hasSeniorTier = showtime?.senior_price != null;
  const adultPrice = Number(showtime?.price || 0);
  const childPrice = hasChildTier ? Number(showtime.child_price) : adultPrice;
  const seniorPrice = hasSeniorTier ? Number(showtime.senior_price) : adultPrice;
  const vipPrice = showtime?.vip_price != null ? Number(showtime.vip_price) : adultPrice;
  const vipRowSet = new Set((seatLayout?.vip_rows || []).map((r) => String(r).toUpperCase()));
  const isVipSeat = (seat) => {
    const row = String(seat).replace(/[^A-Za-z]/g, '').toUpperCase();
    return vipRowSet.has(row);
  };
  const hasVipPricing = vipRowSet.size > 0 && showtime?.vip_price != null;

  // Pricing model — DECOUPLED from seat count:
  //   subtotal = adult*adultPrice + child*childPrice + senior*seniorPrice
  //   vipSurcharge = vipSeatsSelected * (vipPrice - adultPrice)
  //   serviceFee = (subtotal + vipSurcharge) * 5%
  //   promoDiscount = subtotal * promo% (when applied)
  //   total = subtotal + vipSurcharge + serviceFee - promoDiscount
  // This means adjusting the Adult counter does NOT get reset just because the
  // customer picks a seat; only choosing a VIP-row seat raises the price (and
  // we surface a clear "+VIP surcharge" line explaining why).
  const calculatePricing = () => {
    const subtotal =
      ticketCounts.adult * adultPrice +
      ticketCounts.child * childPrice +
      ticketCounts.senior * seniorPrice;
    const vipSeatCount = selectedSeats.filter(isVipSeat).length;
    const regularSeatCount = selectedSeats.length - vipSeatCount;
    const vipSurchargePerSeat = Math.max(0, vipPrice - adultPrice);
    const vipSurcharge = hasVipPricing ? vipSeatCount * vipSurchargePerSeat : 0;
    const beforeFee = subtotal + vipSurcharge;
    const promoDiscount = promoApplied ? Math.min(beforeFee, (promoApplied.discount_amount || (beforeFee * (promoApplied.discount_percent || 0) / 100)) || 0) : 0;
    const commissionRate = 5;
    const commission = (beforeFee - promoDiscount) * (commissionRate / 100);
    const total = beforeFee - promoDiscount + commission;
    return {
      subtotal,
      vipSurcharge,
      vipSurchargePerSeat,
      vipSeatCount,
      regularSeatCount,
      promoDiscount,
      commission,
      commissionRate,
      total,
      adultPrice,
      childPrice,
      seniorPrice,
      vipPrice,
      hasVipPricing,
      hasChildTier,
      hasSeniorTier,
    };
  };

  const pricing = calculatePricing();

  const handlePaymentInitiated = async (response) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    if (response.opening_modal) return;
    if (response.redirectUrl) {
      toast.info('Redirecting to payment...');
      window.location.href = response.redirectUrl;
      return;
    }
    if (response.success || response.transactionRef) {
      toast.success('Booking confirmed! Enjoy your movie!');
      navigate('/orders');
    }
  };

  const handlePaymentError = (error) => {
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setTriggerPayment(false);
    toast.error(error.message || 'Payment failed');
  };

  const handleSubmit = async () => {
    if (selectedSeats.length !== totalTickets) {
      toast.error(`Please select ${totalTickets} seat${totalTickets > 1 ? 's' : ''}`);
      return;
    }
    if (!formData.firstName || !formData.email || !formData.phone) {
      toast.error('Please fill in all contact details');
      setCurrentStep(2);
      return;
    }
    if (orderId) { rePayExisting(setTriggerPayment); return; }

    setPaymentInProgress(true);
    setShowPaymentOverlay(true);
    setCurrentStep(3);
    try {
      const orderPayload = {
        service_type: 'cinema',
        service_id: showtimeId,
        service_name: `${film?.title} - ${showtime?.cinema_name}`,
        total_amount: pricing.total,
        currency: 'XAF',
        status: 'pending',
        payment_status: 'pending',
        booking_details: {
          ...formData,
          film_title: film?.title,
          cinema: showtime?.cinema_name,
          screen: showtime?.screen_name,
          show_date: showtime?.show_date,
          show_time: showtime?.show_time,
          seats: selectedSeats,
          ticket_counts: ticketCounts,
        },
      };
      const response = await api.post('/orders/create', orderPayload);
      const newId = response.data?.order_id || response.data?.id;
      if (newId) {
        setOrderId(newId);
        setTriggerPayment(true);
      }
    } catch {
      toast.error('Failed to create booking');
      setPaymentInProgress(false);
      setShowPaymentOverlay(false);
    }
  };

  // Update step indicator based on user progress
  useEffect(() => {
    if (selectedSeats.length === totalTickets && totalTickets > 0) {
      setCurrentStep((s) => Math.max(s, 2));
    }
  }, [selectedSeats, totalTickets]);

  // Centralised abandonment safety net: hard-deletes the pending order if the
  // user closes the payment modal, navigates away, or closes the tab.
  const { abandon: abandonOrder } = useOrderAbandonment(orderId, () => {
    setOrderId(null);
    setTriggerPayment(false);
    setPaymentInProgress(false);
    setShowPaymentOverlay(false);
    setCurrentStep(2);
  });

  // Called when the customer closes the Stripe/MoMo modal WITHOUT a
  // successful payment.
  const handleCheckoutAbandoned = ({ orderId: abandonedId } = {}) => abandonOrder(abandonedId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-pulse" />
            <Film className="h-10 w-10 text-cyan-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-cyan-700 mt-4 font-medium tracking-wide uppercase text-xs">Loading showtime…</p>
        </div>
      </div>
    );
  }

  const vipRowSetForRender = vipRowSet;


  // Operator self-booking is hard-blocked at this point (after all hooks have run).
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <PaymentProcessingOverlay isVisible={showPaymentOverlay} message="Processing your booking..." />

      {/* Ambient cyan glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] bg-cyan-400/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-900 hover:bg-white/10" data-testid="cinema-booking-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-cyan-600/70 text-[11px] tracking-[0.3em] uppercase">Cinema Booking</p>
              <h1 className="text-xl font-bold text-slate-900">{film?.title || 'Book Your Seats'}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Hero card */}
        <Card className="relative overflow-hidden mb-8 border-cyan-500/20 bg-white backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Film className="w-8 h-8 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight">{film?.title}</h2>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-cyan-600" />{showtime?.cinema_name}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-cyan-600" />{safeFmtDate(showtime?.show_date)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-cyan-600" />{showtime?.show_time}</span>
                    {showtime?.screen_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-400/60 text-cyan-800 font-semibold text-[11px] uppercase tracking-wide" data-testid="hero-screen-name">
                        <Monitor className="w-3 h-3" /> {showtime.screen_name}
                      </span>
                    )}
                    <Badge className="bg-cyan-600 text-white border border-cyan-700/40 uppercase text-[10px] tracking-wider">{showtime?.screen_type || '2d'}</Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-cyan-600/70 text-[10px] tracking-[0.3em] uppercase mb-1">Starting from</p>
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(showtime?.price)}</p>
                <p className="text-slate-500 text-xs">per ticket</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — seats + tickets + booker */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seat selection — same elevated white card style as Movie Cards in results */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
              <div className="h-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400" />
              <div className="bg-gradient-to-r from-cyan-50 to-white border-b border-cyan-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-xl border border-cyan-200">
                    <Armchair className="h-5 w-5 text-cyan-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Select your seats</h3>
                    <p className="text-xs text-cyan-700/80">Choose {totalTickets} seat{totalTickets !== 1 ? 's' : ''} — orange seats are VIP and cost extra</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <CinemaSeatMap
                  layout={seatLayout}
                  bookedSeats={bookedSeats}
                  selectedSeats={selectedSeats}
                  onChange={setSelectedSeats}
                  maxSeats={totalTickets || 1}
                />
              </CardContent>
            </Card>

            {/* Tickets — same elevated white card style */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl">
              <div className="h-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400" />
              <div className="bg-gradient-to-r from-cyan-50 to-white border-b border-cyan-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-xl border border-cyan-200">
                    <Popcorn className="h-5 w-5 text-cyan-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Tickets</h3>
                    <p className="text-xs text-cyan-700/80">Choose how many tickets of each tier — picking a VIP seat adds a surcharge</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-5 space-y-3">
                {TICKET_TYPES.filter((t) => {
                  if (t.id === 'adult') return true;
                  if (t.id === 'child') return pricing.hasChildTier;
                  if (t.id === 'senior') return pricing.hasSeniorTier;
                  return false;
                }).map((t) => {
                  const unitPrice = t.id === 'adult' ? pricing.adultPrice : t.id === 'child' ? pricing.childPrice : pricing.seniorPrice;
                  const adultPriceLocal = pricing.adultPrice;
                  const pctOff = adultPriceLocal > 0 && unitPrice < adultPriceLocal
                    ? Math.round((1 - unitPrice / adultPriceLocal) * 100)
                    : 0;
                  return (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-slate-100 hover:bg-slate-50 rounded-xl border border-slate-300/50 transition" data-testid={`ticket-row-${t.id}`}>
                      <div>
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                          {t.name}
                          {pctOff > 0 && (
                            <Badge className={`text-[10px] ${t.id === 'child' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'} border`}>
                              −{pctOff}%
                            </Badge>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5 tabular-nums" data-testid={`ticket-${t.id}-price`}>
                          {formatCurrency(unitPrice)} per ticket
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:border-cyan-400/40"
                          onClick={() => setTicketCounts((p) => ({ ...p, [t.id]: Math.max(0, p[t.id] - 1) }))}
                          data-testid={`ticket-${t.id}-decrement`}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center text-slate-900 text-lg font-bold tabular-nums">{ticketCounts[t.id]}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full border-cyan-300 bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
                          onClick={() => setTicketCounts((p) => ({ ...p, [t.id]: p[t.id] + 1 }))}
                          data-testid={`ticket-${t.id}-increment`}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card className="overflow-hidden border-cyan-200 bg-white backdrop-blur-md">
              <div className="p-2">
                <BookerInfoSection
                  title="Contact Information"
                  subtitle="Where should we send your tickets?"
                  toggleLabel="Use my account details"
                  firstName={formData.firstName}
                  lastName={formData.lastName}
                  email={formData.email}
                  phone={formData.phone}
                  onChange={(field, value) => setFormData((p) => ({ ...p, [field]: value }))}
                  user={user}
                  isSelf={isSelf}
                  onSelfChange={handleSelfChange}
                />
              </div>
            </Card>
          </div>

          {/* Right — order summary FIRST, then payment, then CTA */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">

              {/* Order Summary card with poster header */}
              <Card className="overflow-hidden border-cyan-500/20 bg-white backdrop-blur-md">
                <div className="relative h-44 bg-gradient-to-br from-cyan-700 via-cyan-600 to-slate-900 overflow-hidden">
                  {film?.poster_url ? (
                    <img src={resolvePoster(film.poster_url)} alt={film.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-24 h-24 text-slate-900/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-cyan-500/30 text-cyan-100 border border-cyan-400/40 uppercase tracking-wider text-[10px] backdrop-blur-sm">{showtime?.screen_type || '2d'}</Badge>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold text-base line-clamp-2 drop-shadow">{film?.title}</h3>
                    {showtime?.screen_name && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 text-cyan-800 font-semibold text-[11px] uppercase tracking-wide shadow-sm" data-testid="sidebar-screen-name">
                        <Monitor className="w-3 h-3" /> {showtime.screen_name}
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Show details — bigger, clearer grid layout */}
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-200">
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-600" /> Cinema
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{showtime?.cinema_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-600" /> Date
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{safeFmtDate(showtime?.show_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-600" /> Showtime
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {showtime?.show_time || '—'}{showtime?.end_time ? ` – ${showtime.end_time}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Selected seats */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                        <Ticket className="w-4 h-4 text-cyan-600" /> Seats
                      </h4>
                      <span className="text-xs text-slate-500 tabular-nums">{selectedSeats.length} / {totalTickets}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeats.length > 0 ? selectedSeats.map((seat) => {
                        const isVip = vipRowSetForRender.has(seat[0]);
                        return (
                          <Badge
                            key={seat}
                            className={isVip
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 gap-1'
                              : 'bg-cyan-100 text-cyan-700 border border-cyan-500/40'}
                          >
                            {isVip && <Crown className="h-3 w-3" />}{seat}
                          </Badge>
                        );
                      }) : <span className="text-slate-500 text-sm italic">No seats selected yet</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Breakdown — Travel-style dedicated card. All pricing
                  (tickets + VIP + service fee + promo + total) lives HERE and
                  ONLY here so there's no duplication with the show-info card. */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100" data-testid="cinema-price-breakdown">
                <div className="bg-[#082c59] p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-2 text-sm">
                    {ticketCounts.adult > 0 && (
                      <div className="flex justify-between text-slate-600" data-testid="summary-adult-line">
                        <span>Adult × {ticketCounts.adult}</span>
                        <span className="font-medium text-slate-800 tabular-nums">{formatCurrency(ticketCounts.adult * pricing.adultPrice)}</span>
                      </div>
                    )}
                    {ticketCounts.child > 0 && pricing.hasChildTier && (
                      <div className="flex justify-between text-slate-600" data-testid="summary-child-line">
                        <span>Child × {ticketCounts.child}</span>
                        <span className="font-medium text-slate-800 tabular-nums">{formatCurrency(ticketCounts.child * pricing.childPrice)}</span>
                      </div>
                    )}
                    {ticketCounts.senior > 0 && pricing.hasSeniorTier && (
                      <div className="flex justify-between text-slate-600" data-testid="summary-senior-line">
                        <span>Senior × {ticketCounts.senior}</span>
                        <span className="font-medium text-slate-800 tabular-nums">{formatCurrency(ticketCounts.senior * pricing.seniorPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500 text-xs pt-1 border-t border-slate-100" data-testid="summary-subtotal-line">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatCurrency(pricing.subtotal)}</span>
                    </div>
                    {pricing.hasVipPricing && pricing.vipSeatCount > 0 && (
                      <div className="flex justify-between text-amber-700" data-testid="vip-surcharge-line">
                        <span className="flex items-center gap-1">
                          <Crown className="h-3 w-3" /> VIP seats × {pricing.vipSeatCount}
                        </span>
                        <span className="font-medium tabular-nums">
                          +{formatCurrency(pricing.vipSurcharge)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500" data-testid="summary-service-fee-line">
                      <span>Service fee ({pricing.commissionRate}%)</span>
                      <span className="font-medium tabular-nums">+{formatCurrency(pricing.commission)}</span>
                    </div>

                    {/* Promo Code */}
                    <div className="pt-2" data-testid="cinema-booking-promo-section">
                      {!promoApplied ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            placeholder="Promo code"
                            className="flex-1 bg-slate-50 border-slate-200 text-sm uppercase"
                            data-testid="cinema-booking-promo-input"
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); } }}
                          />
                          <Button
                            type="button"
                            onClick={applyPromoCode}
                            disabled={!promoCode.trim() || promoSubmitting}
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            data-testid="cinema-booking-promo-apply"
                          >
                            {promoSubmitting ? '...' : 'Apply'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="cinema-booking-promo-applied">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm text-emerald-700 font-medium">{promoApplied.code}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearPromoCode}
                            className="text-red-500 hover:text-red-600 h-7 px-2"
                            data-testid="cinema-booking-promo-clear"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {pricing.promoDiscount > 0 && promoApplied && (
                      <div className="flex justify-between text-emerald-600" data-testid="summary-promo-discount-line">
                        <span>Discount ({promoApplied.code})</span>
                        <span className="tabular-nums">−{formatCurrency(pricing.promoDiscount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-[#082c59] tabular-nums" data-testid="cinema-booking-total">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method (NOW BELOW Order Summary, per request) */}
              <Card className="overflow-hidden border-cyan-200 bg-white backdrop-blur-md">
                <div className="bg-gradient-to-r from-cyan-50 to-white border-b border-cyan-200 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-cyan-100 rounded-lg border border-cyan-300">
                      <CreditCard className="h-4 w-4 text-cyan-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Payment method</h3>
                      <p className="text-[11px] text-cyan-700/80">Secure checkout via Stripe / MoMo</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <PaymentMethodsSelection
                    amount={pricing.total}
                    orderId={orderId}
                    serviceName={film?.title || 'Cinema'}
                    onPaymentInitiated={handlePaymentInitiated}
                    onPaymentError={handlePaymentError}
                    triggerPayment={triggerPayment}
                    onMethodSelected={setSelectedPaymentMethod}
                    onCheckoutAbandoned={handleCheckoutAbandoned}
                  />
                </CardContent>
              </Card>

              {/* Confirm CTA */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedPaymentMethod || paymentInProgress || totalTickets === 0 || selectedSeats.length !== totalTickets}
                data-testid="cinema-confirm-booking-btn"
                className="w-full h-13 py-6 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-base shadow-[0_8px_30px_-8px_rgba(34,211,238,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
              >
                {paymentInProgress ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing…</>
                ) : selectedSeats.length !== totalTickets ? (
                  `Select ${Math.max(0, totalTickets - selectedSeats.length)} more seat(s)`
                ) : !selectedPaymentMethod ? (
                  'Choose a payment method'
                ) : (
                  <>Confirm booking · {formatCurrency(pricing.total)}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

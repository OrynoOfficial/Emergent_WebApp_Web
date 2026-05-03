import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Film, Clock, MapPin, ArrowLeft, Calendar, Armchair, Plus, Minus, Loader2,
  CreditCard, User, CheckCircle2, Popcorn, Crown, Sparkles, Ticket,
} from 'lucide-react';
import api from '@/api/client';
import { BookerInfoSection } from '@/components/booking/BookerInfoSection';
import { formatCurrency } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import { rePayExisting } from '@/utils/paymentRetry';
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
                    ? 'bg-cyan-500 text-slate-900 shadow-[0_0_25px_rgba(34,211,238,0.55)]'
                    : 'bg-slate-700/80 text-slate-400 border border-slate-600'
                }`}
                data-testid={`booking-step-${step.num}`}
              >
                {passed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-[11px] mt-2 font-medium tracking-wide uppercase ${reached ? 'text-cyan-300' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 mt-[-18px] rounded-full transition-all ${
                passed ? 'bg-cyan-500' : 'bg-slate-700'
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

export default function CinemaBooking() {
  const { showtimeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

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
      let data = null;
      try {
        const res = await api.get(`/cinema/showtimes/${showtimeId}/details`);
        data = res.data;
      } catch { /* fallback to mock below */ }

      if (data) {
        setShowtime(data.showtime || data);
        setFilm(data.film || { title: data.film_title || 'Movie' });
        if (data.seat_layout || data.showtime?.seat_layout) {
          setSeatLayout(data.seat_layout || data.showtime.seat_layout);
        }
        if (data.booked_seats) setBookedSeats(data.booked_seats);
      } else {
        // Mock fallback (preserves existing behaviour while seat config is rolled out)
        const mockShowtime = {
          id: showtimeId,
          cinema_name: 'CanalOlympia Yaoundé',
          city: 'Yaoundé',
          screen_name: 'Screen 1',
          screen_type: '3d',
          show_date: searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'),
          show_time: '14:00',
          price: 5000,
          vip_price: 7500,
          total_seats: 96,
        };
        setShowtime(mockShowtime);
        setFilm({ id: searchParams.get('film'), title: 'Black Panther: Wakanda Forever', duration_minutes: 161, rating: 'PG-13' });
        // Mock layout — 8 rows × 12 cols, last 2 rows VIP, central aisle, a few blocked.
        setSeatLayout({ rows: 8, cols: 12, aisle_after_col: [4, 8], vip_rows: ['G', 'H'], blocked: ['A1', 'A12'] });
        setBookedSeats(['A3', 'A4', 'B5', 'B6', 'C7', 'D8', 'D9', 'E10']);
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

  const calculatePricing = () => {
    const basePrice = showtime?.price || 0;
    const vipPrice  = showtime?.vip_price || basePrice * 1.5;
    const vipRows = new Set(seatLayout?.vip_rows || []);

    // Compute per-seat actual price (VIP if its row letter is VIP, else base)
    let seatsTotal = 0;
    selectedSeats.forEach((seatId) => {
      const rowLetter = seatId[0];
      seatsTotal += vipRows.has(rowLetter) ? vipPrice : basePrice;
    });
    // Apply ticket-type discounts proportionally to selected seats: child=0.5, senior=0.7, adult=1.
    // Distribute discounts to seats from the cheapest first.
    const sortedSeats = [...selectedSeats].sort((a, b) => {
      const aIsVip = vipRows.has(a[0]); const bIsVip = vipRows.has(b[0]);
      return (aIsVip === bIsVip) ? 0 : aIsVip ? 1 : -1;
    });
    const seatPrices = sortedSeats.map((seatId) => vipRows.has(seatId[0]) ? vipPrice : basePrice);
    // Build queue: child slots first, then senior, then adult
    const slots = [
      ...Array(ticketCounts.child).fill(0.5),
      ...Array(ticketCounts.senior).fill(0.7),
      ...Array(ticketCounts.adult).fill(1),
    ];
    let subtotal = 0;
    seatPrices.forEach((p, i) => {
      const m = slots[i] ?? 1;
      subtotal += p * m;
    });
    if (selectedSeats.length === 0) {
      subtotal = basePrice * (ticketCounts.adult + ticketCounts.child * 0.5 + ticketCounts.senior * 0.7);
    }
    const commissionRate = 5;
    const commission = subtotal * (commissionRate / 100);
    return { subtotal, commission, commissionRate, total: subtotal + commission, basePrice, vipPrice };
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-pulse" />
            <Film className="h-10 w-10 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-cyan-200 mt-4 font-medium tracking-wide uppercase text-xs">Loading showtime…</p>
        </div>
      </div>
    );
  }

  const vipRowSet = new Set(seatLayout?.vip_rows || []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <PaymentProcessingOverlay isVisible={showPaymentOverlay} message="Processing your booking..." />

      {/* Ambient cyan glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] bg-cyan-400/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative bg-black/40 backdrop-blur-xl border-b border-cyan-500/10 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10" data-testid="cinema-booking-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-cyan-400/70 text-[11px] tracking-[0.3em] uppercase">Cinema Booking</p>
              <h1 className="text-xl font-bold text-white">{film?.title || 'Book Your Seats'}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Hero card */}
        <Card className="relative overflow-hidden mb-8 border-cyan-500/20 bg-slate-900/60 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Film className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">{film?.title}</h2>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-300">
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-cyan-400" />{showtime?.cinema_name}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-cyan-400" />{safeFmtDate(showtime?.show_date)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-cyan-400" />{showtime?.show_time}</span>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase text-[10px] tracking-wider">{showtime?.screen_type || '2d'}</Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-cyan-400/70 text-[10px] tracking-[0.3em] uppercase mb-1">Starting from</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(showtime?.price)}</p>
                <p className="text-slate-500 text-xs">per ticket</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — seats + tickets + booker */}
          <div className="lg:col-span-2 space-y-6">
            {/* Seat selection */}
            <Card className="overflow-hidden border-cyan-500/15 bg-slate-900/70 backdrop-blur-md">
              <div className="bg-gradient-to-r from-cyan-600/30 via-cyan-500/20 to-transparent border-b border-cyan-500/15 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-400/30">
                    <Armchair className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Select your seats</h3>
                    <p className="text-xs text-cyan-200/70">Choose {totalTickets} seat{totalTickets !== 1 ? 's' : ''} from the layout below</p>
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

            {/* Tickets */}
            <Card className="overflow-hidden border-cyan-500/15 bg-slate-900/70 backdrop-blur-md">
              <div className="bg-gradient-to-r from-cyan-600/30 via-cyan-500/20 to-transparent border-b border-cyan-500/15 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-400/30">
                    <Popcorn className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Tickets</h3>
                    <p className="text-xs text-cyan-200/70">Pick the categories — final price scales with seat type (VIP / Standard)</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-5 space-y-3">
                {TICKET_TYPES.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-slate-800/40 hover:bg-slate-800/60 rounded-xl border border-slate-700/50 transition">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium">
                        {t.name}
                        {t.id !== 'adult' && (
                          <Badge className={`text-[10px] ${t.id === 'child' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} border`}>
                            {t.description}
                          </Badge>
                        )}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        {t.id === 'adult' ? `${formatCurrency(showtime?.price)} standard · ${formatCurrency(pricing.vipPrice)} VIP` : `Discount applies to seat price`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:border-cyan-400/40"
                        onClick={() => setTicketCounts((p) => ({ ...p, [t.id]: Math.max(0, p[t.id] - 1) }))}
                        data-testid={`ticket-${t.id}-decrement`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center text-white text-lg font-bold tabular-nums">{ticketCounts[t.id]}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                        onClick={() => setTicketCounts((p) => ({ ...p, [t.id]: p[t.id] + 1 }))}
                        data-testid={`ticket-${t.id}-increment`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card className="overflow-hidden border-cyan-500/15 bg-slate-900/70 backdrop-blur-md">
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
              <Card className="overflow-hidden border-cyan-500/20 bg-slate-900/70 backdrop-blur-md">
                <div className="relative h-44 bg-gradient-to-br from-cyan-700 via-cyan-600 to-slate-900 overflow-hidden">
                  {film?.poster_url ? (
                    <img src={film.poster_url} alt={film.title} className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-24 h-24 text-white/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-cyan-500/30 text-cyan-100 border border-cyan-400/40 uppercase tracking-wider text-[10px] backdrop-blur-sm">{showtime?.screen_type || '2d'}</Badge>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold text-base line-clamp-2">{film?.title}</h3>
                    <p className="text-cyan-200/80 text-xs">{showtime?.screen_name}</p>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Show details */}
                  <div className="space-y-1.5 text-sm pb-4 border-b border-slate-700/60">
                    <div className="flex items-center gap-2 text-slate-300"><MapPin className="w-4 h-4 text-cyan-400" />{showtime?.cinema_name}</div>
                    <div className="flex items-center gap-2 text-slate-300"><Calendar className="w-4 h-4 text-cyan-400" />{safeFmtDate(showtime?.show_date)}</div>
                    <div className="flex items-center gap-2 text-slate-300"><Clock className="w-4 h-4 text-cyan-400" />{showtime?.show_time}</div>
                  </div>

                  {/* Selected seats */}
                  <div className="pb-4 border-b border-slate-700/60">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="font-semibold text-white text-sm flex items-center gap-1.5">
                        <Ticket className="w-4 h-4 text-cyan-400" /> Seats
                      </h4>
                      <span className="text-xs text-slate-400 tabular-nums">{selectedSeats.length} / {totalTickets}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeats.length > 0 ? selectedSeats.map((seat) => {
                        const isVip = vipRowSet.has(seat[0]);
                        return (
                          <Badge
                            key={seat}
                            className={isVip
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 gap-1'
                              : 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'}
                          >
                            {isVip && <Crown className="h-3 w-3" />}{seat}
                          </Badge>
                        );
                      }) : <span className="text-slate-500 text-sm italic">No seats selected yet</span>}
                    </div>
                  </div>

                  {/* Pricing breakdown */}
                  <div>
                    <h4 className="font-semibold text-white text-sm mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" /> Order summary
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      {ticketCounts.adult > 0 && (
                        <div className="flex justify-between text-slate-300"><span>Adult × {ticketCounts.adult}</span><span className="tabular-nums">{formatCurrency(ticketCounts.adult * (showtime?.price || 0))}</span></div>
                      )}
                      {ticketCounts.child > 0 && (
                        <div className="flex justify-between text-slate-300"><span>Child × {ticketCounts.child}</span><span className="tabular-nums">{formatCurrency(ticketCounts.child * (showtime?.price || 0) * 0.5)}</span></div>
                      )}
                      {ticketCounts.senior > 0 && (
                        <div className="flex justify-between text-slate-300"><span>Senior × {ticketCounts.senior}</span><span className="tabular-nums">{formatCurrency(ticketCounts.senior * (showtime?.price || 0) * 0.7)}</span></div>
                      )}
                      <div className="flex justify-between text-slate-400"><span>Service fee ({pricing.commissionRate}%)</span><span className="tabular-nums">+{formatCurrency(pricing.commission)}</span></div>
                      <div className="pt-3 mt-3 border-t border-slate-700/60 flex justify-between items-center">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-2xl font-bold text-cyan-300 tabular-nums" data-testid="cinema-booking-total">{formatCurrency(pricing.total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method (NOW BELOW Order Summary, per request) */}
              <Card className="overflow-hidden border-cyan-500/15 bg-slate-900/70 backdrop-blur-md">
                <div className="bg-gradient-to-r from-cyan-600/30 via-cyan-500/20 to-transparent border-b border-cyan-500/15 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-cyan-500/20 rounded-lg border border-cyan-400/30">
                      <CreditCard className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Payment method</h3>
                      <p className="text-[11px] text-cyan-200/70">Secure checkout via Stripe / MoMo</p>
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

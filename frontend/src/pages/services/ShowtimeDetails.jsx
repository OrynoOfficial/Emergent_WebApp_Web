// Event booking page — design mirrors CinemaBooking.jsx (cyan-on-slate +
// step indicator + hero card + 2/3 + 1/3 grid). The "Ticket details" /
// venue-policies panel is preserved on the right rail per product request.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MapPin, Calendar, Clock, Ticket, Loader2,
  Plus, Minus, Flame, Sparkles, AlertCircle, Building2,
  CreditCard, User, CheckCircle2, Theater, Armchair, PartyPopper,
  Image as ImageIcon, Receipt, ShieldCheck,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';

import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { BookerInfoSection } from '@/components/booking/BookerInfoSection';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import OperatorBookingBlock from '@/components/shared/OperatorBookingBlock';

const SERVICE_FEE_PCT = 0.03; // mirrors backend constant

// ── helpers ─────────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Tickets', icon: Ticket },
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
                    ? 'bg-pink-600 text-white shadow-[0_0_25px_rgba(244,114,182,0.35)]'
                    : 'bg-slate-200 text-slate-500 border border-slate-300'
                }`}
                data-testid={`booking-step-${step.num}`}
              >
                {passed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-[11px] mt-2 font-medium tracking-wide uppercase ${reached ? 'text-pink-700' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 mt-[-18px] rounded-full transition-all ${passed ? 'bg-pink-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy · HH:mm') : iso;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy') : iso;
}
function fmtTime(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'HH:mm') : iso;
}
function availabilityChip(c) {
  const avail = c.available_units ?? 0;
  const total = c.total_units ?? 0;
  if (avail <= 0) return { text: 'Sold out', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle };
  if (total > 0 && avail / total <= 0.2) return { text: `Only ${avail} left`, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame };
  return { text: `${avail} available`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles };
}

// ── Seat picker ─────────────────────────────────────────────────────────────
function SeatPicker({ location, selectedClass, selectedSeats, setSelectedSeats, quantity }) {
  const rows = Math.max(1, Math.min(20, Number(location?.grid_rows) || 8));
  const cols = Math.max(1, Math.min(26, Number(location?.grid_cols) || 12));
  const aisle = Number(location?.grid_aisle_after) || 0;
  const booked = new Set(selectedClass?.booked_seats || []);
  const classColor = selectedClass?.color || '#ec4899';

  const toggle = (seatId) => {
    if (booked.has(seatId)) return;
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) return prev.filter((s) => s !== seatId);
      if (prev.length >= quantity) return [...prev.slice(1), seatId];
      return [...prev, seatId];
    });
  };

  return (
    <div className="bg-slate-50 rounded-xl p-5">
      <div className="flex flex-col items-center">
        <div className="w-2/3 h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 mb-1.5" />
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-4">STAGE / SCREEN</p>
        <div className="space-y-1.5">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="w-4 text-[10px] text-slate-400 text-right">{String.fromCharCode(65 + r)}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: cols }).map((_, c) => {
                  const seatId = `${String.fromCharCode(65 + r)}-${c + 1}`;
                  const isBooked = booked.has(seatId);
                  const isPicked = selectedSeats.includes(seatId);
                  return (
                    <React.Fragment key={c}>
                      <button
                        type="button"
                        onClick={() => toggle(seatId)}
                        disabled={isBooked}
                        title={seatId}
                        className={`w-5 h-5 rounded-sm text-[8px] flex items-center justify-center transition-all ${
                          isBooked ? 'bg-slate-300 cursor-not-allowed' :
                          isPicked ? 'ring-2 ring-offset-1 shadow' :
                          'bg-white border border-slate-300 hover:border-pink-400 cursor-pointer'
                        }`}
                        style={isPicked ? { background: classColor, color: 'white', ringColor: classColor } : {}}
                        data-testid={`seat-${seatId}`}
                      >
                        {isBooked ? '×' : (c + 1)}
                      </button>
                      {aisle > 0 && c + 1 === aisle && <div className="w-2.5" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white border border-slate-300 rounded-sm" /> Free</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: classColor }} /> Selected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-300 rounded-sm" /> Booked</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ShowtimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOperatorUser } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ticket / seat state
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Booker info (Cinema-style first/last/email/phone + self-fill toggle)
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [isSelf, setIsSelf] = useState(false);

  // Payment state
  const [currentStep, setCurrentStep] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [triggerPayment, setTriggerPayment] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const sRes = await api.get(`/event-showtimes/${id}`);
        setShowtime(sRes.data);
        if (sRes.data?.location_id) {
          const lRes = await api.get(`/event-locations/${sRes.data.location_id}`);
          setLocation(lRes.data);
        }
        const firstAvailable = (sRes.data.classes || []).find((c) => (c.available_units ?? 0) > 0);
        if (firstAvailable) setSelectedClassId(firstAvailable.id);
      } catch {
        toast.error('Showtime not found');
        navigate('/services/events');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  // Reset seats when class or quantity changes
  useEffect(() => { setSelectedSeats([]); }, [selectedClassId, quantity]);

  // ── Derived state ────────────────────────────────────────────────────────
  const selectedClass = useMemo(
    () => (showtime?.classes || []).find((c) => c.id === selectedClassId),
    [showtime, selectedClassId],
  );
  const needsSeatPicker = location?.layout_type === 'visual_grid';
  const subtotal = selectedClass ? Number(selectedClass.price) * quantity : 0;
  const serviceFee = Math.round(subtotal * SERVICE_FEE_PCT);
  const grandTotal = subtotal + serviceFee;
  const maxQty = selectedClass ? Math.max(1, Math.min(10, selectedClass.available_units || 0)) : 1;
  const isPastShowtime = useMemo(() => {
    if (!showtime?.start_datetime) return false;
    const d = parseISO(showtime.start_datetime);
    return isValid(d) && d.getTime() < Date.now();
  }, [showtime]);
  const startingPrice = useMemo(() => {
    const prices = (showtime?.classes || [])
      .filter((c) => (c.available_units ?? 0) > 0)
      .map((c) => Number(c.price));
    return prices.length ? Math.min(...prices) : 0;
  }, [showtime]);
  // Poster fallback chain: dedicated poster_url → first gallery image → null.
  const posterUrl = showtime?.poster_url || showtime?.images?.[0] || null;

  // Drive the step indicator off interaction milestones.
  useEffect(() => {
    if (!selectedClass) return;
    if (formData.firstName && formData.email && formData.phone) {
      setCurrentStep((s) => Math.max(s, 3));
    } else if (selectedSeats.length === quantity || !needsSeatPicker) {
      setCurrentStep((s) => Math.max(s, 2));
    } else {
      setCurrentStep(1);
    }
  }, [selectedClass, selectedSeats.length, quantity, needsSeatPicker, formData.firstName, formData.email, formData.phone]);

  // Booker self-fill toggle (mirrors CinemaBooking.handleSelfChange)
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
          lastName: profile.last_name || parts.slice(1).join(' ') || '',
          email: profile.email || p.email,
          phone: profile.phone || p.phone || '',
        }));
      } catch { /* user already in context */ }
    } else {
      setFormData((p) => ({ ...p, firstName: '', lastName: '', phone: '' }));
    }
  };

  const canPay = !!selectedClass
    && !!formData.firstName?.trim()
    && !!formData.email?.trim()
    && !!formData.phone?.trim()
    && !isPastShowtime
    && (selectedClass?.available_units ?? 0) >= quantity
    && (!needsSeatPicker || selectedSeats.length === quantity)
    && !!selectedPaymentMethod;

  // ── Booking flow ─────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedPaymentMethod) { toast.error('Pick a payment method'); return; }
    if (!formData.firstName?.trim()) { toast.error('First name is required'); return; }
    if (needsSeatPicker && selectedSeats.length !== quantity) {
      toast.error(`Select ${quantity} seat${quantity > 1 ? 's' : ''}`); return;
    }
    setReserving(true);
    try {
      const res = await api.post('/event-showtimes/book', {
        showtime_id: showtime.id,
        class_id: selectedClassId,
        quantity,
        seat_ids: needsSeatPicker ? selectedSeats : null,
        contact_name: `${formData.firstName} ${formData.lastName}`.trim(),
        contact_phone: formData.phone || null,
        contact_email: formData.email || null,
      });
      setOrderId(res.data.order_id);
      setTriggerPayment(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reservation failed');
    } finally { setReserving(false); }
  };

  const handlePaymentInitiated = ({ success, message } = {}) => {
    setTriggerPayment(false);
    if (success) {
      toast.success('Payment confirmed — see you at the show!');
      navigate(`/orders?highlight=${orderId}`);
    } else if (message) {
      toast.error(message);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-pink-50">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-pink-500/30 rounded-full animate-pulse" />
            <PartyPopper className="h-10 w-10 text-pink-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <p className="text-pink-700 mt-4 font-medium tracking-wide uppercase text-xs">Loading showtime…</p>
        </div>
      </div>
    );
  }
  if (!showtime) return null;
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      {/* Ambient pink glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] bg-rose-400/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1472px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-900 hover:bg-slate-100" data-testid="showtime-back-btn">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-pink-600/70 text-[11px] tracking-[0.3em] uppercase">Event Booking</p>
              <h1 className="text-xl font-bold text-slate-900 truncate" data-testid="showtime-title">{showtime.title}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-[1472px] mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Hero card */}
        <Card className="relative overflow-hidden mb-8 border-pink-500/20 bg-white" data-testid="event-hero">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-transparent to-rose-500/5 pointer-events-none" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-5">
                {showtime.operator_logo_url ? (
                  <img
                    src={showtime.operator_logo_url}
                    alt={showtime.operator_name}
                    className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-pink-500/20 border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-700 flex items-center justify-center shadow-lg shadow-pink-500/25">
                    <PartyPopper className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight">{showtime.title}</h2>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-pink-600" />{showtime.location_name}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-pink-600" />{fmtDate(showtime.start_datetime)}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-pink-600" />{fmtTime(showtime.start_datetime)}</span>
                    {showtime.event_type && (
                      <Badge className="bg-pink-600 text-white border border-pink-700/40 uppercase text-[10px] tracking-wider">{showtime.event_type}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-pink-600/70 text-[10px] tracking-[0.3em] uppercase mb-1">Starting from</p>
                <p className="text-3xl font-bold text-slate-900">{formatFCFA(startingPrice)}</p>
                <p className="text-slate-500 text-xs">per ticket</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ───────── LEFT — tickets, seats, booker ───────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tickets */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl" data-testid="reserve-card">
              <div className="h-1 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-400" />
              <div className="bg-gradient-to-r from-pink-50 to-white border-b border-pink-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 rounded-xl border border-pink-200">
                    <Ticket className="h-5 w-5 text-pink-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Pick your tickets</h3>
                    <p className="text-xs text-pink-700/80">Choose a tier and how many — colour matches the seat preview</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-5 space-y-3" data-testid="ticket-classes">
                {(showtime.classes || []).map((c) => {
                  const isActive = selectedClassId === c.id;
                  const soldOut = (c.available_units ?? 0) <= 0;
                  const chip = availabilityChip(c);
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={soldOut || isPastShowtime}
                      onClick={() => { setSelectedClassId(c.id); setQuantity(1); }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        soldOut || isPastShowtime ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' :
                        isActive ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-slate-200 hover:border-pink-300 bg-white'
                      }`}
                      data-testid={`class-option-${c.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-2 ring-white" style={{ background: c.color || '#ec4899' }} />
                          <span className="font-semibold text-sm text-slate-900 truncate">{c.name}</span>
                        </div>
                        <span className="font-bold text-pink-700 text-sm whitespace-nowrap tabular-nums">{formatFCFA(c.price)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${chip.color}`}>
                          <ChipIcon className="w-3 h-3" /> {chip.text}
                        </span>
                        {(c.perks || []).slice(0, 3).map((p, i) => <span key={i} className="text-[10px] text-slate-500">• {p}</span>)}
                      </div>
                    </button>
                  );
                })}

                {selectedClass && !isPastShowtime && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 -mx-5 -mb-5 px-5 py-4 rounded-b-2xl">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Quantity</p>
                      <p className="text-[11px] text-slate-500">Up to {maxQty} per booking</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:border-pink-400/40"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        data-testid="qty-decrement"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center text-slate-900 text-lg font-bold tabular-nums" data-testid="qty-value">{quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full border-pink-300 bg-pink-100 text-pink-700 hover:bg-pink-200"
                        onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                        disabled={quantity >= maxQty}
                        data-testid="qty-increment"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seat picker (visual_grid only) */}
            {selectedClass && needsSeatPicker && !isPastShowtime && (
              <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl" data-testid="seat-picker-card">
                <div className="h-1 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-400" />
                <div className="bg-gradient-to-r from-pink-50 to-white border-b border-pink-100 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-pink-100 rounded-xl border border-pink-200">
                        <Armchair className="h-5 w-5 text-pink-700" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Select your seats</h3>
                        <p className="text-xs text-pink-700/80">Choose {quantity} seat{quantity !== 1 ? 's' : ''} on the {selectedClass.name} tier</p>
                      </div>
                    </div>
                    <Badge className="bg-pink-100 text-pink-700 border-pink-200">{selectedSeats.length} / {quantity}</Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <SeatPicker
                    location={location}
                    selectedClass={selectedClass}
                    selectedSeats={selectedSeats}
                    setSelectedSeats={setSelectedSeats}
                    quantity={quantity}
                  />
                  {selectedSeats.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] uppercase font-semibold text-slate-500 mb-2">Your seats</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSeats.map((s) => (
                          <Badge
                            key={s}
                            className="text-[11px] border-0"
                            style={{ background: `${selectedClass.color || '#ec4899'}22`, color: selectedClass.color || '#ec4899' }}
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact info — Cinema-style BookerInfoSection */}
            {selectedClass && !isPastShowtime && (
              <Card className="overflow-hidden border-pink-200 bg-white" data-testid="contact-card">
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
            )}
          </div>

          {/* ───────── RIGHT — summary, ticket details, price, payment ───────── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">

              {/* Order Summary card with event poster header */}
              <Card className="overflow-hidden border-pink-500/20 bg-white" data-testid="order-summary-card">
                <div className="relative h-44 bg-gradient-to-br from-pink-700 via-rose-600 to-slate-900 overflow-hidden">
                  {posterUrl ? (
                    <img src={posterUrl} alt={showtime.title} onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover opacity-80" data-testid="order-poster-image" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-24 h-24 text-white/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
                  {showtime.event_type && (
                    <Badge className="absolute top-3 left-3 bg-pink-500/30 text-pink-100 border border-pink-400/40 uppercase tracking-wider text-[10px] backdrop-blur-sm">
                      {showtime.event_type}
                    </Badge>
                  )}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold text-base line-clamp-2 drop-shadow">{showtime.title}</h3>
                    {showtime.operator_name && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 text-pink-700 font-semibold text-[11px] uppercase tracking-wide shadow-sm">
                        <Building2 className="w-3 h-3" /> {showtime.operator_name}
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-200">
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-pink-600" /> Venue
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{showtime.location_name || '—'}</p>
                      {location && (
                        <p className="text-[11px] text-slate-500">{[location.address, location.city].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-pink-600" /> Date
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{fmtDate(showtime.start_datetime)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-pink-600" /> Showtime
                      </p>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {fmtTime(showtime.start_datetime)}
                        {showtime.doors_open_at ? ` · doors ${showtime.doors_open_at}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Selected ticket + seats */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                        <Ticket className="w-4 h-4 text-pink-600" /> {selectedClass?.name || 'Ticket'}
                      </h4>
                      <span className="text-xs text-slate-500 tabular-nums">× {quantity}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {needsSeatPicker && selectedSeats.length > 0 ? (
                        selectedSeats.map((s) => (
                          <Badge
                            key={s}
                            className="text-[11px] border-0"
                            style={{ background: `${selectedClass?.color || '#ec4899'}22`, color: selectedClass?.color || '#ec4899' }}
                          >
                            {s}
                          </Badge>
                        ))
                      ) : needsSeatPicker ? (
                        <span className="text-slate-500 text-sm italic">No seats selected yet</span>
                      ) : (
                        <span className="text-slate-500 text-sm">General admission</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ticket details — KEPT per user request. Venue policies + organiser. */}
              <Card className="overflow-hidden border-slate-200 bg-white shadow-sm rounded-2xl" data-testid="ticket-details-card">
                <div className="h-1 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-400" />
                <div className="bg-gradient-to-r from-pink-50 to-white border-b border-pink-100 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-pink-100 rounded-lg border border-pink-300">
                      <Sparkles className="h-4 w-4 text-pink-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Ticket details</h4>
                      <p className="text-[11px] text-pink-700/80">Venue plan, policies and organiser</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Theater className="w-3.5 h-3.5 text-pink-600 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-semibold">Seating plan</p>
                      <p className="text-xs font-bold text-slate-800 capitalize">{location?.layout_type?.replace('_', ' ') || '—'}</p>
                      <p className="text-[10px] text-slate-500">{location?.capacity ?? '—'} capacity</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {showtime.operator_logo_url ? (
                      <img src={showtime.operator_logo_url} alt={showtime.operator_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-pink-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase font-semibold text-pink-600">Organised by</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{showtime.operator_name}</p>
                      {(showtime.operator_phone || showtime.operator_email) && (
                        <p className="text-[10px] text-slate-500 truncate">{showtime.operator_phone || showtime.operator_email}</p>
                      )}
                    </div>
                  </div>

                  {(location?.policies || []).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-2.5 space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-slate-500">Venue policies</p>
                      <ul className="text-[11px] text-slate-700 space-y-0.5">
                        {(location.policies || []).slice(0, 4).map((p, i) => (
                          <li key={i} className="flex gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Price Breakdown — Cinema-style with #082c59 header */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-slate-100" data-testid="events-price-breakdown">
                <div className="bg-[#082c59] p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-2 text-sm">
                    {selectedClass && (
                      <div className="flex justify-between text-slate-600">
                        <span>{selectedClass.name} × {quantity}</span>
                        <span className="font-medium text-slate-800 tabular-nums">{formatFCFA(subtotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>
                        Service fee ({Math.round(SERVICE_FEE_PCT * 100)}%)
                        <span className="block text-[10px] text-slate-400 mt-0.5">Platform · 24/7 support · secure payment</span>
                      </span>
                      <span className="font-medium tabular-nums" data-testid="service-fee">+{formatFCFA(serviceFee)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-[#082c59] tabular-nums" data-testid="total-amount">{formatFCFA(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <Card className="overflow-hidden border-pink-200 bg-white" data-testid="payment-card">
                <div className="bg-gradient-to-r from-pink-50 to-white border-b border-pink-200 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-pink-100 rounded-lg border border-pink-300">
                      <CreditCard className="h-4 w-4 text-pink-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Payment method</h3>
                      <p className="text-[11px] text-pink-700/80 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Stripe · MoMo · Orange</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  {!selectedClass && (
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> Pick a ticket above to choose a payment method.
                    </div>
                  )}
                  {selectedClass && needsSeatPicker && selectedSeats.length !== quantity && (
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> Select {quantity} seat{quantity > 1 ? 's' : ''} (currently {selectedSeats.length}) to unlock payment.
                    </div>
                  )}
                  <div className={(!selectedClass || (needsSeatPicker && selectedSeats.length !== quantity)) ? 'opacity-50 pointer-events-none' : ''}>
                    <PaymentMethodsSelection
                      amount={grandTotal}
                      orderId={orderId}
                      customerEmail={formData.email}
                      customerPhone={formData.phone}
                      serviceDetails={{ name: showtime.title }}
                      triggerPayment={triggerPayment}
                      onPaymentInitiated={handlePaymentInitiated}
                      onMethodSelected={setSelectedPaymentMethod}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Confirm CTA — Cinema-style gradient pill */}
              <Button
                onClick={handlePay}
                disabled={!canPay || reserving}
                data-testid="book-now-btn"
                className="w-full h-13 py-6 rounded-xl bg-gradient-to-r from-pink-500 via-pink-400 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-base shadow-[0_8px_30px_-8px_rgba(244,114,182,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
              >
                {reserving ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing…</>
                ) : isPastShowtime ? (
                  <><AlertCircle className="w-5 h-5 mr-2" /> Event ended</>
                ) : !selectedClass ? (
                  'Pick a ticket'
                ) : needsSeatPicker && selectedSeats.length !== quantity ? (
                  `Select ${Math.max(0, quantity - selectedSeats.length)} more seat(s)`
                ) : !formData.firstName?.trim() || !formData.email?.trim() || !formData.phone?.trim() ? (
                  'Fill in your details'
                ) : !selectedPaymentMethod ? (
                  'Choose a payment method'
                ) : (
                  <>Confirm booking · {formatFCFA(grandTotal)}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

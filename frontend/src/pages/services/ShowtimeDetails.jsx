// Single-page booking layout for the new Location → Showtime architecture.
// LEFT (2/3):  Pick tickets · Your details · Seat selection (when applicable)
// RIGHT (1/3): Ticket details · Price breakdown · Payment method · Pay button
//
// Order creation + payment is one atomic flow now (no more 2-step). The order
// is created on the FIRST interaction with PaymentMethodsSelection (which
// already handles the gateway redirect).
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, MapPin, Calendar, Clock, Ticket, Loader2,
  Plus, Minus, Flame, Sparkles, AlertCircle, Building2,
  CreditCard, User as UserIcon, Mail, Phone, ShieldCheck, Theater, CheckCircle2,
  Image as ImageIcon, Receipt,
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';

const SERVICE_FEE_PCT = 0.03;   // mirrors backend constant; safe duplicate.

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy · HH:mm') : iso;
}
function availabilityChip(c) {
  const avail = c.available_units ?? 0;
  const total = c.total_units ?? 0;
  if (avail <= 0) return { text: 'Sold out', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle };
  if (total > 0 && avail / total <= 0.2) return { text: `Only ${avail} left`, color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame };
  return { text: `${avail} left`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles };
}

// ── Seat picker for visual_grid venues. Cinema-like UI; wired to the
//    location.grid_rows/cols defined in the Management → Locations editor.
function SeatPicker({ location, selectedClass, selectedSeats, setSelectedSeats, quantity }) {
  const rows = Math.max(1, Math.min(20, Number(location?.grid_rows) || 8));
  const cols = Math.max(1, Math.min(26, Number(location?.grid_cols) || 12));
  const aisle = Number(location?.grid_aisle_after) || 0;
  const booked = new Set(selectedClass?.booked_seats || []);
  const classColor = selectedClass?.color || '#3b82f6';

  const toggle = (seatId) => {
    if (booked.has(seatId)) return;
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) return prev.filter(s => s !== seatId);
      if (prev.length >= quantity) return [...prev.slice(1), seatId];   // rolling selection
      return [...prev, seatId];
    });
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex flex-col items-center">
        <div className="w-2/3 h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 mb-1.5" />
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">STAGE / SCREEN</p>
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

export default function ShowtimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showtime, setShowtime] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });

  // Payment wiring — order is created lazily on "Pay" click.
  const [reserving, setReserving] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [triggerPayment, setTriggerPayment] = useState(false);

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
        const firstAvailable = (sRes.data.classes || []).find(c => (c.available_units ?? 0) > 0);
        if (firstAvailable) setSelectedClassId(firstAvailable.id);
      } catch {
        toast.error('Showtime not found');
        navigate('/services/events');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (user) {
      setContact(c => ({
        name: c.name || user.name || '',
        email: c.email || user.email || '',
        phone: c.phone || user.phone || '',
      }));
    }
  }, [user]);

  // Reset seats whenever class or qty changes — keeps state consistent.
  useEffect(() => { setSelectedSeats([]); }, [selectedClassId, quantity]);

  const selectedClass = useMemo(
    () => (showtime?.classes || []).find(c => c.id === selectedClassId),
    [showtime, selectedClassId]
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

  const canPay = !!selectedClass
    && !!contact.name?.trim()
    && !isPastShowtime
    && (selectedClass?.available_units ?? 0) >= quantity
    && (!needsSeatPicker || selectedSeats.length === quantity)
    && !!selectedPaymentMethod;

  // Reserve seats (creates the order in pending) THEN trigger the payment
  // gateway via PaymentMethodsSelection. PMS handles success/error callbacks.
  const handlePay = async () => {
    if (!selectedPaymentMethod) { toast.error('Pick a payment method'); return; }
    if (!contact.name?.trim()) { toast.error('Name is required'); return; }
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
        contact_name: contact.name,
        contact_phone: contact.phone || null,
        contact_email: contact.email || null,
      });
      setOrderId(res.data.order_id);
      setTriggerPayment(true);     // PaymentMethodsSelection fires the gateway.
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reservation failed');
    } finally { setReserving(false); }
  };

  const handlePaymentInitiated = ({ success, message }) => {
    setTriggerPayment(false);
    if (success) {
      toast.success('Payment confirmed — see you at the show!');
      navigate(`/orders?highlight=${orderId}`);
    } else {
      toast.error(message || 'Payment failed — your reservation will expire shortly');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <Loader2 className="h-12 w-12 animate-spin text-pink-600" />
      </div>
    );
  }
  if (!showtime) return null;

  return (
    <div className="min-h-screen bg-pink-50/30 pb-12">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur border-b border-pink-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-pink-700 hover:bg-pink-50" data-testid="showtime-back-btn">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-pink-600 text-[10px] tracking-[0.2em] uppercase">Event Booking</p>
            <h1 className="text-lg font-bold text-slate-900 truncate" data-testid="showtime-title">{showtime.title}</h1>
          </div>
          {showtime.operator_logo_url && (
            <img src={showtime.operator_logo_url} alt={showtime.operator_name} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow" />
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ───────── LEFT (2/3) — pick tickets, contact, seats ───────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pick your tickets */}
          <Card className="overflow-hidden border-pink-200 shadow-md" data-testid="reserve-card">
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-3">
              <h2 className="font-bold text-white flex items-center gap-2"><Ticket className="w-4 h-4" /> Pick your tickets</h2>
            </div>
            <CardContent className="bg-white p-4 space-y-3">
              <div className="space-y-2" data-testid="ticket-classes">
                {(showtime.classes || []).map(c => {
                  const isActive = selectedClassId === c.id;
                  const soldOut = (c.available_units ?? 0) <= 0;
                  const chip = availabilityChip(c);
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={c.id} type="button" disabled={soldOut || isPastShowtime}
                      onClick={() => { setSelectedClassId(c.id); setQuantity(1); }}
                      className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                        soldOut || isPastShowtime ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' :
                        isActive ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-slate-200 hover:border-pink-300 bg-white'
                      }`}
                      data-testid={`class-option-${c.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || '#3b82f6' }} />
                          <span className="font-semibold text-sm text-slate-900 truncate">{c.name}</span>
                        </div>
                        <span className="font-bold text-pink-700 text-sm whitespace-nowrap">{formatFCFA(c.price)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${chip.color}`}>
                          <ChipIcon className="w-3 h-3" /> {chip.text}
                        </span>
                        {(c.perks || []).slice(0, 2).map((p, i) => <span key={i} className="text-[10px] text-slate-500">• {p}</span>)}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedClass && !isPastShowtime && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Quantity</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1} data-testid="qty-decrement"><Minus className="w-3.5 h-3.5" /></Button>
                    <span className="font-bold w-8 text-center" data-testid="qty-value">{quantity}</span>
                    <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty} data-testid="qty-increment"><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your details */}
          {selectedClass && !isPastShowtime && (
            <Card className="overflow-hidden border-slate-200 shadow-md" data-testid="contact-card">
              <div className="bg-[#082c59] p-3">
                <h4 className="font-bold text-white flex items-center gap-2"><UserIcon className="w-4 h-4" /> Your details</h4>
              </div>
              <CardContent className="bg-white p-4 space-y-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Name *</Label>
                  <Input value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} className="h-9 text-sm mt-1" data-testid="contact-name-input" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                    <Input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} className="h-9 text-sm mt-1" data-testid="contact-email-input" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                    <Input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} className="h-9 text-sm mt-1" data-testid="contact-phone-input" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seat picker (visual_grid only) */}
          {selectedClass && needsSeatPicker && !isPastShowtime && (
            <Card className="overflow-hidden border-amber-200 shadow-md" data-testid="seat-picker-card">
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-3 flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-2"><Theater className="w-4 h-4" /> Pick your seats</h4>
                <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                  {selectedSeats.length} / {quantity} selected
                </Badge>
              </div>
              <CardContent className="bg-white p-4">
                <SeatPicker
                  location={location}
                  selectedClass={selectedClass}
                  selectedSeats={selectedSeats}
                  setSelectedSeats={setSelectedSeats}
                  quantity={quantity}
                />
                {selectedSeats.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1.5">Your seats</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSeats.map(s => (
                        <Badge key={s} className="text-[11px] border-0" style={{ background: `${selectedClass.color || '#3b82f6'}22`, color: selectedClass.color || '#3b82f6' }}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ───────── RIGHT (1/3) — summary, breakdown, payment ───────── */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Ticket details + policy */}
          <Card className="overflow-hidden border-pink-200 shadow-md" data-testid="ticket-details-card">
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-3">
              <h4 className="font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4" /> Ticket details</h4>
            </div>
            <CardContent className="bg-white p-4 space-y-3 text-sm">
              {showtime.images?.[0] ? (
                <img src={showtime.images[0]} alt="" className="w-full h-28 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-28 rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-pink-300" />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-pink-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">Date</p>
                    <p className="text-xs font-bold text-slate-800">{fmtDateTime(showtime.start_datetime)}</p>
                    {showtime.doors_open_at && <p className="text-[10px] text-slate-500">Doors {showtime.doors_open_at}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-pink-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">Location</p>
                    <p className="text-xs font-bold text-slate-800">{showtime.location_name}</p>
                    {location && (
                      <p className="text-[10px] text-slate-500">{[location.address, location.city].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Theater className="w-3.5 h-3.5 text-pink-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">Seating plan</p>
                    <p className="text-xs font-bold text-slate-800 capitalize">{location?.layout_type?.replace('_', ' ') || '—'}</p>
                    <p className="text-[10px] text-slate-500">{location?.capacity ?? '—'} capacity</p>
                  </div>
                </div>
                {/* Operator block */}
                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-2">
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

          {/* Price breakdown */}
          <Card className="overflow-hidden shadow-lg" data-testid="events-price-breakdown">
            <div className="bg-[#082c59] p-3">
              <h4 className="font-bold text-white flex items-center gap-2"><Receipt className="w-4 h-4" /> Price Breakdown</h4>
            </div>
            <CardContent className="bg-white p-4 space-y-1.5 text-sm">
              {selectedClass && (
                <div className="flex justify-between text-slate-600">
                  <span>{selectedClass.name} × {quantity}</span>
                  <span className="tabular-nums font-medium">{formatFCFA(subtotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <div>
                  <span>Service fee</span>
                  <p className="text-[10px] text-slate-400">{Math.round(SERVICE_FEE_PCT * 100)}% to keep the platform running, support 24/7, and secure your payment.</p>
                </div>
                <span className="tabular-nums font-medium" data-testid="service-fee">{formatFCFA(serviceFee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 text-pink-700">
                <span>Total</span>
                <span className="tabular-nums" data-testid="total-amount">{formatFCFA(grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="overflow-hidden border-cyan-200 shadow-md" data-testid="payment-card">
            <div className="bg-gradient-to-r from-cyan-700 to-blue-700 p-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-white" />
              <div>
                <h3 className="font-bold text-white text-sm">Payment method</h3>
                <p className="text-[10px] text-cyan-100 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure checkout · Stripe / MoMo / Orange</p>
              </div>
            </div>
            <CardContent className="bg-white p-3">
              <PaymentMethodsSelection
                amount={grandTotal}
                orderId={orderId}
                customerEmail={contact.email}
                customerPhone={contact.phone}
                serviceDetails={{ name: showtime.title }}
                triggerPayment={triggerPayment}
                onPaymentInitiated={handlePaymentInitiated}
                onMethodSelected={setSelectedPaymentMethod}
              />
            </CardContent>
          </Card>

          <Button onClick={handlePay} disabled={!canPay || reserving}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white h-12 shadow shadow-pink-500/30"
            data-testid="book-now-btn">
            {reserving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reserving…</> :
             isPastShowtime ? <><AlertCircle className="w-4 h-4 mr-2" />Event ended</> :
             !selectedPaymentMethod ? 'Choose a payment method' :
             needsSeatPicker && selectedSeats.length !== quantity ? `Select ${quantity} seat${quantity > 1 ? 's' : ''}` :
             <>Pay {formatFCFA(grandTotal)}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

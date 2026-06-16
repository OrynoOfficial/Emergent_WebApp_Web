// Customer-side Event Showtime detail + booking page.
// 2-step flow: (1) pick ticket class + qty + contact → reserve;
//             (2) pay via PaymentMethodsSelection (Stripe / MoMo / Orange).
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, MapPin, Calendar, Clock, Ticket, Users, Loader2, CheckCircle2,
  Plus, Minus, Flame, Sparkles, Image as ImageIcon, AlertCircle, Building2,
  CreditCard, User as UserIcon, Mail, Phone, ShieldCheck,} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';

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
  return { text: `${avail} available`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles };
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
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [posterIdx, setPosterIdx] = useState(0);

  // ── Step state ────────────────────────────────────────────────────────────
  // step 1 = pick class & contact, step 2 = pay
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [triggerPayment, setTriggerPayment] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const sRes = await api.get(`/event-showtimes/${id}`);
        setShowtime(sRes.data);
        if (sRes.data?.location_id) {
          try {
            const lRes = await api.get(`/event-locations/${sRes.data.location_id}`);
            setLocation(lRes.data);
          } catch (err) { console.warn('Location fetch failed:', err); }
        }
        const firstAvailable = (sRes.data.classes || []).find(c => (c.available_units ?? 0) > 0);
        if (firstAvailable) setSelectedClassId(firstAvailable.id);
      } catch (err) {
        toast.error('Showtime not found');
        navigate('/services/events');
      } finally { setLoading(false); }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (user) {
      setContact(c => ({
        ...c,
        name: c.name || user.name || '',
        email: c.email || user.email || '',
        phone: c.phone || user.phone || '',
      }));
    }
  }, [user]);

  const selectedClass = useMemo(
    () => (showtime?.classes || []).find(c => c.id === selectedClassId),
    [showtime, selectedClassId]
  );
  const subtotal = selectedClass ? Number(selectedClass.price) * quantity : 0;
  const maxQty = selectedClass ? Math.max(1, Math.min(10, selectedClass.available_units || 0)) : 1;
  const isPastShowtime = useMemo(() => {
    if (!showtime?.start_datetime) return false;
    const d = parseISO(showtime.start_datetime);
    return isValid(d) && d.getTime() < Date.now();
  }, [showtime]);

  // ── Step 1: reserve the seats (creates pending order) ────────────────────
  const handleReserve = async () => {
    if (!selectedClassId) { toast.error('Pick a ticket class'); return; }
    if (quantity < 1) { toast.error('Quantity must be at least 1'); return; }
    if (!contact.name?.trim()) { toast.error('Your name is required'); return; }
    setReserving(true);
    try {
      const res = await api.post('/event-showtimes/book', {
        showtime_id: showtime.id,
        class_id: selectedClassId,
        quantity,
        contact_name: contact.name,
        contact_phone: contact.phone || null,
        contact_email: contact.email || null,
      });
      setOrderId(res.data.order_id);
      setStep(2);
      toast.success(`${quantity} × ${selectedClass.name} reserved — complete payment below`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reservation failed');
    } finally { setReserving(false); }
  };

  // ── Step 2: payment callbacks ────────────────────────────────────────────
  const handlePaymentInitiated = ({ success, message }) => {
    setTriggerPayment(false);
    if (success) {
      toast.success('Payment confirmed — see you at the show!');
      navigate(`/orders?highlight=${orderId}`);
    } else {
      toast.error(message || 'Payment failed');
    }
  };
  const handlePay = () => {
    if (!selectedPaymentMethod) { toast.error('Pick a payment method'); return; }
    setTriggerPayment(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading event…</p>
        </div>
      </div>
    );
  }
  if (!showtime) return null;

  const posters = showtime.images || [];
  const policies = location?.policies || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 pb-12">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2" data-testid="showtime-back-btn">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${step === 1 ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-emerald-100 text-emerald-700'}`}>
              {step === 1 ? <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">1</span> : <CheckCircle2 className="w-4 h-4" />}
              Reserve
            </div>
            <div className="w-6 h-px bg-slate-300" />
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${step === 2 ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-slate-100 text-slate-500'}`}>
              <span className={`w-4 h-4 rounded-full ${step === 2 ? 'bg-amber-500' : 'bg-slate-400'} text-white flex items-center justify-center text-[10px] font-bold`}>2</span>
              Pay
            </div>
          </div>
          {showtime.operator_logo_url && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <img src={showtime.operator_logo_url} alt={showtime.operator_name} className="w-6 h-6 rounded-full object-cover" />
              <span>{showtime.operator_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — event details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Posters carousel */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-72 relative bg-gradient-to-br from-indigo-200 to-purple-200" data-testid="showtime-poster">
              {posters.length > 0 ? (
                <>
                  <img src={posters[posterIdx]} alt={showtime.title} className="w-full h-full object-cover" />
                  {posters.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {posters.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPosterIdx(i)}
                          className={`h-2 rounded-full transition ${i === posterIdx ? 'bg-white w-6' : 'bg-white/50 w-2'}`}
                          aria-label={`Poster ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-14 h-14 text-white/70" /></div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge className="bg-amber-500 text-white border-0 capitalize">{showtime.event_type || 'event'}</Badge>
                {isPastShowtime && <Badge className="bg-slate-700 text-white border-0">Past</Badge>}
                {showtime.status === 'sold_out' && <Badge className="bg-rose-600 text-white border-0">Sold out</Badge>}
              </div>
            </div>
            <CardContent className="p-5 space-y-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900" data-testid="showtime-title">{showtime.title}</h1>
                {showtime.description && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{showtime.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">When</p>
                    <p className="text-sm font-semibold text-slate-800">{fmtDateTime(showtime.start_datetime)}</p>
                    {showtime.doors_open_at && (
                      <p className="text-[11px] text-slate-500">Doors {showtime.doors_open_at}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase text-slate-500 font-semibold">Where</p>
                    <p className="text-sm font-semibold text-slate-800">{showtime.location_name}</p>
                    {location && (
                      <p className="text-[11px] text-slate-500">{location.city}{location.address ? ` · ${location.address}` : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Venue card */}
          {location && (
            <Card className="border-indigo-100">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{location.name}</p>
                    {location.description && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{location.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {location.capacity} cap</span>
                      <span className="capitalize">{location.layout_type?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                {policies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1.5">Venue policies</p>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {policies.map((p, i) => <li key={i} className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" /> {p}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — booking panel */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {step === 1 ? (
            // ─── STEP 1: pick class + qty + contact ──────────────────────
            <>
              {/* Ticket class picker — pink-themed card with header band */}
              <Card className="overflow-hidden border-pink-200 shadow-lg" data-testid="reserve-card">
                <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-3">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4" /> Pick your tickets
                  </h2>
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
                          key={c.id}
                          type="button"
                          disabled={soldOut || isPastShowtime}
                          onClick={() => { setSelectedClassId(c.id); setQuantity(1); }}
                          className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                            soldOut || isPastShowtime ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' :
                            isActive ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-slate-200 hover:border-pink-300 bg-white'
                          }`}
                          data-testid={`class-option-${c.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || '#3b82f6' }} />
                              <span className="font-semibold text-sm text-slate-900 truncate">{c.name}</span>
                            </div>
                            <span className="font-bold text-pink-700 text-sm whitespace-nowrap">{formatFCFA(c.price)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${chip.color}`}>
                              <ChipIcon className="w-3 h-3" /> {chip.text}
                            </span>
                            {(c.perks || []).slice(0, 2).map((p, i) => (
                              <span key={i} className="text-[10px] text-slate-500">• {p}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedClass && !isPastShowtime && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
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
                      <p className="text-[10px] text-slate-500 mt-1">Up to {maxQty} per order</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Your details — separate card, like cinema */}
              {selectedClass && !isPastShowtime && (
                <Card className="overflow-hidden border-slate-200 shadow-md" data-testid="contact-card">
                  <div className="bg-[#082c59] p-3">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <UserIcon className="w-4 h-4" /> Your details
                    </h4>
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

              {/* Price breakdown — cinema-style total card */}
              <Card className="overflow-hidden shadow-lg border border-slate-100" data-testid="events-price-breakdown">
                <div className="bg-[#082c59] p-3">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Price Breakdown
                  </h4>
                </div>
                <CardContent className="bg-white p-4 space-y-2">
                  {selectedClass && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>{selectedClass.name} × {quantity}</span>
                      <span className="font-medium tabular-nums">{formatFCFA(selectedClass.price * quantity)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200 text-pink-700">
                    <span>Total</span>
                    <span className="tabular-nums" data-testid="total-amount">{formatFCFA(subtotal)}</span>
                  </div>
                  <Button onClick={handleReserve}
                    disabled={!selectedClass || reserving || isPastShowtime || (selectedClass?.available_units ?? 0) <= 0}
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white h-11 mt-2 shadow shadow-pink-500/30"
                    data-testid="book-now-btn">
                    {reserving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving…</>
                    ) : isPastShowtime ? (<><AlertCircle className="w-4 h-4 mr-2" /> Event has ended</>
                    ) : (<><Ticket className="w-4 h-4 mr-2" /> Continue to payment</>)}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            // ─── STEP 2: pay ─────────────────────────────────────────────
            <>
              {/* Order summary — cinema-style header band */}
              <Card className="overflow-hidden border-emerald-200 shadow-md" data-testid="order-summary-card">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Reservation confirmed
                  </h2>
                </div>
                <CardContent className="bg-white p-4 space-y-2.5">
                  <p className="text-xs text-slate-500">Complete payment below to lock in your seats.</p>
                  <div className="bg-emerald-50/60 rounded-lg p-3 space-y-2 border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: selectedClass?.color || '#3b82f6' }} />
                      <span className="font-bold text-sm text-slate-900">{selectedClass?.name}</span>
                      <Badge className="ml-auto bg-slate-900 text-white border-0">× {quantity}</Badge>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">{showtime.title}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(showtime.start_datetime)}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {showtime.location_name}</div>
                  </div>
                  <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs uppercase font-semibold text-slate-500">Total to pay</span>
                    <span className="text-2xl font-bold text-emerald-700">{formatFCFA(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment — cinema-style header band */}
              <Card className="overflow-hidden border-cyan-200 shadow-md" data-testid="payment-card">
                <div className="bg-gradient-to-r from-cyan-700 to-blue-700 p-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-white" />
                    <div>
                      <h3 className="font-bold text-white text-sm">Payment method</h3>
                      <p className="text-[10px] text-cyan-100 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure checkout · Stripe / MoMo / Orange</p>
                    </div>
                  </div>
                </div>
                <CardContent className="bg-white p-3">
                  <PaymentMethodsSelection
                    amount={subtotal}
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

              <Button onClick={handlePay} disabled={!selectedPaymentMethod}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 shadow shadow-emerald-500/30"
                data-testid="confirm-payment-btn">
                {selectedPaymentMethod
                  ? <>Pay {formatFCFA(subtotal)}</>
                  : 'Choose a payment method'}
              </Button>

              <button onClick={() => { setStep(1); setOrderId(null); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline w-full text-center"
                data-testid="back-to-step-1">
                ← Edit reservation
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

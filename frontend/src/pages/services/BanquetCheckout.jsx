// Banquet & Event Services — checkout page.
//
// Same structural pattern as `LaundryBooking.jsx` — single-page funnel with:
//   • Sticky teal header showing the event date + city + cart counts.
//   • Three-step indicator (Cart → Event Details → Payment) for clarity.
//   • Two-column grid: LEFT = cart-review + event details + contact info,
//     RIGHT = sticky summary (event meta), price breakdown (with promo),
//     inline PaymentMethodsSelection, and a single Confirm & Pay button.
//
// The order is created lazily when the customer hits Confirm so abandoning
// the page doesn't pollute the orders collection.
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerModal from '@/components/shared/DatePickerModal';
import { format } from 'date-fns';
import {
  ArrowLeft, PartyPopper, CalendarIcon, Users, MapPin, Phone, Mail, User,
  Loader2, CheckCircle2, Package as PackageIcon, ShoppingBag, Sparkles, Plus,
  Minus, Trash2, Tag, X, DollarSign, CreditCard, Building2, Clock,
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import { useEventCart } from '@/hooks/useEventCart';
import { useAuth } from '@/contexts/AuthContext';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';
import OperatorBookingBlock from '@/components/shared/OperatorBookingBlock';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL = {
  hall: 'Hall', rental_item: 'Rental', canopy: 'Canopy',
  photographer: 'Photographer', videographer: 'Videographer',
  catering: 'Catering', decoration: 'Decoration',
  sound_lighting: 'Sound & Lighting', other: 'Other',
};

const EVENT_TYPES = ['wedding', 'birthday', 'conference', 'corporate', 'graduation', 'other'];

// ── 3-step indicator (matches LaundryBooking styling) ──────────────────────
const StepIndicator = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Cart' },
    { num: 2, label: 'Event Details' },
    { num: 3, label: 'Payment' },
  ];
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              currentStep >= step.num
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-200'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
            </div>
            <span className={`text-xs mt-2 font-medium ${currentStep >= step.num ? 'text-teal-700' : 'text-slate-400'}`}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded-full transition-all ${currentStep > step.num ? 'bg-teal-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Cart line card — service ───────────────────────────────────────────────
const ServiceLineCard = ({ item, onInc, onDec, onRemove }) => {
  const snap = item.snapshot || {};
  const unitPrice = Number(snap.base_price || 0);
  const hours = snap.pricing_model === 'per_hour' ? (item.hours || 1) : 1;
  const lineTotal = unitPrice * (item.quantity || 1) * hours;
  return (
    <div
      className="rounded-xl border border-teal-100 bg-white p-3 shadow-sm hover:shadow-md transition"
      data-testid={`co-cart-item-${item.service_id}`}
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200 flex-shrink-0">
          {(snap.images && snap.images[0]) ? (
            <img src={snap.images[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-6 h-6 text-teal-400" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 leading-tight truncate">{snap.name}</p>
              <Badge variant="outline" className="text-[10px] mt-1 bg-teal-50 border-teal-200 text-teal-700">
                {CATEGORY_LABEL[snap.category] || snap.category}
              </Badge>
            </div>
            <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0" data-testid={`co-remove-item-${item.service_id}`}>
              <Trash2 className="w-4 h-4 text-teal-500" />
            </Button>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {formatFCFA(unitPrice)} / {snap.unit_label || 'unit'}
            {snap.city && <span> · {snap.city}</span>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon" onClick={onDec}
                disabled={item.quantity <= (snap.min_quantity || 1)}
                className="h-7 w-7 rounded-full border-teal-300 hover:bg-teal-50 disabled:opacity-40"
                data-testid={`co-dec-${item.service_id}`}
              ><Minus className="w-3 h-3" /></Button>
              <span className="text-sm font-bold text-teal-700 tabular-nums min-w-[24px] text-center">{item.quantity}</span>
              <Button
                variant="outline" size="icon" onClick={onInc}
                className="h-7 w-7 rounded-full border-teal-300 hover:bg-teal-50"
                data-testid={`co-inc-${item.service_id}`}
              ><Plus className="w-3 h-3" /></Button>
            </div>
            <div className="text-right">
              <div className="text-base font-bold text-teal-700">{formatFCFA(lineTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Cart line card — bundle / package (read-only here) ────────────────────
const PackageLineCard = ({ pkg, onRemove }) => {
  const snap = pkg.snapshot || {};
  const memberImages = (snap.services || []).flatMap(line => (line.service?.images || []).slice(0, 1)).filter(Boolean);
  const cover = (snap.images && snap.images[0]) || memberImages[0];
  return (
    <div
      className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3 shadow-sm"
      data-testid={`co-cart-package-${pkg.package_id}`}
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-teal-200 border border-teal-300 flex-shrink-0">
          {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center"><PackageIcon className="w-6 h-6 text-teal-700" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Badge className="bg-teal-600 text-white border-0 text-[10px] mb-1"><PackageIcon className="w-2.5 h-2.5 mr-0.5" /> Bundle</Badge>
              <p className="font-semibold text-teal-900 leading-tight truncate">{snap.name}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7 -mr-1.5 -mt-1.5 flex-shrink-0" data-testid={`co-remove-package-${pkg.package_id}`}>
              <Trash2 className="w-4 h-4 text-teal-500" />
            </Button>
          </div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            {snap.services?.length || 0} services
            {snap.discount_percent > 0 && ` · −${snap.discount_percent}% off`}
          </p>
          {snap.subtotal && snap.discount_percent > 0 && (
            <p className="text-[10px] text-slate-400 line-through">{formatFCFA(snap.subtotal)}</p>
          )}
          <div className="mt-1 text-base font-bold text-teal-700">{formatFCFA(snap.total_price || 0)}</div>
        </div>
      </div>
    </div>
  );
};

export default function BanquetCheckout() {
  const navigate = useNavigate();
  const { user, isOperatorUser } = useAuth();
  const { cart, setMeta, updateQty, removeItem, removePackage, totals, count, clear } = useEventCart();

  const [contact, setContact] = useState({
    contact_name: user?.full_name || '',
    contact_phone: user?.phone || '',
    contact_email: user?.email || '',
    address: '',
    special_requests: '',
  });
  const [eventDateOpen, setEventDateOpen] = useState(false);
  const [eventTime, setEventTime] = useState('17:00');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [triggerPayment, setTriggerPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Promo code (mirrors Laundry pattern)
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  // Step indicator — derived from form state, no effect needed.
  const currentStep = useMemo(() => {
    if (selectedPaymentMethod) return 3;
    if (cart.event_date && contact.contact_name && contact.contact_phone) return 2;
    return 1;
  }, [selectedPaymentMethod, cart.event_date, contact.contact_name, contact.contact_phone]);

  const setField = (k, v) => setContact(c => ({ ...c, [k]: v }));

  // Convert YYYY-MM-DD ⇄ Date instance for the DatePickerModal
  const eventDateObj = useMemo(() => {
    if (!cart.event_date) return null;
    const [y, m, d] = cart.event_date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [cart.event_date]);

  // ── Pricing ────────────────────────────────────────────────────────────
  const subtotalBeforeDiscount = totals.total;
  const serviceFee = Math.round(subtotalBeforeDiscount * 0.05);

  const discount = useMemo(() => {
    if (!appliedPromo) return 0;
    const base = subtotalBeforeDiscount + serviceFee;
    if (appliedPromo.discount_percent) return Math.round(base * (appliedPromo.discount_percent / 100));
    if (appliedPromo.fixed_discount) return Math.min(appliedPromo.fixed_discount, base);
    return 0;
  }, [appliedPromo, subtotalBeforeDiscount, serviceFee]);

  const grandTotal = Math.max(0, subtotalBeforeDiscount + serviceFee - discount);

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    try {
      const response = await api.post('/promo-codes/validate', {
        code: promoCode.toUpperCase(),
        service_type: 'banquet',
        order_amount: subtotalBeforeDiscount + serviceFee,
      });
      const promo = response.data;
      setAppliedPromo({
        ...promo,
        discount_percent: promo.discount_type === 'percentage' ? promo.discount_value : null,
        fixed_discount: promo.discount_type === 'fixed' ? promo.discount_value : null,
      });
      setPromoError('');
      toast.success(`Promo applied: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : formatFCFA(promo.discount_value)} off`);
    } catch (err) {
      setPromoError(err.response?.data?.detail || 'Invalid promo code');
      setAppliedPromo(null);
    }
  };

  // ── Validation + submit ────────────────────────────────────────────────
  const validate = () => {
    if (count === 0) { toast.error('Your cart is empty.'); return false; }
    if (!cart.event_date) { toast.error('Please pick your event date.'); return false; }
    if (!contact.contact_name?.trim()) { toast.error('Please enter a contact name.'); return false; }
    if (!contact.contact_phone?.trim()) { toast.error('Please enter a phone number.'); return false; }
    return true;
  };

  const ensureOrder = async () => {
    if (orderId) return orderId;
    const payload = {
      event_date: cart.event_date,
      event_time: eventTime,
      expected_guests: cart.expected_guests || 0,
      event_type: cart.event_type || null,
      line_items: cart.items.map(it => ({
        service_id: it.service_id,
        quantity: it.quantity,
        hours: it.hours || null,
      })),
      package_ids: cart.packages.map(p => p.package_id),
      contact_name: contact.contact_name,
      contact_phone: contact.contact_phone,
      contact_email: contact.contact_email,
      address: contact.address,
      special_requests: contact.special_requests,
      promo_code: appliedPromo?.code,
      promo_discount: discount,
      service_fee: serviceFee,
    };
    const res = await api.post('/banquets/cart/checkout', payload);
    const data = res.data || {};
    const newId = data.order_id || data._id || data.id || data.order_number;
    if (!newId) throw new Error('Failed to create order');
    setOrderId(newId);
    // Snapshot for success screen (cart will be cleared on payment success)
    setSuccess({ ...data, event_date: cart.event_date });
    return newId;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    if (!selectedPaymentMethod) { toast.error('Please choose a payment method.'); return; }
    if (orderId) { setTriggerPayment(true); return; }
    setSubmitting(true);
    try {
      await ensureOrder();
      setTriggerPayment(true);
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = Array.isArray(d) && d[0]?.msg ? `${d[0].loc?.slice(-1)?.[0] || 'Field'}: ${d[0].msg}` : (typeof d === 'string' ? d : err.message || 'Checkout failed');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentInitiated = async (response) => {
    setSubmitting(false);
    setTriggerPayment(false);
    if (response?.opening_modal) return;
    if (response?.success || response?.transactionRef) {
      if (appliedPromo?.code && orderId && discount > 0) {
        try { await api.post(`/promo-codes/use?code=${encodeURIComponent(appliedPromo.code)}&order_id=${orderId}&discount_amount=${discount}`); } catch { /* non-blocking */ }
      }
      toast.success('Event booked!');
      clear();
      navigate('/orders');
    } else {
      toast.error(`Payment Failed: ${response?.message || 'Unknown error'}`);
    }
  };

  // Operator self-booking guard (after hooks)
  if (user?.role === 'operator' || isOperatorUser) return <OperatorBookingBlock />;

  // Empty cart
  if (count === 0 && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-teal-300 mb-4" />
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-slate-600 mb-4">Add some event services or a bundle first.</p>
          <Button onClick={() => navigate('/services/banquet')} className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white" data-testid="back-to-browse-btn">
            Browse event services
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50/40">
      <DatePickerModal
        isOpen={eventDateOpen}
        onClose={() => setEventDateOpen(false)}
        onSelect={(date) => {
          if (date) setMeta({ event_date: format(date, 'yyyy-MM-dd') });
          setEventDateOpen(false);
        }}
        selectedDate={eventDateObj}
        minDate={new Date()}
      />

      {/* Sticky header */}
      <div className="bg-white border-b border-teal-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1472px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-teal-50">
              <ArrowLeft className="h-5 w-5 text-teal-700" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900 truncate flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-teal-600" /> Checkout your event
              </h1>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                <Badge className="text-[10px] bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-transparent">{count} item{count === 1 ? '' : 's'}</Badge>
                {cart.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {cart.city}</span>}
                {cart.event_date && <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {format(eventDateObj, 'MMM d, yyyy')}</span>}
                {cart.expected_guests > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {cart.expected_guests} guests</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1472px] mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT COLUMN ===== */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Cart Items ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="co-cart-card">
              <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-5">
                <div className="flex items-center justify-between gap-3 text-white flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><ShoppingBag className="h-6 w-6" /></div>
                    <div>
                      <h3 className="font-bold text-lg">Your Cart</h3>
                      <p className="text-sm text-white/80">{count} item{count !== 1 ? 's' : ''} ready · review & adjust qty</p>
                    </div>
                  </div>
                  <Badge className="bg-white text-teal-700 hover:bg-white" data-testid="co-cart-subtotal-badge">
                    {formatFCFA(subtotalBeforeDiscount)}
                  </Badge>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {cart.packages.map(p => (
                  <PackageLineCard key={p.package_id} pkg={p} onRemove={() => removePackage(p.package_id)} />
                ))}
                {cart.items.map(it => (
                  <ServiceLineCard
                    key={it.service_id}
                    item={it}
                    onInc={() => updateQty(it.service_id, (it.quantity || 1) + 1)}
                    onDec={() => updateQty(it.service_id, Math.max((it.snapshot?.min_quantity || 1), (it.quantity || 1) - 1))}
                    onRemove={() => removeItem(it.service_id)}
                  />
                ))}
              </div>
            </div>

            {/* ── Event Details ───────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="co-event-card">
              <div className="bg-gradient-to-r from-teal-700 to-teal-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><CalendarIcon className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Event Details</h3>
                    <p className="text-sm text-white/80">When and where is your event?</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Event Date *</Label>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left h-11 bg-slate-50', !cart.event_date && 'text-muted-foreground')}
                      onClick={() => setEventDateOpen(true)}
                      data-testid="co-event-date-btn"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-teal-700" />
                      {cart.event_date ? format(eventDateObj, 'PPP') : 'Select date'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Start Time</Label>
                    <Select value={eventTime} onValueChange={setEventTime}>
                      <SelectTrigger className="h-11 bg-slate-50" data-testid="co-event-time-trigger"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Expected Guests</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="number" min="1"
                        value={cart.expected_guests || ''}
                        onChange={(e) => setMeta({ expected_guests: Number(e.target.value) || 0 })}
                        placeholder="50"
                        className="pl-10 h-11 bg-slate-50"
                        data-testid="co-event-guests"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Event Type</Label>
                    <Select value={cart.event_type || ''} onValueChange={(v) => setMeta({ event_type: v })}>
                      <SelectTrigger className="h-11 bg-slate-50" data-testid="co-event-type-trigger">
                        <SelectValue placeholder="Wedding, birthday, conference…" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {EVENT_TYPES.map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">City</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        value={cart.city || ''}
                        onChange={(e) => setMeta({ city: e.target.value })}
                        placeholder="Douala, Yaoundé…"
                        className="pl-10 h-11 bg-slate-50"
                        data-testid="co-event-city"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Your Information ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="co-contact-card">
              <div className="bg-gradient-to-r from-teal-700 to-teal-500 p-5">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/20 rounded-xl"><User className="h-6 w-6" /></div>
                  <div>
                    <h3 className="font-bold text-lg">Your Information</h3>
                    <p className="text-sm text-white/80">How can we reach you?</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={contact.contact_name} onChange={(e) => setField('contact_name', e.target.value)} placeholder="Jane Doe" className="pl-10 h-11 bg-slate-50" data-testid="co-contact-name" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Phone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={contact.contact_phone} onChange={(e) => setField('contact_phone', e.target.value)} placeholder="+237 6XX XXX XXX" className="pl-10 h-11 bg-slate-50" data-testid="co-contact-phone" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={contact.contact_email} onChange={(e) => setField('contact_email', e.target.value)} placeholder="you@example.com" className="pl-10 h-11 bg-slate-50" type="email" data-testid="co-contact-email" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Event Location / Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input value={contact.address} onChange={(e) => setField('address', e.target.value)} placeholder="Where will the event take place?" className="pl-10 h-11 bg-slate-50" data-testid="co-contact-address" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-700 font-medium">Special Requests</Label>
                    <Textarea
                      value={contact.special_requests}
                      onChange={(e) => setField('special_requests', e.target.value)}
                      placeholder="Anything we should know? (dietary, layout, parking…)"
                      className="bg-slate-50"
                      data-testid="co-contact-requests"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT COLUMN — sticky summary ===== */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">

              {/* Event summary card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="co-summary-card">
                <div className="relative h-28 bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-500 p-5">
                  <div className="relative">
                    <p className="text-white/85 text-xs uppercase tracking-wider font-semibold">Event Summary</p>
                    <h3 className="text-white font-bold text-lg leading-tight mt-1">
                      {cart.event_type ? `${cart.event_type.charAt(0).toUpperCase()}${cart.event_type.slice(1)}` : 'Your Event'}
                    </h3>
                    <Badge className="bg-white/20 text-white border-white/40 mt-1 text-[10px]">
                      {count} item{count === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </div>
                <div className="p-5 space-y-2.5 text-sm">
                  {cart.event_date && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarIcon className="w-4 h-4 text-teal-700 flex-shrink-0" />
                      <span className="font-medium">{format(eventDateObj, 'EEE, MMM d, yyyy')} · {eventTime}</span>
                    </div>
                  )}
                  {cart.expected_guests > 0 && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Users className="w-4 h-4 text-teal-700 flex-shrink-0" />
                      <span className="font-medium">{cart.expected_guests} guests</span>
                    </div>
                  )}
                  {cart.city && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{cart.city}</span>
                    </div>
                  )}
                  {contact.address && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Building2 className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{contact.address}</span>
                    </div>
                  )}

                  {/* Mini cart preview */}
                  {(cart.packages.length > 0 || cart.items.length > 0) && (
                    <div className="pt-3 mt-2 border-t border-teal-100">
                      <h4 className="font-semibold text-slate-800 mb-2 text-xs uppercase tracking-wide">Selection</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {cart.packages.map(p => (
                          <div key={p.package_id} className="flex justify-between text-xs text-slate-600">
                            <span className="truncate"><PackageIcon className="inline w-3 h-3 mr-1 text-teal-700" />{p.snapshot?.name}</span>
                            <span className="font-medium text-slate-800 ml-2">{formatFCFA(p.snapshot?.total_price || 0)}</span>
                          </div>
                        ))}
                        {cart.items.map(it => {
                          const snap = it.snapshot || {};
                          const unitPrice = Number(snap.base_price || 0);
                          const hours = snap.pricing_model === 'per_hour' ? (it.hours || 1) : 1;
                          const lineTotal = unitPrice * (it.quantity || 1) * hours;
                          return (
                            <div key={it.service_id} className="flex justify-between text-xs text-slate-600">
                              <span className="truncate">{snap.name} × {it.quantity}</span>
                              <span className="font-medium text-slate-800 ml-2">{formatFCFA(lineTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price breakdown */}
              <div className="rounded-2xl shadow-lg overflow-hidden border border-teal-100" data-testid="co-price-breakdown">
                <div className="bg-teal-800 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Price Breakdown
                  </h4>
                </div>
                <div className="bg-white p-5">
                  <div className="space-y-3 text-sm">
                    {totals.bundles > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Bundles</span><span className="font-medium text-slate-800">{formatFCFA(totals.bundles)}</span>
                      </div>
                    )}
                    {totals.items > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Individual services</span><span className="font-medium text-slate-800">{formatFCFA(totals.items)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Service fee (5%)</span><span className="font-medium">+{formatFCFA(serviceFee)}</span>
                    </div>

                    {/* Promo code */}
                    <div className="pt-2">
                      {!appliedPromo ? (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500" />
                            <Input
                              placeholder="Promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value)}
                              className="pl-10 bg-teal-50/40 border-teal-200 text-sm"
                              data-testid="co-promo-input"
                            />
                          </div>
                          <Button
                            onClick={validatePromoCode}
                            variant="outline" size="sm"
                            className="shrink-0 border-teal-300 text-teal-700 hover:bg-teal-50"
                            data-testid="co-promo-apply-btn"
                          >Apply</Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="co-promo-applied">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm text-emerald-700 font-medium">{appliedPromo.code}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="text-red-500 hover:text-red-600 h-7 px-2" data-testid="co-promo-remove">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                      {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                    </div>

                    {discount > 0 && appliedPromo && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({appliedPromo.code})</span>
                        <span className="font-medium">-{formatFCFA(discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-teal-200">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-bold text-teal-700" data-testid="co-grand-total">{formatFCFA(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="bg-teal-800 border-t border-teal-200 p-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Payment Method
                  </h4>
                </div>
                <div className="bg-slate-50 p-5">
                  <PaymentMethodsSelection
                    amount={grandTotal}
                    orderId={orderId}
                    customerPhone={contact.contact_phone}
                    customerEmail={contact.contact_email}
                    serviceDetails={{
                      service_category: 'banquet',
                      service_title: 'Event Services',
                      order_id: orderId,
                    }}
                    serviceName="Event Services"
                    onPaymentInitiated={handlePaymentInitiated}
                    onPaymentError={(error) => toast.error(error.message)}
                    onRequestCreateOrder={ensureOrder}
                    triggerPayment={triggerPayment}
                    onMethodSelected={setSelectedPaymentMethod}
                  />
                  <Button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full mt-4 bg-gradient-to-r from-teal-700 to-cyan-600 hover:from-teal-800 hover:to-cyan-700 text-white h-12 font-semibold rounded-xl shadow-md shadow-teal-300/40 disabled:opacity-60"
                    data-testid="co-confirm-btn"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                    ) : (
                      <><PartyPopper className="w-4 h-4 mr-2" />Confirm &amp; Pay {formatFCFA(grandTotal)}</>
                    )}
                  </Button>
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    You&apos;ll receive a confirmation by phone/email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

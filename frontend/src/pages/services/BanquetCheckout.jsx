// Banquet & Event Services — checkout page.
//
// Shows the cart (read-only), collects contact info + payment method,
// then POSTs to /api/banquets/cart/checkout. Server re-prices and creates
// one order spanning all services + packages. We redirect to the order
// confirmation page on success.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, PartyPopper, Calendar, Users, MapPin, Phone, Mail, User,
  Loader2, CheckCircle2, Package as PackageIcon, ShoppingBag,
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { formatFCFA } from '@/utils/currency';
import { useEventCart } from '@/hooks/useEventCart';
import { useAuth } from '@/contexts/AuthContext';
import PaymentMethodsSelection from '@/components/common/PaymentMethodsSelection';

const CATEGORY_LABEL = {
  hall: 'Hall', rental_item: 'Rental', canopy: 'Canopy',
  photographer: 'Photographer', videographer: 'Videographer',
  catering: 'Catering', decoration: 'Decoration',
  sound_lighting: 'Sound & Lighting', other: 'Other',
};

export default function BanquetCheckout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, setMeta, totals, count, clear } = useEventCart();

  const [contact, setContact] = useState({
    contact_name: user?.full_name || '',
    contact_phone: user?.phone || '',
    contact_email: user?.email || '',
    special_requests: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  // Tracks whether the user has clicked "Pay now" on the success screen so we
  // reveal the payment-methods card and route the order through the V2 ledger.
  const [showPayNow, setShowPayNow] = useState(false);

  const setField = (k, v) => setContact(c => ({ ...c, [k]: v }));

  const validate = () => {
    if (!cart.event_date) { toast.error('Please pick your event date.'); return false; }
    if (!contact.contact_name?.trim()) { toast.error('Please enter a contact name.'); return false; }
    if (!contact.contact_phone?.trim()) { toast.error('Please enter a phone number.'); return false; }
    if (count === 0) { toast.error('Your cart is empty.'); return false; }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const payload = {
        event_date: cart.event_date,
        expected_guests: cart.expected_guests || 0,
        event_type: cart.event_type || null,
        line_items: cart.items.map(it => ({
          service_id: it.service_id,
          quantity: it.quantity,
          hours: it.hours || null,
        })),
        package_ids: cart.packages.map(p => p.package_id),
        ...contact,
      };
      // Snapshot the metadata we want on the success screen *before*
      // clearing the cart — otherwise the confirmation card shows an
      // empty "Event date" row.
      const snapshot = {
        event_date: cart.event_date,
        expected_guests: cart.expected_guests,
        city: cart.city,
        event_type: cart.event_type,
      };
      const res = await api.post('/banquets/cart/checkout', payload);
      setSuccess({ ...res.data, ...snapshot });
      clear();
      toast.success('Event order placed!');
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = Array.isArray(d) && d[0]?.msg
        ? `${d[0].loc?.slice(-1)?.[0] || 'Field'}: ${d[0].msg}`
        : (typeof d === 'string' ? d : 'Checkout failed');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full bg-white shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Your event is booked!</h1>
            <p className="text-slate-600">
              We&apos;ve sent the confirmation to <strong>{contact.contact_email || contact.contact_phone}</strong>.
              Your event ID is <strong className="text-teal-700" data-testid="success-order-number">{success.order_number}</strong>.
            </p>
            <div className="bg-teal-50 rounded-lg p-4 text-left space-y-2 my-4">
              <div className="flex justify-between"><span className="text-slate-600">Event date</span><span className="font-semibold">{success.event_date}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Items</span><span className="font-semibold">{(success.line_items || []).length}</span></div>
              <div className="flex justify-between border-t pt-2 mt-2"><span className="text-slate-600">Total</span><span className="font-bold text-teal-700 text-xl">{formatFCFA(success.total_price)}</span></div>
            </div>

            {/* ── V2 ledger payment ──────────────────────────────────────
                Lazy-disclosed payment card. When the user clicks "Pay now"
                we render <PaymentMethodsSelection/> which writes an
                `intent_created` event to /api/v2/payments/intent and then
                hands off to Stripe or MTN MoMo. Users who'd rather pay
                later can still click "View my orders". */}
            {!showPayNow ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowPayNow(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  data-testid="banquet-pay-now-btn"
                >
                  Pay now
                </Button>
                <Button onClick={() => navigate('/orders')} variant="outline" className="w-full" data-testid="view-orders-btn">
                  View my orders
                </Button>
                <Button onClick={() => navigate('/')} variant="ghost" className="w-full">
                  Back to home
                </Button>
              </div>
            ) : (
              <div className="text-left" data-testid="banquet-payment-block">
                <PaymentMethodsSelection
                  amount={success.total_price}
                  customerPhone={contact.contact_phone}
                  customerEmail={contact.contact_email}
                  orderId={success.order_id || success._id || success.id || success.order_number}
                  serviceDetails={{
                    service_category: 'banquet',
                    service_title: 'Event Services',
                    order_id: success.order_id || success._id || success.id || success.order_number,
                  }}
                  onPaymentInitiated={(data) => {
                    if (data?.success) {
                      toast.success('Payment recorded. Awaiting confirmation.');
                      navigate('/orders');
                    } else if (data?.success === false && data?.message) {
                      toast.error(data.message);
                    }
                  }}
                />
                <Button
                  onClick={() => navigate('/orders')}
                  variant="ghost"
                  className="w-full mt-3"
                  data-testid="banquet-pay-later-btn"
                >
                  I&apos;ll pay later
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty cart guard
  if (count === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white">
          <CardContent className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-slate-600 mb-4">Add some services first.</p>
            <Button onClick={() => navigate('/services/banquet')} className="bg-teal-600 hover:bg-teal-700">
              Browse event services
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-teal-600" /> Checkout your event
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — contact info */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-white border-teal-100">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" /> Event details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Event date *</Label>
                    <Input
                      type="date"
                      value={cart.event_date || ''}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setMeta({ event_date: e.target.value })}
                      className="mt-1 border-teal-200 focus-visible:ring-teal-400"
                      data-testid="checkout-event-date"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Expected guests</Label>
                    <Input
                      type="number" min="1"
                      value={cart.expected_guests || ''}
                      onChange={(e) => setMeta({ expected_guests: Number(e.target.value) || 0 })}
                      className="mt-1 border-teal-200 focus-visible:ring-teal-400"
                      placeholder="50"
                      data-testid="checkout-guests"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">City</Label>
                    <Input
                      value={cart.city || ''}
                      onChange={(e) => setMeta({ city: e.target.value })}
                      className="mt-1 border-teal-200 focus-visible:ring-teal-400"
                      placeholder="Douala, Yaoundé…"
                      data-testid="checkout-city"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Event type</Label>
                    <Input
                      value={cart.event_type || ''}
                      onChange={(e) => setMeta({ event_type: e.target.value })}
                      className="mt-1 border-teal-200 focus-visible:ring-teal-400"
                      placeholder="Wedding, birthday, conference…"
                      data-testid="checkout-event-type"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-slate-900">Contact information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Full name *</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input value={contact.contact_name} onChange={(e) => setField('contact_name', e.target.value)} placeholder="Your name" className="pl-9" data-testid="checkout-name-input" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Phone *</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input value={contact.contact_phone} onChange={(e) => setField('contact_phone', e.target.value)} placeholder="+237 …" className="pl-9" data-testid="checkout-phone-input" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm">Email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input value={contact.contact_email} onChange={(e) => setField('contact_email', e.target.value)} placeholder="you@example.com" className="pl-9" type="email" data-testid="checkout-email-input" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm">Special requests</Label>
                    <Textarea value={contact.special_requests} onChange={(e) => setField('special_requests', e.target.value)} placeholder="Anything we should know? (dietary, layout, parking…)" className="mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — order summary */}
          <Card className="bg-white h-fit sticky top-4">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Order summary</h2>

              {cart.packages.length > 0 && (
                <div className="space-y-2">
                  {cart.packages.map(p => (
                    <div key={p.package_id} className="rounded-lg bg-teal-50 p-3 text-sm" data-testid={`checkout-package-${p.package_id}`}>
                      <div className="flex items-center gap-2 font-semibold text-teal-900">
                        <PackageIcon className="w-4 h-4" />
                        {p.snapshot?.name}
                      </div>
                      <div className="flex justify-between mt-1 text-teal-700">
                        <span>{p.snapshot?.services?.length || 0} services</span>
                        <span className="font-semibold">{formatFCFA(p.snapshot?.total_price || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.items.length > 0 && (
                <div className="space-y-2">
                  {cart.items.map(it => {
                    const line = (it.snapshot?.base_price || 0) * (it.quantity || 1) * (it.snapshot?.pricing_model === 'per_hour' ? (it.hours || 1) : 1);
                    return (
                      <div key={it.service_id} className="text-sm border-b pb-2" data-testid={`checkout-item-${it.service_id}`}>
                        <div className="flex justify-between">
                          <div>
                            <div className="font-medium text-slate-900">{it.snapshot?.name}</div>
                            <div className="text-xs text-slate-500">
                              <Badge variant="outline" className="text-[10px] mr-1">{CATEGORY_LABEL[it.snapshot?.category]}</Badge>
                              × {it.quantity}{it.snapshot?.unit_label ? ` ${it.snapshot.unit_label}${it.quantity > 1 ? 's' : ''}` : ''}
                            </div>
                          </div>
                          <div className="font-semibold">{formatFCFA(line)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t pt-3 space-y-1 text-sm">
                {totals.bundles > 0 && (<div className="flex justify-between text-slate-600"><span>Bundles</span><span>{formatFCFA(totals.bundles)}</span></div>)}
                {totals.items > 0 && (<div className="flex justify-between text-slate-600"><span>Services</span><span>{formatFCFA(totals.items)}</span></div>)}
                <div className="flex justify-between items-baseline pt-2 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-teal-700" data-testid="checkout-total">{formatFCFA(totals.total)}</span>
                </div>
              </div>

              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-base h-12"
                data-testid="confirm-checkout-btn"
              >
                {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Placing order…</>) : `Confirm & pay ${formatFCFA(totals.total)}`}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                You&apos;ll receive a confirmation by phone/email. Payment is collected by the operator on the event date.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

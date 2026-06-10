import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { UserCheck, UserPlus, Banknote, CreditCard, Loader2, Search } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'pos', label: 'POS / Card (in-person)', icon: CreditCard },
  { value: 'mtn_momo', label: 'MTN Mobile Money', icon: CreditCard },
  { value: 'orange_money', label: 'Orange Money', icon: CreditCard },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: CreditCard },
  { value: 'other', label: 'Other', icon: CreditCard },
];

/**
 * Reusable walk-in (on-site) booking modal for all service types.
 *
 * Props:
 *  - open, onClose
 *  - serviceType: 'travel'|'hotel'|'car_rental'|'restaurant'|'event'|'package'|'cinema'|'laundry'|'banquet'
 *  - services: [{ id, name, price?, from_city?, to_city?, total_seats? }] — list of this operator's services
 *  - onSuccess: callback(order) on successful creation
 *  - extraFieldsRenderer?: (details, setDetails) => ReactNode — optional extra booking_details inputs
 */
export default function WalkInBookingModal({
  open,
  onClose,
  serviceType,
  services = [],
  onSuccess,
  extraFieldsRenderer,
}) {
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [linkedCustomer, setLinkedCustomer] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [bookingDetails, setBookingDetails] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId || s._id === serviceId),
    [services, serviceId]
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCustomer({ name: '', phone: '', email: '' });
      setLinkedCustomer(null);
      setServiceId('');
      setAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setServiceDate('');
      setServiceTime('');
      setPassengers(1);
      setBookingDetails({});
    }
  }, [open]);

  // Auto-fill price and scheduled time when a service is picked
  useEffect(() => {
    if (!selectedService) return;
    const p = selectedService.price || selectedService.base_price || selectedService.amount;
    if (p && !amount) setAmount(String(p));
    // Schedule: HH:MM
    const t = selectedService.departure_time || selectedService.time || selectedService.scheduled_time;
    if (t && !serviceTime) setServiceTime(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  // Debounced customer lookup
  useEffect(() => {
    const { phone, email } = customer;
    if (!phone && !email) {
      setLinkedCustomer(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setLookupLoading(true);
        const res = await api.get('/operator/manual-bookings/lookup-customer', {
          params: { phone: phone || undefined, email: email || undefined },
        });
        if (res.data?.found) {
          setLinkedCustomer(res.data.customer);
          // Auto-fill name if empty
          setCustomer((c) => ({ ...c, name: c.name || res.data.customer.full_name || '' }));
        } else {
          setLinkedCustomer(null);
        }
      } catch {
        setLinkedCustomer(null);
      } finally {
        setLookupLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [customer.phone, customer.email]);

  const canSubmit =
    !!customer.name.trim() &&
    !!serviceId &&
    Number(amount) > 0 &&
    !!paymentMethod &&
    (serviceType !== 'travel' || !!serviceDate);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      toast.error('Please complete all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        service_type: serviceType,
        service_id: serviceId,
        service_name: selectedService?.name || selectedService?.service_name,
        total_amount: Number(amount),
        currency: 'XAF',
        payment_method: paymentMethod,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim() || null,
          email: customer.email.trim() || null,
        },
        booking_details: { ...bookingDetails, passengers: Number(passengers) || 1 },
        notes: notes.trim() || null,
        service_date: serviceDate || null,
        service_time: serviceTime || null,
      };
      const res = await api.post('/operator/manual-bookings/', payload);
      toast.success(
        res.data?.customer_linked
          ? `Booking saved & linked to ${res.data.linked_user?.full_name || 'customer'}`
          : 'Walk-in booking recorded'
      );
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      // Pydantic 422s return `detail` as an array of error objects; coerce to string.
      const raw = err?.response?.data?.detail;
      const msg = Array.isArray(raw)
        ? raw.map((e) => e?.msg || String(e)).join('; ')
        : (typeof raw === 'string' ? raw : 'Failed to record booking');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, serviceType, serviceId, selectedService, amount, paymentMethod, customer, bookingDetails, notes, serviceDate, serviceTime, passengers, onSuccess, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="walk-in-booking-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[#082c59]" />
            Record Walk-in / Cash Booking
          </DialogTitle>
          <p className="text-sm text-slate-500">
            Log a booking paid at the counter so it reconciles with online bookings.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Customer block */}
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Customer</Label>
              {lookupLoading ? (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking up…
                </span>
              ) : linkedCustomer ? (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 gap-1" data-testid="customer-linked-badge">
                  <UserCheck className="h-3 w-3" /> Linked to {linkedCustomer.full_name || linkedCustomer.email}
                </Badge>
              ) : (customer.phone || customer.email) ? (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 gap-1" data-testid="customer-guest-badge">
                  <UserPlus className="h-3 w-3" /> Guest
                </Badge>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs text-slate-500">Full Name *</Label>
                <Input
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Jean Mbarga"
                  data-testid="walkin-customer-name"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Phone</Label>
                <Input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="+237 6 99 00 00 00"
                  data-testid="walkin-customer-phone"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Email</Label>
                <Input
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="jean@example.com"
                  type="email"
                  data-testid="walkin-customer-email"
                />
              </div>
            </div>
          </div>

          {/* Service picker */}
          <div>
            <Label className="text-sm font-semibold">Service *</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger data-testid="walkin-service-select">
                <SelectValue placeholder={`Pick a ${serviceType.replace('_', ' ')}…`} />
              </SelectTrigger>
              <SelectContent>
                {services.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No services available.</div>
                )}
                {services.map((s) => {
                  const id = s.id || s._id;
                  const label =
                    s.name ||
                    s.service_name ||
                    [s.from_city, s.to_city].filter(Boolean).join(' → ') ||
                    id;
                  return (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Service date & time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">
                Service Date {serviceType === 'travel' ? '*' : ''}
              </Label>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                data-testid="walkin-service-date"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">
                Service Time
                {serviceType === 'travel' && selectedService?.departure_time && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    (auto-filled from route)
                  </span>
                )}
              </Label>
              <Input
                type="time"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                data-testid="walkin-service-time"
              />
            </div>
          </div>

          {/* Service-specific fields — curated per service type */}
          {serviceType === 'travel' && (
            <div className="space-y-3 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Travel details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Passengers *</Label>
                  <Input
                    type="number" min="1" max="100"
                    value={passengers}
                    onChange={(e) => setPassengers(e.target.value)}
                    data-testid="walkin-passengers"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Seat Numbers <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                  <Input
                    placeholder="e.g., 12, 13"
                    value={(bookingDetails.seat_numbers || []).join(', ')}
                    onChange={(e) => {
                      const seats = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      setBookingDetails({ ...bookingDetails, seat_numbers: seats });
                    }}
                    data-testid="walkin-seat-numbers"
                  />
                </div>
              </div>
              {selectedService?.total_seats && (
                <p className="text-xs text-slate-500">Vehicle capacity: {selectedService.total_seats} seats.</p>
              )}
            </div>
          )}

          {serviceType === 'cinema' && (
            <div className="space-y-3 p-3 bg-violet-50/60 border border-violet-200 rounded-lg">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Cinema details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Showtime *</Label>
                  <Input
                    placeholder="e.g., 19:30 — Hall 2"
                    value={bookingDetails.showtime_label || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, showtime_label: e.target.value })}
                    data-testid="walkin-cinema-showtime"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Tickets *</Label>
                  <Input
                    type="number" min="1" max="50"
                    value={bookingDetails.tickets_count || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, tickets_count: Number(e.target.value) || 1 })}
                    data-testid="walkin-cinema-tickets"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Seat Numbers <span className="text-xs font-normal text-slate-500">(comma-separated)</span></Label>
                <Input
                  placeholder="e.g., A12, A13, A14"
                  value={(bookingDetails.seat_numbers || []).join(', ')}
                  onChange={(e) => {
                    const seats = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    setBookingDetails({ ...bookingDetails, seat_numbers: seats });
                  }}
                  data-testid="walkin-cinema-seats"
                />
              </div>
            </div>
          )}

          {serviceType === 'hotel' && (
            <div className="space-y-3 p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Hotel stay</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Check-in *</Label>
                  <Input
                    type="date"
                    value={bookingDetails.check_in_date || serviceDate}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, check_in_date: e.target.value })}
                    data-testid="walkin-hotel-checkin"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Check-out *</Label>
                  <Input
                    type="date"
                    value={bookingDetails.check_out_date || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, check_out_date: e.target.value })}
                    data-testid="walkin-hotel-checkout"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Guests *</Label>
                  <Input
                    type="number" min="1" max="20"
                    value={bookingDetails.guests || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, guests: Number(e.target.value) || 1 })}
                    data-testid="walkin-hotel-guests"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Room Type / Number <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                <Input
                  placeholder="e.g., Deluxe Suite #204"
                  value={bookingDetails.room_label || ''}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, room_label: e.target.value })}
                  data-testid="walkin-hotel-room"
                />
              </div>
            </div>
          )}

          {serviceType === 'restaurant' && (
            <div className="space-y-3 p-3 bg-orange-50/60 border border-orange-200 rounded-lg">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Restaurant order</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Party Size *</Label>
                  <Input
                    type="number" min="1" max="50"
                    value={bookingDetails.party_size || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, party_size: Number(e.target.value) || 1 })}
                    data-testid="walkin-rest-party"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Table <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                  <Input
                    placeholder="e.g., Table 7"
                    value={bookingDetails.table_label || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, table_label: e.target.value })}
                    data-testid="walkin-rest-table"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Service</Label>
                  <Select
                    value={bookingDetails.dining_service || 'dine_in'}
                    onValueChange={(v) => setBookingDetails({ ...bookingDetails, dining_service: v })}
                  >
                    <SelectTrigger data-testid="walkin-rest-service"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine_in">Dine-in</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Order Summary <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                <Textarea
                  placeholder="e.g., 2× Ndolé, 1× Grilled fish, 3× Drinks"
                  rows={2}
                  value={bookingDetails.order_summary || ''}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, order_summary: e.target.value })}
                  data-testid="walkin-rest-summary"
                />
              </div>
            </div>
          )}

          {serviceType === 'laundry' && (
            <div className="space-y-3 p-3 bg-sky-50/60 border border-sky-200 rounded-lg">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Laundry / pressing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Items / Pieces *</Label>
                  <Input
                    type="number" min="1"
                    value={bookingDetails.items_count || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, items_count: Number(e.target.value) || 1 })}
                    data-testid="walkin-laundry-items"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Service Type *</Label>
                  <Select
                    value={bookingDetails.laundry_service || 'wash_and_fold'}
                    onValueChange={(v) => setBookingDetails({ ...bookingDetails, laundry_service: v })}
                  >
                    <SelectTrigger data-testid="walkin-laundry-service"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wash_and_fold">Wash & Fold</SelectItem>
                      <SelectItem value="dry_clean">Dry Clean</SelectItem>
                      <SelectItem value="ironing">Ironing Only</SelectItem>
                      <SelectItem value="express">Express (24h)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    id="walkin-laundry-pickup"
                    checked={!!bookingDetails.pickup_required}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, pickup_required: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="walkin-laundry-pickup"
                  />
                  <Label htmlFor="walkin-laundry-pickup" className="text-sm">Pickup required</Label>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Ready by <span className="text-xs font-normal text-slate-500">(date)</span></Label>
                  <Input
                    type="date"
                    value={bookingDetails.ready_date || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, ready_date: e.target.value })}
                    data-testid="walkin-laundry-ready"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Items Description <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                <Textarea
                  placeholder="e.g., 3× shirts, 2× trousers, 1× blanket"
                  rows={2}
                  value={bookingDetails.items_description || ''}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, items_description: e.target.value })}
                  data-testid="walkin-laundry-description"
                />
              </div>
            </div>
          )}

          {serviceType === 'banquet' && (
            <div className="space-y-3 p-3 bg-pink-50/60 border border-pink-200 rounded-lg">
              <p className="text-xs font-semibold text-pink-700 uppercase tracking-wider">Banquet event</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Event Date *</Label>
                  <Input
                    type="date"
                    value={bookingDetails.event_date || serviceDate}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, event_date: e.target.value })}
                    data-testid="walkin-banquet-date"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Guests *</Label>
                  <Input
                    type="number" min="1" max="2000"
                    value={bookingDetails.guest_count || 50}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, guest_count: Number(e.target.value) || 50 })}
                    data-testid="walkin-banquet-guests"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Event Type</Label>
                  <Select
                    value={bookingDetails.event_type || 'wedding'}
                    onValueChange={(v) => setBookingDetails({ ...bookingDetails, event_type: v })}
                  >
                    <SelectTrigger data-testid="walkin-banquet-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="anniversary">Anniversary</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Catering</Label>
                  <Select
                    value={bookingDetails.catering || 'included'}
                    onValueChange={(v) => setBookingDetails({ ...bookingDetails, catering: v })}
                  >
                    <SelectTrigger data-testid="walkin-banquet-catering"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="external">External / BYO</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {serviceType === 'car_rental' && (
            <div className="space-y-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Car rental</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Pickup Date *</Label>
                  <Input
                    type="date"
                    value={bookingDetails.pickup_date || serviceDate}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, pickup_date: e.target.value })}
                    data-testid="walkin-car-pickup-date"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Return Date *</Label>
                  <Input
                    type="date"
                    value={bookingDetails.return_date || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, return_date: e.target.value })}
                    data-testid="walkin-car-return-date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    id="walkin-car-driver"
                    checked={!!bookingDetails.with_driver}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, with_driver: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="walkin-car-with-driver"
                  />
                  <Label htmlFor="walkin-car-driver" className="text-sm">With driver</Label>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Driver License # <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                  <Input
                    placeholder="License number"
                    value={bookingDetails.license_number || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, license_number: e.target.value })}
                    data-testid="walkin-car-license"
                  />
                </div>
              </div>
            </div>
          )}

          {serviceType === 'package' && (
            <div className="space-y-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Package / courier</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">From (Origin) *</Label>
                  <Input
                    placeholder="Pickup city / address"
                    value={bookingDetails.origin || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, origin: e.target.value })}
                    data-testid="walkin-pkg-origin"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">To (Destination) *</Label>
                  <Input
                    placeholder="Delivery city / address"
                    value={bookingDetails.destination || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, destination: e.target.value })}
                    data-testid="walkin-pkg-dest"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Weight (kg) *</Label>
                  <Input
                    type="number" step="0.1" min="0.1"
                    value={bookingDetails.weight_kg || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, weight_kg: e.target.value })}
                    data-testid="walkin-pkg-weight"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Receiver Name *</Label>
                  <Input
                    placeholder="Recipient full name"
                    value={bookingDetails.receiver_name || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, receiver_name: e.target.value })}
                    data-testid="walkin-pkg-receiver"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Receiver Phone *</Label>
                  <Input
                    placeholder="+237…"
                    value={bookingDetails.receiver_phone || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, receiver_phone: e.target.value })}
                    data-testid="walkin-pkg-receiver-phone"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Package Description <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                <Input
                  placeholder="e.g., Documents, electronics, fragile"
                  value={bookingDetails.package_description || ''}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, package_description: e.target.value })}
                  data-testid="walkin-pkg-description"
                />
              </div>
            </div>
          )}

          {serviceType === 'event' && (
            <div className="space-y-3 p-3 bg-fuchsia-50/60 border border-fuchsia-200 rounded-lg">
              <p className="text-xs font-semibold text-fuchsia-700 uppercase tracking-wider">Event tickets</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Ticket Type *</Label>
                  <Select
                    value={bookingDetails.ticket_type || 'standard'}
                    onValueChange={(v) => setBookingDetails({ ...bookingDetails, ticket_type: v })}
                  >
                    <SelectTrigger data-testid="walkin-event-ticket-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="vvip">VVIP</SelectItem>
                      <SelectItem value="early_bird">Early Bird</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Quantity *</Label>
                  <Input
                    type="number" min="1" max="100"
                    value={bookingDetails.tickets_quantity || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, tickets_quantity: Number(e.target.value) || 1 })}
                    data-testid="walkin-event-qty"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Section <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                  <Input
                    placeholder="e.g., Block C, Row 5"
                    value={bookingDetails.section || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, section: e.target.value })}
                    data-testid="walkin-event-section"
                  />
                </div>
              </div>
            </div>
          )}

          {extraFieldsRenderer?.(bookingDetails, setBookingDetails)}

          {/* Amount + Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Total Amount (XAF) *</Label>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                data-testid="walkin-amount"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="walkin-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold">Notes <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra info (ID number, group size, etc.)"
              rows={2}
              data-testid="walkin-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-[#082c59] hover:bg-[#0a366d]"
            data-testid="walkin-submit-btn"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              'Record Booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      setBookingDetails({});
    }
  }, [open]);

  // Auto-fill price when a service is picked
  useEffect(() => {
    if (selectedService && !amount) {
      const p = selectedService.price || selectedService.base_price || selectedService.amount;
      if (p) setAmount(String(p));
    }
  }, [selectedService, amount]);

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
    (serviceType !== 'travel' || (!!serviceDate && (bookingDetails.seat_numbers?.length > 0)));

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
        booking_details: bookingDetails,
        notes: notes.trim() || null,
        service_date: serviceDate || null,
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
      toast.error(err?.response?.data?.detail || 'Failed to record booking');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, serviceType, serviceId, selectedService, amount, paymentMethod, customer, bookingDetails, notes, serviceDate, onSuccess, onClose]);

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

          {/* Service date */}
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

          {/* Service-specific fields */}
          {serviceType === 'travel' && (
            <div>
              <Label className="text-sm font-semibold">Seats * <span className="text-xs font-normal text-slate-500">(comma-separated numbers)</span></Label>
              <Input
                placeholder="e.g., 12, 13"
                value={(bookingDetails.seat_numbers || []).join(', ')}
                onChange={(e) => {
                  const seats = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setBookingDetails({ ...bookingDetails, seat_numbers: seats });
                }}
                data-testid="walkin-seat-numbers"
              />
              {selectedService?.total_seats && (
                <p className="text-xs text-slate-400 mt-1">Vehicle capacity: {selectedService.total_seats} seats</p>
              )}
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

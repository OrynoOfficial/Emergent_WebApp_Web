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
import { UserCheck, UserPlus, Banknote, CreditCard, Loader2, Plus, Minus, BedDouble, Armchair, Calendar as CalendarIcon, Film, Sparkles, MapPin, Users as UsersIcon } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import CinemaSeatMap from '@/components/cinema/CinemaSeatMap';
import LiveSeatMap from '@/components/travel/LiveSeatMap';
import { formatFCFA } from '@/utils/currency';

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

  // ─── Rich-picker state ──────────────────────────────────────────────
  // Cinema: list of showtimes for the picked film + the chosen one + seat layout
  const [cinemaShowtimes, setCinemaShowtimes] = useState([]);
  const [cinemaShowtimesLoading, setCinemaShowtimesLoading] = useState(false);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');
  const [cinemaSeatPayload, setCinemaSeatPayload] = useState(null); // {seat_layout, booked_seats, showtime}
  const [cinemaSeatLoading, setCinemaSeatLoading] = useState(false);
  // Hotel: list of rooms for the picked hotel + the chosen room id
  const [hotelRooms, setHotelRooms] = useState([]);
  const [hotelRoomsLoading, setHotelRoomsLoading] = useState(false);
  // Laundry: item id → qty map (item_prices[].item is the key)
  const [laundryQty, setLaundryQty] = useState({});

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
      setCinemaShowtimes([]);
      setSelectedShowtimeId('');
      setCinemaSeatPayload(null);
      setHotelRooms([]);
      setLaundryQty({});
    }
  }, [open]);

  // When the operator picks a different service, drop any picker selections
  // that belong to the previous service to avoid mixing seat ids / room ids.
  useEffect(() => {
    setSelectedShowtimeId('');
    setCinemaSeatPayload(null);
    setHotelRooms([]);
    setLaundryQty({});
    setBookingDetails((bd) => ({
      ...bd,
      seat_numbers: undefined,
      seats: undefined,
      showtime_id: undefined,
      showtime_label: undefined,
      tickets_count: undefined,
      room_id: undefined,
      room_label: undefined,
      room_type: undefined,
      laundry_items: undefined,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

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

  // ─── Cinema: fetch showtimes when a film is picked ──────────────────
  useEffect(() => {
    if (serviceType !== 'cinema' || !serviceId) {
      setCinemaShowtimes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCinemaShowtimesLoading(true);
        const { data } = await api.get(`/cinema/films/${serviceId}/showtimes`);
        if (!cancelled) setCinemaShowtimes(data?.showtimes || []);
      } catch {
        if (!cancelled) setCinemaShowtimes([]);
      } finally {
        if (!cancelled) setCinemaShowtimesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceType, serviceId]);

  // ─── Cinema: fetch seat layout + booked seats once a showtime is picked ──
  useEffect(() => {
    if (serviceType !== 'cinema' || !selectedShowtimeId) {
      setCinemaSeatPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCinemaSeatLoading(true);
        const { data } = await api.get(`/cinema/showtimes/${selectedShowtimeId}/details`);
        if (cancelled) return;
        setCinemaSeatPayload(data);
        // Auto-fill date/time + amount based on the showtime when fresh
        const st = data?.showtime || {};
        setServiceDate((d) => d || st.show_date || '');
        setServiceTime((t) => t || st.show_time || '');
        setBookingDetails((bd) => ({
          ...bd,
          showtime_id: st.id || selectedShowtimeId,
          showtime_label: [st.show_date, st.show_time, st.screen_name].filter(Boolean).join(' · '),
          seats: bd.seats || [],
          tickets_count: bd.tickets_count || 1,
        }));
      } catch {
        if (!cancelled) setCinemaSeatPayload(null);
      } finally {
        if (!cancelled) setCinemaSeatLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceType, selectedShowtimeId]);

  // ─── Cinema: recompute amount = tickets × showtime price ────────────
  useEffect(() => {
    if (serviceType !== 'cinema') return;
    const st = cinemaSeatPayload?.showtime;
    const tickets = Number(bookingDetails.tickets_count || (bookingDetails.seats?.length) || 0);
    if (st?.price && tickets > 0) {
      setAmount(String(Math.round(tickets * Number(st.price))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, cinemaSeatPayload, bookingDetails.tickets_count, bookingDetails.seats]);

  // ─── Hotel: fetch rooms when hotel + check-in + check-out are set ───
  useEffect(() => {
    if (serviceType !== 'hotel' || !serviceId) {
      setHotelRooms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setHotelRoomsLoading(true);
        const params = { hotel_id: serviceId, limit: 100 };
        if (bookingDetails.check_in_date) params.check_in = bookingDetails.check_in_date;
        if (bookingDetails.check_out_date) params.check_out = bookingDetails.check_out_date;
        const { data } = await api.get('/rooms/', { params });
        if (!cancelled) setHotelRooms(data?.rooms || []);
      } catch {
        if (!cancelled) setHotelRooms([]);
      } finally {
        if (!cancelled) setHotelRoomsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceType, serviceId, bookingDetails.check_in_date, bookingDetails.check_out_date]);

  // ─── Hotel: recompute amount = nights × picked room price ────────────
  useEffect(() => {
    if (serviceType !== 'hotel') return;
    const room = hotelRooms.find((r) => r.id === bookingDetails.room_id);
    const ci = bookingDetails.check_in_date;
    const co = bookingDetails.check_out_date;
    if (!room || !ci || !co) return;
    const nights = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const unit = Number(room.base_price || room.price_per_night || 0);
    if (unit > 0) setAmount(String(nights * unit));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, bookingDetails.room_id, bookingDetails.check_in_date, bookingDetails.check_out_date, hotelRooms]);

  // ─── Laundry: recompute amount from item × qty whenever it changes ──
  useEffect(() => {
    if (serviceType !== 'laundry') return;
    const items = selectedService?.item_prices || [];
    if (!items.length) return;
    const total = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(laundryQty[it.item]) || 0), 0);
    if (total > 0) setAmount(String(Math.round(total)));
    const itemsList = items
      .filter((it) => (laundryQty[it.item] || 0) > 0)
      .map((it) => ({ item: it.item, qty: laundryQty[it.item], unit_price: it.price }));
    setBookingDetails((bd) => ({
      ...bd,
      laundry_items: itemsList,
      items_count: itemsList.reduce((s, i) => s + (i.qty || 0), 0) || bd.items_count,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, laundryQty, selectedService]);

  const canSubmit =
    !!customer.name.trim() &&
    !!serviceId &&
    Number(amount) > 0 &&
    !!paymentMethod &&
    (serviceType !== 'travel' || !!serviceDate) &&
    (serviceType !== 'cinema' || !!selectedShowtimeId) &&
    (serviceType !== 'hotel' || !!bookingDetails.check_in_date) &&
    (serviceType !== 'hotel' || !!bookingDetails.check_out_date);

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
      <DialogContent
        className={`${['cinema', 'travel', 'hotel', 'laundry'].includes(serviceType) ? 'max-w-4xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto`}
        data-testid="walk-in-booking-modal"
      >
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                  <Armchair className="h-3 w-3" /> Travel — pick seats
                </p>
                {selectedService?.total_seats && (
                  <span className="text-[11px] text-slate-500">
                    Vehicle capacity: <strong>{selectedService.total_seats}</strong> seats
                  </span>
                )}
              </div>
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
                  <Label className="text-sm font-semibold">Selected seats</Label>
                  <div className="px-3 py-2 rounded border bg-white text-sm min-h-[38px] flex items-center" data-testid="walkin-selected-seats">
                    {(bookingDetails.seat_numbers || []).length > 0 ? (
                      <span className="font-mono text-slate-700">{(bookingDetails.seat_numbers || []).join(', ')}</span>
                    ) : (
                      <span className="text-slate-400">Tap seats on the map below…</span>
                    )}
                  </div>
                </div>
              </div>
              {serviceId && serviceDate ? (
                <LiveSeatMap
                  routeId={serviceId}
                  departureDate={serviceDate}
                  maxSeats={Number(passengers) || 1}
                  selectedSeats={(bookingDetails.seat_numbers || []).map(String)}
                  onSeatsChange={(seats) =>
                    setBookingDetails((bd) => ({ ...bd, seat_numbers: seats.map(String) }))
                  }
                  autoRefresh={false}
                />
              ) : (
                <p className="text-xs text-slate-500 italic">Pick a route + service date above to load the live seat map.</p>
              )}
            </div>
          )}

          {serviceType === 'cinema' && (
            <div className="space-y-3 p-3 bg-violet-50/60 border border-violet-200 rounded-lg">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider flex items-center gap-1">
                <Film className="h-3 w-3" /> Cinema — pick showtime & seats
              </p>

              {/* Showtime picker */}
              <div>
                <Label className="text-sm font-semibold">Showtime *</Label>
                {!serviceId ? (
                  <p className="text-xs text-slate-500 italic">Pick a film above first.</p>
                ) : cinemaShowtimesLoading ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading showtimes…
                  </div>
                ) : cinemaShowtimes.length === 0 ? (
                  <p className="text-xs text-amber-600">No active showtimes for this film.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {cinemaShowtimes.map((st) => {
                      const active = selectedShowtimeId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedShowtimeId(st.id)}
                          className={`text-left p-2 rounded-md border text-xs transition ${active ? 'border-violet-500 bg-violet-100 ring-2 ring-violet-300' : 'border-slate-200 bg-white hover:border-violet-300'}`}
                          data-testid={`walkin-cinema-showtime-${st.id}`}
                        >
                          <p className="font-semibold text-slate-700">{st.show_date} · {st.show_time}</p>
                          <p className="text-slate-500 truncate">{st.screen_name || st.cinema_name}</p>
                          <p className="text-violet-600 font-medium">{formatFCFA(st.price || 0)}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Tickets *</Label>
                  <Input
                    type="number" min="1" max="50"
                    value={bookingDetails.tickets_count || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, tickets_count: Number(e.target.value) || 1 })}
                    data-testid="walkin-cinema-tickets"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Selected seats</Label>
                  <div className="px-3 py-2 rounded border bg-white text-sm min-h-[38px] flex items-center" data-testid="walkin-cinema-selected-seats">
                    {(bookingDetails.seats || []).length > 0 ? (
                      <span className="font-mono text-slate-700">{(bookingDetails.seats || []).join(', ')}</span>
                    ) : (
                      <span className="text-slate-400">Tap seats below…</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seat map */}
              {selectedShowtimeId && (
                cinemaSeatLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading seat layout…
                  </div>
                ) : cinemaSeatPayload?.seat_layout ? (
                  <div className="bg-white rounded border p-3">
                    <CinemaSeatMap
                      layout={cinemaSeatPayload.seat_layout}
                      bookedSeats={cinemaSeatPayload.booked_seats || []}
                      selectedSeats={bookingDetails.seats || []}
                      maxSeats={Number(bookingDetails.tickets_count) || 1}
                      onChange={(seats) =>
                        setBookingDetails((bd) => ({ ...bd, seats, seat_numbers: seats }))
                      }
                    />
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">No seat layout configured for this showtime.</p>
                )
              )}
            </div>
          )}

          {serviceType === 'hotel' && (
            <div className="space-y-3 p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <BedDouble className="h-3 w-3" /> Hotel stay
              </p>
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

              {/* Room picker */}
              <div>
                <Label className="text-sm font-semibold">Choose room *</Label>
                {!serviceId ? (
                  <p className="text-xs text-slate-500 italic">Pick a hotel above.</p>
                ) : hotelRoomsLoading ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading rooms…
                  </div>
                ) : hotelRooms.length === 0 ? (
                  <p className="text-xs text-amber-600">No rooms configured for this hotel{bookingDetails.check_in_date && bookingDetails.check_out_date ? ' for these dates' : ''}.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {hotelRooms.map((r) => {
                      const active = bookingDetails.room_id === r.id;
                      const price = r.base_price || r.price_per_night || 0;
                      const avail = Number(r.available_rooms || 0);
                      const disabled = avail <= 0;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            setBookingDetails((bd) => ({
                              ...bd,
                              room_id: r.id,
                              room_label: r.room_name || r.room_type,
                              room_type: r.room_type,
                            }))
                          }
                          className={`text-left p-3 rounded-md border text-sm transition ${active ? 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300' : 'border-slate-200 bg-white hover:border-indigo-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          data-testid={`walkin-hotel-room-${r.id}`}
                        >
                          <p className="font-semibold text-slate-800">{r.room_name || r.room_type}</p>
                          <p className="text-xs text-slate-500 capitalize">{r.room_type}{r.max_guests ? ` · sleeps ${r.max_guests}` : ''}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-indigo-600 font-semibold">{formatFCFA(price)} <span className="text-[10px] text-slate-400">/ night</span></span>
                            <Badge variant="outline" className={`text-[10px] ${avail > 0 ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-600'}`}>
                              {avail > 0 ? `${avail} avail.` : 'Sold out'}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Laundry / pressing
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <Label className="text-sm font-semibold">Ready by</Label>
                  <Input
                    type="date"
                    value={bookingDetails.ready_date || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, ready_date: e.target.value })}
                    data-testid="walkin-laundry-ready"
                  />
                </div>
              </div>

              {/* Item grid with qty steppers (uses shop's configured item_prices) */}
              {(selectedService?.item_prices?.length || 0) > 0 ? (
                <div>
                  <Label className="text-sm font-semibold">Items & quantities</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-56 overflow-y-auto pr-1">
                    {selectedService.item_prices.map((it) => {
                      const qty = Number(laundryQty[it.item]) || 0;
                      return (
                        <div key={it.item} className={`flex items-center justify-between p-2 rounded border ${qty > 0 ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`} data-testid={`walkin-laundry-item-${it.item}`}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{it.item}</p>
                            <p className="text-xs text-slate-500">{formatFCFA(it.price || 0)} <span className="text-[10px]">/ piece</span></p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button" variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setLaundryQty((q) => ({ ...q, [it.item]: Math.max(0, (q[it.item] || 0) - 1) }))}
                              data-testid={`walkin-laundry-minus-${it.item}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-semibold" data-testid={`walkin-laundry-qty-${it.item}`}>{qty}</span>
                            <Button
                              type="button" variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setLaundryQty((q) => ({ ...q, [it.item]: (q[it.item] || 0) + 1 }))}
                              data-testid={`walkin-laundry-plus-${it.item}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-semibold">Items / Pieces *</Label>
                  <Input
                    type="number" min="1"
                    value={bookingDetails.items_count || 1}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, items_count: Number(e.target.value) || 1 })}
                    data-testid="walkin-laundry-items"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">This shop hasn&apos;t configured per-item pricing — record items as a single bundle.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 mt-1">
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
                  <Label className="text-sm font-semibold">Notes <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                  <Input
                    placeholder="e.g., fragile, stain on collar"
                    value={bookingDetails.items_description || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, items_description: e.target.value })}
                    data-testid="walkin-laundry-description"
                  />
                </div>
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

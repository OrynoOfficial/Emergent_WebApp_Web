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
  // Restaurant: list of menu items + qty map (item.id -> qty)
  const [restMenuItems, setRestMenuItems] = useState([]);
  const [restMenuLoading, setRestMenuLoading] = useState(false);
  const [restItemQty, setRestItemQty] = useState({});
  // Package: pricing tier picker
  const [selectedTierIndex, setSelectedTierIndex] = useState(null);

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
      setRestMenuItems([]);
      setRestItemQty({});
      setSelectedTierIndex(null);
    }
  }, [open]);

  // When the operator picks a different service, drop any picker selections
  // that belong to the previous service to avoid mixing seat ids / room ids.
  useEffect(() => {
    setSelectedShowtimeId('');
    setCinemaSeatPayload(null);
    setHotelRooms([]);
    setLaundryQty({});
    setRestMenuItems([]);
    setRestItemQty({});
    setSelectedTierIndex(null);
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
      restaurant_items: undefined,
      delivery_mode: undefined,
      delivery_address: undefined,
      delivery_city: undefined,
      origin: undefined,
      destination: undefined,
      weight_kg: undefined,
      weight_tier_label: undefined,
      receiver_address: undefined,
      receiver_city: undefined,
      receiver_postal_code: undefined,
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

  // ─── Cinema: fetch showtimes when a cinema is picked ─────────────────
  useEffect(() => {
    if (serviceType !== 'cinema' || !serviceId) {
      setCinemaShowtimes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCinemaShowtimesLoading(true);
        const { data } = await api.get(`/cinema/${serviceId}/showtimes`);
        if (!cancelled) {
          // Filter to upcoming only
          const today = new Date().toISOString().split('T')[0];
          const upcoming = (data?.showtimes || []).filter((s) => !s.show_date || s.show_date >= today);
          setCinemaShowtimes(upcoming);
        }
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

  // ─── Restaurant: fetch menu items when a restaurant is picked ────────
  useEffect(() => {
    if (serviceType !== 'restaurant' || !serviceId) {
      setRestMenuItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setRestMenuLoading(true);
        const { data } = await api.get(`/restaurants/${serviceId}/menu`);
        if (!cancelled) setRestMenuItems(data?.items || []);
      } catch {
        if (!cancelled) setRestMenuItems([]);
      } finally {
        if (!cancelled) setRestMenuLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceType, serviceId]);

  // ─── Restaurant: recompute amount = sum(item.price × qty) ────────────
  useEffect(() => {
    if (serviceType !== 'restaurant') return;
    if (!restMenuItems.length) return;
    const total = restMenuItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(restItemQty[it.id]) || 0),
      0
    );
    if (total > 0) setAmount(String(Math.round(total)));
    const itemsList = restMenuItems
      .filter((it) => (restItemQty[it.id] || 0) > 0)
      .map((it) => ({ id: it.id, name: it.name, qty: restItemQty[it.id], unit_price: it.price }));
    setBookingDetails((bd) => ({
      ...bd,
      restaurant_items: itemsList,
      order_summary: itemsList.length
        ? itemsList.map((i) => `${i.qty}× ${i.name}`).join(', ')
        : bd.order_summary,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, restItemQty, restMenuItems]);

  // ─── Package: when tier picked, auto-fill amount + weight ────────────
  useEffect(() => {
    if (serviceType !== 'package') return;
    if (selectedTierIndex === null) return;
    const tier = (selectedService?.tiers || [])[selectedTierIndex];
    if (!tier) return;
    setAmount(String(Math.round(Number(tier.price) || 0)));
    setBookingDetails((bd) => ({
      ...bd,
      weight_kg: tier.weight_max_kg || tier.weight_min_kg || bd.weight_kg,
      weight_tier_label: tier.label || `${tier.weight_min_kg}–${tier.weight_max_kg} kg`,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, selectedTierIndex, selectedService]);

  // ─── Package: when a route is picked, prefill origin & destination ───
  useEffect(() => {
    if (serviceType !== 'package' || !selectedService) return;
    setBookingDetails((bd) => ({
      ...bd,
      origin: bd.origin || selectedService.origin_city || '',
      destination: bd.destination || selectedService.destination_city || '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, selectedService]);

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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Armchair className="h-3.5 w-3.5 text-slate-500" /> Travel — pick seats
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
                <div className="max-w-md mx-auto scale-90 origin-top">
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
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Pick a route + service date above to load the live seat map.</p>
              )}
            </div>
          )}

          {serviceType === 'cinema' && (
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-slate-500" /> Cinema — pick showtime & seats
              </p>

              {/* Showtime picker */}
              <div>
                <Label className="text-sm font-semibold">Showtime *</Label>
                {!serviceId ? (
                  <p className="text-xs text-slate-500 italic">Pick a cinema above first.</p>
                ) : cinemaShowtimesLoading ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading showtimes…
                  </div>
                ) : cinemaShowtimes.length === 0 ? (
                  <p className="text-xs text-amber-600">No upcoming showtimes for this cinema.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {cinemaShowtimes.map((st) => {
                      const active = selectedShowtimeId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedShowtimeId(st.id)}
                          className={`text-left p-2 rounded-md border text-xs transition ${active ? 'border-slate-700 bg-slate-100 ring-2 ring-slate-300' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                          data-testid={`walkin-cinema-showtime-${st.id}`}
                        >
                          <p className="font-semibold text-slate-800 truncate">{st.film_title || 'Film'}</p>
                          <p className="text-slate-500">{st.show_date} · {st.show_time}</p>
                          <p className="text-slate-500 truncate">{st.screen_name}</p>
                          <p className="text-slate-700 font-medium">{formatFCFA(st.price || 0)}</p>
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-slate-500" /> Hotel stay
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {hotelRooms.map((r) => {
                      const active = bookingDetails.room_id === r.id;
                      const price = r.base_price || r.price_per_night || 0;
                      const avail = Number(r.available_rooms || 0);
                      const disabled = avail <= 0;
                      const thumb = (r.images || [])[0];
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
                          className={`text-left rounded-md border overflow-hidden transition ${active ? 'border-slate-700 ring-2 ring-slate-300' : 'border-slate-200 bg-white hover:border-slate-400'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          data-testid={`walkin-hotel-room-${r.id}`}
                        >
                          <div className="flex gap-2">
                            <div className="w-20 h-20 bg-slate-100 flex-shrink-0 flex items-center justify-center">
                              {thumb ? (
                                <img src={thumb} alt={r.room_name || r.room_type} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <BedDouble className="h-7 w-7 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 p-2">
                              <p className="font-semibold text-slate-800 text-sm truncate">{r.room_name || r.room_type}</p>
                              <p className="text-xs text-slate-500 capitalize truncate">{r.room_type}{r.max_guests ? ` · sleeps ${r.max_guests}` : ''}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-slate-800 font-semibold text-sm">{formatFCFA(price)} <span className="text-[10px] text-slate-400">/ night</span></span>
                                <Badge variant="outline" className={`text-[10px] ${avail > 0 ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-600'}`}>
                                  {avail > 0 ? `${avail} avail.` : 'Sold out'}
                                </Badge>
                              </div>
                            </div>
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5 text-slate-500" /> Restaurant order
              </p>
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

              {/* Menu items picker with thumbnails */}
              <div>
                <Label className="text-sm font-semibold">Menu items</Label>
                {!serviceId ? (
                  <p className="text-xs text-slate-500 italic">Pick a restaurant above first.</p>
                ) : restMenuLoading ? (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading menu…
                  </div>
                ) : restMenuItems.length === 0 ? (
                  <p className="text-xs text-amber-600">No menu items configured for this restaurant — use the order summary below instead.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-72 overflow-y-auto pr-1">
                    {restMenuItems.map((it) => {
                      const qty = Number(restItemQty[it.id]) || 0;
                      return (
                        <div key={it.id} className={`flex items-center justify-between gap-2 rounded border overflow-hidden ${qty > 0 ? 'border-slate-700 bg-slate-50' : 'border-slate-200 bg-white'}`} data-testid={`walkin-rest-item-${it.id}`}>
                          <div className="w-16 h-16 bg-slate-100 flex-shrink-0 flex items-center justify-center">
                            {it.image ? (
                              <img src={it.image} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <UsersIcon className="h-6 w-6 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 py-1.5">
                            <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                            <p className="text-xs text-slate-500">{formatFCFA(it.price || 0)}</p>
                          </div>
                          <div className="flex items-center gap-1 pr-2">
                            <Button
                              type="button" variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setRestItemQty((q) => ({ ...q, [it.id]: Math.max(0, (q[it.id] || 0) - 1) }))}
                              data-testid={`walkin-rest-minus-${it.id}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold" data-testid={`walkin-rest-qty-${it.id}`}>{qty}</span>
                            <Button
                              type="button" variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setRestItemQty((q) => ({ ...q, [it.id]: (q[it.id] || 0) + 1 }))}
                              data-testid={`walkin-rest-plus-${it.id}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-slate-500" /> Laundry / pressing
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

              {/* Item grid with qty steppers + thumbnails */}
              {(selectedService?.item_prices?.length || 0) > 0 ? (
                <div>
                  <Label className="text-sm font-semibold">Items & quantities</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-72 overflow-y-auto pr-1">
                    {selectedService.item_prices.map((it) => {
                      const qty = Number(laundryQty[it.item]) || 0;
                      return (
                        <div key={it.item} className={`flex items-center justify-between gap-2 rounded border overflow-hidden ${qty > 0 ? 'border-slate-700 bg-slate-50' : 'border-slate-200 bg-white'}`} data-testid={`walkin-laundry-item-${it.item}`}>
                          <div className="w-14 h-14 bg-slate-100 flex-shrink-0 flex items-center justify-center">
                            {it.image_url ? (
                              <img src={it.image_url} alt={it.item} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Sparkles className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 py-1.5">
                            <p className="text-sm font-medium text-slate-800 truncate">{it.item}</p>
                            <p className="text-xs text-slate-500">{formatFCFA(it.price || 0)} <span className="text-[10px]">/ piece</span></p>
                          </div>
                          <div className="flex items-center gap-1 pr-2">
                            <Button
                              type="button" variant="outline" size="icon" className="h-7 w-7"
                              onClick={() => setLaundryQty((q) => ({ ...q, [it.item]: Math.max(0, (q[it.item] || 0) - 1) }))}
                              data-testid={`walkin-laundry-minus-${it.item}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold" data-testid={`walkin-laundry-qty-${it.item}`}>{qty}</span>
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

              {/* Pickup / Delivery toggle */}
              <div>
                <Label className="text-sm font-semibold">Pickup or Delivery *</Label>
                <div className="flex gap-2 mt-1">
                  {[
                    { v: 'pickup', label: 'Customer pickup' },
                    { v: 'delivery', label: 'Delivery to customer' },
                  ].map((opt) => {
                    const active = (bookingDetails.delivery_mode || 'pickup') === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setBookingDetails({ ...bookingDetails, delivery_mode: opt.v, pickup_required: opt.v === 'delivery' })}
                        className={`flex-1 px-3 py-2 rounded-md border text-sm transition ${active ? 'border-slate-700 bg-slate-100 ring-2 ring-slate-300 font-semibold' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                        data-testid={`walkin-laundry-mode-${opt.v}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery address fields */}
              {bookingDetails.delivery_mode === 'delivery' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-semibold">Delivery Address *</Label>
                    <Input
                      placeholder="Street, neighborhood, landmarks"
                      value={bookingDetails.delivery_address || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, delivery_address: e.target.value })}
                      data-testid="walkin-laundry-delivery-address"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">City *</Label>
                    <Input
                      placeholder="e.g., Douala"
                      value={bookingDetails.delivery_city || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, delivery_city: e.target.value })}
                      data-testid="walkin-laundry-delivery-city"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Contact Phone</Label>
                    <Input
                      placeholder="+237…"
                      value={bookingDetails.delivery_phone || customer.phone || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, delivery_phone: e.target.value })}
                      data-testid="walkin-laundry-delivery-phone"
                    />
                  </div>
                </div>
              )}

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
          )}

          {serviceType === 'banquet' && (
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" /> Banquet event
              </p>
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" /> Car rental
              </p>
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-500" /> Package / courier
              </p>

              {/* Route summary (prefilled) */}
              {selectedService && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-200 text-sm">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-800">{selectedService.origin_city || '—'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-slate-800">{selectedService.destination_city || '—'}</span>
                  {selectedService.delivery_time_hours && (
                    <span className="ml-auto text-xs text-slate-500">~{selectedService.delivery_time_hours}h</span>
                  )}
                </div>
              )}

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

              {/* Weight tier picker (tiered pricing) */}
              {selectedService?.pricing_model === 'tiered' && (selectedService?.tiers?.length || 0) > 0 ? (
                <div>
                  <Label className="text-sm font-semibold">Weight tier *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    {selectedService.tiers.map((tier, idx) => {
                      const active = selectedTierIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedTierIndex(idx)}
                          className={`text-left p-2 rounded-md border text-xs transition ${active ? 'border-slate-700 bg-slate-100 ring-2 ring-slate-300' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                          data-testid={`walkin-pkg-tier-${idx}`}
                        >
                          <p className="font-semibold text-slate-800">{tier.label || `Tier ${idx + 1}`}</p>
                          <p className="text-slate-500">{tier.weight_min_kg}–{tier.weight_max_kg} kg</p>
                          <p className="text-slate-700 font-medium mt-0.5">{formatFCFA(tier.price || 0)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-semibold">Weight (kg) *</Label>
                  <Input
                    type="number" step="0.1" min="0.1"
                    value={bookingDetails.weight_kg || ''}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, weight_kg: e.target.value })}
                    data-testid="walkin-pkg-weight"
                  />
                  {selectedService?.pricing_model === 'per_kg' && selectedService?.per_kg_rate && (
                    <p className="text-[11px] text-slate-500 mt-1">Rate: {formatFCFA(selectedService.per_kg_rate)} / kg{selectedService.base_price ? ` · base ${formatFCFA(selectedService.base_price)}` : ''}</p>
                  )}
                </div>
              )}

              {/* Recipient (full address) */}
              <div className="space-y-2 p-3 rounded-md bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Recipient</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-semibold">Street Address *</Label>
                    <Input
                      placeholder="Street, neighborhood, landmarks"
                      value={bookingDetails.receiver_address || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, receiver_address: e.target.value })}
                      data-testid="walkin-pkg-receiver-address"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">City *</Label>
                    <Input
                      placeholder="e.g., Yaoundé"
                      value={bookingDetails.receiver_city || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, receiver_city: e.target.value })}
                      data-testid="walkin-pkg-receiver-city"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Postal Code <span className="text-xs font-normal text-slate-500">(optional)</span></Label>
                    <Input
                      placeholder="e.g., 00237"
                      value={bookingDetails.receiver_postal_code || ''}
                      onChange={(e) => setBookingDetails({ ...bookingDetails, receiver_postal_code: e.target.value })}
                      data-testid="walkin-pkg-receiver-postal"
                    />
                  </div>
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
            <div className="border-l-2 border-slate-200 pl-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" /> Event tickets
              </p>
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

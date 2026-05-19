import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar, MapPin, Phone, Mail, User, CreditCard, Clock,
  Package, Film, Shirt, Hotel, Utensils, Car, Plane, PartyPopper,
  CheckCircle2, AlertCircle, XCircle, Truck, Home, Sparkles, FileText,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatFCFA } from '@/utils/currency';

// ── helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return null;
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return d;
    return format(dt, 'PPP');
  } catch {
    return d;
  }
};

const fmtDateTime = (d) => {
  if (!d) return null;
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return d;
    return format(dt, 'PPp');
  } catch {
    return d;
  }
};

const SERVICE_ICONS = {
  cinema: Film, hotel: Hotel, restaurant: Utensils, car_rental: Car,
  travel: Plane, package: Package, event: PartyPopper, banquet: PartyPopper,
  laundry: Shirt, pressing: Shirt,
};

const PAYMENT_BADGE = {
  paid:      { label: 'Paid',      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  completed: { label: 'Paid',      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  verified:  { label: 'Verified',  cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  pending:   { label: 'Awaiting payment', cls: 'bg-amber-100 text-amber-800 border-amber-300', Icon: AlertCircle },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
  refunded:  { label: 'Refunded',  cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: XCircle },
};

const STATUS_BADGE = {
  pending:    { label: 'Pending validation', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed:  { label: 'Confirmed',          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  completed:  { label: 'Completed',          cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  in_progress:{ label: 'In progress',        cls: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  cancelled:  { label: 'Cancelled',          cls: 'bg-red-50 text-red-800 border-red-200' },
};

// ── small UI primitives ────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, children, accent = 'text-slate-700' }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
    {Icon && <Icon className={`h-3.5 w-3.5 ${accent}`} />} {children}
  </h3>
);

const KV = ({ label, value, testId, valueClass = '' }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
    <p className={`text-sm text-slate-900 font-medium truncate ${valueClass}`} title={typeof value === 'string' ? value : undefined} data-testid={testId}>
      {value || '—'}
    </p>
  </div>
);

// ── Service-specific summaries ────────────────────────────────────────────
const CinemaSummary = ({ bd }) => {
  const si = bd.showtime_info || {};
  const items = [
    ['Film', si.film_title || bd.film_title],
    ['Cinema', si.cinema_name || bd.cinema],
    ['Screen', si.screen_name || bd.screen],
    ['Show date', fmtDate(si.show_date || bd.show_date)],
    ['Show time', `${si.show_time || bd.show_time || ''}${(si.end_time || bd.end_time) ? ` – ${si.end_time || bd.end_time}` : ''}`],
  ];
  const seats = bd.seats || bd.selected_seats || [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(([l, v]) => (l && v) ? <KV key={l} label={l} value={v} /> : null)}
      {seats.length > 0 && (
        <div className="col-span-full">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Seats ({seats.length})</p>
          <div className="flex flex-wrap gap-1">
            {seats.map((s) => (
              <Badge key={s} className="bg-purple-100 text-purple-800 border border-purple-200 font-mono text-xs">{s}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LaundrySummary = ({ bd }) => {
  const items = bd.items || [];
  const pickupMethod = bd.pickup_method || 'pickup';
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KV label="Shop" value={bd.shop_name || (bd.pressing_info?.name)} />
        <KV
          label="Mode"
          value={
            <span className="inline-flex items-center gap-1">
              {pickupMethod === 'pickup' ? <Truck className="h-3.5 w-3.5 text-purple-700" /> : <Home className="h-3.5 w-3.5 text-purple-700" />}
              {pickupMethod === 'pickup' ? 'Pickup from customer' : 'Customer drops off'}
            </span>
          }
        />
        <KV label="Pickup date" value={fmtDate(bd.pickup_date)} />
        <KV label="Time" value={bd.pickup_time} />
        {bd.delivery_date && <KV label="Delivery date" value={fmtDate(bd.delivery_date)} />}
        {bd.express && <KV label="Express" value={<Badge className="bg-orange-100 text-orange-800 border border-orange-200">Yes (+50%)</Badge>} />}
      </div>
      {items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Items ordered ({items.reduce((s, i) => s + (i.quantity || 0), 0)})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-700"><span className="font-semibold text-purple-700">{it.quantity || 1}×</span> {it.name}</span>
                <span className="text-slate-800 font-medium">{formatFCFA((it.unit_price || it.price || 0) * (it.quantity || 1))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const HotelSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Hotel" value={bd.hotel_name || bd.service_name} />
    <KV label="Room" value={bd.room_type || bd.room_name} />
    <KV label="Guests" value={bd.guests || bd.adults_count} />
    <KV label="Check-in" value={fmtDate(bd.check_in)} />
    <KV label="Check-out" value={fmtDate(bd.check_out)} />
    <KV label="Nights" value={bd.nights} />
  </div>
);

const RestaurantSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Restaurant" value={bd.restaurant_name} />
    <KV label="Guests" value={bd.guests} />
    <KV label="Date" value={fmtDate(bd.date)} />
    <KV label="Time" value={bd.time} />
    <KV label="Table" value={bd.table_number || bd.table} />
  </div>
);

const TravelSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Route" value={(bd.departure_city && bd.destination_city) ? `${bd.departure_city} → ${bd.destination_city}` : null} />
    <KV label="Travel date" value={fmtDate(bd.travel_date)} />
    <KV label="Time" value={bd.departure_time} />
    <KV label="Passengers" value={(bd.passengers || []).length || bd.passenger_count} />
    <KV label="Class" value={bd.class_name || bd.travel_class} />
  </div>
);

const CarRentalSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Vehicle" value={bd.car_name || bd.vehicle_name} />
    <KV label="Pickup" value={fmtDate(bd.pickup_date)} />
    <KV label="Return" value={fmtDate(bd.return_date)} />
    <KV label="Pickup location" value={bd.pickup_location} />
    <KV label="With driver" value={bd.with_driver ? 'Yes' : 'No'} />
  </div>
);

const EventSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Event" value={bd.event_name || bd.event_title} />
    <KV label="Date" value={fmtDate(bd.event_date || bd.date)} />
    <KV label="Tickets" value={(bd.tickets || []).length || bd.ticket_count} />
    <KV label="Ticket type" value={bd.ticket_type} />
  </div>
);

const PackageSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Service" value={bd.service_name || bd.package_name} />
    <KV label="Pickup" value={fmtDate(bd.pickup_date)} />
    <KV label="Delivery" value={fmtDate(bd.delivery_date)} />
    <KV label="Origin" value={bd.origin_city || bd.from_city} />
    <KV label="Destination" value={bd.destination_city || bd.to_city} />
    <KV label="Weight (kg)" value={bd.weight_kg || bd.weight} />
  </div>
);

const BanquetSummary = ({ bd }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <KV label="Venue" value={bd.venue_name || bd.banquet_name} />
    <KV label="Date" value={fmtDate(bd.event_date || bd.date)} />
    <KV label="Guests" value={bd.guests || bd.guest_count} />
    <KV label="Theme" value={bd.theme} />
  </div>
);

const FallbackSummary = ({ bd }) => {
  const entries = Object.entries(bd)
    .filter(([k, v]) => !['firstName','lastName','first_name','last_name','email','phone','address','notes',
      'pressing_info','showtime_info','items','passengers','tickets','seats',
      'operator_id','operator_name','shop_id','pickup_surcharge','express_surcharge','items_subtotal',
      'service_fee','promo_code','promo_discount'].includes(k) && v != null && v !== '' && typeof v !== 'object');
  if (entries.length === 0) return <p className="text-sm text-slate-500 italic">No additional details captured.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {entries.slice(0, 9).map(([k, v]) => (
        <KV key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
      ))}
    </div>
  );
};

const SERVICE_SUMMARIES = {
  cinema: CinemaSummary, laundry: LaundrySummary, pressing: LaundrySummary,
  hotel: HotelSummary, restaurant: RestaurantSummary, travel: TravelSummary,
  car_rental: CarRentalSummary, event: EventSummary, package: PackageSummary,
  banquet: BanquetSummary,
};

// ── Main modal ─────────────────────────────────────────────────────────────
export default function BookingDetailModal({ isOpen, onClose, order }) {
  if (!order) return null;

  const bd = order.booking_details || {};
  const serviceType = (order.service_type || order.service_category || '').toLowerCase();
  const ServiceIcon = SERVICE_ICONS[serviceType] || Package;
  const SummaryComp = SERVICE_SUMMARIES[serviceType] || FallbackSummary;

  const customerName = bd.customer_name
    || [bd.firstName || bd.first_name, bd.lastName || bd.last_name].filter(Boolean).join(' ').trim()
    || order.customer_name
    || 'Walk-in customer';
  const customerEmail = bd.email || order.customer_email;
  const customerPhone = bd.phone || order.customer_phone;
  const customerAddress = bd.address;

  const pStatus = (order.payment_status || 'pending').toLowerCase();
  const oStatus = (order.status || 'pending').toLowerCase();
  const payBadge = PAYMENT_BADGE[pStatus] || PAYMENT_BADGE.pending;
  const statBadge = STATUS_BADGE[oStatus] || STATUS_BADGE.pending;
  const PayIcon = payBadge.Icon;

  const channelLabel = (order.channel || 'online').replace('_', '-');

  // Operator hint — what the operator needs to do
  const opHint = (() => {
    if (oStatus === 'cancelled') return { tone: 'red', text: 'This booking was cancelled — no action required.' };
    if (oStatus === 'completed') return { tone: 'blue', text: 'Booking has been fulfilled.' };
    if (pStatus === 'pending') return { tone: 'amber', text: 'Awaiting customer payment — booking is not yet binding.' };
    if (pStatus === 'failed') return { tone: 'red', text: 'Payment failed. Booking cannot be fulfilled.' };
    return { tone: 'emerald', text: 'Paid and confirmed — prepare the service for the scheduled date.' };
  })();
  const hintCls = {
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    red:     'bg-red-50 border-red-200 text-red-900',
    blue:    'bg-blue-50 border-blue-200 text-blue-900',
  }[opHint.tone];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0" data-testid="booking-detail-modal">
        {/* Sticky header — operator-focused */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-700 text-white px-6 py-4 rounded-t-lg">
          <DialogHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-white text-lg flex items-center gap-2">
                  <ServiceIcon className="h-5 w-5" />
                  Booking · {order.order_number || (order.id || '').slice(0, 8)}
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  {fmtDateTime(order.created_at) || '—'}
                  {order.operator_name && <span> · {order.operator_name}</span>}
                </DialogDescription>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge className={`${statBadge.cls} border text-[11px]`} data-testid="booking-status-badge">{statBadge.label}</Badge>
                <Badge className={`${payBadge.cls} border text-[11px] gap-1`} data-testid="booking-payment-badge">
                  <PayIcon className="h-3 w-3" /> {payBadge.label}
                </Badge>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Operator hint banner */}
          <div className={`rounded-lg border p-3 text-sm font-medium ${hintCls}`} data-testid="booking-operator-hint">
            {opHint.text}
          </div>

          {/* Customer block — biggest, most prominent for operators */}
          <section>
            <SectionHeader icon={User} accent="text-blue-600">Customer</SectionHeader>
            <div className="rounded-xl border-2 border-blue-500/15 bg-gradient-to-br from-blue-50 to-white p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {customerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-base truncate" data-testid="booking-customer-name">{customerName}</p>
                  <p className="text-xs text-slate-500">Booked via {channelLabel}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {customerPhone && (
                  <a href={`tel:${customerPhone}`} className="flex items-center gap-2 text-slate-700 hover:text-blue-700 transition-colors truncate" data-testid="booking-customer-phone">
                    <Phone className="h-4 w-4 text-blue-600 flex-shrink-0" /> {customerPhone}
                  </a>
                )}
                {customerEmail && (
                  <a href={`mailto:${customerEmail}`} className="flex items-center gap-2 text-slate-700 hover:text-blue-700 transition-colors truncate" data-testid="booking-customer-email">
                    <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" /> {customerEmail}
                  </a>
                )}
                {customerAddress && (
                  <div className="flex items-start gap-2 text-slate-700 truncate" title={customerAddress}>
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" /> <span className="truncate">{customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Service details */}
          <section>
            <SectionHeader icon={ServiceIcon} accent="text-slate-700">Service booked</SectionHeader>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{order.service_name || order.service_title || serviceType}</p>
                  <p className="text-xs text-slate-500 capitalize">{serviceType.replace('_', ' ')}</p>
                </div>
                {order.operator_name && (
                  <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-300 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {order.operator_name}
                  </Badge>
                )}
              </div>
              <SummaryComp bd={bd} order={order} />
            </div>
          </section>

          {/* Customer notes / special instructions */}
          {bd.notes && (
            <section data-testid="booking-customer-notes">
              <SectionHeader icon={FileText} accent="text-amber-600">Customer notes</SectionHeader>
              <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 p-3">
                <p className="text-sm text-slate-700 italic leading-relaxed">"{bd.notes}"</p>
              </div>
            </section>
          )}

          {/* Financial summary — operator needs to know what they're owed */}
          <section>
            <SectionHeader icon={CreditCard} accent="text-emerald-600">Payment</SectionHeader>
            <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-50 to-white p-4">
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <KV label="Method" value={
                  order.payment_method
                    ? <span className="capitalize">{(order.payment_method || '').replace(/_/g, ' ')}</span>
                    : '—'
                } />
                <KV label="Status" value={
                  <span className="inline-flex items-center gap-1.5">
                    <PayIcon className="h-3.5 w-3.5" />
                    <span className={pStatus === 'paid' || pStatus === 'completed' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {payBadge.label}
                    </span>
                  </span>
                } />
                {order.paid_at && <KV label="Paid at" value={fmtDateTime(order.paid_at)} />}
                {order.transaction_id && <KV label="Transaction ID" value={order.transaction_id} valueClass="font-mono text-xs" testId="booking-transaction-id" />}
              </div>

              {/* Surcharges (if present) */}
              {(bd.items_subtotal > 0 || bd.service_fee > 0 || bd.express_surcharge > 0 || bd.pickup_surcharge > 0 || bd.promo_discount > 0) && (
                <div className="pt-3 border-t border-emerald-200/60 space-y-1 text-xs">
                  {bd.items_subtotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Items subtotal</span><span>{formatFCFA(bd.items_subtotal)}</span>
                    </div>
                  )}
                  {bd.express_surcharge > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Express</span>
                      <span>+{formatFCFA(bd.express_surcharge)}</span>
                    </div>
                  )}
                  {bd.pickup_surcharge > 0 && (
                    <div className="flex justify-between text-purple-700">
                      <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> Pickup</span>
                      <span>+{formatFCFA(bd.pickup_surcharge)}</span>
                    </div>
                  )}
                  {bd.service_fee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Service fee</span><span>+{formatFCFA(bd.service_fee)}</span>
                    </div>
                  )}
                  {bd.promo_discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>🎟️ Promo {bd.promo_code ? `(${bd.promo_code})` : ''}</span>
                      <span>-{formatFCFA(bd.promo_discount)}</span>
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-3 bg-emerald-200/40" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">Total amount</span>
                <span className="text-2xl font-bold text-emerald-700" data-testid="booking-total">
                  {formatFCFA(order.total_amount || 0)} <span className="text-xs font-normal text-slate-500">{order.currency || 'XAF'}</span>
                </span>
              </div>
            </div>
          </section>

          {/* Validation / audit (admin/super_admin info, helpful for operators too) */}
          {(order.validated_by_name || order.validated_at || order.cancelled_at || order.cancellation_reason) && (
            <section data-testid="booking-audit">
              <SectionHeader icon={Clock}>Audit trail</SectionHeader>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                {order.validated_by_name && (
                  <p className="text-slate-700">
                    <span className="text-slate-500">Validated by:</span> <span className="font-medium">{order.validated_by_name}</span>
                    {order.validated_at && <span className="text-slate-500"> · {fmtDateTime(order.validated_at)}</span>}
                  </p>
                )}
                {order.cancelled_at && (
                  <p className="text-slate-700">
                    <span className="text-slate-500">Cancelled:</span> <span className="font-medium">{fmtDateTime(order.cancelled_at)}</span>
                    {order.cancellation_reason && <span className="text-slate-500"> — {order.cancellation_reason}</span>}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

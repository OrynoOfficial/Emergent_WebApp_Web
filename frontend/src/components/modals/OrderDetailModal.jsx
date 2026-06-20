import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  Clock,
  Package,
  CreditCard,
  Receipt,
  QrCode,
  Download,
  Printer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Hash,
  Users as UsersIcon,
  RefreshCw,
  Info,
  Ticket,
  CheckCircle2,
  Building2,
  Wallet,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate as fmtDate, formatDateTime as fmtDateTime, getTimezone } from '@/utils/dateUtils';
import MoneyTrail from '@/components/payment/MoneyTrail';
import EventTicket from '@/components/tickets/EventTicket';
import TravelTicket from '@/components/tickets/TravelTicket';
import CinemaTicket from '@/components/tickets/CinemaTicket';
import HotelTicket from '@/components/tickets/HotelTicket';
import RestaurantTicket from '@/components/tickets/RestaurantTicket';
import CarRentalTicket from '@/components/tickets/CarRentalTicket';
import LaundryTicket from '@/components/tickets/LaundryTicket';
import RefundRequestDialog from '@/components/refunds/RefundRequestDialog';
import { RefreshCcw } from 'lucide-react';

const getStatusConfig = (status) => {
  const configs = {
    pending: {
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: AlertCircle,
      label: 'Pending'
    },
    confirmed: {
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: CheckCircle,
      label: 'Confirmed'
    },
    completed: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: CheckCircle,
      label: 'Completed'
    },
    delivered: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: Truck,
      label: 'Delivered'
    },
    cancelled: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: XCircle,
      label: 'Cancelled'
    },
    reserved: {
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      icon: Clock,
      label: 'Reserved'
    },
    refund_requested: {
      color: 'bg-rose-100 text-rose-700 border-rose-200',
      icon: RefreshCw,
      label: 'Refund Request Submitted'
    },
    refunded: {
      color: 'bg-slate-200 text-slate-700 border-slate-300',
      icon: CheckCircle2,
      label: 'Refunded'
    },
    expired: {
      color: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: XCircle,
      label: 'Expired'
    },
  };
  return configs[status] || configs.pending;
};

const getCategoryIcon = (category) => {
  const icons = {
    hotel: '🏨',
    restaurant: '🍽️',
    travel: '🚌',
    car_rental: '🚗',
    event: '🎫',
    package: '📦',
    cinema: '🎬',
    laundry: '👔',
    banquet: '🎊',
  };
  return icons[category] || '📦';
};

// Uses the user's active timezone (see utils/dateUtils.js).
const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return 'N/A';
  const out = includeTime ? fmtDateTime(dateString) : fmtDate(dateString);
  return out === '-' ? 'N/A' : out;
};

// QR Code generator URL — self-hosted so we don't depend on a 3rd party for
// ticket validation. Backend route at /api/qr returns the PNG directly.
const generateQRCodeUrl = (order) => {
  const data = JSON.stringify({
    orderId: order.id,
    orderNumber: order.order_number,
    service: order.service_name || order.service_title,
  });
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/qr?size=200&data=${encodeURIComponent(data)}`;
};

export default function OrderDetailModal({ order, isOpen, onClose, onCancel, onDownloadReceipt }) {
  const [refundOpen, setRefundOpen] = useState(false);
  if (!order) return null;

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const qrCodeUrl = generateQRCodeUrl(order);

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QRCode-${order.order_number}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('QR Code download failed:', error);
      alert('Failed to download QR code.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl">{getCategoryIcon(order.service_category || order.service_type)}</span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold">Order Details</h2>
                <p className="text-sm text-slate-500 font-normal truncate">#{order.order_number || (order.id || order._id || '').slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            {/* iter 245: status tag now sits on the same line as the title
                to compress vertical whitespace between the heading and the
                operator strip below. */}
            <Badge
              className={`${statusConfig.color} flex items-center gap-1 px-2.5 py-1 text-xs shrink-0`}
              data-testid="order-status-badge"
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* iter 245: "Booked on" timestamp moved out of the right-rail and
            placed right above the operator hero strip, so the section under
            the operator block reaches Service Information with no wasted gap. */}
        <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5" data-testid="order-booked-on">
          <Clock className="h-3 w-3" />
          Booked on <span className="font-medium text-slate-700">{formatDate(order.created_at, true)}</span>
          <span className="text-slate-400">· {getTimezone()}</span>
        </p>

        {/* ── Operator hero strip ─────────────────────────────────────────
            Surfaces the operator name + logo right after the modal heading
            so customers immediately know WHO they're booked with. */}
        {(order.operator_name || order.operator_logo_url || order.booking_details?.operator_logo_url) && (
          <div
            className="mt-1 mb-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 shadow-sm"
            data-testid="order-detail-operator-strip"
          >
            {(order.operator_logo_url || order.booking_details?.operator_logo_url) ? (
              <img
                src={order.operator_logo_url || order.booking_details.operator_logo_url}
                alt={order.operator_name || 'Operator'}
                className="h-10 w-10 rounded-lg bg-white object-contain border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-[#082c59]/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-[#082c59]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Operator</p>
              <p className="text-sm font-bold text-slate-900 truncate">
                {order.operator_name || order.booking_details?.operator_name || 'Operator'}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-white border-slate-300 text-slate-600 capitalize hidden sm:inline-flex">
              {(order.service_category || order.service_type)?.replace('_', ' ') || 'Service'}
            </Badge>
          </div>
        )}

        <div className="space-y-4 py-3">
          {/* Ticket invalidated / Money refunded banners (iter 245+248). */}
          {order.status === 'refunded' ? (
            <div
              data-testid="money-refunded-banner"
              className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800">
                <span className="font-semibold">Money refunded.</span>{' '}
                {order.payment_method === 'stripe'
                  ? `${formatFCFA(order.refunded_amount || order.total_amount)} will land on your original card within 5–10 business days.`
                  : `Expect ${formatFCFA(order.refunded_amount || order.total_amount)} on your MoMo / Orange wallet within 2–3 business days.`}
              </p>
            </div>
          ) : order.ticket_invalidated && (
            <div
              data-testid="ticket-invalidated-banner"
              className="rounded-xl border-2 border-rose-200 bg-rose-50 p-3 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <p className="text-xs text-rose-800">
                <span className="font-semibold">Ticket invalidated.</span> A refund request is in progress for this booking, so the QR / bar code has been removed and the ticket cannot be scanned.
              </p>
            </div>
          )}

          {/* Reassignment banner — shows when the resource attached to this booking has been swapped */}
          {Array.isArray(order.reassignment_history) && order.reassignment_history.length > 0 && (() => {
            const latest = order.reassignment_history[order.reassignment_history.length - 1];
            const fromLabel = latest?.from?.plate_number || latest?.from?.vehicle_name || latest?.from?.name || '—';
            const toLabel = latest?.to?.plate_number || latest?.to?.vehicle_name || latest?.to?.name || '—';
            const reasonLabel = latest?.reason_note || (latest?.reason ? latest.reason.charAt(0).toUpperCase() + latest.reason.slice(1) : 'Updated');
            const at = latest?.at ? formatDate(latest.at, true) : '';
            return (
              <div
                data-testid="reassignment-banner"
                className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Your {order.service_type === 'travel' ? 'bus' : 'resource'} was changed
                  </p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    <span className="font-mono text-xs bg-white/60 border border-amber-200 px-1.5 py-0.5 rounded">{fromLabel}</span>
                    <span className="mx-1.5">→</span>
                    <span className="font-mono text-xs bg-white border border-amber-300 px-1.5 py-0.5 rounded font-bold">{toLabel}</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" /> {reasonLabel}{at ? ` · ${at}` : ''}
                  </p>
                  {order.reassignment_history.length > 1 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {order.reassignment_history.length} changes recorded for this booking.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <Separator />

          {/* Service + Booking summary — merged into a single dense block
              so customers don't scroll through redundant section dividers.
              Operator info now lives in the hero strip above, so we don't
              repeat it here. */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Service Information</h3>
            {order.checked_in && (
              <div
                className="mb-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-300"
                data-testid="ticket-checked-in-tag"
              >
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/40">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold uppercase tracking-wider">Checked In</p>
                  <p className="text-xs opacity-90">
                    {order.checked_in_at ? new Date(order.checked_in_at).toLocaleString() : 'Successfully verified'}
                  </p>
                </div>
              </div>
            )}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2.5">
              {/* Route/Title row */}
              {(order.booking_details?.departure_city && order.booking_details?.destination_city) ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <span className="font-bold text-lg text-slate-900">
                    {order.booking_details.departure_city} → {order.booking_details.destination_city}
                  </span>
                </div>
              ) : (
                <h4 className="font-bold text-lg text-slate-900">{order.service_name || order.service_title || 'Service'}</h4>
              )}

              {/* Compact 2-column key/value grid covering Date / Time /
                  Check-in/out / Vehicle Type / Guests / Seats / Arrival.
                  Each row is a fragment rendered ONLY when the value
                  exists — keeps the section as tall as the data warrants. */}
              {(() => {
                const bd = order.booking_details || {};
                const si = bd.showtime_info || {};
                const serviceDate = bd.travel_date || bd.service_date || bd.show_date || si.show_date || order.service_date;
                const checkIn = bd.check_in;
                const checkOut = bd.check_out;
                const serviceTime = order.service_time || bd.service_time || bd.travel_time || bd.departure_time || bd.show_time || si.show_time;
                const arrivalLabel = bd.arrival_time ? 'Arrival Time' : 'End Time';
                const arrivalValue = bd.arrival_time || bd.end_time || si.end_time;
                const vehicleType = bd.vehicle_type;
                const guests = bd.guests;
                const seats = bd.selected_seats?.length > 0 ? bd.selected_seats.join(', ') : null;
                const rows = [
                  serviceDate && { label: 'Service Date', value: formatDate(serviceDate), testId: 'service-date' },
                  serviceTime && { label: 'Service Time', value: serviceTime, testId: 'service-time' },
                  checkIn && { label: 'Check-in', value: formatDate(checkIn) },
                  checkOut && { label: 'Check-out', value: formatDate(checkOut) },
                  arrivalValue && { label: arrivalLabel, value: arrivalValue },
                  vehicleType && { label: 'Vehicle Type', value: vehicleType },
                  guests && { label: 'Guests', value: guests },
                  seats && { label: 'Seats', value: seats },
                ].filter(Boolean);
                if (rows.length === 0) return null;
                return (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-200">
                    {rows.map((r, i) => (
                      <div key={i} className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{r.label}</p>
                        <p className="text-sm font-semibold text-slate-800 truncate" data-testid={r.testId}>{r.value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Travel boarding ticket */}
          {(order.service_type === 'travel' || order.service_category === 'travel') && !order.ticket_invalidated && (
            <TravelTicket order={order} formatDate={formatDate} />
          )}

          {/* Cinema screening ticket */}
          {(order.service_type === 'cinema' || order.service_category === 'cinema') && !order.ticket_invalidated && (
            <CinemaTicket order={order} formatDate={formatDate} />
          )}

          {/* Event Showtime Ticket — new Location → Showtime architecture */}
          {(order.service_type === 'event' || order.service_category === 'event') && !order.ticket_invalidated && (
            <EventTicket order={order} />
          )}

          {/* Laundry / Pressing voucher */}
          {(order.service_type === 'laundry' || order.service_type === 'pressing' || order.service_category === 'laundry' || order.service_category === 'pressing') && !order.ticket_invalidated && (
            <LaundryTicket order={order} formatDate={formatDate} />
          )}

          {/* Hotel booking voucher */}
          {(order.service_type === 'hotel' || order.service_category === 'hotel') && !order.ticket_invalidated && (
            <HotelTicket order={order} formatDate={formatDate} />
          )}

          {/* Restaurant reservation voucher */}
          {(order.service_type === 'restaurant' || order.service_category === 'restaurant') && !order.ticket_invalidated && (
            <RestaurantTicket order={order} formatDate={formatDate} />
          )}

          {/* Car rental voucher */}
          {(order.service_type === 'car_rental' || order.service_category === 'car_rental') && !order.ticket_invalidated && (
            <CarRentalTicket order={order} formatDate={formatDate} />
          )}

          {/* Customer Info — compact 3-column grid so Name/Phone/Email sit
              on a single row on desktop instead of stacking. Saves ~120px
              of vertical space. */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer Information</h3>
            <div className="bg-slate-50 rounded-lg p-3.5 text-sm">
              {(() => {
                const customerName = order.customer_name ||
                  (order.booking_details?.passengers?.[0] &&
                    `${order.booking_details.passengers[0].first_name || ''} ${order.booking_details.passengers[0].last_name || ''}`.trim()) ||
                  (order.booking_details?.firstName && order.booking_details?.lastName &&
                    `${order.booking_details.firstName} ${order.booking_details.lastName}`) ||
                  null;
                const idNumber = order.booking_details?.passengers?.[0]?.id_number ||
                  order.booking_details?.idNumber || null;
                const phone = order.customer_phone ||
                  order.booking_details?.passengers?.[0]?.phone ||
                  order.booking_details?.phone || null;
                const email = order.customer_email || order.user_email;
                const cells = [
                  { icon: User,  label: 'Name',  value: customerName || email || 'N/A' },
                  phone   && { icon: Phone, label: 'Phone', value: phone },
                  email   && { icon: Mail,  label: 'Email', value: email },
                  idNumber && { icon: Hash, label: 'ID / Passport', value: idNumber },
                ].filter(Boolean);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2">
                    {cells.map((c, i) => {
                      const Icon = c.icon;
                      return (
                        <div key={i} className="flex items-start gap-1.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium leading-tight">{c.label}</p>
                            <p className="text-sm font-medium text-slate-800 truncate">{c.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Additional passengers — collapsed into a compact line */}
              {order.booking_details?.passengers?.length > 1 && (
                <div className="pt-2.5 mt-2.5 border-t border-slate-200">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-1">
                    All Passengers ({order.booking_details.passengers.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.booking_details.passengers.map((p, idx) => (
                      <Badge key={idx} variant="outline" className="bg-white border-slate-200 text-slate-700 text-[11px] font-normal">
                        {idx + 1}. {p.first_name} {p.last_name}
                        {p.id_number && <span className="text-slate-400 ml-1">· {p.id_number}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Notes */}
          {order.customer_notes && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Special Requests</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 italic">&ldquo;{order.customer_notes}&rdquo;</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Payment Summary — hero total + line-items breakdown + method
              pill. The total is the eye-catching anchor because that's what
              the customer cares about most. */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" /> Payment Summary
            </h3>
            <div className="rounded-xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white overflow-hidden">
              {/* Hero total banner */}
              <div className="bg-gradient-to-r from-[#082c59] to-[#0a3b78] text-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">Total Paid</p>
                  <p className="text-2xl font-bold mt-0.5" data-testid="payment-summary-total">
                    {formatFCFA(order.total_amount || order.final_amount || 0)}
                  </p>
                </div>
                <Badge
                  className={`px-2.5 py-1 text-[10px] uppercase tracking-wide font-semibold ${
                    (order.payment_status || '').toLowerCase() === 'paid' || (order.payment_status || '').toLowerCase() === 'completed'
                      ? 'bg-emerald-100 text-emerald-800 border-0'
                      : 'bg-amber-100 text-amber-800 border-0'
                  }`}
                  data-testid="payment-summary-status"
                >
                  {order.payment_status || 'pending'}
                </Badge>
              </div>

              {/* Line items breakdown — only render when there's at least
                  one component to show (subtotal/tax/discount), otherwise
                  the banner above is the entire summary. */}
              {((order.subtotal && order.subtotal !== order.total_amount) || order.tax > 0 || order.discount > 0) && (
                <div className="p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatFCFA(order.subtotal || order.amount || 0)}</span>
                  </div>
                  {order.tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax</span>
                      <span className="font-medium">{formatFCFA(order.tax)}</span>
                    </div>
                  )}
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="inline-flex items-center gap-1">🎟️ Discount</span>
                      <span className="font-medium">-{formatFCFA(order.discount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment method strip */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-emerald-100">
                <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500">Method</span>
                <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 font-medium text-[11px] capitalize">
                  {order.payment_method || 'Not specified'}
                </Badge>
              </div>
            </div>
          </div>

          {/* ── Money Trail ─────────────────────────────────────────────
              The immutable ledger view: every event from intent_created
              through captured → refunded → disputed lives here. Pulled
              from /api/v2/payments/by-order/{order_id}/timeline. */}
          <div data-testid="money-trail-section">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Money Trail</h3>
            <MoneyTrail orderId={order.id || order._id || order.order_id} />
          </div>

          {/* QR Code Section — only for confirmed + paid orders, and HIDDEN
              if the ticket has been invalidated by a refund request (iter 245). */}
          {!order.ticket_invalidated
            && ['confirmed', 'reserved', 'completed'].includes(order.status)
            && ['paid', 'verified', 'captured', 'completed', 'succeeded'].includes((order.payment_status || '').toLowerCase()) && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Ticket</h3>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <img
                  src={qrCodeUrl}
                  alt="Order QR Code"
                  className="mx-auto rounded-lg shadow-md mb-3"
                />
                <p className="text-xs text-slate-500 mb-3">
                  Present this QR code to the service provider
                </p>
                <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {order.status === 'pending' && onCancel && (
            <Button
              variant="destructive"
              onClick={() => onCancel(order.id || order._id)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          )}
          {/* Refund request — only on paid orders that aren't already refunded,
              scanned, or already in-flight (refund_requested). */}
          {['completed', 'paid', 'verified', 'captured', 'succeeded'].includes((order.payment_status || '').toLowerCase())
            && !['refunded', 'cancelled', 'refund_requested', 'expired'].includes((order.status || '').toLowerCase())
            && !order.ticket_invalidated
            && !order.checked_in
            && !order.scanned_at && (
            <Button
              variant="outline"
              onClick={() => setRefundOpen(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              data-testid="open-refund-request-btn"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Request refund
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {onDownloadReceipt && (
            <Button variant="outline" onClick={() => onDownloadReceipt(order)}>
              <Receipt className="h-4 w-4 mr-2" />
              Receipt
            </Button>
          )}
          <Button onClick={onClose} className="bg-[#082c59]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      <RefundRequestDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        order={order}
      />
    </Dialog>
  );
}

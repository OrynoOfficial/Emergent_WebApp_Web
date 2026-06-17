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
  Bus,
  Hash,
  Armchair,
  Users as UsersIcon,
  RefreshCw,
  Info,
  Film,
  Ticket,
  Monitor,
  Shirt,
  Droplets,
  Sparkles,
  Home,
  CheckCircle2,
  Building2,
  Wallet,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { formatDate as fmtDate, formatDateTime as fmtDateTime, getTimezone } from '@/utils/dateUtils';
import MoneyTrail from '@/components/payment/MoneyTrail';
import EventTicket from '@/components/tickets/EventTicket';
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
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{getCategoryIcon(order.service_category || order.service_type)}</span>
            <div>
              <h2 className="text-xl font-bold">Order Details</h2>
              <p className="text-sm text-slate-500 font-normal">#{order.order_number}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* ── Operator hero strip ─────────────────────────────────────────
            Surfaces the operator name + logo right after the modal heading
            so customers immediately know WHO they're booked with. Previously
            this was buried inside the Service Info grid and customers
            scrolled past it. */}
        {(order.operator_name || order.operator_logo_url || order.booking_details?.operator_logo_url) && (
          <div
            className="mt-2 mb-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 shadow-sm"
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

        <div className="space-y-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`${statusConfig.color} flex items-center gap-1 px-3 py-1`}>
                <StatusIcon className="h-4 w-4" />
                {statusConfig.label}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Booked on</p>
              <p className="text-sm font-medium" data-testid="order-booked-on">{formatDate(order.created_at, true)}</p>
              <p className="text-[10px] text-slate-400">{getTimezone()}</p>
            </div>
          </div>

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

          {/* Vehicle Info — for travel bookings */}
          {(order.service_type === 'travel' || order.service_category === 'travel') && (
            (() => {
              const v = order.booking_details?.vehicle_info || {};
              const plate = v.plate_number || order.booking_details?.plate_number;
              const vName = v.vehicle_name || v.name || order.booking_details?.vehicle_name;
              const model = [v.manufacturer, v.model].filter(Boolean).join(' ') || order.booking_details?.vehicle_model;
              const images = v.images || order.booking_details?.vehicle_images || [];
              const vType = v.vehicle_type || order.booking_details?.vehicle_type;
              const seats = order.booking_details?.seat_numbers || order.booking_details?.selected_seats || [];
              if (!plate && !vName && !model && images.length === 0 && !vType) return null;
              return (
                <div data-testid="order-vehicle-info">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Bus className="h-4 w-4 text-[#082c59]" /> Your Vehicle
                  </h3>
                  <div className="rounded-xl border-2 border-[#082c59]/10 bg-gradient-to-br from-[#082c59]/5 to-white p-4">
                    <div className="flex gap-4 items-start">
                      {images.length > 0 ? (
                        <img
                          src={images[0]}
                          alt={vName || 'Vehicle'}
                          className="w-28 h-20 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-28 h-20 rounded-lg bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                          <Bus className="h-8 w-8 text-[#082c59]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {vName && <p className="font-bold text-slate-900">{vName}</p>}
                        {model && <p className="text-sm text-slate-600">{model}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {plate && (
                            <Badge className="bg-[#082c59] text-white font-mono text-xs gap-1" data-testid="ticket-plate-number">
                              <Hash className="h-3 w-3" /> {plate}
                            </Badge>
                          )}
                          {vType && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {vType.replace('_', ' ')}
                            </Badge>
                          )}
                          {seats.length > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs gap-1">
                              <Armchair className="h-3 w-3" /> Seat{seats.length > 1 ? 's' : ''} {seats.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 italic">
                      Show this ticket and the plate number to the agent at boarding.
                    </p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Extra-luggage manifest — directly under "Your Vehicle" since
              passengers reference both side-by-side at boarding. Operators
              and station staff can verify each bag's contents at a glance. */}
          {Array.isArray(order.booking_details?.extra_luggage_descriptions) && order.booking_details.extra_luggage_descriptions.length > 0 && (
            <div data-testid="order-luggage-manifest">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                  {order.booking_details.extra_luggage_descriptions.length}
                </span>
                Extra Luggage Manifest
              </h3>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <ol className="space-y-2">
                  {order.booking_details.extra_luggage_descriptions.map((desc, idx) => (
                    <li key={idx} className="flex gap-3 items-start text-sm" data-testid={`order-luggage-bag-${idx}`}>
                      <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-amber-300 text-amber-800 text-[11px] font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="text-slate-700 leading-snug">{desc}</p>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-amber-700/80 italic mt-3">
                  Contents declared at booking. Show this list at boarding for verification.
                </p>
              </div>
            </div>
          )}

          {/* Screening Info — for cinema bookings */}
          {(order.service_type === 'cinema' || order.service_category === 'cinema') && (
            (() => {
              const si = order.booking_details?.showtime_info || {};
              const bd = order.booking_details || {};
              const filmTitle = si.film_title || bd.film_title || order.service_name;
              const cinemaName = si.cinema_name || bd.cinema || order.operator_name;
              const cinemaCity = si.cinema_city || bd.cinema_city;
              const cinemaAddress = si.cinema_address;
              const cinemaPhone = si.cinema_phone;
              const cinemaAmenities = si.cinema_amenities || [];
              const screenName = si.screen_name || bd.screen;
              const screenType = si.screen_type || bd.screen_type;
              const showDate = si.show_date || bd.show_date;
              const showTime = si.show_time || bd.show_time;
              const endTime = si.end_time || bd.end_time;
              const seats = bd.seats || bd.selected_seats || [];
              const counts = bd.ticket_counts || {};
              const poster = si.poster_url || bd.poster_url;
              // Rich film metadata (added by backend enrichment)
              const filmDuration = si.film_duration_minutes;
              const filmGenre = si.film_genre || [];
              const filmLanguage = si.film_language || si.language;
              const filmRating = si.film_rating;
              const filmDirector = si.film_director;
              const filmCast = si.film_cast || [];
              const filmSynopsis = si.film_synopsis;
              const filmImdb = si.film_imdb_rating;
              const filmTrailerUrl = si.film_trailer_url;
              if (!filmTitle && !cinemaName && !screenName && seats.length === 0) return null;
              return (
                <div data-testid="order-screening-info">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Film className="h-4 w-4 text-[#082c59]" /> Your Screening
                  </h3>
                  <div className="rounded-xl border-2 border-cyan-500/15 bg-gradient-to-br from-cyan-50 to-white p-4">
                    <div className="flex gap-4 items-start">
                      {poster ? (
                        <img
                          src={poster}
                          alt={filmTitle || 'Film'}
                          className="w-24 h-36 rounded-lg object-cover border border-slate-200 flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-24 h-36 rounded-lg bg-gradient-to-br from-red-700 to-rose-600 flex items-center justify-center flex-shrink-0">
                          <Film className="h-10 w-10 text-white/80" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {filmTitle && (
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 text-base leading-tight" data-testid="ticket-film-title">{filmTitle}</p>
                            {filmRating && (
                              <Badge variant="outline" className="text-[10px] bg-slate-100 border-slate-300 text-slate-700 uppercase">{filmRating}</Badge>
                            )}
                          </div>
                        )}
                        {/* Film meta line — duration / language / IMDB */}
                        {(filmDuration || filmLanguage || filmImdb) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            {filmDuration && (
                              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {filmDuration} min</span>
                            )}
                            {filmLanguage && (
                              <span className="inline-flex items-center gap-1 capitalize">{filmLanguage}</span>
                            )}
                            {filmImdb && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">★ {Number(filmImdb).toFixed(1)} IMDb</span>
                            )}
                          </div>
                        )}
                        {/* Genres */}
                        {filmGenre.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5" data-testid="ticket-film-genres">
                            {filmGenre.slice(0, 4).map((g, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] capitalize bg-purple-50 border-purple-200 text-purple-700 px-1.5 py-0">
                                {(g || '').replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {cinemaName && (
                          <p className="text-sm text-slate-700 flex items-start gap-1 pt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span>
                              <span className="font-medium">{cinemaName}</span>
                              {cinemaAddress && <span className="text-slate-500"> · {cinemaAddress}</span>}
                              {cinemaCity && <span className="text-slate-500"> · {cinemaCity}</span>}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {screenName && (
                            <Badge className="bg-[#082c59] text-white text-xs gap-1" data-testid="ticket-screen-name">
                              <Monitor className="h-3 w-3" /> {screenName}
                            </Badge>
                          )}
                          {screenType && (
                            <Badge variant="outline" className="text-xs uppercase tracking-wide bg-cyan-50 border-cyan-200 text-cyan-700">
                              {screenType.replace('_', ' ')}
                            </Badge>
                          )}
                          {seats.length > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs gap-1" data-testid="ticket-seats">
                              <Armchair className="h-3 w-3" /> Seat{seats.length > 1 ? 's' : ''} {seats.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Director + cast — pulled from the enriched film snapshot */}
                    {(filmDirector || filmCast.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-cyan-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" data-testid="ticket-film-credits">
                        {filmDirector && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Director</p>
                            <p className="text-slate-800 font-medium mt-0.5">{filmDirector}</p>
                          </div>
                        )}
                        {filmCast.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Starring</p>
                            <p className="text-slate-800 font-medium mt-0.5 truncate" title={filmCast.join(', ')}>
                              {filmCast.slice(0, 4).join(', ')}{filmCast.length > 4 ? '…' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Synopsis — short description from the film row */}
                    {filmSynopsis && (
                      <div className="mt-3 pt-3 border-t border-cyan-200/60" data-testid="ticket-film-synopsis">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Synopsis</p>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{filmSynopsis}</p>
                        {filmTrailerUrl && (
                          <a
                            href={filmTrailerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-700 hover:text-cyan-800 underline mt-1.5 inline-flex items-center gap-1"
                            data-testid="ticket-film-trailer-link"
                          >
                            Watch trailer →
                          </a>
                        )}
                      </div>
                    )}

                    {/* When */}
                    {(showDate || showTime) && (
                      <div className="mt-3 pt-3 border-t border-cyan-200/60 grid grid-cols-2 gap-3 text-sm">
                        {showDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                            <div>
                              <p className="text-[11px] text-slate-500 leading-none mb-0.5">Date</p>
                              <p className="font-semibold text-slate-900 leading-none">{formatDate(showDate)}</p>
                            </div>
                          </div>
                        )}
                        {showTime && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-cyan-600 flex-shrink-0" />
                            <div>
                              <p className="text-[11px] text-slate-500 leading-none mb-0.5">Showtime</p>
                              <p className="font-semibold text-slate-900 leading-none">
                                {showTime}{endTime ? ` – ${endTime}` : ''}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cinema phone + amenities — pulled from cinema snapshot */}
                    {(cinemaPhone || cinemaAmenities.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-cyan-200/60 space-y-2 text-xs" data-testid="ticket-cinema-extras">
                        {cinemaPhone && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />
                            <span>{cinemaPhone}</span>
                          </div>
                        )}
                        {cinemaAmenities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cinemaAmenities.slice(0, 6).map((a, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] capitalize bg-white border-slate-200 text-slate-600 px-1.5 py-0">
                                {(a || '').replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ticket type breakdown — only when the booking captured it */}
                    {(counts.adult || counts.child || counts.senior || counts.vip) && (
                      <div className="mt-3 pt-3 border-t border-cyan-200/60">
                        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">Tickets</p>
                        <div className="flex flex-wrap gap-1.5">
                          {counts.adult > 0 && (
                            <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                              <Ticket className="h-3 w-3" /> {counts.adult} Adult{counts.adult > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {counts.child > 0 && (
                            <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                              <Ticket className="h-3 w-3" /> {counts.child} Child{counts.child > 1 ? 'ren' : ''}
                            </Badge>
                          )}
                          {counts.senior > 0 && (
                            <Badge variant="outline" className="text-xs bg-white border-slate-200 text-slate-700 gap-1">
                              <Ticket className="h-3 w-3" /> {counts.senior} Senior{counts.senior > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {counts.vip > 0 && (
                            <Badge className="text-xs bg-amber-400 text-amber-950 gap-1">
                              <Ticket className="h-3 w-3" /> {counts.vip} VIP
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="mt-3 text-xs text-slate-500 italic">
                      Present this ticket (or the QR code below) at the cinema entrance.
                    </p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Event Showtime Ticket — new Location → Showtime architecture */}
          {(order.service_type === 'event' || order.service_category === 'event') && (
            <EventTicket order={order} />
          )}

          {/* Laundry / Pressing Order Info */}
          {(order.service_type === 'laundry' || order.service_type === 'pressing' || order.service_category === 'laundry' || order.service_category === 'pressing') && (
            (() => {
              const bd = order.booking_details || {};
              const pi = bd.pressing_info || {};
              const shopName = pi.name || bd.shop_name || order.service_name;
              const shopAddress = pi.address;
              const shopCity = pi.city;
              const shopPhone = pi.phone;
              const turnaround = pi.turnaround_hours;
              const operatorName = pi.operator_name || order.operator_name;
              const heroImg = (pi.images && pi.images[0]) || null;
              const shopType = pi.shop_type || bd.shop_type || 'laundry';
              const isPressing = shopType === 'pressing' || shopType === 'both';

              const pickupMethod = bd.pickup_method || 'pickup';
              const pickupDate = bd.pickup_date;
              const pickupTime = bd.pickup_time;
              const deliveryDate = bd.delivery_date;
              const items = bd.items || [];
              const itemsSubtotal = bd.items_subtotal || 0;
              const expressOn = !!bd.express;
              const expressSurcharge = bd.express_surcharge || 0;
              const pickupSurcharge = bd.pickup_surcharge || 0;
              const serviceFee = bd.service_fee || 0;
              const promoCode = bd.promo_code;
              const promoDiscount = bd.promo_discount || 0;

              const stBadge = shopType === 'pressing'
                ? 'bg-fuchsia-500 text-white'
                : shopType === 'both'
                ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white'
                : 'bg-purple-500 text-white';
              const stLabel = shopType === 'pressing' ? 'Pressing' : shopType === 'both' ? 'Laundry + Pressing' : 'Laundry';

              if (!shopName && items.length === 0) return null;

              return (
                <div data-testid="order-laundry-info">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Shirt className="h-4 w-4 text-purple-700" /> Your {isPressing ? 'Pressing' : 'Laundry'} Order
                  </h3>
                  <div className="rounded-xl border-2 border-purple-500/15 bg-gradient-to-br from-purple-50 to-white p-4">
                    {/* Header — shop card */}
                    <div className="flex gap-4 items-start">
                      {heroImg ? (
                        <img
                          src={heroImg}
                          alt={shopName || 'Shop'}
                          className="w-24 h-24 rounded-lg object-cover border border-purple-200 flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                          <Shirt className="h-10 w-10 text-white/80" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-base leading-tight" data-testid="laundry-shop-name">{shopName}</p>
                          <Badge className={`text-[10px] capitalize ${stBadge} border-transparent`} data-testid="laundry-shop-type">{stLabel}</Badge>
                        </div>
                        {operatorName && (
                          <p className="text-xs text-slate-500">by {operatorName}</p>
                        )}
                        {(shopAddress || shopCity) && (
                          <p className="text-sm text-slate-700 flex items-start gap-1 pt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-purple-700 mt-0.5 flex-shrink-0" />
                            <span>
                              {shopAddress && <span className="font-medium">{shopAddress}</span>}
                              {shopAddress && shopCity && <span className="text-slate-500"> · </span>}
                              {shopCity && <span className="text-slate-500">{shopCity}</span>}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                          {shopPhone && (
                            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {shopPhone}</span>
                          )}
                          {turnaround && (
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {turnaround}h turnaround</span>
                          )}
                          {pi.delivery_available && (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><Truck className="h-3 w-3" /> Pickup &amp; delivery</span>
                          )}
                          {pi.express_available && (
                            <span className="inline-flex items-center gap-1 text-orange-700"><Sparkles className="h-3 w-3" /> Express</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pickup vs drop-off + dates */}
                    <div className="mt-3 pt-3 border-t border-purple-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {pickupMethod === 'pickup' ? <Truck className="h-4 w-4 text-purple-700 flex-shrink-0" /> : <Home className="h-4 w-4 text-purple-700 flex-shrink-0" />}
                        <div>
                          <p className="text-[11px] text-slate-500 leading-none mb-0.5">Logistics</p>
                          <p className="font-semibold text-slate-900 leading-none text-xs">
                            {pickupMethod === 'pickup' ? 'Pickup from customer' : 'Customer drops off'}
                          </p>
                        </div>
                      </div>
                      {pickupDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-700 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-slate-500 leading-none mb-0.5">{pickupMethod === 'pickup' ? 'Pickup date' : 'Drop-off date'}</p>
                            <p className="font-semibold text-slate-900 leading-none text-xs">{formatDate(pickupDate)}{pickupTime ? ` · ${pickupTime}` : ''}</p>
                          </div>
                        </div>
                      )}
                      {deliveryDate && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-fuchsia-700 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-slate-500 leading-none mb-0.5">Delivery date</p>
                            <p className="font-semibold text-slate-900 leading-none text-xs">{formatDate(deliveryDate)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Items breakdown — for pressing or pay-per-item */}
                    {items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-200/60" data-testid="laundry-items-list">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">Items ({items.reduce((s, i) => s + (i.quantity || 0), 0)})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {items.map((it, idx) => {
                            const qty = it.quantity || 1;
                            const unit = it.unit_price || it.price || 0;
                            return (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-slate-700 truncate"><span className="font-medium">{qty}×</span> {it.name}</span>
                                <span className="text-slate-800 font-medium ml-2 whitespace-nowrap">{formatFCFA(unit * qty)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Special instructions */}
                    {bd.notes && (
                      <div className="mt-3 pt-3 border-t border-purple-200/60" data-testid="laundry-notes">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Special Instructions</p>
                        <p className="text-xs text-slate-700 italic leading-relaxed">"{bd.notes}"</p>
                      </div>
                    )}

                    {/* Price breakdown — surcharges + promo */}
                    {(expressSurcharge > 0 || pickupSurcharge > 0 || serviceFee > 0 || promoDiscount > 0) && (
                      <div className="mt-3 pt-3 border-t border-purple-200/60 space-y-1 text-xs" data-testid="laundry-price-summary">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Order Breakdown</p>
                        {itemsSubtotal > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Items subtotal</span>
                            <span className="font-medium">{formatFCFA(itemsSubtotal)}</span>
                          </div>
                        )}
                        {expressSurcharge > 0 && (
                          <div className="flex justify-between text-orange-700">
                            <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Express surcharge</span>
                            <span className="font-medium">+{formatFCFA(expressSurcharge)}</span>
                          </div>
                        )}
                        {pickupSurcharge > 0 && (
                          <div className="flex justify-between text-purple-700">
                            <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" /> Pickup surcharge</span>
                            <span className="font-medium">+{formatFCFA(pickupSurcharge)}</span>
                          </div>
                        )}
                        {serviceFee > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Service fee</span>
                            <span className="font-medium">+{formatFCFA(serviceFee)}</span>
                          </div>
                        )}
                        {promoDiscount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span className="inline-flex items-center gap-1">🎟️ Promo {promoCode ? `(${promoCode})` : ''}</span>
                            <span className="font-medium">-{formatFCFA(promoDiscount)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-slate-500 italic">
                      {pickupMethod === 'pickup'
                        ? 'A rider will collect your items at the agreed time.'
                        : 'Please drop off your items at the shop on the scheduled date.'}
                    </p>
                  </div>
                </div>
              );
            })()
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
                <p className="text-sm text-amber-800 italic">"{order.customer_notes}"</p>
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

          {/* QR Code Section — only for confirmed orders that are actually paid.
              Pending / unpaid orders MUST NOT show a QR because the ticket
              hasn't been issued yet. */}
          {['confirmed', 'reserved', 'completed'].includes(order.status)
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
          {/* Refund request — only on paid orders that aren't already refunded */}
          {['completed', 'paid', 'verified', 'captured', 'succeeded'].includes((order.payment_status || '').toLowerCase())
            && !['refunded', 'cancelled'].includes((order.status || '').toLowerCase()) && (
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

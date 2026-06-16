// Per-showtime e-ticket renderer used inside OrderDetailModal & BookingConfirmation.
// Mirrors the cinema ticket block but built for the Location → Showtime model:
//   • Front: class badge with the operator's class color, qty pill, when/where,
//     operator logo, contact name.
//   • Back of ticket (right-side panel on desktop, below on mobile): venue
//     policies as the "important info".
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Ticket, User, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'EEE, MMM d, yyyy · HH:mm') : iso;
}

export default function EventTicket({ order }) {
  const bd = order?.booking_details || {};
  const title = bd.showtime_title || order?.service_name || 'Event';
  const venue = bd.location_name || order?.operator_name;
  const city = bd.location_city;
  const address = bd.location_address;
  const start = bd.start_datetime;
  const doors = bd.doors_open_at;
  const classColor = bd.class_color || '#3b82f6';
  const className = bd.class_name || 'Standard';
  const perks = bd.class_perks || [];
  const policies = bd.location_policies || [];
  const qty = bd.quantity || 1;
  const poster = bd.showtime_image;
  const contactName = bd.contact_name;
  const logo = order?.operator_logo_url;
  const eventType = bd.showtime_type;

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-amber-50 border-2 border-indigo-200/60 shadow-sm" data-testid="event-ticket">
      {/* Top — header band with class color */}
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, ${classColor} 0%, ${classColor}66 50%, transparent 100%)` }}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* LEFT — main face of the ticket */}
        <div className="md:col-span-2 p-5 space-y-4 relative">
          {/* perforation dot for that ticket-stub feel on desktop */}
          <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-200" />
          <div className="flex items-start gap-3">
            {poster ? (
              <img src={poster} alt={title} className="w-16 h-16 rounded-lg object-cover border-2 border-indigo-100" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-indigo-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  className="text-[10px] font-semibold border-0"
                  style={{ background: `${classColor}22`, color: classColor }}
                  data-testid="event-ticket-class-badge"
                >
                  <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ background: classColor }} />
                  {className}
                </Badge>
                {eventType && (
                  <Badge variant="outline" className="text-[10px] capitalize text-slate-600">{eventType}</Badge>
                )}
                <Badge className="bg-slate-900 text-white text-[10px] border-0" data-testid="event-ticket-qty-badge">
                  × {qty}
                </Badge>
              </div>
              <h3 className="font-bold text-base text-slate-900 leading-tight" data-testid="event-ticket-title">{title}</h3>
              {bd.showtime_description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bd.showtime_description}</p>
              )}
            </div>
            {logo && (
              <img src={logo} alt={order?.operator_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow flex-shrink-0" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-indigo-200">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">When</p>
                <p className="text-xs font-semibold text-slate-800">{fmtWhen(start)}</p>
                {doors && <p className="text-[10px] text-slate-500">Doors {doors}</p>}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Where</p>
                <p className="text-xs font-semibold text-slate-800 truncate">{venue}</p>
                {(address || city) && (
                  <p className="text-[10px] text-slate-500 truncate">{[address, city].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Holder</p>
                <p className="text-xs font-semibold text-slate-800 truncate">{contactName || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ticket className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Paid</p>
                <p className="text-xs font-bold" style={{ color: classColor }}>{formatFCFA(order?.total_amount || 0)}</p>
              </div>
            </div>
          </div>

          {perks.length > 0 && (
            <div className="pt-3 border-t border-dashed border-indigo-200">
              <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Includes</p>
              <div className="flex flex-wrap gap-1.5">
                {perks.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — "back of ticket" panel (venue policies + important info) */}
        <div className="bg-slate-900 text-white p-5 space-y-3 md:rounded-l-2xl relative">
          <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-200" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Important Info</p>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Present this ticket (or the QR below) at the venue entrance.
              {doors && ` Doors open at ${doors}.`}
            </p>
          </div>
          {policies.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1.5">Venue Rules</p>
              <ul className="text-xs text-slate-200 space-y-1.5" data-testid="event-ticket-policies">
                {policies.map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!policies.length && (
            <p className="text-[11px] text-slate-400 italic">No venue-specific rules.</p>
          )}
        </div>
      </div>
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${classColor}66 50%, ${classColor} 100%)` }}
      />
    </div>
  );
}

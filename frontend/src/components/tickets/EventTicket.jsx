// Per-showtime e-ticket renderer for events (Location → Showtime model).
// Built on the shared BaseTicket paradigm so every service ticket shares the
// same look. Class color drives the accent.
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Ticket, User, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { format, parseISO, isValid } from 'date-fns';
import BaseTicket from './BaseTicket';

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
  const classColor = bd.class_color || '#6366f1';
  const className = bd.class_name || 'Standard';
  const perks = bd.class_perks || [];
  const policies = bd.location_policies || [];
  const qty = bd.quantity || 1;
  const poster = bd.showtime_image;
  const contactName = bd.contact_name;
  const eventType = bd.showtime_type;

  const badges = [
    {
      label: className,
      style: { background: `${classColor}22`, color: classColor },
      dot: classColor,
      testId: 'event-ticket-class-badge',
    },
    eventType && { label: eventType, variant: 'outline', className: 'text-slate-600' },
    { label: `× ${qty}`, style: { background: '#0f172a', color: '#fff' }, testId: 'event-ticket-qty-badge' },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Clock,
      label: 'When',
      value: fmtWhen(start),
      sublabel: doors ? `Doors ${doors}` : null,
    },
    {
      icon: MapPin,
      label: 'Where',
      value: venue,
      sublabel: [address, city].filter(Boolean).join(' · ') || null,
    },
    { icon: User, label: 'Holder', value: contactName || '—' },
    {
      icon: Ticket,
      label: 'Paid',
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: classColor },
    },
  ];

  const extraSections = perks.length > 0 && (
    <div className="pt-3 border-t border-dashed" style={{ borderColor: `${classColor}40` }}>
      <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Includes</p>
      <div className="flex flex-wrap gap-1.5">
        {perks.map((p, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50"
          >
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> {p}
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <BaseTicket
      testId="event-ticket"
      accentColor={classColor}
      posterSrc={poster}
      posterAlt={title}
      posterAspect="square"
      PosterFallbackIcon={ImageIcon}
      posterFallbackBg="bg-gradient-to-br from-indigo-100 to-purple-100"
      posterFallbackIconColor="text-indigo-300"
      badges={badges}
      title={title}
      subtitle={bd.showtime_description}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle="Important Info"
      rightPanelDescription={`Present this ticket (or the QR below) at the venue entrance.${doors ? ` Doors open at ${doors}.` : ''}`}
      rulesTitle="Venue Rules"
      rules={policies}
    />
  );
}

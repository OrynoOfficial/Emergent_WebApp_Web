// Travel boarding ticket — bus / shuttle. Uses BaseTicket so the look matches
// the Event/Cinema/Hotel tickets, but surfaces route, vehicle plate, seats,
// and the extra-luggage manifest scoped to travel bookings.
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bus, Hash, Armchair, MapPin, Clock, User, Ticket } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import BaseTicket from './BaseTicket';

const ACCENT = '#082c59'; // brand navy

export default function TravelTicket({ order, formatDate }) {
  const bd = order?.booking_details || {};
  const v = bd.vehicle_info || {};
  const plate = v.plate_number || bd.plate_number;
  const vName = v.vehicle_name || v.name || bd.vehicle_name;
  const model = [v.manufacturer, v.model].filter(Boolean).join(' ') || bd.vehicle_model;
  const images = v.images || bd.vehicle_images || [];
  const vType = v.vehicle_type || bd.vehicle_type;
  const seats = bd.seat_numbers || bd.selected_seats || [];
  const dep = bd.departure_city;
  const dest = bd.destination_city;
  const date = bd.travel_date || bd.service_date || order?.service_date;
  const time = bd.departure_time || bd.travel_time || order?.service_time;
  const arrival = bd.arrival_time;
  const luggage = Array.isArray(bd.extra_luggage_descriptions) ? bd.extra_luggage_descriptions : [];
  const passengerName = bd.passengers?.[0]
    ? `${bd.passengers[0].first_name || ''} ${bd.passengers[0].last_name || ''}`.trim()
    : order?.customer_name;
  const operatorPhone = order?.operator_phone || bd.operator_phone;

  const route = dep && dest ? `${dep} → ${dest}` : order?.service_name || 'Trip';

  const badges = [
    plate && {
      label: plate,
      style: { background: ACCENT, color: '#fff', fontFamily: 'monospace' },
      icon: Hash,
      testId: 'ticket-plate-number',
    },
    vType && {
      label: vType.replace('_', ' '),
      variant: 'outline',
      className: 'text-slate-600',
    },
    seats.length > 0 && {
      label: `Seat${seats.length > 1 ? 's' : ''} ${seats.join(', ')}`,
      style: { background: '#d1fae5', color: '#047857' },
      icon: Armchair,
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Clock,
      label: 'Departure',
      value: date && formatDate ? formatDate(date) : date,
      sublabel: time && arrival ? `${time} → ${arrival}` : time,
    },
    {
      icon: MapPin,
      label: 'Route',
      value: dep && dest ? `${dep} → ${dest}` : '—',
    },
    {
      icon: User,
      label: 'Passenger',
      value: passengerName || '—',
    },
    {
      icon: Ticket,
      label: 'Fare',
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: ACCENT },
    },
  ];

  const extraSections = (
    <>
      {(vName || model) && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Vehicle</p>
          <p className="text-xs font-semibold text-slate-800">
            {vName}
            {model && <span className="text-slate-500 font-normal"> · {model}</span>}
          </p>
        </div>
      )}
      {luggage.length > 0 && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">
            Extra Luggage Manifest ({luggage.length})
          </p>
          <ol className="space-y-1.5">
            {luggage.map((desc, idx) => (
              <li
                key={idx}
                className="flex gap-2 items-start text-xs"
                data-testid={`travel-ticket-bag-${idx}`}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold shrink-0">
                  #{idx + 1}
                </span>
                <p className="text-slate-700 leading-snug">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );

  return (
    <BaseTicket
      testId="travel-ticket"
      accentColor={ACCENT}
      posterSrc={images[0]}
      posterAlt={vName || 'Vehicle'}
      posterAspect="wide"
      PosterFallbackIcon={Bus}
      posterFallbackBg="bg-[#082c59]/10"
      posterFallbackIconColor="text-[#082c59]"
      badges={badges}
      title={route}
      subtitle={vName || null}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle="Boarding Info"
      rightPanelDescription="Show this ticket and the plate number to the agent at boarding. Arrive at least 20 minutes before departure."
      rulesTitle="Travel Notes"
      rules={[
        operatorPhone && `Operator support: ${operatorPhone}`,
        luggage.length > 0 && 'Declared luggage will be verified before boarding.',
        'Valid ID may be required at the station.',
      ].filter(Boolean)}
    />
  );
}

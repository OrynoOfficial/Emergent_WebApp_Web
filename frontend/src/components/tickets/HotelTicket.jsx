// Hotel booking voucher — renders the booked room as a ticket-style stub so
// it matches the Event/Travel/Cinema visual paradigm. Surfaces check-in /
// check-out, nights, room type, guests, special requests.
import React from 'react';
import { Hotel, Calendar, Clock, Users as UsersIcon, MapPin, Ticket, BedDouble, User } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import BaseTicket from './BaseTicket';

const ACCENT = '#b45309'; // amber-700

export default function HotelTicket({ order, formatDate }) {
  const { t } = useTranslation();
  const bd = order?.booking_details || {};
  const hotelName = bd.hotel_name || order?.service_name || 'Hotel';
  const checkIn = bd.check_in || bd.check_in_date;
  const checkOut = bd.check_out || bd.check_out_date;
  const nights = bd.nights;
  const adults = bd.adults;
  const children = bd.children;
  const guests = bd.guests || ((adults || 0) + (children || 0)) || null;
  const roomType = bd.room_type;
  const roomBed = bd.room_bed_type;
  const roomSize = bd.room_size_sqm;
  const roomCapacity = bd.room_capacity;
  const roomImage = bd.room_image || (bd.hotel_images && bd.hotel_images[0]);
  const roomPolicies = Array.isArray(bd.room_policies) ? bd.room_policies : [];
  const specialRequests = bd.specialRequests || bd.special_requests;
  const address = bd.address || bd.hotel_address;
  const city = bd.city || bd.hotel_city;
  const checkInTime = bd.check_in_time || 'From 14:00';
  const checkOutTime = bd.check_out_time || 'Before 12:00';
  const guestName = bd.firstName && bd.lastName ? `${bd.firstName} ${bd.lastName}` : order?.customer_name;

  const badges = [
    roomType && {
      label: roomType,
      style: { background: ACCENT, color: '#fff' },
      icon: BedDouble,
      testId: 'hotel-ticket-room-type',
    },
    roomBed && { label: roomBed, variant: 'outline', className: 'text-slate-600' },
    roomSize && { label: `${roomSize} m²`, variant: 'outline', className: 'text-slate-600' },
    nights && {
      label: `${nights} night${nights > 1 ? 's' : ''}`,
      style: { background: '#d1fae5', color: '#047857' },
      icon: Clock,
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Calendar,
      label: t('orders.check_in'),
      value: checkIn && formatDate ? formatDate(checkIn) : checkIn || '—',
      sublabel: checkInTime,
    },
    {
      icon: Calendar,
      label: t('orders.check_out'),
      value: checkOut && formatDate ? formatDate(checkOut) : checkOut || '—',
      sublabel: checkOutTime,
    },
    {
      icon: UsersIcon,
      label: t('orders.guests'),
      value: guests
        ? `${guests}${adults || children ? ` (${[adults && `${adults} adult${adults > 1 ? 's' : ''}`, children && `${children} child${children > 1 ? 'ren' : ''}`].filter(Boolean).join(', ')})` : ''}`
        : '—',
    },
    {
      icon: Ticket,
      label: t('common.paid'),
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: ACCENT },
    },
  ];

  const extraSections = (
    <>
      {(address || city) && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Address</p>
          <p className="text-xs text-slate-700 flex items-start gap-1">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
            <span>{[address, city].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
      )}
      {specialRequests && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Special Requests</p>
          <p className="text-xs text-slate-700 italic leading-relaxed">&ldquo;{specialRequests}&rdquo;</p>
        </div>
      )}
      {guestName && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Primary guest</p>
          <p className="text-xs text-slate-800 font-semibold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            {guestName}
          </p>
        </div>
      )}
    </>
  );

  const rules = roomPolicies.length > 0
    ? roomPolicies
    : [
        `Check-in ${checkInTime.toLowerCase()}, check-out ${checkOutTime.toLowerCase()}.`,
        'A valid ID will be required at check-in.',
        roomCapacity && `Maximum ${roomCapacity} guest${roomCapacity > 1 ? 's' : ''} per room.`,
      ].filter(Boolean);

  return (
    <BaseTicket
      testId="hotel-ticket"
      accentColor={ACCENT}
      posterSrc={roomImage}
      posterAlt={roomType || 'Room'}
      posterAspect="wide"
      PosterFallbackIcon={Hotel}
      posterFallbackBg="bg-amber-100"
      posterFallbackIconColor="text-amber-700"
      badges={badges}
      title={hotelName}
      subtitle={roomType ? `${roomType} room` : null}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle={t("orders.stay_info")}
      rightPanelDescription={t("orders.hotel_present_at_desk")}
      rulesTitle={t("orders.hotel_policies")}
      rules={rules}
    />
  );
}

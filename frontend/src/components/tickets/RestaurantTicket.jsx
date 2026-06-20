// Restaurant reservation voucher — built on BaseTicket so reservations
// (and pre-order receipts) feel consistent with the rest of the platform.
import React from 'react';
import { Utensils, Calendar, Clock, Users as UsersIcon, MapPin, Ticket, User, ChefHat } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import BaseTicket from './BaseTicket';

const ACCENT = '#c2410c'; // orange-700

export default function RestaurantTicket({ order, formatDate }) {
  const bd = order?.booking_details || {};
  const restaurantName = bd.restaurant_name || order?.service_name || 'Restaurant';
  const date = bd.date || bd.reservation_date || order?.service_date;
  const time = bd.time || bd.reservation_time || order?.service_time;
  const guests = bd.guests;
  const orderType = bd.order_type || 'dine-in';
  const items = Array.isArray(bd.items) ? bd.items : [];
  const address = bd.address || bd.restaurant_address;
  const city = bd.city || bd.restaurant_city;
  const heroImg = bd.restaurant_image || (bd.restaurant_images && bd.restaurant_images[0]);
  const cuisine = bd.cuisine || bd.cuisine_type;
  const customerName = bd.firstName && bd.lastName ? `${bd.firstName} ${bd.lastName}` : order?.customer_name;
  const notes = bd.specialRequests || bd.notes || bd.special_requests;

  const badges = [
    {
      label: orderType.replace('-', ' '),
      style: { background: ACCENT, color: '#fff' },
      icon: Utensils,
      testId: 'restaurant-ticket-order-type',
    },
    cuisine && { label: cuisine, variant: 'outline', className: 'text-slate-600' },
    guests && {
      label: `${guests} guest${guests > 1 ? 's' : ''}`,
      style: { background: '#fff7ed', color: ACCENT },
      icon: UsersIcon,
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Calendar,
      label: 'Date',
      value: date && formatDate ? formatDate(date) : date || '—',
    },
    {
      icon: Clock,
      label: 'Time',
      value: time || '—',
    },
    {
      icon: User,
      label: 'Booked for',
      value: customerName || '—',
    },
    {
      icon: Ticket,
      label: 'Paid',
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: ACCENT },
    },
  ];

  const totalItems = items.reduce((s, i) => s + (i.quantity || 0), 0);

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
      {items.length > 0 && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }} data-testid="restaurant-ticket-items">
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">
            <ChefHat className="inline h-3 w-3 mr-1" style={{ color: ACCENT }} />
            Pre-ordered items ({totalItems})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {items.slice(0, 6).map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-slate-700 truncate">
                  <span className="font-medium">{it.quantity || 1}×</span> {it.name}
                </span>
                <span className="text-slate-800 font-medium ml-2 whitespace-nowrap">
                  {formatFCFA((it.price || 0) * (it.quantity || 1))}
                </span>
              </div>
            ))}
            {items.length > 6 && (
              <p className="text-[10px] text-slate-500 italic">+{items.length - 6} more items</p>
            )}
          </div>
        </div>
      )}
      {notes && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Special requests</p>
          <p className="text-xs text-slate-700 italic leading-relaxed">&ldquo;{notes}&rdquo;</p>
        </div>
      )}
    </>
  );

  return (
    <BaseTicket
      testId="restaurant-ticket"
      accentColor={ACCENT}
      posterSrc={heroImg}
      posterAlt={restaurantName}
      posterAspect="square"
      PosterFallbackIcon={Utensils}
      posterFallbackBg="bg-orange-100"
      posterFallbackIconColor="text-orange-600"
      badges={badges}
      title={restaurantName}
      subtitle={orderType === 'takeaway' ? 'Takeaway order' : 'Dine-in reservation'}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle="Reservation Info"
      rightPanelDescription={
        orderType === 'takeaway'
          ? 'Show this voucher at the counter when collecting your order.'
          : 'Show this voucher to the host on arrival. Tables are held for up to 15 minutes after the booked time.'
      }
      rulesTitle="Restaurant Notes"
      rules={[
        orderType === 'dine-in' && 'Please arrive within 15 minutes of your booked time.',
        'Larger parties may incur a service charge.',
      ].filter(Boolean)}
    />
  );
}

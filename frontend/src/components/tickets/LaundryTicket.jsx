// Laundry / Pressing service voucher — built on BaseTicket so the order
// confirmation matches the rest of the platform's ticket aesthetic. Surfaces
// pickup logistics, items breakdown, and price surcharges.
import React from 'react';
import {
  Shirt,
  Calendar,
  Clock,
  Truck,
  Home,
  Ticket,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import BaseTicket from './BaseTicket';

const ACCENT = '#7e22ce'; // purple-700

export default function LaundryTicket({ order, formatDate }) {
  const bd = order?.booking_details || {};
  const pi = bd.pressing_info || {};
  const shopName = pi.name || bd.shop_name || order?.service_name;
  const shopAddress = pi.address;
  const shopCity = pi.city;
  const shopPhone = pi.phone;
  const turnaround = pi.turnaround_hours;
  const heroImg = (pi.images && pi.images[0]) || null;
  const shopType = pi.shop_type || bd.shop_type || 'laundry';
  const isPressing = shopType === 'pressing' || shopType === 'both';

  const pickupMethod = bd.pickup_method || 'pickup';
  const pickupDate = bd.pickup_date;
  const pickupTime = bd.pickup_time;
  const deliveryDate = bd.delivery_date;
  const items = Array.isArray(bd.items) ? bd.items : [];
  const itemsSubtotal = bd.items_subtotal || 0;
  const expressOn = !!bd.express;
  const expressSurcharge = bd.express_surcharge || 0;
  const pickupSurcharge = bd.pickup_surcharge || 0;
  const serviceFee = bd.service_fee || 0;
  const promoCode = bd.promo_code;
  const promoDiscount = bd.promo_discount || 0;
  const notes = bd.notes;

  const stLabel = shopType === 'pressing' ? 'Pressing' : shopType === 'both' ? 'Laundry + Pressing' : 'Laundry';

  const badges = [
    {
      label: stLabel,
      style: { background: ACCENT, color: '#fff' },
      icon: Shirt,
      testId: 'laundry-ticket-shop-type',
    },
    expressOn && {
      label: 'Express',
      style: { background: '#fff7ed', color: '#c2410c' },
      icon: Sparkles,
    },
    pi.delivery_available && {
      label: 'Pickup & delivery',
      variant: 'outline',
      className: 'text-emerald-700 border-emerald-200 bg-emerald-50',
      icon: Truck,
    },
    turnaround && {
      label: `${turnaround}h turnaround`,
      variant: 'outline',
      className: 'text-slate-600',
      icon: Clock,
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: pickupMethod === 'pickup' ? Truck : Home,
      label: 'Logistics',
      value: pickupMethod === 'pickup' ? 'Pickup from customer' : 'Customer drops off',
    },
    pickupDate && {
      icon: Calendar,
      label: pickupMethod === 'pickup' ? 'Pickup date' : 'Drop-off date',
      value: formatDate ? formatDate(pickupDate) : pickupDate,
      sublabel: pickupTime || null,
    },
    deliveryDate && {
      icon: Truck,
      label: 'Delivery',
      value: formatDate ? formatDate(deliveryDate) : deliveryDate,
    },
    {
      icon: Ticket,
      label: 'Paid',
      value: formatFCFA(order?.total_amount || 0),
      valueStyle: { color: ACCENT },
    },
  ].filter(Boolean);

  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  const extraSections = (
    <>
      {(shopAddress || shopCity) && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Shop address</p>
          <p className="text-xs text-slate-700 flex items-start gap-1">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
            <span>
              {[shopAddress, shopCity].filter(Boolean).join(' · ')}
              {shopPhone && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-500">
                  <Phone className="h-3 w-3" /> {shopPhone}
                </span>
              )}
            </span>
          </p>
        </div>
      )}
      {items.length > 0 && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }} data-testid="laundry-ticket-items">
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">
            Items ({totalQty})
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {items.slice(0, 8).map((it, idx) => {
              const qty = it.quantity || 1;
              const unit = it.unit_price || it.price || 0;
              return (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-slate-700 truncate">
                    <span className="font-medium">{qty}×</span> {it.name}
                  </span>
                  <span className="text-slate-800 font-medium ml-2 whitespace-nowrap">
                    {formatFCFA(unit * qty)}
                  </span>
                </div>
              );
            })}
            {items.length > 8 && (
              <p className="text-[10px] text-slate-500 italic">+{items.length - 8} more items</p>
            )}
          </div>
        </div>
      )}
      {(expressSurcharge > 0 || pickupSurcharge > 0 || serviceFee > 0 || promoDiscount > 0) && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }} data-testid="laundry-ticket-price-summary">
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Order breakdown</p>
          <div className="space-y-1 text-xs">
            {itemsSubtotal > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Items subtotal</span>
                <span className="font-medium">{formatFCFA(itemsSubtotal)}</span>
              </div>
            )}
            {expressSurcharge > 0 && (
              <div className="flex justify-between text-orange-700">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Express surcharge
                </span>
                <span className="font-medium">+{formatFCFA(expressSurcharge)}</span>
              </div>
            )}
            {pickupSurcharge > 0 && (
              <div className="flex justify-between text-purple-700">
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Pickup surcharge
                </span>
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
                <span>Promo {promoCode ? `(${promoCode})` : ''}</span>
                <span className="font-medium">-{formatFCFA(promoDiscount)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {notes && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Special instructions</p>
          <p className="text-xs text-slate-700 italic leading-relaxed">&ldquo;{notes}&rdquo;</p>
        </div>
      )}
    </>
  );

  return (
    <BaseTicket
      testId="laundry-ticket"
      accentColor={ACCENT}
      posterSrc={heroImg}
      posterAlt={shopName || 'Shop'}
      posterAspect="square"
      PosterFallbackIcon={Shirt}
      posterFallbackBg="bg-gradient-to-br from-purple-600 to-fuchsia-500"
      posterFallbackIconColor="text-white/80"
      badges={badges}
      title={shopName}
      subtitle={isPressing ? 'Pressing order' : 'Laundry order'}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle="Service Info"
      rightPanelDescription={
        pickupMethod === 'pickup'
          ? 'A rider will collect your items at the agreed time. Please have them packed and ready.'
          : 'Please drop off your items at the shop on the scheduled date.'
      }
      rulesTitle="Service Notes"
      rules={[
        turnaround && `Standard turnaround: ${turnaround} hours.`,
        expressOn && 'Express service: prioritized handling, faster turnaround.',
        'Check items at handover for any discrepancies.',
      ].filter(Boolean)}
    />
  );
}

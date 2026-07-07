// Car rental voucher — built on BaseTicket so the rental confirmation reads
// like a ticket-stub (pickup/return dates, location, extras).
import React from 'react';
import { Car, Calendar, Clock, MapPin, Ticket, User, Sparkles } from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import BaseTicket from './BaseTicket';

const ACCENT = '#0f766e'; // teal-700

const EXTRA_LABELS = {
  driver: 'Professional driver',
  gps: 'GPS',
  child_seat: 'Child seat',
  insurance: 'Full insurance',
  fuel: 'Pre-paid fuel',
  delivery: 'Delivery',
};

export default function CarRentalTicket({ order, formatDate }) {
  const { t } = useTranslation();
  const bd = order?.booking_details || {};
  const carName = bd.car_name || order?.service_name || 'Vehicle';
  const pickupDate = bd.pickup_date;
  const returnDate = bd.return_date;
  const pickupLocation = bd.pickup_location;
  const dropoffLocation = bd.dropoff_location || bd.return_location || pickupLocation;
  const days = bd.days;
  const extras = Array.isArray(bd.extras) ? bd.extras : [];
  const carImage = bd.car_image || (bd.car_images && bd.car_images[0]);
  const carType = bd.car_type || bd.vehicle_type;
  const transmission = bd.transmission;
  const fuelType = bd.fuel_type;
  const seats = bd.seats || bd.car_seats;
  const driverName = bd.firstName && bd.lastName ? `${bd.firstName} ${bd.lastName}` : order?.customer_name;
  const licenseNumber = bd.licenseNumber || bd.license_number;

  const badges = [
    carType && {
      label: carType.replace('_', ' '),
      style: { background: ACCENT, color: '#fff' },
      icon: Car,
    },
    transmission && { label: transmission, variant: 'outline', className: 'text-slate-600' },
    seats && { label: `${seats} seats`, variant: 'outline', className: 'text-slate-600' },
    days && {
      label: `${days} day${days > 1 ? 's' : ''}`,
      style: { background: '#d1fae5', color: '#047857' },
      icon: Clock,
    },
  ].filter(Boolean);

  const metaItems = [
    {
      icon: Calendar,
      label: t('orders.check_in'),
      value: pickupDate && formatDate ? formatDate(pickupDate) : pickupDate || '—',
      sublabel: pickupLocation,
    },
    {
      icon: Calendar,
      label: t('orders.return'),
      value: returnDate && formatDate ? formatDate(returnDate) : returnDate || '—',
      sublabel: dropoffLocation,
    },
    {
      icon: User,
      label: t('orders.holder'),
      value: driverName || '—',
      sublabel: licenseNumber ? `Lic: ${licenseNumber}` : null,
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
      {fuelType && (
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" style={{ color: ACCENT }} />
          Fuel: <span className="text-slate-700 font-medium">{fuelType}</span>
        </div>
      )}
      {extras.length > 0 && (
        <div className="pt-3 border-t border-dashed" style={{ borderColor: `${ACCENT}40` }}>
          <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1.5">Add-ons</p>
          <div className="flex flex-wrap gap-1.5" data-testid="car-rental-ticket-extras">
            {extras.map((e, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-full border bg-teal-50 border-teal-200 text-teal-700"
              >
                {EXTRA_LABELS[e] || e}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <BaseTicket
      testId="car-rental-ticket"
      accentColor={ACCENT}
      posterSrc={carImage}
      posterAlt={carName}
      posterAspect="wide"
      PosterFallbackIcon={Car}
      posterFallbackBg="bg-teal-100"
      posterFallbackIconColor="text-teal-700"
      badges={badges}
      title={carName}
      subtitle={[carType, transmission].filter(Boolean).join(' · ') || null}
      metaItems={metaItems}
      operatorLogo={order?.operator_logo_url}
      operatorName={order?.operator_name}
      extraSections={extraSections}
      rightPanelTitle={t("orders.rental_info")}
      rightPanelDescription={t("orders.car_rental_present_at_counter")}
      rulesTitle={t("orders.rental_notes")}
      rules={[
        'A valid driver\'s license is mandatory at pick-up.',
        'Return the vehicle with the same fuel level unless pre-paid fuel was added.',
        extras.includes('driver') ? 'A professional driver has been arranged for this trip.' : 'A security deposit may be charged on pick-up.',
      ].filter(Boolean)}
    />
  );
}

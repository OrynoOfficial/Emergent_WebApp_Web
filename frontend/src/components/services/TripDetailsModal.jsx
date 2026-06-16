import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bus, MapPin, Clock, Users, Star, Wifi, Coffee, Snowflake,
  Armchair, X, ArrowRight, CalendarDays, Image as ImageIcon,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import LocationMap from '@/components/shared/LocationMap';

const AMENITY_ICONS = {
  wifi: Wifi,
  'air conditioning': Snowflake,
  ac: Snowflake,
  refreshments: Coffee,
  snacks: Coffee,
  'reclining seats': Armchair,
};

/**
 * Bus seat layout preview — purely visual.
 * Renders a 4-across grid with a centre aisle (the classic 2+2 layout)
 * sized to `total_seats`. Booked seats are greyed out if the trip exposes
 * `booked_seats: [num]`.
 */
function SeatLayoutPreview({ totalSeats = 40, bookedSeats = [] }) {
  const rows = Math.ceil(totalSeats / 4);
  const seats = [];
  let n = 1;
  for (let r = 0; r < rows && n <= totalSeats; r++) {
    const row = [];
    for (let c = 0; c < 4 && n <= totalSeats; c++) {
      const isBooked = bookedSeats.includes(n);
      row.push(
        <div
          key={n}
          className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold border ${
            isBooked
              ? 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {n}
        </div>
      );
      n++;
    }
    seats.push(
      <div key={r} className="flex items-center gap-1.5">
        {row.slice(0, 2)}
        <div className="w-3" />
        {row.slice(2, 4)}
      </div>
    );
  }
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-600 uppercase">Seat layout</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-200 border border-slate-200" /> Booked
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 items-center">
        <div className="w-20 h-5 rounded-t-lg bg-slate-300 mb-1.5 flex items-center justify-center text-[10px] text-slate-600 font-semibold">
          Driver
        </div>
        {seats}
      </div>
    </div>
  );
}

export default function TripDetailsModal({ open, onOpenChange, trip, onContinue }) {
  if (!trip) return null;

  const images = trip.vehicle_images || trip.images || [];
  const amenities = trip.amenities || [];
  const lat = trip.pickup_lat ?? trip.operator_lat ?? trip.location?.lat;
  const lon = trip.pickup_lon ?? trip.operator_lon ?? trip.location?.lon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] bg-white p-0 sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        data-testid="travel-prebooking-modal"
      >
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#1565c0] text-white">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Close"
              data-testid="travel-modal-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 pr-12">
            <Badge className="bg-white/20 border-transparent text-white mb-3">
              <Star className="w-3 h-3 mr-1" /> {trip.vehicle_type || 'Standard'}
            </Badge>
            <h2 className="text-2xl font-bold leading-tight">{trip.operator_name}</h2>
            <p className="text-sm text-white/80 mt-1">{trip.vehicle_name || trip.operator_name}</p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-white/70" />
                <span className="font-semibold">{trip.from_city}</span>
                <ArrowRight className="w-4 h-4 text-white/60" />
                <span className="font-semibold">{trip.to_city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/70" />
                <span>{trip.departure_time} → {trip.arrival_time}</span>
                <span className="text-white/60">· {trip.duration}</span>
              </div>
              {trip.tripDate && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-white/70" />
                  <span>{trip.tripDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Left — Bus pictures + seat layout */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Bus pictures
              </h3>
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((img, idx) => (
                    <div key={idx} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                      <img src={img} alt={`Bus ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-[16/8] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-dashed border-slate-200">
                  <div className="text-center">
                    <Bus className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-xs">No photos provided by operator</p>
                  </div>
                </div>
              )}
            </div>

            <SeatLayoutPreview
              totalSeats={trip.total_seats || trip.available_seats || 40}
              bookedSeats={trip.booked_seats || []}
            />

            {amenities.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Onboard amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a, idx) => {
                    const Icon = AMENITY_ICONS[a.toLowerCase()] || Star;
                    return (
                      <Badge key={idx} variant="outline" className="bg-slate-50 capitalize">
                        <Icon className="w-3 h-3 mr-1" />
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right — Operator info + map + CTA */}
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">Operator details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Operator</span>
                  <span className="font-semibold">{trip.operator_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vehicle</span>
                  <span className="font-semibold">{trip.vehicle_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Capacity</span>
                  <span className="font-semibold">{trip.total_seats || trip.available_seats || 40} seats</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Available</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {trip.available_seats ?? trip.total_seats ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Pickup location
              </h4>
              <LocationMap
                lat={lat}
                lon={lon}
                title={trip.operator_name}
                address={trip.pickup_address || trip.operator_address || `${trip.from_city} departure point`}
                height="aspect-[4/3]"
                showGoogleLink
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500">Price</div>
                  <div className="text-2xl font-bold text-[#082c59]">{formatCurrency(trip.price)}</div>
                  <div className="text-xs text-slate-500">per person</div>
                </div>
              </div>
              <Button
                onClick={() => onContinue?.(trip)}
                className="w-full bg-[#082c59] hover:bg-[#0a3a75] rounded-xl py-6 text-base font-semibold"
                data-testid="travel-modal-continue"
              >
                Continue to Book <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

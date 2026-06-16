import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bus, MapPin, Clock, Users, Star, Wifi, Coffee, Snowflake, ShieldCheck,
  Armchair, X, ArrowRight, CalendarDays, Image as ImageIcon, ChevronDown,
  Info, AlertTriangle,
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

// Approximate centre coordinates for Cameroon's major cities — used only as a
// last-resort fallback so the map never renders fully blank. Operator-provided
// pickup coordinates always take precedence.
const CITY_FALLBACK_COORDS = {
  douala: { lat: 4.0511, lon: 9.7679 },
  yaoundé: { lat: 3.848, lon: 11.5021 },
  yaounde: { lat: 3.848, lon: 11.5021 },
  bafoussam: { lat: 5.4781, lon: 10.4179 },
  bamenda: { lat: 5.9597, lon: 10.1463 },
  garoua: { lat: 9.3017, lon: 13.3979 },
  maroua: { lat: 10.591, lon: 14.3158 },
  kribi: { lat: 2.9404, lon: 9.9097 },
  limbe: { lat: 4.0228, lon: 9.1925 },
  buea: { lat: 4.1559, lon: 9.2622 },
  ngaoundere: { lat: 7.3214, lon: 13.5847 },
  ngaoundéré: { lat: 7.3214, lon: 13.5847 },
};

const cityCoords = (city) => {
  if (!city) return null;
  const key = String(city).trim().toLowerCase();
  return CITY_FALLBACK_COORDS[key] || null;
};

/**
 * Bus seat layout preview — purely visual, collapsible.
 * Default state: collapsed (per UX requirement).
 */
function CollapsibleSeatLayout({ totalSeats = 40, bookedSeats = [] }) {
  const [open, setOpen] = useState(false);
  const rows = Math.ceil(totalSeats / 4);
  const available = totalSeats - (bookedSeats?.length || 0);

  const seats = [];
  let n = 1;
  for (let r = 0; r < rows && n <= totalSeats; r++) {
    const row = [];
    for (let c = 0; c < 4 && n <= totalSeats; c++) {
      const isBooked = bookedSeats.includes(n);
      row.push(
        <div
          key={n}
          className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-semibold border transition-colors ${
            isBooked
              ? 'bg-slate-200 text-slate-400 border-slate-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {n}
        </div>
      );
      n++;
    }
    seats.push(
      <div key={r} className="flex items-center justify-center gap-1.5">
        {row.slice(0, 2)}
        <div className="w-4" />
        {row.slice(2, 4)}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-colors"
        data-testid="seat-layout-toggle"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Armchair className="w-4 h-4 text-[#082c59]" />
          <span className="text-sm font-bold text-slate-700">Seat layout</span>
          <span className="text-[11px] text-slate-500">· {available} of {totalSeats} available</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="p-4 bg-slate-50/60 border-t border-slate-200" data-testid="seat-layout-panel">
          <div className="flex items-center justify-between mb-3 text-[11px] text-slate-500">
            <span>Click to preview the bus layout — seats will be selected at booking.</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-slate-200 border border-slate-200" /> Booked
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <div className="w-24 h-6 rounded-t-lg bg-slate-300 mb-2 flex items-center justify-center text-[10px] text-slate-700 font-semibold">
              Driver
            </div>
            {seats}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripDetailsModal({ open, onOpenChange, trip, onContinue }) {
  if (!trip) return null;

  const images = trip.vehicle_images || trip.images || [];
  const amenities = trip.amenities || [];
  // Pickup coordinates: explicit operator-provided values, otherwise city centre.
  const explicitLat = trip.pickup_lat ?? trip.operator_lat ?? trip.location?.lat;
  const explicitLon = trip.pickup_lon ?? trip.operator_lon ?? trip.location?.lon;
  const fallback = (explicitLat == null || explicitLon == null) ? cityCoords(trip.from_city) : null;
  const lat = explicitLat ?? fallback?.lat;
  const lon = explicitLon ?? fallback?.lon;
  const isApproxLocation = (explicitLat == null || explicitLon == null) && !!fallback;

  // Policy data — pulled from the route doc (`policies` is an array of strings)
  const policies = Array.isArray(trip.policies) && trip.policies.length > 0
    ? trip.policies
    : [
        'Arrive 30 minutes before scheduled departure',
        'Valid government-issued ID required at boarding',
        'Free cancellation up to 24 hours before departure',
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] bg-white p-0 sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        data-testid="travel-prebooking-modal"
      >
        {/* HERO — richer, with subtle pattern + glass cards */}
        <div className="relative bg-gradient-to-br from-[#082c59] via-[#0a3a75] to-[#1565c0] text-white overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px, 60px 60px',
          }} />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
            aria-label="Close"
            data-testid="travel-modal-close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative p-6 sm:p-7 pr-14">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-white/20 border-transparent text-white hover:bg-white/25">
                <Star className="w-3 h-3 mr-1" /> {trip.vehicle_type || 'Standard'}
              </Badge>
              <Badge className="bg-emerald-500/90 border-transparent text-white hover:bg-emerald-500">
                <ShieldCheck className="w-3 h-3 mr-1" /> Insured
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{trip.operator_name}</h2>
            <p className="text-sm text-white/80 mt-1">{trip.vehicle_name || trip.operator_name}</p>

            {/* Route + time strip — glass cards */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60">From</div>
                <div className="font-semibold text-sm truncate">{trip.from_city}</div>
                <div className="text-[11px] text-white/70 mt-0.5">{trip.departure_time}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60">To</div>
                <div className="font-semibold text-sm truncate">{trip.to_city}</div>
                <div className="text-[11px] text-white/70 mt-0.5">{trip.arrival_time}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60">Duration</div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/70" />
                  {trip.duration || '~3h 30m'}
                </div>
                <div className="text-[11px] text-white/70 mt-0.5">Direct trip</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/60">Date</div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-white/70" />
                  {trip.tripDate || 'Today'}
                </div>
                <div className="text-[11px] text-white/70 mt-0.5">{trip.available_seats ?? trip.total_seats ?? 40} seats left</div>
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bus pictures */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#082c59]" /> Bus pictures
              </h3>
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((img, idx) => (
                    <div key={idx} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 hover:opacity-90 transition-opacity">
                      <img src={img} alt={`Bus ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-[16/8] rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-slate-400 border border-dashed border-slate-200">
                  <div className="text-center">
                    <Bus className="w-12 h-12 mx-auto mb-2 opacity-60" />
                    <p className="text-xs">No photos provided by operator</p>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible seat layout */}
            <CollapsibleSeatLayout
              totalSeats={trip.total_seats || trip.available_seats || 40}
              bookedSeats={trip.booked_seats || []}
            />

            {/* Onboard amenities */}
            {amenities.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Onboard amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a, idx) => {
                    const Icon = AMENITY_ICONS[a.toLowerCase()] || Star;
                    return (
                      <Badge key={idx} variant="outline" className="bg-slate-50 capitalize text-slate-700 border-slate-200 hover:bg-slate-100">
                        <Icon className="w-3 h-3 mr-1 text-[#082c59]" />
                        {a}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Policies & rules (NEW) */}
            <div data-testid="trip-policies-section">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#082c59]" /> Policies & rules
              </h3>
              <ul className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
                {policies.map((p, idx) => (
                  <li key={idx} className="text-sm text-slate-700 flex gap-2 items-start">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Bus className="w-4 h-4 text-[#082c59]" /> Operator details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Operator</span>
                  <span className="font-semibold text-right">{trip.operator_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vehicle</span>
                  <span className="font-semibold text-right">{trip.vehicle_name || '—'}</span>
                </div>
                {trip.plate_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Plate</span>
                    <Badge variant="outline" className="font-bold bg-[#082c59]/10 text-[#082c59] border-[#082c59]/20">
                      {trip.plate_number}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Capacity</span>
                  <span className="font-semibold">{trip.total_seats || trip.available_seats || 40} seats</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Available</span>
                  <span className="font-semibold flex items-center gap-1 text-emerald-700">
                    <Users className="w-3.5 h-3.5" />
                    {trip.available_seats ?? trip.total_seats ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#082c59]" /> Pickup location
              </h4>
              <LocationMap
                lat={lat}
                lon={lon}
                title={trip.operator_name}
                address={trip.pickup_address || trip.operator_address || `${trip.from_city} departure point`}
                height="aspect-[4/3]"
                showGoogleLink
              />
              {isApproxLocation && (
                <p className="mt-2 text-[11px] text-slate-500 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                  Approximate location — exact pickup point will be confirmed by the operator.
                </p>
              )}
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
                className="w-full bg-[#082c59] hover:bg-[#0a3a75] rounded-xl py-6 text-base font-semibold shadow-md hover:shadow-lg transition-shadow"
                data-testid="travel-modal-continue"
              >
                Continue to Book <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-[11px] text-slate-500 text-center mt-2">
                You won't be charged yet — payment happens on the next step.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

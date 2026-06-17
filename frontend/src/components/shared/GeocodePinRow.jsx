// Reusable "Pin on Map" row used by service editors (Banquet, Hotel,
// Restaurant, …). Renders a status pill + Pin/Re-pin/Clear actions and
// uses OpenStreetMap Nominatim under the hood. Caller owns the
// `latitude` / `longitude` state on its form.
//
// Usage:
//   <GeocodePinRow
//     city={form.city}
//     address={form.address}
//     latitude={form.latitude}
//     longitude={form.longitude}
//     onPin={({ lat, lon }) => updateForm({ latitude: lat, longitude: lon })}
//     onClear={() => updateForm({ latitude: null, longitude: null })}
//   />
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/utils/geocode';

export default function GeocodePinRow({
  city,
  address,
  latitude,
  longitude,
  onPin,
  onClear,
  testIdPrefix = 'geocode',
  helperText = 'No pin yet — customer-facing map will fall back to city centre.',
}) {
  const [busy, setBusy] = useState(false);
  const [hit, setHit] = useState(null);
  const [missed, setMissed] = useState(false);
  const hasPin = typeof latitude === 'number' && typeof longitude === 'number';

  const handlePin = async () => {
    const query = [address, city, 'Cameroon'].filter(Boolean).join(', ');
    if (!query) {
      toast.error('Add a city or address first');
      return;
    }
    setBusy(true);
    setMissed(false);
    try {
      const r = await geocodeAddress(query);
      if (r) {
        setHit(r);
        onPin?.({ lat: r.lat, lon: r.lon, display_name: r.display_name });
        toast.success('Pinned on map');
      } else {
        setHit(null);
        setMissed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    setHit(null);
    setMissed(false);
    onClear?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <MapPin className="w-4 h-4 text-pink-600 flex-shrink-0" />
      <div className="text-xs text-slate-600 mr-auto min-w-0">
        {hasPin ? (
          <span className="text-emerald-700 font-medium" data-testid={`${testIdPrefix}-status`}>
            Pinned · {latitude.toFixed(4)}, {longitude.toFixed(4)}
            {hit?.display_name && (
              <span className="text-slate-500 ml-1.5 hidden md:inline">— {hit.display_name.split(',').slice(0, 2).join(',')}</span>
            )}
          </span>
        ) : missed ? (
          <span className="text-amber-700" data-testid={`${testIdPrefix}-status`}>
            Couldn’t find that address. Try refining the city/address and pin again.
          </span>
        ) : (
          <span className="text-slate-500" data-testid={`${testIdPrefix}-status`}>{helperText}</span>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePin}
        disabled={busy || (!city && !address)}
        data-testid={`${testIdPrefix}-btn`}
      >
        {busy ? 'Pinning…' : hasPin ? 'Re-pin' : 'Pin on Map'}
      </Button>
      {hasPin && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-rose-600 hover:bg-rose-50"
          onClick={handleClear}
          data-testid={`${testIdPrefix}-clear-btn`}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

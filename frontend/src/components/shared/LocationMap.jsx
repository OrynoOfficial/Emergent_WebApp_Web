import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';

// Fix Leaflet default marker icon (global, idempotent)
if (typeof window !== 'undefined' && !L.Icon.Default.prototype._iconUrlPatched) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
  L.Icon.Default.prototype._iconUrlPatched = true;
}

const SERVICE_COLORS = {
  restaurants: '#F59E0B',
  'car-rental': '#3B82F6',
  cinemas: '#8B5CF6',
  events: '#EC4899',
  hotels: '#10B981',
  banquet: '#F97316',
};

export const getServicePinIcon = (type) => {
  const color = SERVICE_COLORS[type] || '#6B7280';
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

/**
 * Reusable Location Map.
 *
 * Props:
 *  - lat, lon (numbers, required for the map to render — otherwise shows fallback)
 *  - title: string shown in the marker popup
 *  - address: string shown in the marker popup
 *  - zoom: default 14
 *  - height: tailwind aspect ratio classes or fixed height (default: aspect-[16/10])
 *  - nearbyPins: array of { id, lat, lon, name, type }
 *  - showGoogleLink: boolean to display the "View in Google Maps >" link
 *  - showHeader: boolean — render the built-in "Explore the area" header
 *  - headerLabel: override the header text (default: "Explore the area")
 *  - className: extra wrapper classes
 *  - rounded: rounded class (default rounded-xl)
 */
export default function LocationMap({
  lat,
  lon,
  title,
  address,
  zoom = 14,
  height = 'aspect-[16/10]',
  nearbyPins = [],
  showGoogleLink = true,
  showHeader = false,
  headerLabel = 'Explore the area',
  className = '',
  rounded = 'rounded-xl',
}) {
  const hasLocation = typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon);
  const center = hasLocation ? [lat, lon] : null;

  const mapBody = (
    <div className={`${height} ${rounded} overflow-hidden bg-slate-100 border border-slate-200`} data-testid="location-map">
      {center ? (
        <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center}>
            <Popup>
              {title && <b>{title}</b>}
              {title && address && <br />}
              {address}
            </Popup>
          </Marker>
          {nearbyPins.map((pin) => (
            <Marker key={pin.id} position={[pin.lat, pin.lon]} icon={getServicePinIcon(pin.type)}>
              <Popup>{pin.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <MapPin className="w-12 h-12" />
        </div>
      )}
    </div>
  );

  if (!showHeader) {
    return (
      <div className={className}>
        {mapBody}
        {address && (
          <p className="font-semibold text-sm text-slate-800 mt-3">{address}</p>
        )}
        {hasLocation && showGoogleLink && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#082c59] hover:underline"
            data-testid="open-in-google-maps"
          >
            View in Google Maps &gt;
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`}>
      <div className="p-5">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-[#082c59]" />
          {headerLabel}
        </h3>
        {mapBody}
        {address && <p className="font-semibold text-sm text-slate-800 mt-3">{address}</p>}
        {hasLocation && showGoogleLink && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#082c59] hover:underline"
            data-testid="open-in-google-maps"
          >
            View in Google Maps &gt;
          </a>
        )}
      </div>
    </div>
  );
}

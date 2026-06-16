import React from 'react';
import {
  Wifi, Car, Utensils, Droplets, Dumbbell, Star, Plane, Landmark,
} from 'lucide-react';

/**
 * Renders the right Lucide icon next to an amenity label.
 * Falls back to a generic Star icon if no keyword matches.
 */
export const AmenityIcon = ({ amenity }) => {
  const getIcon = () => {
    const lower = (amenity || '').toLowerCase();
    if (lower.includes('wifi')) return <Wifi className="h-5 w-5 text-slate-700" />;
    if (lower.includes('parking')) return <Car className="h-5 w-5 text-slate-700" />;
    if (lower.includes('restaurant')) return <Utensils className="h-5 w-5 text-slate-700" />;
    if (lower.includes('pool')) return <Droplets className="h-5 w-5 text-slate-700" />;
    if (lower.includes('gym') || lower.includes('fitness')) return <Dumbbell className="h-5 w-5 text-slate-700" />;
    return <Star className="h-5 w-5 text-slate-700" />;
  };

  return (
    <div className="flex items-center gap-3">
      {getIcon()}
      <span className="text-sm text-slate-800 capitalize">{(amenity || '').replace(/_/g, ' ')}</span>
    </div>
  );
};

/**
 * Inline icon used in "Nearby landmarks" rows.
 * `mode` can be `walk`, `drive`, or anything else (defaults to a Landmark icon).
 */
export const LandmarkIcon = ({ mode }) => {
  switch (mode) {
    case 'walk':
      return <Plane style={{ transform: 'rotate(90deg)' }} className="h-5 w-5 text-slate-500" />;
    case 'drive':
      return <Car className="h-5 w-5 text-slate-500" />;
    default:
      return <Landmark className="h-5 w-5 text-slate-500" />;
  }
};

import { Wifi, Coffee, UtensilsCrossed, Armchair, Star } from 'lucide-react';
import { parse, isValid } from 'date-fns';

/**
 * Safe date parser — returns `backupDate` if the input string fails to parse.
 */
export const safeParse = (dateString, formatString, backupDate = new Date()) => {
  try {
    const parsed = parse(dateString, formatString, new Date());
    if (isValid(parsed)) return parsed;
  } catch (e) {
    // Invalid date format, use backup
  }
  return backupDate;
};

/**
 * Returns the Lucide icon component associated with an amenity label.
 * Falls back to a generic Star icon when no keyword matches.
 */
export const getAmenityIcon = (amenity) => {
  const amenityLower = (amenity || '').toLowerCase();
  if (amenityLower.includes('wifi') || amenityLower.includes('internet')) return Wifi;
  if (amenityLower.includes('coffee') || amenityLower.includes('refreshment') || amenityLower.includes('snack')) return Coffee;
  if (amenityLower.includes('meal') || amenityLower.includes('food')) return UtensilsCrossed;
  if (amenityLower.includes('seat') || amenityLower.includes('comfort')) return Armchair;
  return Star;
};

/**
 * Returns a sensible default amenity list when the trip itself doesn't expose any.
 */
export const getDefaultAmenities = (vehicleType) => {
  const baseAmenities = ['Air Conditioning', 'Comfortable Seats'];
  switch ((vehicleType || '').toLowerCase()) {
    case 'vip': return [...baseAmenities, 'WiFi', 'Refreshments', 'Reclining Seats'];
    case 'comfort': return [...baseAmenities, 'WiFi', 'Snacks'];
    default: return baseAmenities;
  }
};

/**
 * Tailwind classes used on the vehicle-type badge.
 */
export const getVehicleTypeStyle = (vehicleType) => {
  switch ((vehicleType || '').toLowerCase()) {
    case 'vip': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
    case 'comfort': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    default: return 'bg-gradient-to-r from-slate-500 to-slate-600 text-white';
  }
};

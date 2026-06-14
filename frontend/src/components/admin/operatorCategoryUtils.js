// Operator-category helpers, factored out of `OperatorCategoryAssign.jsx`
// so React Refresh (Fast Refresh) doesn't complain about a component file
// exporting non-component values.

import {
  Building2, Armchair, TentTree, Camera, Video, UtensilsCrossed, Sparkles, Music2, Box,
} from 'lucide-react';

// Per-service-area sub-category catalogue. Keys are lower-cased to match
// what the backend `by-service-category` endpoint expects.
export const CATEGORY_CATALOG = {
  banquet: [
    { value: 'hall',           label: 'Halls / Venues', icon: Building2 },
    { value: 'rental_item',    label: 'Rental items',   icon: Armchair },
    { value: 'canopy',         label: 'Canopies',       icon: TentTree },
    { value: 'photographer',   label: 'Photography',    icon: Camera },
    { value: 'videographer',   label: 'Videography',    icon: Video },
    { value: 'catering',       label: 'Catering',       icon: UtensilsCrossed },
    { value: 'decoration',     label: 'Decoration',     icon: Sparkles },
    { value: 'sound_lighting', label: 'Sound & Lighting', icon: Music2 },
    { value: 'other',          label: 'Other',          icon: Box },
  ],
  restaurant: [
    { value: 'cameroonian', label: 'Cameroonian' },
    { value: 'continental', label: 'Continental' },
    { value: 'french',      label: 'French' },
    { value: 'italian',     label: 'Italian' },
    { value: 'asian',       label: 'Asian' },
    { value: 'lebanese',    label: 'Lebanese' },
    { value: 'fast_food',   label: 'Fast food' },
    { value: 'pastry',      label: 'Pastry / Desserts' },
    { value: 'vegan',       label: 'Vegan / Plant-based' },
  ],
  hotel: [
    { value: 'hotel',   label: 'Hotel' },
    { value: 'resort',  label: 'Resort' },
    { value: 'lodge',   label: 'Lodge' },
    { value: 'airbnb',  label: 'Apartments / Airbnb' },
    { value: 'guesthouse', label: 'Guesthouse' },
    // Star tiers — saved as the bare digit so the backend can match
    // `star_rating == 5`.
    { value: '3star', label: '3★' },
    { value: '4star', label: '4★' },
    { value: '5star', label: '5★' },
  ],
  car_rental: [
    { value: 'normal', label: 'Normal' },
    { value: 'vip',    label: 'VIP' },
    { value: 'luxury', label: 'Luxury' },
  ],
  // Add more areas here as they grow sub-categories.
};

// Parse the operator's `service_types` into:
//   - areas: Set of top-level service area names (e.g. "banquet")
//   - cats:  per-area Set of sub-categories (e.g. cats.banquet = Set("photographer"))
export function parseOperatorTags(service_types = []) {
  const areas = new Set();
  const cats = {};
  for (const tag of service_types) {
    if (!tag || typeof tag !== 'string') continue;
    if (tag.includes('.')) {
      const [area, cat] = tag.split('.', 2);
      areas.add(area);
      if (!cats[area]) cats[area] = new Set();
      cats[area].add(cat);
    } else {
      areas.add(tag);
    }
  }
  return { areas, cats };
}

// Inverse: combine `areas` + per-area `cats` back into a flat string array
// suitable for PUT /api/operators/{id}.
export function serializeOperatorTags(areas, cats) {
  const out = new Set();
  for (const a of areas) out.add(a);
  for (const [area, catSet] of Object.entries(cats || {})) {
    for (const c of catSet || []) out.add(`${area}.${c}`);
  }
  return [...out];
}

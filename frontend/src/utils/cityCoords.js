// Lightweight city → lat/lon lookup so live maps render in service modals
// (Banquet, Restaurant, etc.) even when the underlying service doc has no
// geocoded location yet. Backend should eventually persist lat/lon per
// service; this is a graceful fallback so users still see a regional map.

const CAMEROON_CITIES = {
  douala:     { lat: 4.0511,  lon: 9.7679  },
  yaounde:    { lat: 3.8480,  lon: 11.5021 },
  yaoundé:    { lat: 3.8480,  lon: 11.5021 },
  bafoussam:  { lat: 5.4781,  lon: 10.4179 },
  bamenda:    { lat: 5.9631,  lon: 10.1591 },
  buea:       { lat: 4.1559,  lon: 9.2920  },
  limbe:      { lat: 4.0220,  lon: 9.2114  },
  kribi:      { lat: 2.9492,  lon: 9.9094  },
  garoua:     { lat: 9.3265,  lon: 13.3958 },
  ngaoundere: { lat: 7.3203,  lon: 13.5832 },
  ngaoundéré: { lat: 7.3203,  lon: 13.5832 },
  maroua:     { lat: 10.591,  lon: 14.3158 },
  bertoua:    { lat: 4.5775,  lon: 13.6846 },
  ebolowa:    { lat: 2.9000,  lon: 11.1500 },
  edea:       { lat: 3.7997,  lon: 10.1340 },
  édéa:       { lat: 3.7997,  lon: 10.1340 },
  kumba:      { lat: 4.6363,  lon: 9.4469  },
  dschang:    { lat: 5.4458,  lon: 10.0533 },
};

/**
 * Resolve a city name → {lat, lon}. Returns null when the city isn't on
 * the lookup list. Case- and accent-tolerant.
 */
export function getCityCoords(city) {
  if (!city || typeof city !== 'string') return null;
  const key = city.trim().toLowerCase();
  return CAMEROON_CITIES[key] || null;
}

/**
 * Pull the best lat/lon for a service-like doc. Order of preference:
 *   1. `latitude` / `longitude` top-level fields
 *   2. `location.lat` / `location.lon`
 *   3. City fallback via `getCityCoords(svc.city)`
 * Returns { lat, lon } | null.
 */
export function getServiceCoords(svc) {
  if (!svc) return null;
  const lat = svc.latitude ?? svc.location?.lat;
  const lon = svc.longitude ?? svc.location?.lon;
  if (typeof lat === 'number' && typeof lon === 'number') {
    return { lat, lon };
  }
  return getCityCoords(svc.city);
}

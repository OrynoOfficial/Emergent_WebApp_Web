// OpenStreetMap Nominatim geocoder.
//
// Free and key-less. Usage policy: <=1 req/sec, set User-Agent, no abusive
// bulk querying. We only fire this from operator-side forms (one-off per
// save), so we stay well under the limit.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a free-form query → { lat, lon, display_name } | null.
 *
 * @param {string} query  free-form address (e.g. "Rue Joss, Douala, Cameroon")
 * @param {object} [opts]
 * @param {string} [opts.country='CM'] ISO2 country code biases results
 * @param {AbortSignal} [opts.signal]
 */
export async function geocodeAddress(query, { country = 'CM', signal } = {}) {
  const q = (query || '').trim();
  if (!q) return null;
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  if (country) params.set('countrycodes', country.toLowerCase());

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return null;
    const arr = await res.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    return {
      lat: parseFloat(hit.lat),
      lon: parseFloat(hit.lon),
      display_name: hit.display_name || '',
    };
  } catch (err) {
    // Network error, aborted, or rate-limited — caller should fall back to
    // the city-centroid lookup in cityCoords.js.
    if (err?.name !== 'AbortError') {
      // eslint-disable-next-line no-console
      console.warn('Nominatim geocoder failed:', err);
    }
    return null;
  }
}

/**
 * Tiny localStorage-backed store for user preferences that need to be
 * available synchronously (without awaiting /users/me/preferences) for the
 * first paint — e.g. when computing the default landing path on login,
 * choosing page sizes for tables, or formatting distances.
 *
 * AccessibilityBridge + Settings page write to this store every time the
 * user saves new preferences. Read-only on the consumer side.
 */

const KEYS = {
  DEFAULT_LANDING_PAGE: 'oryno_landing',
  DISTANCE_UNIT: 'oryno_distance_unit',
  TEMPERATURE_UNIT: 'oryno_temp_unit',
  NUMBER_FORMAT: 'oryno_number_format',
  RESULTS_PER_PAGE: 'oryno_results_per_page',
  DEFAULT_SEARCH_RADIUS_KM: 'oryno_search_radius_km',
  MARKETING_OPT_IN: 'oryno_marketing_opt_in',
  SHOW_PROFILE_PUBLICLY: 'oryno_show_profile_publicly',
  SHARE_USAGE_DATA: 'oryno_share_usage_data',
};

const read = (k) => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; }
  catch { return null; }
};
const write = (k, v) => {
  try {
    if (v === null || v === undefined || v === '') localStorage.removeItem(k);
    else localStorage.setItem(k, String(v));
  } catch { /* ignore */ }
};

// ── Getters with sensible defaults ──────────────────────────────────────
export const getDefaultLandingPage = () => read(KEYS.DEFAULT_LANDING_PAGE) || 'auto';
export const getDistanceUnit = () => read(KEYS.DISTANCE_UNIT) || 'km';
export const getTemperatureUnit = () => read(KEYS.TEMPERATURE_UNIT) || 'celsius';
export const getNumberFormat = () => read(KEYS.NUMBER_FORMAT) || 'fr';
export const getResultsPerPage = () => {
  const v = parseInt(read(KEYS.RESULTS_PER_PAGE), 10);
  return Number.isFinite(v) && v > 0 ? v : 20;
};
export const getDefaultSearchRadiusKm = () => {
  const v = parseInt(read(KEYS.DEFAULT_SEARCH_RADIUS_KM), 10);
  return Number.isFinite(v) && v > 0 ? v : 25;
};
export const isMarketingOptIn = () => read(KEYS.MARKETING_OPT_IN) === 'true';
export const isProfilePublic = () => read(KEYS.SHOW_PROFILE_PUBLICLY) === 'true';
export const isShareUsageData = () => read(KEYS.SHARE_USAGE_DATA) !== 'false'; // default true

// ── Bulk write — call once after /users/me/preferences resolves ─────────
export const syncPreferencesToLocal = (prefs = {}) => {
  if (!prefs) return;
  if (prefs.default_landing_page !== undefined) write(KEYS.DEFAULT_LANDING_PAGE, prefs.default_landing_page);
  if (prefs.distance_unit !== undefined) write(KEYS.DISTANCE_UNIT, prefs.distance_unit);
  if (prefs.temperature_unit !== undefined) write(KEYS.TEMPERATURE_UNIT, prefs.temperature_unit);
  if (prefs.number_format !== undefined) write(KEYS.NUMBER_FORMAT, prefs.number_format);
  if (prefs.results_per_page !== undefined) write(KEYS.RESULTS_PER_PAGE, prefs.results_per_page);
  if (prefs.default_search_radius_km !== undefined) write(KEYS.DEFAULT_SEARCH_RADIUS_KM, prefs.default_search_radius_km);
  if (prefs.marketing_opt_in !== undefined) write(KEYS.MARKETING_OPT_IN, prefs.marketing_opt_in);
  if (prefs.show_profile_publicly !== undefined) write(KEYS.SHOW_PROFILE_PUBLICLY, prefs.show_profile_publicly);
  if (prefs.share_usage_data !== undefined) write(KEYS.SHARE_USAGE_DATA, prefs.share_usage_data);
};

// ── Helpers that consume the prefs ───────────────────────────────────────
/** Convert kilometers to the user-preferred display unit ("km" or "mi"). */
export const formatDistance = (km) => {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '—';
  if (getDistanceUnit() === 'mi') {
    const mi = Number(km) * 0.621371;
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  return `${Number(km).toFixed(Number(km) < 10 ? 1 : 0)} km`;
};

/** Format a number using the user-selected separator preference. */
export const formatNumber = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const locale = getNumberFormat() === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.NumberFormat(locale).format(n);
};

export { KEYS as PREF_KEYS };

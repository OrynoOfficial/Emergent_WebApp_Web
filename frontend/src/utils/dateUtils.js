/**
 * Date and Time Utilities for Oryno
 * Timezone is dynamic and taken from (in order):
 *   1. The user's saved preference  (auth-context -> localStorage "oryno_tz")
 *   2. The browser's detected IANA timezone (Intl.DateTimeFormat)
 *   3. 'Africa/Douala' as the final fallback (platform default)
 */

const DEFAULT_FALLBACK = 'Africa/Douala';
const LOCALE = 'en-GB';
export const TIMEZONE_KEY = 'oryno_tz';
export const DATE_FORMAT_KEY = 'oryno_date_format';
export const TIME_FORMAT_KEY = 'oryno_time_format';

const readLocal = (key) => {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
};

/** User's preferred date format. One of: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD MMM YYYY. Default DD/MM/YYYY. */
export const getDateFormat = () => readLocal(DATE_FORMAT_KEY) || 'DD/MM/YYYY';
export const setDateFormat = (v) => {
  try { v ? localStorage.setItem(DATE_FORMAT_KEY, v) : localStorage.removeItem(DATE_FORMAT_KEY); } catch { /* ignore */ }
};

/** User's preferred clock format: '24h' (default) or '12h'. */
export const getTimeFormat = () => readLocal(TIME_FORMAT_KEY) || '24h';
export const setTimeFormat = (v) => {
  try { v ? localStorage.setItem(TIME_FORMAT_KEY, v) : localStorage.removeItem(TIME_FORMAT_KEY); } catch { /* ignore */ }
};

// Month abbreviations for the "DD MMM YYYY" template
const MONTHS_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Detect the browser's current IANA timezone string. */
export const detectBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_FALLBACK;
  } catch {
    return DEFAULT_FALLBACK;
  }
};

/** Get the effective timezone to use for all date formatting. */
export const getTimezone = () => {
  try {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(TIMEZONE_KEY);
    if (saved) return saved;
  } catch { /* ignore */ }
  return detectBrowserTimezone();
};

/** Persist the user's preferred timezone so it survives page reloads. */
export const setTimezone = (tz) => {
  try {
    if (tz) localStorage.setItem(TIMEZONE_KEY, tz);
    else localStorage.removeItem(TIMEZONE_KEY);
  } catch { /* ignore */ }
};

export const TIMEZONE = getTimezone();

// ---- Internal helpers ----
const toDate = (input) => {
  if (input == null || input === '') return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  // Date-only "YYYY-MM-DD" → treat as local midnight (avoid UTC drift)
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // Naive ISO datetime (no timezone offset) — backend uses datetime.utcnow(),
  // which Pydantic serializes WITHOUT a trailing 'Z' or '+00:00'.  JavaScript
  // would otherwise parse those strings as local time and shift the value by
  // the browser's UTC offset.  Assume UTC in that case.
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(input)) {
    const d = new Date(input + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
};

const partsInTz = (date, tz) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  // some engines return "24" for hour — normalize to "00"
  if (parts.hour === '24') parts.hour = '00';
  return parts;
};

// ---- Public formatters (all timezone-aware) ----

/** Check if a date is today (in the active timezone). */
export const isToday = (input) => {
  const d = toDate(input);
  if (!d) return false;
  const tz = getTimezone();
  const a = partsInTz(d, tz);
  const b = partsInTz(new Date(), tz);
  return a.year === b.year && a.month === b.month && a.day === b.day;
};

/**
 * Check whether a datetime has passed.
 * @param {string|Date} dateInput
 * @param {string} [timeStr] optional "HH:mm" or "HH:mm AM/PM" in the active TZ
 */
export const isPast = (dateInput, timeStr = null) => {
  const d = toDate(dateInput);
  if (!d) return false;
  if (!timeStr) return d.getTime() < Date.now();
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return d.getTime() < Date.now();
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];
  if (period) {
    if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  const combined = new Date(d);
  combined.setHours(hours, minutes, 0, 0);
  return combined.getTime() < Date.now();
};

export const isShowtimePast = (dateStr, timeStr) => isPast(dateStr, timeStr);

/** Apply the user's preferred date format template to a parts dict. */
const applyDateFormat = (p) => {
  switch (getDateFormat()) {
    case 'MM/DD/YYYY': return `${p.month}/${p.day}/${p.year}`;
    case 'YYYY-MM-DD': return `${p.year}-${p.month}-${p.day}`;
    case 'DD MMM YYYY': return `${p.day} ${MONTHS_ABBR[Number(p.month) - 1] || p.month} ${p.year}`;
    case 'DD/MM/YYYY':
    default:           return `${p.day}/${p.month}/${p.year}`;
  }
};

/** Apply the user's preferred clock format (24h vs 12h) to a parts dict. */
const applyTimeFormat = (p) => {
  if (getTimeFormat() === '12h') {
    let h = Number(p.hour);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${p.minute} ${period}`;
  }
  return `${p.hour}:${p.minute}`;
};

/** Date formatted with the user's selected date_format preference. */
export const formatDate = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  return applyDateFormat(partsInTz(d, getTimezone()));
};

/** Date + time formatted with the user's selected date_format & time_format prefs. */
export const formatDateTime = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  const p = partsInTz(d, getTimezone());
  return `${applyDateFormat(p)} ${applyTimeFormat(p)}`;
};

/** Clock time honoring the user's time_format preference. */
export const formatTime = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  return applyTimeFormat(partsInTz(d, getTimezone()));
};

/** DD Month YYYY (long month) in the active timezone. */
export const formatDateLong = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  try {
    return d.toLocaleDateString(LOCALE, {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: getTimezone(),
    });
  } catch {
    return formatDate(d);
  }
};

/** DD Mon YYYY (short month) in the active timezone. */
export const formatDateShort = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  try {
    return d.toLocaleDateString(LOCALE, {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: getTimezone(),
    });
  } catch {
    return formatDate(d);
  }
};

/** Relative "2 hours ago" style; falls back to formatDate for > 7d. */
export const getTimeAgo = (input) => {
  const d = toDate(input);
  if (!d) return '-';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(d);
};

/** YYYY-MM-DD for <input type="date"> in the active timezone. */
export const formatDateForInput = (input) => {
  const d = toDate(input);
  if (!d) return '';
  const p = partsInTz(d, getTimezone());
  return `${p.year}-${p.month}-${p.day}`;
};

/** Parse DD.MM.YYYY → Date (local midnight). */
export const parseDateString = (s) => {
  if (!s) return null;
  const parts = String(s).split('.');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if ([day, month, year].some(Number.isNaN)) return null;
  return new Date(year, month, day);
};

export const getCurrentDate = () => new Date();

/** Format XAF currency using fr-CM. */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency', currency: 'XAF',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('fr-CM').format(num);
};

export default {
  formatDate,
  formatDateTime,
  formatDateLong,
  formatDateShort,
  formatTime,
  getTimeAgo,
  formatDateForInput,
  parseDateString,
  getCurrentDate,
  formatCurrency,
  formatNumber,
  getTimezone,
  setTimezone,
  detectBrowserTimezone,
  TIMEZONE,
  TIMEZONE_KEY,
  LOCALE,
};

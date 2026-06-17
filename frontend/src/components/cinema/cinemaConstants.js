// Shared constants & helpers for the Cinema Management page and its dialogs.
// Extracted from /app/frontend/src/pages/management/CinemaManagement.jsx so the
// page file stays readable and the dialog modals can live in their own files.

export const PAGE_SIZE = 12;

export const CHART_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const CINEMA_AMENITIES = [
  '3d', 'imax', 'dolby_atmos', 'vip_seating', 'parking', 'snack_bar', 'lounge', 'wheelchair_access',
];

export const FILM_GENRE_OPTIONS = [
  'Thriller', 'Action', 'Comedy', 'Horror', 'Documentary', 'Adventure',
  'Crime', 'Drama', 'Romance', 'Sci-Fi', 'Musical', 'Fantasy',
  'Family/Children', 'Animation',
];

export const WEEKDAY_OPTIONS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

export const SCREEN_TYPES = ['2d', '3d', 'imax', 'dolby_atmos', 'vip'];

export const MOVIE_STATUSES = [
  { value: 'now_showing', label: 'Now Showing' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

export const DEFAULT_CINEMA_FORM = {
  name: '',
  description: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  screens: [],
  amenities: [],
  operating_hours: {},
  images: [],
  operator_id: '',
  operator_name: '',
};

export const DEFAULT_MOVIE_FORM = {
  title: '',
  genre: [],
  duration: '',
  rating: 'PG-13',
  description: '',
  poster_url: '',
  trailer_url: '',
  director: '',
  cast: '',
  language: 'English',
  release_date: '',
  imdb_rating: '',
  status: 'now_showing', // now_showing | coming_soon
  operator_id: '',
  operator_name: '',
};

export const DEFAULT_SHOWTIME_FORM = {
  cinema_id: '',
  film_id: '',
  screen_name: '',
  screen_type: '2d',
  show_date: '',
  show_time: '',
  end_time: '',
  price: '',
  vip_price: '', // Only used when the selected screen has VIP rows configured
  child_price: '', // Optional — when blank, the Child counter is hidden on the booking page
  senior_price: '', // Optional — when blank, the Senior counter is hidden on the booking page
  total_seats: 100,
  // Recurrence (front-end only; expanded into multiple showtimes on save)
  repeat_mode: 'single', // 'single' | 'recurring'
  repeat_end_date: '',
  repeat_days: [], // array of 0-6 (Sun..Sat)
  refund_policy: null, // {preset: 'strict'|'standard'|'flexible'} | null
};

// Expand recurrence to a list of concrete dates between [start, end] inclusive,
// keeping only the dates whose JS weekday is in repeat_days.
export const computeRecurringDates = (startStr, endStr, daysOfWeek) => {
  if (!startStr || !endStr || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (daysOfWeek.includes(cur.getDay())) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      out.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

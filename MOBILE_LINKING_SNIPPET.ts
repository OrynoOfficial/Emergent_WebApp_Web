// /src/lib/orynoLinking.ts
// ──────────────────────────────────────────────────────────────────────────
// Drop-in deep-link parser for Oryno mobile.
//
// Handles BOTH:
//   • Custom scheme:  oryno://services/hotels/results?destination=Douala
//   • Universal link: https://app.oryno.tech/services/hotels/results?…
//
// Wire into React Navigation's `NavigationContainer linking` prop and you get:
//   • Cold-start from push/email/SMS links → land on the right screen
//   • Warm-start (app already running) → also routes correctly
//   • Query params arrive as a typed object on route.params.search
//
// Why we keep the URL surface identical to the web app: the web app is the
// agreed source of truth. Mirroring its routes means email + SMS + push
// payloads work on EITHER platform without us maintaining two link tables.
// ──────────────────────────────────────────────────────────────────────────

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

// All hosts/schemes we accept. Add staging here if/when it exists.
const PREFIXES = [
  Linking.createURL('/'),                  // oryno://  (works in dev + prod builds)
  'oryno://',                              // explicit scheme fallback
  'https://app.oryno.tech',                // production universal link
  'https://www.oryno.tech',
  'https://oryno.tech',
];

// Coerce URLSearchParams string values back to the types the web app uses.
// Keep this aligned with the search-form `useState` initial shapes in
// /app/frontend/src/pages/services/*Search.jsx — see MOBILE_SEARCH_SPEC.md.
const COERCERS: Record<string, (v: string) => unknown> = {
  // ints
  rooms: Number, guests: Number, passengers: Number, tickets: Number,
  weight_kg: Number, length_cm: Number, width_cm: Number, height_cm: Number,
  // booleans
  with_driver: (v) => v === 'true' || v === '1',
  // dates stay as YYYY-MM-DD strings; let the screen parse with date-fns
};

export function parseSearchParams(url: string): Record<string, unknown> {
  const { queryParams } = Linking.parse(url);
  if (!queryParams) return {};
  const out: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(queryParams)) {
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    out[k] = COERCERS[k] ? COERCERS[k](value as string) : value;
  }
  return out;
}

// Build a deep link from a screen name + params. Use this when generating
// share buttons or push-notification payloads on the backend's side.
export function buildOrynoLink(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
  { universal = false }: { universal?: boolean } = {},
): string {
  const base = universal ? 'https://app.oryno.tech' : 'oryno://';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${base}${cleanPath}?${qs}` : `${base}${cleanPath}`;
}

// React Navigation linking config. Pass to <NavigationContainer linking={…} />.
// Screen names below must match the names you register in your stack/tab.
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: PREFIXES,
  config: {
    screens: {
      // Auth flow
      Login: 'login',
      Register: 'register',
      VerifyAccount: 'verify-account',

      // Bottom-tab roots
      Home: 'dashboard',
      Orders: 'orders',
      Profile: 'settings',

      // Services — mirror the web routes 1:1
      HotelSearch:    'services/hotels',
      HotelResults:   'services/hotels/results',
      HotelDetails:   'services/hotels/details/:id',
      HotelBooking:   'services/hotels/booking',

      RestaurantSearch:  'services/restaurants',
      RestaurantResults: 'services/restaurants/results',
      RestaurantDetails: 'services/restaurants/details/:id',
      RestaurantBooking: 'services/restaurants/booking',
      RestaurantMenu:    'services/restaurants/menu',

      TravelSearch:  'services/travel',
      TravelResults: 'services/travel/results',
      TravelBooking: 'services/travel/booking',

      CarRentalSearch:  'services/car-rental',
      CarRentalResults: 'services/car-rental/results',
      CarRentalDetails: 'services/car-rental/details/:id',
      CarRentalBooking: 'services/car-rental/booking',

      EventsSearch:  'services/events',
      EventsResults: 'services/events/results',
      EventsBooking: 'services/events/booking',
      ShowtimeDetails: 'services/showtimes/:id',

      CinemaSearch:   'services/cinema',
      CinemaResults:  'services/cinema/results',
      FilmDetails:    'services/cinema/film/:id',
      CinemaBooking:  'services/cinema/booking/:showtimeId',

      LaundrySearch:  'services/laundry',
      LaundryResults: 'services/laundry/results',
      LaundryBooking: 'services/laundry/booking/:id',

      BanquetSearch:   'services/banquet',
      BanquetResults:  'services/banquet/results',
      BanquetBooking:  'services/banquet/booking/:id',
      BanquetCheckout: 'services/banquet/checkout',

      PackagesSearch:  'services/packages',
      PackagesResults: 'services/packages/results',
      PackagesBooking: 'services/packages/booking/:id',

      // Order detail (used by push-notification taps)
      OrderDetail: 'orders/:id',

      // Catch-all 404 inside the app
      NotFound: '*',
    },
  },

  // Custom subscribe handles the initial cold-start link AND ensures
  // we always pass a parsed `search` object to the screen for convenience.
  async getInitialURL() {
    return (await Linking.getInitialURL()) ?? null;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => sub.remove();
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Usage inside a results screen:
//
// import { useRoute } from '@react-navigation/native';
// import { parseSearchParams } from '@/lib/orynoLinking';
//
// export function HotelResultsScreen() {
//   const route = useRoute();
//   // React Navigation already populates route.params from the URL,
//   // but values arrive as strings. Re-parse + coerce in one line:
//   const search = parseSearchParams(`oryno://?${new URLSearchParams(route.params as any)}`);
//   // search → { destination: 'Douala', check_in: '2026-03-01', rooms: 2, guests: 4 }
//   …
// }
//
// Building a link to send in a push payload (backend side):
//
//   buildOrynoLink('/services/hotels/details/' + hotelId)
//     → "oryno:///services/hotels/details/abc-123"
//   buildOrynoLink('/orders/' + orderId, {}, { universal: true })
//     → "https://app.oryno.tech/orders/xyz-789"
//
// ──────────────────────────────────────────────────────────────────────────

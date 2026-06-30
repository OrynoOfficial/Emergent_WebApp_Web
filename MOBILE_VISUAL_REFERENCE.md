# Oryno Mobile — Visual Reference & Design System

> **For the mobile agent:** Screenshots are great, but the JSX/Tailwind source IS the visual spec — every color, font size, spacing value, and animation curve is in there exactly as it renders. Read the files listed below from the GitHub repo. Pair them with `MOBILE_API_CONTRACT.md` + `MOBILE_SEARCH_SPEC.md` and you have everything needed to match the web app pixel-for-pixel (adapted to native conventions, of course — bottom tabs, swipe gestures, native modals).

---

## 1. Design tokens (use these everywhere)

### Colors
```ts
const colors = {
  // Brand
  primary: '#082c59',          // deep navy — used for hero bands, primary CTA fill
  primaryHover: '#0a3470',
  accent: '#f59e0b',           // amber — used for "Important Info" rail headlines & badges
  accentLight: '#fef3c7',

  // Service category accents (match the ticket components — see §4)
  eventAccent:      '#6366f1', // indigo (per-event class colors override this)
  cinemaAccent:     '#0891b2', // cyan-600
  travelAccent:     '#082c59', // navy (brand)
  hotelAccent:      '#b45309', // amber-700
  restaurantAccent: '#c2410c', // orange-700
  carRentalAccent:  '#0f766e', // teal-700
  laundryAccent:    '#7e22ce', // purple-700

  // Neutrals (slate ramp from Tailwind)
  slate50:  '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  white: '#ffffff',

  // Semantic
  success: '#10b981',  // emerald-500
  warning: '#f59e0b',  // amber-500
  danger:  '#ef4444',  // red-500
  info:    '#3b82f6',  // blue-500
};
```

### Typography
```ts
// Mobile base 16 (NOT 14.4 — that 90% web density doesn't transfer to native).
// Use Apple SF/SF Pro on iOS, Roboto on Android (system defaults).
const type = {
  h1:     { size: 28, weight: '700', lineHeight: 34 },  // page titles
  h2:     { size: 22, weight: '700', lineHeight: 28 },  // section headers
  h3:     { size: 18, weight: '600', lineHeight: 24 },  // card titles
  body:   { size: 15, weight: '400', lineHeight: 22 },
  bodyBold: { size: 15, weight: '600', lineHeight: 22 },
  caption:{ size: 13, weight: '500', lineHeight: 18 },  // meta labels
  micro:  { size: 11, weight: '600', lineHeight: 14 },  // uppercase eyebrows ("FILTERS:", "WHEN", "WHERE")
};
```

### Spacing
```ts
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 };
const radius  = { sm: 6, md: 10, lg: 14, xl: 20 };
```

### Currency
Use `formatFCFA(n)` everywhere: thousands separator, NO decimals, trailing ` FCFA`. Examples: `45,000 FCFA`, `5,150 FCFA`, `207,500 FCFA`.

---

## 2. The full UX flow (web app pages mapped to source files)

For each service, the user journey is **Search → Results → Details → Booking form → Payment → Order/Ticket**. Read these files top-to-bottom and you'll see exact layout, props, and state shape:

### Hotels
| Step | Source file (read in GitHub) |
|---|---|
| Search form | `/app/frontend/src/pages/services/HotelsSearch.jsx` |
| Results list + filters | `/app/frontend/src/pages/services/HotelsResults.jsx` |
| Detail page | `/app/frontend/src/pages/services/HotelDetails.jsx` |
| Booking form | `/app/frontend/src/pages/services/HotelBooking.jsx` |
| Order ticket | `/app/frontend/src/components/tickets/HotelTicket.jsx` |

### Restaurants
| Step | Source file |
|---|---|
| Search | `RestaurantsSearch.jsx` |
| Results | `RestaurantsResults.jsx` |
| Detail | `RestaurantDetails.jsx` + `RestaurantMenu.jsx` |
| Booking | `RestaurantBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/RestaurantTicket.jsx` |

### Travel (bus)
| Step | Source file |
|---|---|
| Search | `TravelSearch.jsx` |
| Results | `TravelResults.jsx` (no separate detail — click a trip → booking) |
| Booking (seat picker) | `TravelBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/TravelTicket.jsx` |

### Car Rental
| Step | Source file |
|---|---|
| Search | `CarRentalSearch.jsx` |
| Results | `CarRentalResults.jsx` |
| Detail | `CarRentalDetails.jsx` |
| Booking | `CarRentalBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/CarRentalTicket.jsx` |

### Events
| Step | Source file |
|---|---|
| Search | `EventsSearch.jsx` |
| Results | `EventsResults.jsx` |
| Booking (class picker) | `EventBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/EventTicket.jsx` |

### Cinema
| Step | Source file |
|---|---|
| Search | `CinemaSearch.jsx` |
| Results (film grid) | `CinemaResults.jsx` |
| Film detail (overview + showtimes) | `FilmDetails.jsx` |
| Showtime detail (seat map preview) | `ShowtimeDetails.jsx` |
| Booking (seat selection + ticket counts) | `CinemaBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/CinemaTicket.jsx` |

### Laundry / Pressing
| Step | Source file |
|---|---|
| Search | `LaundrySearch.jsx` |
| Results | `LaundryResults.jsx` |
| Booking (items + logistics) | `LaundryBooking.jsx` |
| Ticket | `/app/frontend/src/components/tickets/LaundryTicket.jsx` |

### Banquet & Packages
Same pattern — `*Search.jsx` → `*Results.jsx` → `*Booking.jsx`. No dedicated ticket variant yet (use a generic ticket card based on `BaseTicket`).

---

## 3. The booking flow logic (shared across ALL services)

This is the **canonical happy path** baked into every `*Booking.jsx` file on the web:

```
1. User taps "Book" on a Results card or Detail page.
   → Navigate to /services/<category>/booking with state { service_id, ... }

2. Booking screen renders a multi-step form:
   - Step 1: Service-specific details (dates/times/quantities/seats/items)
   - Step 2: Contact info (firstName, lastName, phone, email)
   - Step 3: Payment method (Stripe Checkout | MTN MoMo | Orange Money)
   - Step 4: Summary + "Confirm & Pay" button

3. On submit:
   POST /api/orders/create with:
     {
       service_type: 'hotel' | 'restaurant' | 'travel' | ...,
       service_id: '<uuid>',
       booking_details: { ...form fields... },
       total_amount: <integer FCFA>,
       payment_method: 'stripe' | 'mtn' | 'orange',
     }
   → returns { order_id, order_number, total_amount }

4. Based on payment_method:
   • Stripe:   POST /api/checkout/session { order_id } → opens checkout_url in
               an in-app browser (WebBrowser.openAuthSessionAsync). After return,
               poll GET /api/checkout/status/{session_id} for completion.
   • MoMo:     POST /api/payments/initiate { order_id, payment_method, phone }
               → push USSD/prompt to user's phone; poll GET /api/payments/status.

5. On success → navigate to OrderDetail screen showing the new ticket.
   The OrderDetail screen renders the service-specific ticket component
   (see §4 below) inside a scrollable Customer Info + Payment Summary layout.
```

**Mirror this on mobile.** The 4-step wizard pattern works beautifully as a swipeable stack (or 4 vertically stacked sections on a single scrollable screen, which is what the web does — pick whichever fits native UX better).

---

## 4. Ticket components — shared visual paradigm

This is the most important visual reference. **All 7 service tickets share the same `BaseTicket` primitive** and only vary by accent color + service-specific extras. Once you mirror `BaseTicket` in React Native, every other ticket becomes a thin wrapper.

### Anatomy (apply identically on mobile)
```
┌─────────────────────────────────────────────────┐
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔ accent band (1.5px gradient) ▔▔▔ │
│                                                 │
│  ┌──────┐  [BADGE 1] [BADGE 2] [BADGE 3]       │
│  │poster│  Service Title                  ●○○ │ ← perforation dot
│  └──────┘  subtitle line                       │   on the divider
│ ─ ─ ─ ─ ─ ─ ─ dashed border ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  📍 WHEN          📍 WHERE                     │ ← 2-col meta grid
│  Thu Dec 31       Pytest Venue                 │   (eyebrow + value)
│  20:00            123 Test Blvd · Douala       │
│                                                 │
│  📍 HOLDER        📍 PAID                       │
│  John Doe         5,150 FCFA                   │
│                                                 │
│  ┌─ EXTRAS (service-specific) ─────────────┐   │
│  │  Includes: VIP seat ✓ Welcome drink ✓   │   │
│  │  Or items list / luggage manifest / etc │   │
│  └──────────────────────────────────────────┘  │
│                                                 │
│ ▁▁▁▁▁▁▁▁▁▁▁▁▁ accent band (1.5px gradient) ▁▁▁ │
└────────────────────────┬──────────────────────────
                         │   Right panel (dark slate-900)
                       ●○│   IMPORTANT INFO  (amber-400, uppercase)
                         │   Present this ticket at the venue entrance.
                         │
                         │   VENUE RULES
                         │   ✓ No outside drinks
                         │   ✓ Photo ID required
```

### Read this file FIRST
`/app/frontend/src/components/tickets/BaseTicket.jsx` — the single shared component. ~200 lines, fully self-contained, all the layout math is in there.

Then read the service-specific wrappers (each is ~150–200 lines and very thin):
- `EventTicket.jsx` (indigo, class colors override)
- `TravelTicket.jsx` (navy + plate badge + luggage manifest)
- `CinemaTicket.jsx` (cyan + film poster portrait + director/cast/synopsis)
- `HotelTicket.jsx` (amber + check-in/out + room policies)
- `RestaurantTicket.jsx` (orange + items pre-order list)
- `CarRentalTicket.jsx` (teal + pickup/return + add-ons)
- `LaundryTicket.jsx` (purple + items + price surcharges)

### Mobile adaptation note
The two-panel layout (left face + right dark "back" rail) is a **desktop affordance** — on a phone in portrait orientation, **stack them vertically**: left face on top, dark "Important Info" rail below, with the perforation dots sitting on the horizontal divider instead of the vertical one. The accent bands stay top + bottom. Everything else stays identical.

---

## 5. Buttons, cards, and chips (the rest of the UI vocabulary)

### Primary CTA (used on "Book Now", "Confirm & Pay")
```ts
{
  backgroundColor: colors.primary, // #082c59
  borderRadius: radius.md,         // 10
  paddingHorizontal: 20,
  paddingVertical: 14,
  fontSize: 15,
  fontWeight: '600',
  color: colors.white,
  // pressed/hovered: opacity 0.92, scale 0.98
}
```

### Secondary / outline button
```ts
{
  backgroundColor: 'transparent',
  borderColor: colors.slate300,
  borderWidth: 1,
  borderRadius: radius.md,
  color: colors.slate700,
  // same padding as primary
}
```

### Result card (every search-result list item)
```ts
{
  backgroundColor: colors.white,
  borderRadius: radius.lg,         // 14
  borderWidth: 1,
  borderColor: colors.slate200,
  padding: 12,
  shadow: 'sm',                    // very subtle drop shadow
  gap: 8,
  // hero image: 16:10 aspect ratio, borderRadius 10
  // title: type.h3
  // meta row: type.caption + slate-500 icon
  // price: bold, primary color, type.h3
}
```

### Filter chip (active state = brand color fill)
```ts
// idle
{
  backgroundColor: colors.slate100,
  borderRadius: 999,               // fully pill
  paddingHorizontal: 10,
  paddingVertical: 6,
  fontSize: 11,
  color: colors.slate700,
}
// active
{ backgroundColor: colors.primary, color: colors.white }
```

### Badge (status pills on order tiles)
- `CONFIRMED` → emerald background, white text
- `PENDING` → amber background, amber-900 text
- `CANCELLED` → red-50 background, red-700 text
- `COMPLETED` → slate-100 background, slate-700 text

---

## 6. Iconography
The web app uses **lucide-react** everywhere. The Expo equivalent is **`lucide-react-native`** — install once, identical API. Don't substitute with emoji.

```bash
yarn add lucide-react-native
```

Common icons used on every screen: `Search`, `Filter`, `SlidersHorizontal`, `MapPin`, `Clock`, `Calendar`, `User`, `Ticket`, `Star`, `ChevronRight`, `ChevronLeft`, `X`, `Check`, `CheckCircle2`, `AlertCircle`, `Phone`, `Mail`, `CreditCard`, `Wallet`, `Bus`, `Car`, `Hotel`, `Utensils`, `Film`, `Shirt`.

---

## 7. Three things that surprise people coming from web

1. **No CSS Grid in React Native.** Use Flexbox (`flexDirection`, `flexWrap`, `gap`) — that's it. Almost every web layout in our app maps cleanly.
2. **`<View>` everywhere, not `<div>`.** Text MUST be wrapped in `<Text>` — React Native refuses to render bare strings.
3. **No `gap` on Android <9.** Polyfill with `marginRight: spacing.sm` on children if you must support old Android. Mostly safe to ignore in 2026.

---

## 8. How to actually see the web app rendered

You're auth-gated, which is correct. Two paths:

1. **Ask the project owner to screenshot specific pages and attach them.** They have logged-in browser access. Tell them which exact route you need (`/services/hotels/results?…`, `/services/cinema/film/<id>`, etc.) and they'll capture it.

2. **Read the JSX source** — every visual decision is in the file. Tailwind classes literally are the spec (`bg-slate-50`, `rounded-2xl`, `border-2 border-slate-200`, `p-4`, etc. translate 1:1 to React Native StyleSheet values via the design tokens in §1).

Option 2 is faster and more precise. We've already put everything in your GitHub repo for that reason.

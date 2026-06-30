# Oryno Mobile — Search & Results Pages Spec

This document mirrors the **web app** search + results UX exactly so the mobile app can implement the same flows. All filter names, sort options, and URL params are pulled directly from the canonical web pages under `/app/frontend/src/pages/services/`.

**Convention:**
- Step 1 = "Search" screen (form with required inputs, navigates to results).
- Step 2 = "Results" screen (list with extra filters, sort, view-mode toggles).
- Both screens for each service are wired into the same backend list endpoint (see `MOBILE_API_CONTRACT.md` §2).

---

## 1. Hotels

**Web routes:** `/services/hotels` → `/services/hotels/results?…`

### Search screen — submitted query params
| Param | Type | Required | Notes |
|---|---|---|---|
| `destination` | string | ✅ | City name (typeahead). |
| `check_in` | ISO date `YYYY-MM-DD` | ✅ | |
| `check_out` | ISO date `YYYY-MM-DD` | ✅ | Must be > check_in. |
| `rooms` | int | default `1` | |
| `guests` | int | default `2` | |

### Results-screen filters (extra, on top of the URL params)
- **Sort by** (default `rating`): `rating` (Top Rated), `price_low` (Price: Low → High), `price_high` (Price: High → Low), `distance`, `name_asc`
- **Price range** slider: `[0, 500000]` FCFA
- **Star rating** multi-chip: 1–5
- **Amenities** multi-chip: `wifi, pool, gym, spa, parking, restaurant, breakfast, bar, ac, room_service, laundry, business_center, pets_allowed, accessible`
- **Free cancellation** toggle
- **Breakfast included** toggle
- **Min guest rating** number (1–5)
- **View mode**: `grid` | `list`

---

## 2. Restaurants

**Web routes:** `/services/restaurants` → `/services/restaurants/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | ✅ | |
| `cuisine` | string | optional | e.g. `Cameroonian, French, Italian, Lebanese, Asian, African, Fast Food, Café` |
| `date` | ISO date | ✅ | |
| `time` | `HH:MM` | optional | 30-min slots from 11:00 to 23:00 |
| `guests` | int | default `2` | |

### Results-screen filters
- **Sort by** (default `rating`): `rating`, `price_low`, `price_high`, `distance`
- **Cuisine** multi-chip (same vocabulary as above)
- **View mode**: `grid` | `list`

---

## 3. Travel (intercity bus)

**Web routes:** `/services/travel` → `/services/travel/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `from_city` | string | ✅ | |
| `to_city` | string | ✅ | Must differ from `from_city` |
| `departure_date` | ISO date | ✅ | |
| `return_date` | ISO date | optional | If set, treats as round-trip |
| `passengers` | int | default `1` | |

### Results-screen filters
- **Sort by** (default `departure`): `departure` (earliest first), `arrival`, `price_low`, `price_high`, `duration`
- **Vehicle type** multi-chip: `bus, vip_bus, minibus, sedan, suv, van`
- **Departure window** chip: `morning (4–12), afternoon (12–18), evening (18–24), night (0–4)`
- **Amenities** multi-chip: `ac, wifi, usb, reclining_seats, toilet, snacks`
- **View mode**: `grid` | `list`

---

## 4. Car Rental

**Web routes:** `/services/car-rental` → `/services/car-rental/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `pickup_location` | string | ✅ | |
| `dropoff_location` | string | optional | Defaults to same as pickup |
| `car_type` | string | optional | `economy, compact, midsize, suv, luxury, van, pickup` |
| `pickup_date` | ISO date | ✅ | |
| `return_date` | ISO date | ✅ | Must be > pickup_date |
| `with_driver` | boolean | default `false` | |

### Results-screen filters
- **Sort by** (default `price_low`): `price_low`, `price_high`, `rating`
- **Car type** single-select chip: `all, economy, compact, midsize, suv, luxury, van, pickup`
- **Transmission** single-select chip: `all, automatic, manual`
- **View mode**: `grid` | `list`

---

## 5. Events

**Web routes:** `/services/events` → `/services/events/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | ✅ | |
| `event_type` | string | optional | `concert, festival, conference, sports, comedy, theater, exhibition, party, wedding, other` |
| `date` | ISO date | optional | If empty, "any time". |
| `tickets` | int | default `1` | |

### Results-screen filters
- **Sort by** (default `date`): `date`, `rating`, `price_low`, `price_high`
- **Event type** single-select chip: same vocabulary as above
- **Date window** segmented control: `around` (±3 days of selected date), `future` (any future date)
- **View mode**: `grid` | `list`

---

## 6. Cinema

**Web routes:** `/services/cinema` → `/services/cinema/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | ✅ | |
| `genre` | string | optional | `action, adventure, animation, comedy, drama, horror, romance, sci_fi, thriller, documentary, family, fantasy` |
| `showing` | string | default `all` | `all, today, this_week, this_month` |

### Results-screen filters
- **Sort by** (default `rating`): `rating` (Top rated), `release_date`, `popularity`
- **Status** chip: `all, now_showing, coming_soon`
- **Genres** multi-chip (same vocabulary)
- **MPAA rating** chip: `all, G, PG, PG-13, R, NC-17`
- **Duration** chip: `all, short` (≤90 min), `medium` (91–120 min), `long` (>120 min)
- **View mode**: `grid` | `list`

---

## 7. Laundry / Pressing

**Web routes:** `/services/laundry` → `/services/laundry/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | ✅ | |
| `shop_type` | string | optional | `''` (any), `laundry`, `pressing` |

### Results-screen filters
- **Sort by** (default `rating`): `rating`, `price_low`, `price_high`, `turnaround` (fastest first)
- **Shop type** segmented control: `all, laundry, pressing`
- **Express service** toggle
- **Pickup & delivery** toggle
- **View mode**: `grid` | `list`

---

## 8. Banquet (event venue rental)

**Web routes:** `/services/banquet` → `/services/banquet/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `city` | string | ✅ | |
| `venue_type` | string | optional | `wedding_hall, conference_hall, garden, hotel_ballroom, restaurant_private_room, beach_venue, rooftop, outdoor_pavilion` |
| `event_date` | ISO date | optional | |
| `guests` | int | default `50` | |

### Results-screen filters
- **Sort by** (default `relevance`): `relevance`, `price_low`, `price_high`, `rating`, `capacity`
- **Category tab**: `all, wedding, corporate, social, religious`
- **Price range**: `min_price`, `max_price` (FCFA)
- **View mode**: `grid` | `list`

---

## 9. Packages (Shipping / Delivery)

**Web routes:** `/services/packages` → `/services/packages/results?…`

### Search-screen params
| Param | Type | Required | Notes |
|---|---|---|---|
| `pickup_location` | string | ✅ | |
| `delivery_location` | string | ✅ | |
| `shipping_date` | ISO date | ✅ | |
| `package_size` | string | ✅ | `small, medium, large, xl, custom` |
| `weight_kg` | number | ✅ | |
| `length_cm` | number | when `package_size=custom` | |
| `width_cm` | number | when `package_size=custom` | |
| `height_cm` | number | when `package_size=custom` | |
| `package_type` | string | default `parcel` | `document, parcel, fragile, perishable, electronics, heavy_goods` |

### Results-screen filters
- **Sort by** (default `price_low`): `price_low`, `price_high`, `rating`, `delivery_time`
- **Price range** slider: `[0, 200000]` FCFA
- **Max delivery hours** number (0 = no limit)
- **Features** multi-chip: `insured, tracked, signature_required, fragile_handling, refrigerated, express, weekend_delivery`
- **Pricing model** chip: `all, per_kg, flat_rate, per_km, tiered`
- **Min/max weight** number
- **View mode**: `grid` | `list`

---

## 10. Common patterns across all services

### Shared header filter row (every results screen)
- Search-summary chip at top showing the active search params (tappable to re-open Search modal)
- Sort dropdown (mobile = bottom sheet)
- View-mode toggle (`grid` ↔ `list`) — mobile default should be `list`
- Filter button → opens full-screen filter sheet
- Active-filter count badge on the Filter button

### "Smart filters" — shared sidebar/sheet model
Every results page has a left/top sidebar with three multi-select facets that filter the rendered listings:
- `places` (cities / locations)
- `operators` (vendor brand names)
- `listings` (specific named entities, e.g. "Merina Hotel", "Bus Beta")

The mobile equivalent should be a collapsible "Refine by" section inside the filter sheet, each rendered as a search-as-you-type multi-select chip array.

### Empty + skeleton states
- Initial load → 6-card grid skeleton (or list-row skeletons in list mode)
- No results → empty illustration + "Adjust filters" CTA that clears all results-screen filters but preserves the URL search params

### Pagination
- All list endpoints return `{items, total, page, page_size}`
- Mobile: use infinite scroll. Tap "Load more" if a user is on a slow connection (offer fallback).

### Currency formatting
- Use `formatFCFA(n)` equivalent: thousand-separators, no decimals, FCFA suffix (e.g. `45,000 FCFA`).

### Deep-link scheme (for push notifications + web parity)
Mirror the web URLs:
- `oryno://services/hotels/results?destination=Douala&check_in=2026-03-01&check_out=2026-03-03`
- `oryno://services/hotels/details/{id}`
- `oryno://services/cinema/film/{id}`
- `oryno://services/showtimes/{id}`
- `oryno://orders/{id}` (existing convention)

These are also the universal-link paths off `https://app.oryno.tech/*` so push-notification taps land in the right screen even if the app isn't running.

---

## 11. Quick sanity check — backend endpoints called from each results page

| Service | Endpoint hit on Results screen | Notes |
|---|---|---|
| Hotels | `GET /api/hotels/?destination=…&check_in=…&check_out=…` | |
| Restaurants | `GET /api/restaurants/?city=…&cuisine=…&date=…&time=…` | |
| Travel | `GET /api/travel/routes?from_city=…&to_city=…&departure_date=…` | |
| Car Rental | `GET /api/car-rental/?pickup_location=…&pickup_date=…&return_date=…` | |
| Events | `GET /api/events/?city=…&event_type=…` | |
| Cinema | `GET /api/cinema/films?city=…&genre=…&showing=…` | |
| Laundry/Pressing | `GET /api/pressing/?city=…&shop_type=…` | |
| Banquet | `GET /api/banquet/?city=…&venue_type=…` | |
| Packages | `GET /api/packages/?pickup_location=…&delivery_location=…&shipping_date=…&package_size=…` | |

All filter & sort logic above happens **client-side after the initial fetch** — the backend returns a broad result set and the UI narrows it. Match that approach on mobile so the UX feels identical to the web app.

# Oryno Platform - PRD

## Architecture
- React + Vite + Tailwind + Shadcn/UI + Leaflet | FastAPI + MongoDB
- **CRITICAL**: `travel_routes.py` = public travel API. `travel.py` = management/analytics only. Never duplicate.
- **Timezone source of truth**: `frontend/src/utils/dateUtils.js` — reads `localStorage.oryno_tz` → `Intl.DateTimeFormat().resolvedOptions().timeZone` → `Africa/Douala`. All date/time formatters in the app must go through it.

## Latest Changes (Apr 2026)
- **Timezone-aware dates across the app** — centralized `dateUtils.js` now formats every date in the user's chosen IANA timezone; `AuthContext` persists `user.timezone` (or browser-detected) into `localStorage.oryno_tz` on login; Settings → Preferences exposes 60+ IANA zones grouped by region + a "Use system timezone" auto-detect button.
- **Ticket / Order dates fixed** — `OrderDetailModal` shows a clearly-labelled "Booked on" row (date + time + TZ caption) and a new "Service Time" row pulled from `service_time`/`travel_time`/`departure_time`.
- **Seat booking fixes** — new backend endpoint `POST /api/seat-bookings/confirm` flips RESERVED→BOOKED on payment (idempotent, user-scoped, unsets TTL). `LiveSeatMap` now caps the reconciled selection to `maxSeats` and releases the excess so "book 2 then return to book 1" no longer auto-selects 2 seats.
- **Banquet Management blank page fix** — added missing `isWalkInOpen` / `bookingsRefreshKey` state in `BanquetManagement.jsx` (page was crashing with a ReferenceError).
- **User/Operator revamp** — cascade role changes clear `operator_id`; `UserDetailModal` modernized (gradient header, prefilled fields, stat cards, paginated/searchable activity tab); search-only `OperatorPicker`; Create-User / Send-Invitation modals scrollable.
- **Walk-in: Time + Optional Seats** — Walk-in Booking modal includes Service Time (auto-filled from route `departure_time` for travel). Headcount-only tickets supported.
- **Tri-view mode + Quick Date filter + Operator scope** on Receipts / Orders / Bills / Transactions / Reports — `QuickDateRangeFilter`, `ViewModeToggle`.
- **Robust Notifications**: `dedupe_key`-based upsert, partial-unique `(user_id, dedupe_key)` index.
- **Travel Ticket Vehicle Info**: `booking_details.vehicle_info` enrichment; plate + thumbnails on trip cards.
- **Duplicate Router Fix**: `travel.py` only for management/analytics; `travel_routes.py` owns public endpoints.
- **Hotel Data**: Seeded GPS + 9 policies per hotel; Leaflet map with nearby service pins.
- **Restaurant Menu**: Allergen tags, ingredient search, swipeable images.
- **Sidebar**: Right-side flyout submenus with smart positioning.

## Credentials (see /app/memory/test_credentials.md)
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@oryno.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

## Upcoming
- P2: Operator comparison dashboard
- P3: Scheduled report emails
- Polish (optional, from iter124): migrate Settings timezone dropdown from native `<select>` to shadcn `Select` for visual parity with Language/Currency controls.

# Oryno Platform - PRD

## Architecture
- React + Vite + Tailwind + Shadcn/UI + Leaflet | FastAPI + MongoDB
- **CRITICAL**: `travel_routes.py` = public travel API. `travel.py` = management/analytics only. Never duplicate.
- **Timezone source of truth**: `frontend/src/utils/dateUtils.js` — reads `localStorage.oryno_tz` → `Intl.DateTimeFormat().resolvedOptions().timeZone` → `Africa/Douala`. All date/time formatters in the app must go through it.

## Latest Changes (May 2026)
- **Cinema Management overhauled (May 1 2026)** — Cinema = physical venue (name, city, phone, email, address, screens manager [add/remove rows with name+type+capacity], amenities, operator). Movie = film catalogue (title, status now_showing/coming_soon, poster, genre, duration, rating, IMDb rating, language, director, release_date, cast, trailer_url, description) — pricing fields removed. Showtime = NEW assignment dialog linking cinema → film → screen → date → start/end time → price + VIP price + total seats. Backend `cinema.py` POST/PUT `/films` now accept `cast`, `genre`, `subtitles` (Query-wrapped, `imdb_rating` (float), `status` (str). **Critical fix**: List[str] params were Body-treated by FastAPI causing `cast`/`genre`/`subtitles` to silently save as `[]` — now wrapped with `Query(default_factory=list)`.
- **Payment buttons unblocked (May 1 2026)** — `HotelBooking.jsx` and `RestaurantBooking.jsx` were passing `disabled={... || !selectedPaymentMethod}` to `PaymentMethodsSelection`, creating a chicken-and-egg where method buttons never became clickable. Removed the `!selectedPaymentMethod` check from the method-selection disable (kept it on the outer Pay button). Travel: removed `disabled={isTraveler}` from passenger fields so users can edit auto-filled IDs.
- **Replace function rolled out (May 1 2026)** — `BanquetManagement`, `RestaurantManagement`, `PackageManagement` now have a Replace icon button per card that opens `ReplaceResourceModal` to migrate bookings to another resource. Backend `resource_reassignments.py` got new presets for `restaurant` and `banquet`. Frontend modal got `restaurant` + `banquet` presets and the `package` preset was rewritten for the new physical-package schema.
- **Reporting page operator drill-down (May 1 2026)** — `/admin/reporting` now has a 4-column layout: Date Range / Operator / **User (under operator)** / Service Filter. The User dropdown auto-populates from `/api/users/?operator_id=<selected>` when an operator is picked, and is disabled with a hint until then. Service filter expanded to all 9 services (events, cinema, banquets, laundry, packages added).
- **Platform Revenue dashboard (May 1 2026)** — `/admin/sales` now has: (a) `OperatorScopeFilter` (admin/super_admin only) that re-fetches orders scoped to that operator; (b) extended date filter — added This/Last Month, This/Last Year, All Time (9 ranges total); (c) Export dropdown with **CSV / Excel (XLSX) / PDF** that all download a real file (`xlsx`, `file-saver`, `jspdf`, `jspdf-autotable` packages); (d) **Revenue by Operator** card with horizontal bar chart + sortable table of `{operator, orders, revenue, share %}` derived in real-time from filtered orders.
- **Packages → Physical Logistics refactor (Apr 29 2026)** — `packages` collection wiped of stale tour data. New schema: sender/receiver contacts (name, phone, email, address), origin_city, destination_city, package_type (document/parcel/fragile/perishable/electronics/heavy_goods/other), weight_kg, dimensions (length/width/height cm), declared_value, price, payment_status, status flow `pending → picked_up → in_transit → out_for_delivery → delivered`, auto-generated `tracking_number` (format `ORYNO-XXXXXXXX`). New endpoints: `POST/GET /api/packages/`, `GET /api/packages/{id}`, `GET /api/packages/track/{tracking_number}`, `PUT /api/packages/{id}`, `POST /api/packages/{id}/status`, `DELETE /api/packages/{id}`. Backend also updated `routes/orders.py`, `routes/public.py`, `routes/resource_reassignments.py` to mirror new fields.
- **Cinema Results redirect fix (Apr 29 2026)** — `CinemaResults.jsx` `handleViewDetails` was navigating to `/services/cinema/${film.id}` (no match → catch-all `*` → RoleBasedRedirect → /dashboard). Fixed to `/services/cinema/film/${film.id}`.
- **Grid/List/Details + Pagination rolled out** to: CinemaResults, PackageManagement, CarRentalManagement, EventsManagement, BanquetManagement, CinemaManagement (Cinemas + Films sub-tabs both), LaundryManagement, RestaurantManagement (extended existing 2-mode toggle to 3-mode via shared `SearchFilter`). Pattern reference: `TravelManagement.jsx`. Reusable components: `components/common/ViewModeToggle.jsx`, `components/common/Pagination.jsx`. Page size = 12.
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
- **Customer-facing `/services/packages` booking flow refactor** — current flow still references old "tour" fields (inclusions, duration_days, destination, etc.). Re-conceive as a "request a shipment" flow that matches the new logistics model: customer enters sender/receiver, dimensions, weight, package_type → system generates tracking_number and creates a shipment record + linked order.
- **Public package tracking widget** — surface a search box on the landing page (and a `/track` route) that calls `GET /api/packages/track/{tracking_number}` (already public, no auth) so any sender or receiver can paste a tracking number and instantly see live status. Repeat-traffic + conversion booster for the logistics service.

# Oryno Platform - PRD

## Architecture
- React + Vite + Tailwind + Shadcn/UI + Leaflet | FastAPI + MongoDB
- **CRITICAL**: `travel_routes.py` = public travel API. `travel.py` = management/analytics only. Never duplicate.

## Latest Changes (Apr 2026)
- **Walk-in: Time + Optional Seats** — Walk-in Booking modal now includes a Service Time field (auto-filled from the selected route's `departure_time` for travel). Travel walk-ins with no seat numbers are recorded as headcount-only tickets (booking_details.seats_assigned=false, passengers preserved). Backend stores `service_time` on the order and mirrors to `booking_details.travel_time` (user value wins over route schedule).
- **Tri-view mode + Quick Date filter + Operator scope** on Receipts / Orders / Bills / Transactions / Reports — reusable `QuickDateRangeFilter` (Today, Last 3/7/30 days, This/Last Month, This Year, Custom) and `ViewModeToggle` (List / Grid / Details)
- **New page**: `/transactions` — unified payment transactions view with search, status/method/operator/date filters and 3 view modes
- **Walk-in / Cash Bookings**: Operators can record on-site bookings for ALL services via `POST /api/operator/manual-bookings/`. Unified channel filter (Online/Walk-in) on every management page's new "Bookings" tab. Optional linking of walk-in to existing customer by phone/email.
- **Robust Notifications**: New `utils/notifications.py` helper with `dedupe_key`-based upsert. Partial-unique index `(user_id, dedupe_key)` + one-shot migration at startup. Reading a notification once truly keeps it read — no more re-popping on login.
- **Travel Ticket Vehicle Info**: Travel orders auto-enrich with `booking_details.vehicle_info` (plate, model, image). "Your Vehicle" card on OrderDetailModal + BookingConfirmation.
- **Travel Routes**: Plate number + 2 bus thumbnails on trip cards. Vehicle enrichment in `travel_routes.py`.
- **Duplicate Router Fix**: Removed all public endpoints from `travel.py`. Only `travel_routes.py` handles GET/POST/PUT/DELETE /routes.
- **Accent-insensitive Search**: City search now matches accented characters (Yaounde → Yaoundé).
- **Hotel Data Seeded**: Hotels have GPS coordinates and 9 policies each.
- **Hotel Results**: Compact controls (h-9), extended filters (Guest Rating, Cancellation, Breakfast).
- **Hotel Details**: Live Leaflet map with nearby service pins, policies toggle.
- **All Booking Pages**: Navy bg-[#082c59] Price Breakdown + Payment headings.
- **Restaurant Menu**: Premium revamp, allergen tags, ingredient search, swipeable images.
- **Sidebar**: Right-side flyout submenus with smart positioning.

## Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

## Upcoming
- P2: Operator comparison dashboard
- P3: Scheduled report emails

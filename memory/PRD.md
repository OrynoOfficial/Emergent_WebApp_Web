# Oryno Platform - PRD

## Architecture
- React + Vite + Tailwind + Shadcn/UI + Leaflet | FastAPI + MongoDB
- **CRITICAL**: `travel_routes.py` = public travel API. `travel.py` = management/analytics only. Never duplicate.

## Latest Changes (Apr 2026)
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

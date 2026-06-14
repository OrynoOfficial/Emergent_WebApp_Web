# Oryno Platform — Changelog


## Apr 21, 2026 — Showtimes Mgmt Tab + User-Operator Assignment + Users Page Revamp
- **Cinema: Showtimes sub-tab** added to CinemaManagement → Management. Table with film/cinema/screen/date-time/seats/price/status + Replace and Delete actions per row.
- **Backend cinema**: new `GET /api/cinema/showtimes/operator` (returns showtimes with `id` field, operator-scoped), `POST /api/cinema/showtimes` (body-based), `PUT /api/cinema/showtimes/{id}`, `DELETE /api/cinema/showtimes/{id}` (refuses 409 if active bookings reference the showtime — forces Replace flow).
- **User creation with operator assignment**: `POST /api/users/create` now requires `operator_id` when `role='operator'`, validates against `operators` collection, persists `operator_id` + `operator_name` on user.
- **User listing enrichment**: `GET /api/users/` on-the-fly populates missing `operator_name` for operator-role users.
- **Reusable `OperatorPicker`** component (`frontend/src/components/shared/OperatorPicker.jsx`) — search + service filter + region filter + scrollable selectable list.
- **Invite User modal**: OperatorPicker shown conditionally when role=operator; submit blocked without pick.
- **Create User modal (admin/users)**: same conditional OperatorPicker.
- **Admin → Users page revamp**:
  - New **Operator** column (`data-testid="user-operator-cell-<id>"`) shows operator badge with name for operator-role users.
  - View mode toggle: list / grid / details (`data-testid="user-view-mode"` with `view-list|view-grid|view-details`).
  - Client-side **pagination** (12 per page grid, 20 per page list/details, prev/next).
  - Extended filters: status, operator, date-joined range (`joined-from` / `joined-to`).
  - Search now also matches `operator_name`.
- **Delete showtime**: native `window.confirm`/`alert` replaced with toast feedback for consistency.
- **Testing**: iter122 — 11/11 backend pytest PASS, frontend live verification PASS (view modes, operator column populated, pagination, new filters all rendering).


## Apr 21, 2026 — Replace/Reassign UI Rollout: Events, Packages, Laundry
- **Replace icon button** added to card action row on:
  - `EventsManagement.jsx` → `data-testid="replace-event-btn-<id>"` (between View and Edit)
  - `PackageManagement.jsx` → `data-testid="replace-package-btn-<id>"`
  - `LaundryManagement.jsx` → `data-testid="replace-pressing-btn-<id>"`
- **ReplaceResourceModal SERVICE_PRESETS** extended with icons/labels/candidateFilter for `event` (CalendarDays), `package` (Package), `laundry` (Shirt), and `cinema` (Clapperboard — preset ready for future Showtimes UI).
- **Preview fallbacks**: preview card now falls back through `name/film_title/venue_name/destination/city/show_date` so all 7 service types render correctly.
- **Deferred**: **Cinema UI** — CinemaManagement has no Showtimes tab yet; cinema reassignment operates on showtimes, not cinemas. Backend still fully supports cinema reassignment via API. Adding a Showtimes management tab + Replace button is a next-task.
- **Testing**: iter121 — code review PASS, live E2E blocked by Cloudflare bot-challenge in preview env (unrelated to code). Backend endpoints (/api/events/, /api/packages/, /api/pressing/) confirmed working via curl (200 OK for both admin and operator).


## Apr 21, 2026 — Reassignment P3 Rollout: Event, Package, Laundry, Cinema (Backend)
- **SERVICE_SPECS expanded to 7 services**: added `event`, `package`, `laundry`, `cinema` on top of the existing `travel`, `car_rental`, `hotel`.
  - `event`: collection `events`, snapshot (name, event_type, venue_name, start_date, end_date, images). Use case: cancelled show → makeup event, ticket-holders auto-migrated.
  - `package`: collection `packages`, snapshot (name, destination, duration_days, images, base_price). Use case: cancelled tour → equivalent replacement.
  - `laundry`: collection `pressing`, snapshot (name, address, city, phone, images). Accepts legacy `service_type='pressing'` alias in order queries.
  - `cinema`: collection `showtimes` (the bookable unit), snapshot (cinema_name, film_title, screen_name, show_date, show_time, price). Authorization resolves `operator_id` via `showtimes.cinema_id → cinemas.operator_id`. Cross-cinema swap rejected with 400.
- `_resolve_operator_id` generalized: handles both `hotel_id` (rooms) and `cinema_id` (showtimes) indirection; documented in docstring for future services.
- **Order creation enrichment** (`orders.py`): new orders for event/package/laundry/cinema/pressing auto-populate the respective `{resource}_id` + `{resource}_info` snapshot fields, making them matchable by the reassignment query.
- **Cinema UX note**: a "showtime swap" is most useful when a screen has a technical issue and the film has to move to another screen or time slot at the same cinema.
- **Deferred**: Banquet (empty `banquets` collection; no swappable resource) + Restaurant (no per-table resource in booking_details). These need model work before rollout.
- **Frontend**: no UI changes this iteration. Backend `POST /api/operator/resources/reassign` now accepts all 7 service_types. Replace buttons on EventsManagement/PackageManagement/LaundryManagement/CinemaManagement pages are a follow-up task.
- **Testing**: iter120 — 8/8 new + 12/12 regression PASS. No backend issues.


## Apr 20, 2026 — Reassignment: 5-min Undo Window + Multi-service Rollout (Car Rental, Hotel)
- **Undo** (`POST /api/operator/resources/reassignments/{event_id}/revert`): reverts within 5 min; creates reverse event with `is_revert_of`, swaps orders back, re-notifies stakeholders, marks original as reverted. Double-revert → 400, expired (>5min) → 400, unknown event → 404.
- **List endpoint** (`GET /api/operator/resources/reassignments`) now returns `revertable`, `age_seconds`, and `revert_window_minutes=5` on each event.
- **SERVICE_SPECS expanded**: `car_rental` (collection `car_rentals`, snapshot incl. make/model/plate_number) and `hotel` (collection `rooms`; authorization resolves `operator_id` via `hotel_id→hotels.operator_id`; both rooms must share the same hotel).
- **Order creation enrichment**: hotel orders now persist `booking_details.room_id` + `room_info` snapshot; car_rental orders persist `booking_details.car_id` + `car_info`. Future orders are matchable directly by resource_id.
- **Generic frontend modal** (`frontend/src/components/management/shared/ReplaceResourceModal.jsx`) replaces the old travel-only modal. Adapts icon/labels/candidate-filter via `serviceType` prop. Success screen shows live **5-minute countdown** + amber "Undo this reassignment" button.
- **Replace buttons wired up**: TravelManagement (VehicleCard), CarRentalManagement (CarCard), HotelManagement (RoomCard). All use `data-testid="replace-*-btn-<id>"` pattern.
- **Testing**: iter119 — 12/12 new backend tests PASS (undo happy path, double-revert, expired, 404, list-envelope, restoration), modal visually confirmed.
- **Deferred (P3)**: Cinema/Banquet/Events (venue/section swap) + Laundry/Package (slot swap) — data models need an audit before SERVICE_SPECS entries can be written reliably.


## Apr 20, 2026 — Resource Reassignment (Travel/Vehicle) — Reference Implementation
- **Feature**: Generic "Replace Resource" service. Operators replace a broken-down bus → all active bookings atomically updated + customer/operator/admin notifications fired.
- **Backend** (`backend/routes/resource_reassignments.py`, NEW):
  - `POST /api/operator/resources/reassign` with `dry_run` preview (shows affected count + sample orders) then commit.
  - `GET /api/operator/resources/reassignments` lists logged events (operator-scoped for operators).
  - SERVICE_SPECS registry — adding new services (hotels, car rental, etc.) is a one-entry config change.
  - Atomic update of `booking_details.vehicle_id`, `booking_details.vehicle_info` snapshot, mirror fields (`plate_number`, `vehicle_images`, etc.), and `$push` to `reassignment_history` audit trail.
  - Notifications via `utils/notifications.py` with strict dedupe_keys (`reassign:{event_id}:{order}:customer` etc.) — idempotent on retry.
  - `orders.py` now sets `booking_details.vehicle_id` at creation (future orders directly matchable).
- **Frontend**:
  - `frontend/src/components/management/travel/ReplaceVehicleModal.jsx` (NEW) — 3-step flow: form (pick replacement + reason pills + optional note), preview (dry-run impact), confirm (commits + success screen with counts).
  - `frontend/src/pages/management/TravelManagement.jsx` — Replace icon button on every VehicleCard (aliased `Replace as ReplaceIcon` to avoid import conflicts).
  - `frontend/src/components/modals/OrderDetailModal.jsx` — amber `reassignment-banner` showing from→to plate numbers, reason, timestamp, and change count.
- **Testing**: iter117 identified 2 bugs (projection + button render) — both FIXED and re-verified in iter118 (backend 100%, frontend end-to-end flow verified including banner render showing "CE-456-CD → RE-999-XX").
- Extensible to all 9 services by registering a new SERVICE_SPECS entry (no code changes to endpoint or notification logic).


## Apr 20, 2026 — Admin Bookings Data Fetch Fix + support_tickets Cleanup
- **Fix**: `/admin/bookings` page was returning 0 records — root cause was the frontend passing `limit=500` while the backend capped at `le=200`, causing a silent 422 error. Raised cap to `le=1000` in `backend/routes/manual_bookings.py` (GET `/api/operator/manual-bookings/`).
- **Verified**: Admin now sees 163 bookings, Super Admin 163, Operator correctly scoped to 26.
- **Cleanup**: Removed duplicate team endpoint definitions (`/team/members`, `/team/available`, `/team/add`, `/team/{id}`) from the bottom of `backend/routes/support_tickets.py`. The active `/team-members` endpoints (used by frontend CustomerServiceManagement) remain untouched.
- **Test credentials fix**: Corrected Super Admin email in `memory/test_credentials.md` from `superadmin@test.com` → `superadmin@oryno.com`.
- **UX polish**: Added stable fallback `key` props to all three list renderers in `admin/Bookings.jsx` to silence React key warnings.
- Files changed: `backend/routes/manual_bookings.py`, `backend/routes/support_tickets.py`, `frontend/src/pages/admin/Bookings.jsx`, `memory/test_credentials.md`.
- Testing: iteration_116.json — backend 9/9 PASS, frontend PASS (163/154/9 counts render with all 3 toolbar filters).

## Mar 10, 2026 — Real Dashboard Data, Communications Revamp & Subscription System

### Phase 1: Real Operator-Scoped Dashboard Data
- New backend API: `GET /api/management/dashboard-stats?service_type=X&period=Y`
- Removed ALL mock data generators from 9 service management pages
- Created shared hook: `useRealDashboardData(serviceType)`
- Removed default mock chart data from `ServiceExecutiveDashboard.jsx`
- Files changed: management_dashboard.py (new), useRealDashboardData.js (new), 9 management pages, ServiceExecutiveDashboard.jsx

### Phase 2: Communications Page Revamp
- Complete redesign of `ServiceCommunicationsHub.jsx`
- 3 stat cards: Subscribers, Open Tickets, Promotions Sent
- Support Tickets panel, Recent Reviews panel, Promotions grid
- Create Promotion dialog with type, discount, expiry

### Phase 3: Subscription System
- Backend: `/api/subscriptions` (subscribe, unsubscribe, check, my, operator-count, promotions)
- Frontend: `useSubscription` hook, `SubscribeButton` component
- Settings page: "Subscriptions" section for customers
- Promotion → Notification flow for subscribers
- Files: subscriptions.py (new), useSubscription.js (new), SubscribeButton.jsx (new), Settings.jsx, HotelDetails.jsx, RestaurantMenu.jsx

### Testing
- 25/25 backend tests passed
- 100% frontend verified (iteration_72)

## Apr 19, 2026 — Walk-in Bookings, Robust Notifications, Travel Ticket Vehicle Info

### Feature C: Operator Walk-in / Cash Bookings (all services)
- NEW backend: `/app/backend/routes/manual_bookings.py` exposing:
  - `POST /api/operator/manual-bookings/` — records a walk-in booking for any service (travel, hotel, car_rental, restaurant, event, package, cinema, laundry, banquet)
  - `GET /api/operator/manual-bookings/?channel=all|online|on_site` — unified list with counts
  - `GET /api/operator/manual-bookings/lookup-customer` — links walk-in to existing platform user via phone/email (case-insensitive, regex-escaped)
- Walk-in orders stored in `orders` collection with `channel="on_site"`, `is_manual=true`, `created_by_operator_user_id`, `payment_method`, `guest_customer{...}`
- For travel, seats are atomically locked in `seat_bookings` (409 on conflict)
- Optional linkage auto-fills from existing customer by phone/email
- NEW frontend: `WalkInBookingModal.jsx`, `OperatorBookingsList.jsx` (reusable, channel filter All/Online/Walk-in)
- Wired into all 9 management pages with "Walk-in Booking" button + new "Bookings" tab

### Feature B: Robust Notifications (no more re-popping)
- Root cause: 20+ routes inserted notifications directly; nothing prevented duplicates, so repeated triggers re-appeared as unread after read
- NEW helper: `/app/backend/utils/notifications.py`
  - `create_notification(...)` with optional `dedupe_key` → upsert preserves `is_read` state
  - `bulk_create_notifications(...)` for multi-recipient fan-out
  - `ensure_notification_indexes(...)` creates partial-unique index `(user_id, dedupe_key)`
  - `dedupe_existing_notifications(...)` one-shot migration at startup
- Updated: `subscriptions.py` (alerts + promotions), `notifications.py` (admin POST uses helper)
- Startup hook in `server.py` bootstraps indexes + dedupes on every restart
- Expanded `NotificationType` enum with info/success/warning/error/operator_alert/promotion/promotion_pending

### Feature A: Vehicle Info on Travel Tickets
- Backend: `POST /api/orders/create` auto-enriches travel bookings with `booking_details.vehicle_info` from the `vehicles` collection (plate_number, model, manufacturer, images, vehicle_type, year)
- Frontend: "Your Vehicle" card added to:
  - `OrderDetailModal.jsx` — prominent plate number badge (`data-testid=ticket-plate-number`), model, image, seat badge
  - `BookingConfirmation.jsx` — same premium card on post-checkout confirmation
- Walk-in travel bookings also persist vehicle_info so customers always see which bus they booked

### Testing — Iteration 113
- 8/8 backend feature verdicts PASS (walk-in create/list/lookup/403, notifications dedupe, travel enrichment)
- Frontend smoke: "Walk-in Booking" button + Bookings tab visible on Travel management


### 2026-02-14 — Banquet & Event Services + Perf Hardening + Hotel Hard-Delete
- **Banquet module pivot** from "halls only" → multi-category event services catalog
  - 9 categories: hall, rental_item, canopy, photographer, videographer, catering, decoration, sound_lighting, other
  - 5 pricing models: per_event, per_person, per_hour, per_unit, flat_fee
  - New fields on `banquets` model: `category`, `pricing_model`, `unit_label`, `min_quantity`, `max_quantity`, `duration_hours`
  - New `banquet_packages` collection: operator-built bundles with optional bundle discount (subtotal/total computed server-side)
  - Dedicated `packages_router` at `/api/banquets/packages` to bypass `/{banquet_id}` shadow
  - `/api/banquets/management/my-venues?category=X` filter added
  - `/api/admin/db-reset/banquets` super-admin endpoint to wipe legacy hall records (used once to migrate)
  - Frontend `BanquetManagement.jsx` fully rewritten: "Banquet & Event Services" header, 4 tabs (Dashboard/Services/Packages/Communications), category-aware modal, packages CRUD UI with live subtotal/total preview, category filter chips
- **Hotel hard-delete (P0 from earlier)**: `?hard=true` flag on DELETE (super_admin only) cascades to rooms; `/management/my-hotels` filters soft-deleted; N+1 replaced with `$lookup` aggregation
- **Production perf**: GZip middleware (`min_size=500`), 30+ new compound indexes (banquets/restaurants/cinemas/films/vehicles/packages/routes/audit_logs/settings/otps), index ensure on startup
- **Admin ops endpoints**: `POST /api/admin/db-indexes/ensure`, `POST /api/admin/db-cleanup/purge-soft-deleted` (dry-run by default)
- **Testing — iteration_207**: Backend 100% (all 20 cases in test_iter206_banquet_services.py PASS); Frontend 75% (modal save UX now adds inline validation + FastAPI 422 field-error display)

### 2026-02-14 — Banquet & Event Services Phase 2 (Customer-side cart + checkout)
- **Backend cart endpoint** `POST /api/banquets/cart/checkout`
  - Single order spanning multiple services + packages for one event date
  - Per-line snapshot (service_name, category, pricing_model, unit_label, quantity, hours, unit_price, line_total, rate_label, operator_id)
  - Pricing models honoured: per_event, per_person, per_hour (hours required & enforced), per_unit, flat_fee
  - Package expansion: bundle.total_price feeds order subtotal; inner services snapshotted for operator visibility
  - Validation: future date, non-empty cart, all service IDs exist, per_hour requires hours
  - Writes 1 `orders` row (service_category=banquet, EVT-XXXXXX number) + 1 `banquet_bookings` row
- **Customer-side packages visibility**: `GET /api/banquets/packages/` is now public-friendly — customers see all `is_active=true` bundles across operators; operators still see only their own; admins see everything
- **Frontend customer flow**:
  - `useEventCart` hook: localStorage-backed cart with items + packages, live totals, per-event metadata
  - `EventCartDrawer`: floating cart FAB with sliding sheet, qty edits, remove, proceed-to-checkout
  - `BanquetResults.jsx` rewritten: category tabs, ServiceCard with qty stepper, PackageCard with "Add Bundle", mounts cart drawer
  - `BanquetCheckout.jsx` new page: contact form + order summary + success screen (snapshots event_date before clear)
  - Route `/services/banquet/checkout` added
- **Testing (iteration_208)**: Backend 100% (8/8 pytest in test_iter208_banquet_cart_checkout.py PASS); Frontend e2e 100% (order EVT-000005 created end-to-end with cart drawer + checkout + success + localStorage clear). Two follow-up fixes applied: customer-visible packages, snapshot event_date for success screen, per_hour without hours now 400s.

### 2026-02-14 — Banquet Management UX polish (iter209/210)
- **Inline category chips removed** from the Services tab toolbar — filtering now lives only in the dropdown next to the search.
- **Rich per-category fields** in the Add Service modal:
  - New `category_details: Dict[str, Any]` on the Banquet model (free-form, backward-compatible).
  - New `/app/frontend/src/components/banquet/categorySchema.js` defines fields per category (hall, rental_item, canopy, photographer, videographer, catering, decoration, sound_lighting, other).
  - New `<CategoryDetailsFields/>` component walks the schema and renders text/number/select/multi-chip/textarea/checkbox controls.
  - Backend persists/echoes the full dict on POST/PUT/GET.
- **Category-scoped operator picker**: new `GET /api/operators/by-service-category?service_type=banquet&category=X` returns only operators who already have at least one service in that category (derived from `banquets.category` aggregation + `service_types` explicit tags). The Add Service modal refetches operators whenever the category changes; shows an amber warning if none are tagged yet.
- **Pricing-model desync guard**: after rapid category swaps, the pricing-model controlled Select sometimes ended up outside the new allowed set → blank trigger → 422 on save. Added a `useEffect` that snaps `form.pricing_model` to the first allowed model whenever the category changes.
- **Better save error toast**: surfaces FastAPI 422 field-level errors, falls back to a friendly message on unknown shapes, never shows an empty toast.
- **Testing iter210**: both P0 blockers fixed (chip row gone ✓, rich fields render for photographer/catering ✓). Operator dropdown refetches per category and displays the right list.

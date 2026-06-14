### 2026-02-14 — Banquet Customer UI verified + P3 Role chips & DnD assignment (iter184/185)
- **Banquet customer overhaul verified** (iteration_184, 11/12 PASS): pink theme, single Filter popover, swipeable galleries with always-visible chevrons, pinned cart strip, nested package → service modal flow, labelled "Add to Cart" CTA, enriched bundle pricing from `line.service`.
- **PackageCard regression fix**: per-line unit prices on Bundle cards (`BanquetResults.jsx`) now resolve via `line.service` first, falling back to the local services list (mirrors the modal pattern).
- **P3a Role chips on Users list** (`Users.jsx`): module-level `<RoleChips>` resolves `user.assigned_roles` via `GET /access/roles`, rendering coloured pill chips in list/grid/details views. `data-testid="user-role-chips"`, `role-chip-<id>`.
- **P3b Drag-and-drop user → role** (`Permissions.jsx`): Roles tab now ships a 3-col role-card grid + 1-col draggable users sidebar (`data-testid="dnd-users-sidebar"`). Drop a user (`draggable-user-<id>`) onto a role card (`role-drop-target-<role-id>`) to assign — emerald drop highlight, red block for admin/super_admin when non-super-admin. PUT `/access/users/{id}/permissions` sends only `assigned_roles` so `custom_permissions` are preserved.
- **Backend** (`access_control.py`): unchanged — already supports partial updates (only fields present in body are written).
- **Tested**: backend 3/3 PASS (`test_role_chips_dnd.py`); frontend code review verified all `data-testid`s and DnD handlers.


# Oryno Platform — Changelog


## Jun 14, 2026 — Banquet Customer Flow Overhaul (Laundry-style polish)
**Bug fix**
- **Cart → Checkout was blocked** when no event_date was set: `EventCartDrawer.goCheckout` required `cart.event_date` and threw an alert. Removed — checkout now collects the date itself (mirrors Laundry).

**Date moved to checkout** (out of search)
- `BanquetSearch.jsx`: removed event_date input + validation; URL params no longer include `date`.
- `BanquetCheckout.jsx`: added `event_date` (HTML date input), `expected_guests`, `city`, `event_type` editable fields wired to `setMeta` from `useEventCart`. Validation now blocks submit if `event_date` is missing.

**BanquetResults rewrite — Laundry-style polish, rose theme**
- New highlighted "Banquet & Event Services in {city}" hero card (rose-to-pink gradient) replaces the cluttered filter strip.
- Single **Filter** popover button beside the search bar (sort + price range + reset) — removes the under-bar filter row.
- Removed date display entirely from the URL/header.
- Category pills horizontally scrollable, gradient when active.
- `ServiceCard` and `PackageCard` are now **swipeable** (dots + hover arrows) and **clickable** — opens `BanquetDetailsModal`.
- Package cards: pronounced 3-line items list with **unit price** AND quantity per service.

**New `BanquetDetailsModal.jsx`**
- Full-resolution swipeable hero (dots + arrows + drag).
- Service variant: facts grid (capacity/duration/unit/operator), contact strip, category_details tiles, amenities chips, qty +/- and Add-to-cart CTA.
- Package variant: composite hero (package images + member-service photos), member services listed with thumbnail + per-unit price + line total + qty, breakdown card with subtotal/discount/total, Add Bundle / Remove CTA.

**Package images in management**
- `models/banquet.py::BanquetPackageCreate/Update`: added `images: List[str]` field.
- `BanquetManagement.jsx::PackagesTab`: added `MiniImageUploader` (max 5, folder `banquet_packages`) in the create/edit modal so operators can upload curated bundle photos that drive the customer-facing swipeable gallery.

**EventCartDrawer visual refresh**
- Rose-to-pink gradient header strip, white text, FAB rose-themed with count badge.
- Line items now show **service thumbnail + per-unit price + line total** in a clean card layout.
- Packages get a distinct rose-bordered card variant.
- Empty state with sparkles icon and friendly copy.

**BanquetCheckout colour**: all purple → rose to match official banquet palette.



## Jun 14, 2026 — Banquet Modals Polish (View + Package modals)
- **Service View Modal**: now a polished detail sheet — hero image with title-on-overlay + category badge + price ribbon, thumbnail strip (up to 6 images + "+N" pill), 2-column facts grid (location with map-pin, capacity range, default duration, unit + min qty, operator name, contact). Category-specific `category_details` rendered as small bordered tiles (e.g. cuisine type for catering, photography style for photographers). Amenities chip strip preserved. Footer with Edit / Close actions.
- **Package Create/Edit Modal**: added a **"Live preview · how customers will see it"** card below the totals — replicates the customer-facing package card (composite hero from first member service's image, stacked avatar strip, price/discount ribbon, draft-state warning). Lets operators iterate on name/discount/service mix without leaving the modal.



## Jun 14, 2026 — Orange Money LIVE + MoMo Refund Automation + Money Trail UI
**1. Orange Money signature scheme**
- `services/payment_ledger.py::verify_orange_money_signature()` — HMAC-SHA256 over `{X-OM-Timestamp}.{raw_body}` keyed by `ORANGE_MONEY_WEBHOOK_SECRET` with a 5-minute replay-protection window.
- `POST /api/v2/payments/webhook/orange-money` switched from 501 stub → live. Status map: `SUCCESS/SUCCESSFUL/COMPLETED → captured`, `FAILED/REJECTED/EXPIRED/TIMEOUT → failed`, `CANCELLED → voided`, `REFUNDED → refunded`. Dedup via existing `(provider, provider_event_id)` unique partial index.
- 4 new unit tests (valid signature, tampered body, stale timestamp, missing secret) — **all pass**.
- Added `ORANGE_MONEY_WEBHOOK_SECRET` placeholder to `/app/backend/.env`.

**2. Mobile-money refund automation**
- `services/mtn_momo_service.py`: added `transfer()` + `get_transfer_status()` methods that call MoMo's disbursement endpoint to push funds back to the subscriber wallet.
- `POST /api/v2/payments/{payment_id}/refund` now handles 3 providers:
  - **Stripe**: existing API call (unchanged).
  - **MTN MoMo**: live disbursement — appends `refunded` event with the disbursement reference id; full or partial amount.
  - **Orange Money**: records refund in the ledger (manual payout via portal — playbook said varies-by-aggregator). Status returned: `"recorded"` with reason for operator.
- Live-tested: partial refund → snapshot correctly flips to `partially_refunded` with net_amount = captured − refunded.

**3. Money Trail UI**
- `GET /api/v2/payments/by-order/{order_id}/timeline` — new endpoint resolving by order_id (snapshot lookup + payload-scan fallback). Returns `{order_id, payment_id, events, snapshot}`.
- `components/payment/MoneyTrail.jsx` — vertical stepper component: snapshot card (state, captured/refunded/net), then a chronological event timeline with per-type icons + colors (intent_created → captured → refunded → disputed → resolved). Live polls via `RotateCcw` refresh button. Test IDs: `money-trail`, `money-trail-event-{type}`, `money-trail-refresh`.
- `OrderDetailModal.jsx`: added a "Money Trail" section just below "Payment Summary" — visible to operators viewing any order.



## Jun 14, 2026 — Webhook Correlation + Richer Banquet Cards
**1. V2 Ledger ↔ Webhook Correlation**
- `routes/stripe_checkout.py`: `CheckoutRequest` now accepts `v2_payment_id`. The Stripe Checkout session metadata carries it through, and the `checkout.session.completed` webhook handler appends a `captured` event to `/api/v2/payments` (signature- + session-id-deduped). All non-fatal — failures of the v2 append are logged but never break the existing legacy flow.
- `routes/momo_checkout.py`: `MoMoPaymentRequest` accepts `v2_payment_id`, stored on the `payment_transactions` row. The status-poll handler appends `captured` on `SUCCESSFUL`, `failed` on FAILED/TIMED_OUT, `voided` on CANCELLED — each deduped via `{transaction_id}:{status}`.
- `StripeCheckoutModal` + `StripeCheckoutPanel`: `v2PaymentId` prop forwarded to `/api/checkout/session`.
- `PaymentMethodsSelection`: tracks `v2PaymentIdRef.current` from the v2 intent response and threads it into the Stripe modal + the MoMo request-to-pay body.
- **Smoke-tested**: Stripe and MoMo endpoints accept the new field; v2 intent endpoint returns `payment_id` consistently.

**2. Banquet Management — Richer Cards**
- **Service cards**: now lead with a 40-vh cover image (or category-tinted hero), price ribbon overlaid, multi-image count chip, category badge, line-clamped description, and a `category_details` chip strip + amenity chips. Adds an operator/contact strip at the bottom.
- **Package cards**: composite hero (first member service image), stacked avatar strip of 3 more service thumbnails, status badge, discount ribbon, stats row (service count / item count / savings), category chips, scrollable service breakdown with thumbnails.
- **Package creation modal — service picker**: each service row now renders with a 48px image thumbnail (or category-tinted icon), price, pricing model, city — picked rows get a pink-tinted card treatment for clarity.



## Jun 14, 2026 — Checkout Migration to V2 Ledger
- **`PaymentMethodsSelection.jsx`** (used by Cinema + Hotel + Restaurant + Travel etc.) now calls `POST /api/v2/payments/intent` **before** every provider hand-off. Adds a `createV2Intent(provider)` helper that writes the `intent_created` ledger row with the persisted `Idempotency-Key`. Failures are caught as non-fatal so existing Stripe/MoMo flows keep working even when the ledger endpoint is temporarily unhappy.
- Dead legacy fallback to `/api/payments/initiate` (mock) **removed** — replaced by the V2 intent call. Callers continue to read `data.success` / `data.transactionRef` because the wrapper preserves the legacy response shape.
- **`BanquetCheckout.jsx`** success screen now has a **"Pay now"** button that lazy-discloses `<PaymentMethodsSelection/>`, routing banquet orders through the same V2 ledger. Users who'd rather pay later still have "View my orders".
- **Smoke-tested** live: cinema-style + hotel-style + banquet-style intents accepted by `/api/v2/payments/intent`, each returns a `payment_id`. (Stripe live call needs a real `STRIPE_SECRET_KEY` — placeholder fails gracefully with the non-fatal try/catch.)



## Jun 14, 2026 — Immutable Payment Ledger (V2)
- **New collection `payment_events`**: append-only ledger. Every payment lifecycle change (intent → authorize → capture → refund → dispute) is a new row. Never overwritten.
- **New collection `payments`**: denormalized read-model auto-rebuilt by `refresh_snapshot()` on every event append. Rebuildable from the ledger at any time.
- **State machine** in `models/payment_event.py::reduce_events()` — handles out-of-order webhook delivery by sorting events by `occurred_at` before reducing. Supports partial refunds, full refunds, disputes won/lost.
- **Endpoints** (`/api/v2/payments/*`, hybrid — old `/api/payments/*` untouched):
  - `POST /intent` — requires `Idempotency-Key` header. Returns same `payment_id` on replay.
  - `GET /{payment_id}` — derived current state snapshot.
  - `GET /{payment_id}/timeline` — full immutable event history.
  - `POST /{payment_id}/refund` — admin refund initiation (Stripe only for now).
  - `POST /{payment_id}/recompute` — super-admin snapshot rebuild from ledger.
  - `POST /webhook/stripe` — signature verified + `event.id` dedup.
  - `POST /webhook/mtn-momo` — HMAC-SHA256 signature via `MTN_MOMO_WEBHOOK_SECRET` env var.
  - `POST /webhook/orange-money` — stub (501); structure mirrors MTN MoMo.
- **Replay protection**: unique partial indexes on `(provider, provider_event_id)` and `idempotency_key` (intent_created only). Duplicate webhooks no-op safely.
- **Tests**: `backend/tests/test_payment_ledger.py` — 13/13 PASS (reducer correctness, signature verification, dedup invariants, snapshot rebuild).
- **Live smoke**: intent → signed MoMo webhook → captured snapshot → replay webhook = same event count.



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

### 2026-02-14 — Operator categories (assign + filter) — iter211
- **Inline "Service Categories" section** added to the Edit Operator modal — chip-toggle UI per service area. Only renders sub-categories for parent areas the operator has enabled.
- **New "Categories" tab** at `/admin/operators/categories` (4th tab alongside Operators/Geography/Market Segments). Power-user view: every operator listed with chip panels, search + per-area filter, optimistic chip toggles persisted via PUT /api/operators/{id} (success toast on save).
- **Shared category catalog** at `/app/frontend/src/components/admin/operatorCategoryUtils.js` (CATEGORY_CATALOG + parseOperatorTags + serializeOperatorTags). Reusable widget at `OperatorCategoryAssign.jsx`.
- **Restaurant cuisine extended**: `/api/operators/by-service-category?service_type=restaurant&category=italian` now aggregates `db.restaurants` by `cuisine_type` to find matching operators (alongside the existing banquet path).
- **Service-types tagging convention**: operators' `service_types` array now accepts both bare (`banquet`, `restaurant`) and qualified (`banquet.photographer`, `restaurant.italian`) tags side-by-side. Pre-tagging works — operators show up in category-scoped dropdowns even before they have an active service row.
- **Tested**: Backend 5/5 PASS (test_iter211_operator_categories.py); Frontend Playwright verified tab rendering, chip toggle persistence, Edit Modal section, fallback empty-state. No defects found.

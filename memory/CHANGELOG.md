# Oryno Platform — Changelog


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


# Oryno Platform — Codebase Index

> Last refresh: **iter 226 (Feb 2026)**.
> This file is the navigation cheat-sheet for new sessions, fork agents and humans.
> When you add a new route / model / component, append it to the matching section so the next agent can find it in one grep.

## TL;DR — where things live

| You want to… | Look here |
| --- | --- |
> **⚠️ Important runtime note (iter 228)**: the frontend now serves a **bundled production build** (`vite build && vite preview`), not the Vite dev server. Reason: Cloudflare 429-throttled the dev server's hundreds of unbundled requests, which manifested as "no visible changes" for users. After editing any frontend file, run `cd /app/frontend && yarn build` (≈12s) and then `sudo supervisorctl restart frontend` for the change to reach the browser. Hot reload is **disabled** platform-wide (see `disableViteHmrClient` in `vite.config.js`).

| Add or modify an API endpoint | `/app/backend/routes/<domain>.py` |
| Define / extend a DB schema | `/app/backend/models/<domain>.py` (extend `BaseDocument`) |
| Add a customer-facing service page | `/app/frontend/src/pages/services/` |
| Add an operator-side management page | `/app/frontend/src/pages/management/` |
| Add an admin tool/page | `/app/frontend/src/pages/admin/` |
| Re-use a UI primitive | `/app/frontend/src/components/{shared,common,ui,services,management,...}` — all have a barrel `index.js` |
| Wire a third-party SDK | See the **Integrations** section in `PRD.md` |
| Cron / background tasks | `/app/backend/services/` |
| Run the existing pytest suites | `cd /app/backend && pytest tests/` |
| Run the existing JS lint | `cd /app/frontend && npx eslint src` |

---

## Repository layout (top level)

```
/app
├── backend/                # FastAPI + Motor (async MongoDB) service
│   ├── routes/             # All HTTP routers — each file = one domain
│   ├── models/             # Pydantic models + BaseDocument helpers
│   ├── services/           # Domain services (no HTTP, called by routes)
│   ├── middleware/         # Auth, audit, rate-limit, CORS, etc.
│   ├── tests/              # pytest suites (one file per iteration / domain)
│   ├── server.py           # FastAPI app factory; mounts every router
│   └── .env                # MONGO_URL, MONGO_DB_NAME, RESEND_API_KEY, EMERGENT_LLM_KEY, etc.
├── frontend/               # Vite + React (no SSR)
│   ├── src/
│   │   ├── api/            # Axios client + thin per-domain service wrappers
│   │   ├── components/     # See "Components" below
│   │   ├── contexts/       # AuthContext, OperatorContext, ...
│   │   ├── hooks/          # useFavourites, useEventCart, useOrderAbandonment, ...
│   │   ├── pages/          # Top-level routed pages
│   │   ├── utils/          # currency, date, validation, ...
│   │   └── App.jsx         # Route definitions
│   └── .env                # REACT_APP_BACKEND_URL only
├── memory/                 # PRD.md, CHANGELOG.md, ROADMAP.md, test_credentials.md, CODEBASE_INDEX.md (this file)
└── test_reports/           # JSON test reports produced by the testing agent (iter_N.json)
```

---

## Backend — routes (`/app/backend/routes/`)

Every router is mounted in `server.py` with a `/api` prefix. Group by domain:

### Auth / Users / RBAC
- `auth.py` — `/api/auth/*` — login, register, verify-account, invitations, resend-invite, password reset
- `users.py` — `/api/users/*` — admin user management (Super Admin only)
- `invitations.py` — `/api/invitations/*` — staff & operator invitation flow
- `operator_users.py` — `/api/operators/{id}/users/*` — team member CRUD scoped by an operator owner
- `operator_roles.py` — `/api/operators/{id}/roles/*` — per-operator role/permission templates
- `access_control.py` — `/api/access-groups/*` — admin access groups (cross-cutting roles)
- `employees.py` / `employee_scopes.py` — platform employees + attribute-based scoping
- `admin_bootstrap.py` — protected super-admin auto-seed on startup
- `otp.py` — `/api/otp/*` — phone OTP verification (used by checkout flows)

### Marketplace verticals
- `operators.py` — `/api/operators/*` — operator CRUD, profile, services list
- `hotels.py` — `/api/hotels/*` — hotel CRUD + image upload (incl. `latitude`/`longitude`)
- `rooms.py` — `/api/rooms/*` — rooms scoped to a hotel
- `travel_routes.py` — `/api/routes/*` — bus routes (incl. `pickup_address`/`pickup_lat`/`pickup_lon`)
- `vehicles.py` — `/api/vehicles/*` — legacy travel-vehicles endpoint
- `travel.py` — `/api/travel/*` — public search wrappers used by TravelResults
- `car_rental.py` — `/api/car-rental/*` — vehicle catalogue + bookings (Detailed Information schema)
- `restaurants.py` — `/api/restaurants/*` — restaurant + menu management
- `cinema.py` — `/api/cinema/*` — films, screenings, seat-grid, showtimes
- `banquets.py` — `/api/banquets/*` — banquet venues + packages
- `events.py` / `events_management.py` — `/api/events/*` — event venues + bookings
- `pressing.py` — `/api/pressing/*` — laundry catalogue + orders
- `packages.py` / `package_services.py` — `/api/packages/*` — package shipments
- `pods.py` — `/api/pods/*` — pickup-pod locations

### Shared marketplace machinery
- `seat_bookings.py` + `seat_ws.py` — `/api/seat-bookings/*` + WS at `/ws/seats/...` — real-time seat hold & confirmation
- `orders.py` — `/api/orders/*` — central order document (every vertical writes here)
- `ratings.py` — `/api/ratings/*` — entity-agnostic ratings + reviews (used by car-rental, hotel, etc.)
- `favourites.py` — `/api/favourites/*` — heart icon across the platform
- `subscriptions.py` — `/api/subscriptions/*` — follow-an-operator notifications
- `promo_codes.py` — `/api/promo-codes/*`
- `loyalty.py` — `/api/loyalty/*` — points + tiers
- `commission.py` — `/api/commission/*` — operator commission splits
- `notifications.py` — `/api/notifications/*` — in-app inbox
- `communications.py` — service-side messaging (operator <-> customer)
- `customer_location.py` — `/api/customer-location/*` — last-seen city heuristic for filtering
- `inventory.py` — `/api/inventory/*` — units / holds / banquet_items (iter 230)
- `search.py` / `suggestions.py` — `/api/search/*` — global cross-vertical search
- `validation.py` + `routes/validation.py` (admin tools)
- `database_management.py` — admin DB inspection tools
- `analytics.py` / `reports.py` — `/api/analytics/*`, `/api/reports/*`
- `management_dashboard.py` — `/api/management/*` — operator-side dashboard endpoints
- `manual_bookings.py` — operator-driven manual bookings
- `support.py` / `support_tickets.py` — `/api/support/*`
- `document_templates.py` — `/api/document-templates/*`
- `geography.py` — `/api/geography/*` — countries / cities / regions
- `system_settings.py` — `/api/system/*` — feature flags & global config
- `uploads.py` — `/api/uploads/*` — generic file upload endpoint (S3-compatible)
- `public.py` — `/api/public/*` — unauthenticated marketing data

### Payments
- `payments.py` (legacy) / `payments_v2.py` — central payment dispatcher
- `momo_checkout.py` — MTN/Orange Money checkout
- `stripe_checkout.py` — Stripe + Stripe-with-crypto
- `payment_event.py` — webhook event handlers (see also `models/payment_event.py`)

---

## Backend — models (`/app/backend/models/`)

All extend `BaseDocument` (custom `PyObjectId` alias for `_id` → `id`, plus `to_mongo() / from_mongo()`).
**Never spread Mongo docs raw** — always go through `Model.from_mongo(doc)` before returning JSON.

| Model | Notable fields |
| --- | --- |
| `user.py` | role, status (`pending_verification`/`active`/`blocked`), permissions, `is_protected` |
| `operator.py` | services[], commission_rates, operator_owner_id |
| `hotel.py` | **`latitude`, `longitude`** (used by LocationMap), star_rating, amenities |
| `room.py` / `room_booking.py` | base_price, bed_type, size_sqm, capacity |
| `travel_route.py` | **`pickup_address`, `pickup_lat`, `pickup_lon`**, vehicle_type, valid_from/to |
| `vehicle.py` | (legacy) — buses |
| `seat_booking.py` | hold semantics + TTL |
| `cinema.py` | film, screening, seat-grid |
| `restaurant.py` | menu items, opening_hours |
| `banquet.py` | venue, packages, hold TTL |
| `event.py` | event venues, ticket tiers |
| `pressing.py` | laundry items, turnaround |
| `package.py` | shipment fields |
| `pod.py` | pickup locations |
| `order.py` | catch-all customer order doc — every vertical writes here |
| `payment_event.py` | normalised webhook payload (MTN/Stripe/Orange) |
| `loyalty.py` / `promo_code.py` / `commission.py` | self-explanatory |
| `notification.py` | in-app inbox |
| `geography.py` | country/region/city lookup |
| `employee.py` / `employee_scope.py` / `access.py` | RBAC + ABAC |

---

## Backend — services (`/app/backend/services/`)

Cron-style / non-HTTP logic lives here:

| Service | Purpose |
| --- | --- |
| `email_service.py` | Resend-based invites + transactional emails (sandbox-aware) |
| `sms_service.py` | Infobip SMS dispatcher |
| `payment_dispatcher.py` | Routes a checkout to MoMo / Stripe / Crypto |
| `notification_dispatcher.py` | Fan-out to in-app + email + SMS |
| `seat_hold_reaper.py` | Releases expired seat holds |
| `commission_settlement.py` | Periodic commission accruals |
| `subscription_blaster.py` | Operator-followers fan-out |

---

## Frontend — routes (`/app/frontend/src/App.jsx`)

Major route groups (see `App.jsx` for exact paths):

- **Public**: `/`, `/about`, `/help`, `/explore`
- **Auth**: `/login`, `/register`, `/verify-account`, `/forgot-password`
- **Customer**: `/services/<vertical>/...`, `/profile`, `/orders`, `/favourites`, `/subscriptions`, `/loyalty`
- **Operator**: `/management/<area>`
- **Admin**: `/admin/<area>`
- **Utility**: `/payment/return`, `/share/<token>`, fallback 404

### Customer service pages (`pages/services/`)

| Vertical | Search | Results | Details | Booking / Checkout |
| --- | --- | --- | --- | --- |
| Travel | `Travel.jsx` | `TravelResults.jsx` (+ folder) | _opens `TripDetailsModal` from results_ | `TravelBooking.jsx` |
| Hotel | `Hotels.jsx` | `HotelsResults.jsx` | `HotelDetails.jsx` (+ folder) | `HotelBooking.jsx` |
| Car Rental | `CarRentalSearch.jsx` | `CarRentalResults.jsx` | `CarRentalDetails.jsx` | `CarRentalBooking.jsx` |
| Cinema | `Cinema.jsx` | `CinemaResults.jsx` | `CinemaDetails.jsx` | `CinemaBooking.jsx` |
| Restaurant | `Restaurants.jsx` | `RestaurantsResults.jsx` | `RestaurantDetails.jsx` | `RestaurantBooking.jsx` |
| Banquet | `Banquet.jsx` | `BanquetResults.jsx` | `BanquetDetails.jsx` | `BanquetBooking.jsx` → `BanquetCheckout.jsx` |
| Laundry | `Laundry.jsx` | `LaundryResults.jsx` | _opens `LaundryShopDetailsModal`_ | `LaundryBooking.jsx` |
| Packages | `Packages.jsx` | `PackagesResults.jsx` | `PackageDetails.jsx` | `PackageBooking.jsx` |
| Events | `Events.jsx` | `EventsResults.jsx` | `EventDetails.jsx` | `EventBooking.jsx` |

### Recently split sub-folders
- `pages/services/HotelDetails/` — `HotelImageGallery`, `HotelRoomCard`, `AmenityIcons` (named: `AmenityIcon`, `LandmarkIcon`)
- `pages/services/TravelResults/` — `TripCardGrid`, `TripCardList`, `VehicleImageThumbnails`, `helpers.js`

---

## Frontend — components (`/app/frontend/src/components/`)

### `components/shared/` _(barrel: `./index.js`)_
General-purpose, vertical-agnostic UI primitives.
**Key exports**: `LocationMap`, `DatePickerField`, `DatePickerModal`, `FavouriteButton`, `LocationInput`, `MiniImageUploader`, `OperatorBookingBlock`, `OperatorPicker`, `PageTitle`, `SetupWizard`, `SubscribeButton`, `AdminModal`, `AlmostSoldOutBadge`.

### `components/common/` _(barrel: `./index.js`)_
Higher-level building blocks for management & admin dashboards.
**Key exports**: `ViewModeToggle`, `Pagination`, `PaymentMethodsSelection`, `PaymentProcessingOverlay`, `PermissionGate`, `OperatorScopeFilter`, `QuickDateRangeFilter`, `MoMoPaymentButton`, `StripeCheckoutButton`, `CommissionBreakdown`.

### `components/services/` _(barrel: `./index.js`)_
Customer-side service modals. **Exports**: `TripDetailsModal`, `LaundryShopDetailsModal`.

### `components/management/`
- `OperatorRolesManagement.jsx`, `OperatorTeamManagement.jsx`, `OperatorTeamMemberWizard.jsx`, `ServiceCommunicationsHub.jsx`, `ServiceExecutiveDashboard.jsx`
- Sub-folders per vertical with form components: `banquet/`, `hotel/HotelForm.jsx` (lat/lon inputs), `laundry/`, `package/`, `restaurant/`, `travel/RouteForm.jsx` (pickup fields)
- `management/shared/` — `ManagementShell.jsx`, `SubpageCard.jsx`, `DataTable.jsx` (a.k.a. `SearchFilter` — uses shared `ViewModeToggle` internally), `ServiceFormShell.jsx`, `Pagination.jsx`, `EmptyState.jsx`, `ActionMenu.jsx`, `StatusBadge.jsx`

### `components/{admin,banquet,booking,cinema,customer-service,modals,payment,travel}/`
Domain-specific composable widgets. Read the folder's `README.md` if present, otherwise scan filenames — they follow `<Feature><Variant>.jsx`.

### `components/ui/`
Pure shadcn primitives (`Button`, `Card`, `Dialog`, `Select`, …). **Don't put logic here.**

---

## Frontend — hooks (`/app/frontend/src/hooks/`)

| Hook | Purpose |
| --- | --- |
| `useAuth` (via `contexts/AuthContext`) | session + token + user object |
| `useFavourites(entityType)` | toggle + isFav for any entity |
| `useEventCart` | banquet cart with 10-min TTL + countdown |
| `useOrderAbandonment` | tracks unfinished checkouts for the dashboard widget |
| `usePermissions` | wraps `PermissionGate` checks |
| `useOperatorScope` | filters management lists by selected operator |

---

## Memory / docs (`/app/memory/`)

| File | What's in it |
| --- | --- |
| `PRD.md` | Original problem statement + iteration-by-iteration changelog (most recent at top) |
| `ROADMAP.md` | Prioritised backlog (P0/P1/P2) |
| `CHANGELOG.md` | _(may be absent — newest entries live at top of PRD.md instead)_ |
| `test_credentials.md` | Live seeded user accounts — **always update when seeding/rotating** |
| `CODEBASE_INDEX.md` | **This file.** |

---

## Testing

- **Backend pytest**: `cd /app/backend && pytest tests/` — one file per feature iteration (`test_iter225_pickup_and_hotel_coords.py`, `test_user_invite_flow.py`, ...).
- **Frontend lint**: `cd /app/frontend && npx eslint src`.
- **End-to-end**: triggered via the `testing_agent_v3_fork` tool. Reports land in `/app/test_reports/iteration_<N>.json`.

---

## Conventions cheat-sheet

- **Backend route prefix**: every router goes through `/api`. Never expose a non-prefixed FastAPI route.
- **Backend models**: extend `BaseDocument`, use `PyObjectId`, never return raw `_id`.
- **Datetime**: `datetime.now(timezone.utc)` everywhere — never `datetime.utcnow()`.
- **Frontend API**: only `import api from '@/api/client'` (axios with token interceptor) — base URL comes from `REACT_APP_BACKEND_URL`.
- **Frontend env**: `process.env.REACT_APP_BACKEND_URL` in JSX, `import.meta.env.VITE_BACKEND_URL` only inside Vite-managed config.
- **`data-testid`**: every interactive element + every critical info display must have one (kebab-case, function-not-style based).
- **Permission gates**: wrap mutating buttons in `<PermissionGate permission="domain.action">`. Operator owners can only delegate permissions they themselves possess.
- **Money**: always FCFA via `formatFCFA` / `formatCurrency` from `@/utils/currency`.
- **Maps**: drop in `LocationMap` from `@/components/shared` — never re-instantiate Leaflet directly.

---

## Adding a new vertical — minimal checklist

1. `backend/models/<vertical>.py` — Pydantic models + `BaseDocument`.
2. `backend/routes/<vertical>.py` — CRUD + customer search endpoints, prefix `/api/<vertical>`.
3. Register in `server.py` (`app.include_router(...)`).
4. `frontend/src/pages/services/<Vertical>{,Results,Details,Booking}.jsx`.
5. `frontend/src/pages/management/<Vertical>Management.jsx` — wrap in `ManagementShell` + `ViewModeToggle`.
6. Route declarations in `frontend/src/App.jsx`.
7. Append to the "Customer service pages" table above.

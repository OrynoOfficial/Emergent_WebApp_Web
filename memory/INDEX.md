# Oryno Platform — Code Index

Navigation aid for the codebase. Use this when you need to find a specific
flow or feature. Updated Feb 2026.

## 🏗 Top-level layout

```
/app
├── backend/                # FastAPI + Motor (MongoDB)
│   ├── routes/             # All HTTP endpoints. One file per resource.
│   ├── models/             # Pydantic schemas (request/response/DB shapes)
│   ├── services/           # Business logic + 3rd-party integrations
│   ├── utils/              # Shared helpers (auth, indexes, rate limit, etc.)
│   ├── config/             # DB connection, settings, permissions registry
│   ├── tests/              # pytest — exclusively integration tests
│   ├── scripts/            # One-off ops scripts (cleanup, seeds, migrations)
│   └── server.py           # FastAPI app + router includes
├── frontend/
│   ├── src/pages/          # Top-level routes (one file per /url segment)
│   │   ├── admin/          # /admin/*  — admin & super-admin pages
│   │   ├── management/     # /management/*  — operator dashboards
│   │   ├── services/       # /services/*  — customer-facing booking flows
│   │   ├── customer/       # /customer/*  — customer self-service
│   │   └── auth/           # /login, /register, /verify-account, …
│   ├── src/components/
│   │   ├── ui/             # Shadcn primitives (button, dialog, table, …)
│   │   ├── admin/          # Admin-specific composite widgets
│   │   ├── management/     # Operator-dashboard composite widgets
│   │   ├── booking/        # Cross-service booking widgets (BookerInfoSection, …)
│   │   ├── modals/         # OrderDetailModal, RefundDetailModal, …
│   │   └── shared/         # Cross-app widgets (BulkActionsBar, OperatorBookingBlock, …)
│   ├── src/hooks/          # Reusable React hooks
│   ├── src/contexts/       # React contexts (Auth, BookingDraft, …)
│   ├── src/api/            # Axios client + interceptor
│   └── src/utils/          # Pure helpers (currency, dates, …)
└── memory/
    ├── PRD.md              # Product requirements + change history
    ├── INDEX.md            # ← you are here
    └── test_credentials.md # Test accounts
```

## 🌐 Route ↔ Page ↔ Backend map

| URL                          | Frontend file                          | Backend router            | Key endpoints |
| ---------------------------- | -------------------------------------- | ------------------------- | ------------- |
| `/login`                     | pages/auth/Login.jsx                   | routes/auth.py            | POST /auth/login, /refresh |
| `/register`                  | pages/auth/Register.jsx                | routes/auth.py            | POST /auth/register |
| `/verify-account`            | pages/auth/VerifyAccount.jsx           | routes/auth.py            | POST /auth/verify-account |
| `/admin/refunds`             | pages/admin/AdminRefunds.jsx           | routes/refunds.py         | GET / & {id}/details, POST {id}/approve & reject |
| `/admin/commission`          | pages/admin/CommissionManagement.jsx   | routes/commission.py      | GET /resolve, CRUD on /commission-config/ |
| `/admin/operators`           | pages/admin/OperatorsManagement.jsx    | routes/operators.py       | CRUD on /operators/* |
| `/admin/refunds`             | pages/admin/AdminRefunds.jsx           | routes/refunds.py         | (see above) |
| `/management/events`         | pages/management/EventsManagement.jsx  | routes/event_*            | /event-locations, /event-showtimes |
| `/management/cinemas`        | pages/management/CinemaManagement.jsx  | routes/cinema.py          | /films, /screenings |
| `/services/showtimes/:id`    | pages/services/ShowtimeDetails.jsx     | routes/event_showtimes.py | GET /:id, POST /book |
| `/services/cinema/:id`       | pages/services/CinemaBooking.jsx       | routes/cinema.py          | /showtimes/:id/book |
| `/services/hotels/:id`       | pages/services/HotelBooking.jsx        | routes/hotels.py          | /hotels/:id/book |
| `/services/travel/:id`       | pages/services/TravelBooking.jsx       | routes/travel.py          | /routes/book |
| `/services/restaurants/:id`  | pages/services/RestaurantBooking.jsx   | routes/restaurants.py     | /restaurants/:id/order |
| `/services/car-rentals/:id`  | pages/services/CarRentalBooking.jsx    | routes/car_rentals.py     | /vehicles/:id/book |
| `/services/packages/:id`     | pages/services/PackageBooking.jsx      | routes/packages.py        | /packages/:id/book |
| `/services/banquets/:id`     | pages/services/BanquetBooking.jsx      | routes/banquets.py        | /banquets/:id/book |
| `/orders`                    | pages/customer/Orders.jsx              | routes/orders.py          | /orders, /orders/:id |
| `/scanner`                   | pages/utility/Scanner.jsx              | routes/orders.py          | /orders/scan/validate, /scan/check-in |

## 🔑 Cross-cutting concerns

| Concern                | Where it lives | Notes |
| ---------------------- | -------------- | ----- |
| Auth (JWT + refresh)   | routes/auth.py + utils/token_revocation.py | Refresh rotates; reuse burns the family |
| Permissions            | config/permissions.py + utils/dependencies.py (`require_permission`) | Super-admin bypass enabled by default |
| Rate limiting          | utils/rate_limit.py | Per-endpoint decorators (e.g. `@limit("60/minute")`) |
| Email                  | services/email_service.py | Resend SDK; falls back to invite-link in API response |
| Payments               | services/stripe_service.py, mobile_money_service.py | MoMo/Orange flagged manual |
| File uploads           | routes/uploads.py | Returns CDN URLs; backed by object storage |
| QR generation          | routes/qr.py | Self-hosted PNG |
| Commission resolution  | routes/commission.py — `/resolve` | Hierarchy: operator → category → global → 5% |
| Refund lifecycle       | routes/refunds.py | Stripe = automatic; MoMo/Orange = manual flag |
| Bulk actions           | routes/admin_bulk.py + hooks/useBulkSelection.js + components/shared/BulkActionsBar.jsx | Whitelist guarded |

## 🪝 Reusable frontend hooks

| Hook                            | Purpose |
| ------------------------------- | ------- |
| `useAuth()`                     | Logged-in user, login/logout, roles |
| `useCommissionRate(st, opId)`   | Effective commission for a service+operator (with 5-min cache) |
| `useBulkSelection(rows)`        | Multi-row selection state + toggles |
| `useSidebarMenu()`              | Permission-filtered nav items (used by Layout) |
| `useBookingDraft()`             | Persisted multi-step booking state |
| `useUserLocation()`             | LocationContext consumer |

## 🧰 Reusable backend helpers

| Helper                            | Use case |
| --------------------------------- | -------- |
| `require_permission(slug)`        | FastAPI dependency for permission-gated routes |
| `get_current_active_user`         | Resolves logged-in user (raises 401/403) |
| `PyObjectId` / `BaseDocument`     | Pydantic ↔ Mongo serialization (see CRITICAL RULES) |
| `_enrich_refund_with_customer`    | Attach customer block to refund rows |
| `services.StripeService`          | Wraps Stripe SDK with our error format |

## 📊 MongoDB collections (production schema)

See `backend/utils/startup_indexes.py` for the full index manifest. Hot collections:

| Collection        | Primary key | Frequent queries |
| ----------------- | ----------- | ---------------- |
| users             | _id (UUID)  | email lookup, role filter |
| orders            | _id (UUID)  | user_id+created_at, payment_status, service_id |
| refunds           | _id (UUID)  | status+created_at, user_id, order_id |
| event_showtimes   | _id (UUID)  | operator_id+status+start, location_id+start |
| event_locations   | _id (UUID)  | operator_id+is_active, city+is_active |
| commission_configs | _id (UUID) | service_type+operator_id+is_active (cascade resolve) |
| ticket_validations | _id (UUID) | order_id, scanned_by+created_at |
| bills             | _id (UUID)  | user_id+created_at, operator_id+status |
| receipts          | _id (UUID)  | order_id, user_id+created_at |

## 🧪 Test layout

```
backend/tests/
├── conftest.py                       # rate-limit reset between tests
├── test_refund_lifecycle.py          # 12 — full refund flow
├── test_refund_details_modal.py      # 3 — admin detail endpoint
├── test_scanner_refund_overlay.py    # 4 — scanner refund banners + check-in block
├── test_commission_resolution.py     # 6 — hierarchy + super-admin CRUD
├── test_event_poster_url.py          # 3 — poster_url round-trip
├── test_user_invite_flow.py          # signup → verify → login
├── test_iter237_event_locations_showtimes.py
└── …                                  # ~30+ other regression files
```

Run:
```
cd /app/backend
python -m pytest tests/ -v             # all
python -m pytest tests/test_refund_lifecycle.py -v
```

## 🧹 Ops scripts

| Script                              | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `backend/scripts/cleanup_test_data.py` | Surgical delete of test/QA-generated data. `--apply` to execute. |

## 🎨 Service color tokens

The `BookerInfoSection` and per-page accents follow these colour families:

| Service   | Accent slug | Primary class |
| --------- | ----------- | ------------- |
| Cinema    | `cinema`    | cyan-600      |
| Events    | `events`    | pink-600      |
| Hotel     | `hotel`     | amber-600     |
| Travel    | `travel`    | emerald-600   |
| Default   | `navy`      | #082c59       |

## 🚦 When in doubt

- Need to add a new endpoint? → `routes/<resource>.py` + register in `server.py` + add tests in `tests/`.
- Need to add a permission gate? → add slug to `config/permissions.py`, use `require_permission()` in the route.
- Need to add a new booking page? → mirror `ShowtimeDetails.jsx` (most modern), use `useCommissionRate` for the fee, `BookerInfoSection` for contact, and `PaymentMethodsSelection` for inline payment.
- Need to add bulk actions to a management page? → see "Operators" wiring in `OperatorsManagement.jsx` (header checkbox + per-row checkbox + `<BulkActionsBar />`).

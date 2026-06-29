# Oryno API — Mobile Client Contract Cheat Sheet

**OpenAPI spec:** see `oryno-openapi.json` (next to this file). 533 KB, 440 endpoints, 194 schemas.

**Base URL (production):** `https://app.oryno.tech/api`
**Base URL (preview, may rotate):** see `REACT_APP_BACKEND_URL` in the web project's `frontend/.env` + `/api` suffix.

**Auth:** JWT bearer in `Authorization: Bearer <access_token>` header. Refresh-token rotation supported.

---

## 1. Auth (4 endpoints)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account. Returns `{access_token, refresh_token, user}`. |
| `POST` | `/api/auth/login` | Email+password login. Returns `{access_token, refresh_token, user}`. |
| `POST` | `/api/auth/refresh` | Body: `{refresh_token}`. Returns new `{access_token, refresh_token}` (rotation). |
| `GET`  | `/api/auth/me` | Returns current user. Requires bearer. |

---

## 2. Service categories — list/browse endpoints

All return paginated `{items: [...], total: int, page: int, page_size: int}` shapes. Filtering via query params (city, price_min, price_max, etc. — see schema).

| Category | List/Search | Detail | Book |
|---|---|---|---|
| **Hotels** | `GET /api/hotels/` | `GET /api/hotels/{hotel_id}` | `POST /api/rooms/bookings/reserve` then `POST /api/rooms/bookings/confirm` |
| **Restaurants** | `GET /api/restaurants/` | `GET /api/restaurants/{restaurant_id}` (+ `/menu`) | `POST /api/restaurants/{restaurant_id}/orders` |
| **Travel** | `GET /api/travel/routes` | `GET /api/travel/routes/{route_id}` | `POST /api/orders/create` (with `service_type=travel`) |
| **Car Rental** | `GET /api/car-rental/` | `GET /api/car-rental/{car_id}` | `POST /api/car-rental/book` |
| **Cinema** | `GET /api/cinema/films` | `GET /api/cinema/showtimes/{showtime_id}/details` | `POST /api/cinema/showtimes/{showtime_id}/book` |
| **Events** | `GET /api/events/` | `GET /api/events/{event_id}` | `POST /api/events/{event_id}/book` |
| **Pressing / Laundry** | `GET /api/pressing/` | `GET /api/pressing/{shop_id}` | `POST /api/orders/create` (with `service_type=laundry`) |

---

## 3. Search

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/search/?q=...&category=&city=` | Returns mixed results across services. |
| `GET` | `/api/search/suggestions?q=...` | Autocomplete chips. |

---

## 4. Cart / Checkout / Payments

Oryno does NOT have a server-side cart — clients accumulate items locally and call `POST /api/orders/create` per booking, then either Stripe Checkout or MoMo init.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/orders/create` | Create a pending order. Body includes `service_type`, `service_id`, `booking_details`, `total_amount`. Returns `{order_id, order_number, total_amount}`. |
| `GET` | `/api/orders/` | List user's orders. Returns `{orders: [...]}`. |
| `GET` | `/api/orders/{order_id}` | Order detail (includes `booking_details`, status, money trail). |
| `PUT` | `/api/orders/{order_id}/cancel` | Customer-initiated cancel. |
| **Stripe Checkout** | | |
| `POST` | `/api/checkout/session` | Body: `{order_id, success_url, cancel_url}`. Returns `{checkout_url}` → open in WebBrowser. |
| `GET` | `/api/checkout/status/{session_id}` | Poll for completion (or use webhook). |
| `POST` | `/api/checkout/webhook/stripe` | (Server-only — Stripe → Oryno.) |
| **MoMo (Mobile Money)** | | |
| `POST` | `/api/payments/initiate` | Body: `{order_id, payment_method:'mtn'|'orange', phone}`. |
| `GET` | `/api/payments/status/{payment_id}` | Poll for completion. |

---

## 5. Push Notifications

⚠️ **Heads-up:** the in-app notifications endpoints exist (`/api/notifications/*`) for fetching the user's notification feed, but **the device-token registration endpoint for APNs/FCM does NOT exist yet**. The web backend will need to add:

```
POST /api/notifications/register-device
Body: {
  device_token: string,       // FCM token (Android) or APNs token (iOS)
  platform: 'ios' | 'android',
  app_version: string,
  device_id: string           // stable per-install ID
}
```

For now, scaffold the call site in the mobile app but don't block on it — the web team will add this endpoint shortly. In-app notification fetching works already:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/notifications/` | List user notifications. |
| `PUT` | `/api/notifications/{notification_id}/read` | Mark single read. |
| `PUT` | `/api/notifications/read-all` | Mark all read. |
| `DELETE` | `/api/notifications/{notification_id}` | Delete one. |
| `DELETE` | `/api/notifications/clear-all` | Clear feed. |

---

## 6. Convention notes for the mobile agent

- **Path prefixes:** every API route is mounted under `/api/*`. Never strip the prefix.
- **Trailing slash:** most list endpoints end with `/` (e.g. `/api/hotels/`, `/api/restaurants/`). FastAPI is sensitive to this — match the spec exactly.
- **Errors:** 4xx responses are `{detail: string}` (single error) or `{detail: [{loc, msg, type}]}` (Pydantic validation).
- **Rate limiting:** auth/OTP routes are rate-limited; 429 responses include `Retry-After` header. Implement exponential backoff.
- **Service category enum:** when sending `service_type` or `service_category`, use these exact lowercase strings: `hotel`, `restaurant`, `travel`, `car_rental`, `cinema`, `event`, `laundry`, `pressing`.
- **Currency:** all amounts are integer FCFA (Central African franc). No decimal handling needed.

---

## 7. Test accounts (preview env only, do not use in production builds)

- Customer: `customer@test.com` / `testpassword123`
- Operator: `operator@test.com` / `testpassword123`
- Admin: `admin@test.com` / `testpassword123`
- Super Admin: `superadmin@oryno.com` / `testpassword123`

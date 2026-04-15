# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Laundry Management Blank Screen Fix**
- Root cause: `services` array in DB contains objects `{name, type, price}`, not strings. Calling `.replace()` on objects crashed the component.
- Fix: Added `typeof` checks before calling `.replace()` on service items in LaundryManagement.jsx (lines 254, 346, 425)
- Also fixed duplicate `isFav`/`toggleFav` JSX props in 5 result pages (Laundry, Cinema, Events, Packages, Banquet)

**Apr 2026 - Mock Data Removal & Result Page Fixes**
- Removed all `MOCK_EVENTS`, `MOCK_SERVICES`, `MOCK_FILMS` from result pages
- All result pages now strictly fetch from backend APIs
- Cinema `/films` API route reordered before `/{cinema_id}` to prevent conflicts
- Event cover image upload added to EventsManagement.jsx
- Subscribe button moved to result page cards (all 9 service types)

**Apr 2026 - Unified Booking Guest Info Component**
- Created shared `BookerInfoSection` at `/components/booking/BookerInfoSection.jsx`
- Identical template across all booking pages: gradient navy header, self-fill toggle, 4 fields
- Self-fill toggle fetches latest profile from `/api/auth/me`

**Apr 2026 - Reports with Real Data & Operator Scoping**
- 8 report types pulling real MongoDB data, operator scoping, Visual/Data/Download

**Apr 2026 - Operator Scoping for Support Tickets & Promo Codes**
- Support tickets and promo codes scoped per operator

**Apr 2026 - ValidationManagement.jsx & Login.jsx Refactoring**
- ValidationManagement: 1092 -> 367 lines. Login: 1006 -> 275 lines

**Apr 2026 - Unified Tab Styling + Sidebar Restructure**
- Full-width grid tabs, System menu, Reports page, Database removed

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement (WebSocket-based graphical seat map)
- P2: Date range filters for Admin/Operator reports

## Key Technical Notes
- `operator_id` is stored as UUID string, NOT BSON ObjectId
- Pressing services in DB are objects `{name, type, price}`, not plain strings
- Login response uses `access_token` field (not `token`)
- Tabs use Shadcn `<Tabs>` components (not native HTML)

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

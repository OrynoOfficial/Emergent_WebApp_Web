# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Ticket Scanner & Validation System**
- Real-time ticket scanning: operators enter ticket codes, system validates against actual orders
- Operator scoping: operators can only validate/check-in tickets for their own services
- Check-in flow: confirmed+paid tickets can be checked in once; prevents double check-in
- Endpoints: POST /api/orders/scan/validate, POST /api/orders/scan/check-in
- Frontend: Scanner page with code input, validation results, check-in button, scan history
- Sidebar: "Ticket Scanner" link added for operators

**Mar 2026 - Operator Dashboard Fix**
- RoleBasedRedirect: operators → /admin/analytics, customers → /dashboard
- Dashboard.jsx guard: redirects non-customers to their proper dashboard
- Analytics.jsx: fixed operatorContext property names for scoped data

**Mar 2026 - Operator Orders & Service Status**
- Orders now include operator_id (looked up from service at creation time)
- Service status: operators cannot set active; edits reset to pending; suspend/reinstate endpoints
- Service creation: travel/hotels now default to "pending" status

**Earlier:** Loyalty system, notifications, deep-linking, promo codes, ratings, Stripe, AI chatbot

## Key API Endpoints
- POST /api/orders/scan/validate — Validate ticket by order_number
- POST /api/orders/scan/check-in — Check in a validated ticket
- POST /api/validation/services/{type}/{id}/suspend — Operator suspends service
- POST /api/validation/services/{type}/{id}/reinstate — Operator reinstates (→ pending)

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement
- P2: Customizable Email Templates
- P3: Bulk moderation features for ratings

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

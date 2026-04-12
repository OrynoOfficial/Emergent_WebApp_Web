# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Audit Logs Expanded + Compact Layout**
- Admin/Super Admin now see activity from ALL user roles (customers, operators, admins)
- Log items ~50% smaller with compact single-line layout, 40 per page

**Apr 2026 - Ticket Scanner & Validation System**
- Real-time ticket scanning with operator scoping
- Check-in flow: confirmed+paid tickets checked in once; prevents double check-in
- Endpoints: POST /api/orders/scan/validate, POST /api/orders/scan/check-in

**Mar 2026 - Operator Dashboard & Orders Fix**
- Orders now include operator_id; RoleBasedRedirect for proper dashboard routing
- Analytics scoped to operator via operatorContext.operator_id

**Mar 2026 - Service Status Control**
- Operators cannot activate services; edits reset to pending
- Suspend/reinstate endpoints; RouteForm status read-only for operators

**Mar 2026 - Operator Rewards & Alerts Admin Tab**
- New "Op. Rewards" tab in admin Loyalty page with search/filters

**Mar 2026 - Loyalty Enhancements**
- Collapsible codes, search/filters, Create Promotion modal (discount only, % input)
- Operator-scoped promo codes with strict validation

**Earlier:** Notification center, deep-linking, loyalty program, subscriptions, ratings, service management, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - UI Polish: Default Views, Grid Cards, Header**
- Audit Logs default view changed to List
- Customer Service default view changed to Grid with rich ticket cards (description, category, assignee, tags, customer info)
- Welcome header text size reduced significantly (text-sm)

**Apr 2026 - Sidebar Navigation Restructure**
- New "System" menu: Sys Config (Settings), Audit Logs, Commission
- Reports extracted from Audit Logs into standalone page under Admin Config
- Database page completely removed
- Audit Logs default view set to "details" then updated to "list"

**Apr 2026 - Audit Logs Expanded + Compact Layout**
- Admin/Super Admin now see activity from ALL user roles (customers, operators, admins)
- Log items ~50% smaller with compact single-line layout, 40 per page
- 3 view modes: Details, List, Grid with role exclusion filters

**Apr 2026 - Ticket Scanner & Validation System**
- Real-time ticket scanning with operator scoping
- Check-in flow: confirmed+paid tickets checked in once; prevents double check-in

**Mar 2026 - Operator Dashboard & Orders Fix**
- Orders now include operator_id; RoleBasedRedirect for proper dashboard routing

**Mar 2026 - Service Status Control**
- Operators cannot activate services; edits reset to pending

**Mar 2026 - Loyalty Enhancements**
- Collapsible codes, search/filters, operator-scoped promo codes

**Earlier:** Notification center, deep-linking, loyalty program, subscriptions, ratings, service management, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Operator Scoping for Support Tickets & Promo Codes**
- Support Tickets: GET /, stats, stats/detailed, GET /{id} now scope by operator_id OR customer_id for operators
- Promo Codes: DELETE /{code} now scoped by operator_id for operators
- Communications/Alerts: Already had operator scoping (no changes needed)
- Admin/Super Admin see all data; Operators see only their own

**Apr 2026 - Reports with Real Data & Operator Scoping**
- 8 report types pulling real data from MongoDB
- Operator scoping for reports. Customers blocked.

**Apr 2026 - Unified Tab Styling + Sidebar Restructure**
- Full-width grid tabs, System menu, Reports page, Database removed

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement
- Minor: Operator missing promo.view permission in role config

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

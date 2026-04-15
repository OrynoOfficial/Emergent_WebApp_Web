# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Reports with Real Data & Operator Scoping**
- 8 report types pulling real data from MongoDB (bookings, revenue, financial, customer insights, operational, service performance, satisfaction, analytics)
- Operator scoping: admins/super_admins can scope per operator or all. Operators see own data only. Customers blocked (403)
- Visual view with Recharts (pie, bar, line charts + KPI cards)
- Data view with tables and detailed breakdowns
- Download dropdown: Visual (JSON) and Data (CSV) export
- Backend: /api/reports/generate, /api/reports/operators-list

**Apr 2026 - Unified Tab Styling (Commission Pattern)**
- Full-width grid tabs across all pages + sub-tabs (Validation, Customer Service)

**Apr 2026 - Sidebar Restructure & UI Polish**
- System menu, Reports standalone page, Database removed
- Grid cards with priority borders, default views, welcome text reduced

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

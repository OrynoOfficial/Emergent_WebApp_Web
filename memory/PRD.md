# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Sidebar Reorder + Grid Card Enhancement**
- Sidebar: Validation standalone above Customer Service, Admin Config moved below CS
- Admin Config: Reports now first item, Validation removed from submenu
- Grid cards: bold 4px priority-colored left border (red=urgent, orange=high, blue=medium, slate=low)

**Apr 2026 - UI Polish: Default Views, Grid Cards, Header**
- Audit Logs default view changed to List
- Customer Service default view changed to Grid with rich ticket cards
- Welcome header text size reduced significantly (text-sm)

**Apr 2026 - Sidebar Navigation Restructure**
- New "System" menu: Sys Config (Settings), Audit Logs, Commission
- Reports extracted from Audit Logs into standalone page under Admin Config
- Database page completely removed

**Apr 2026 - Audit Logs Expanded + Compact Layout**
- 3 view modes: Details, List, Grid with role exclusion filters

**Apr 2026 - Ticket Scanner & Validation System**
- Real-time ticket scanning with operator scoping

**Mar 2026 - Operator Dashboard & Orders Fix, Service Status Control, Loyalty Enhancements**

**Earlier:** Notification center, deep-linking, loyalty program, subscriptions, ratings, service management, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

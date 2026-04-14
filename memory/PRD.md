# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Unified Tab Styling (Commission Pattern)**
- Applied full-width grid tab layout across 9 pages: Users, Permissions, Operators, Employees, Customer Service, Validation, Ratings, Loyalty
- Pattern: grid w-full grid-cols-N bg-slate-100 with active state bg-[#082c59] text-white
- Removed max-width constraints so tabs span entire page width

**Apr 2026 - Sidebar Reorder + Grid Card Enhancement**
- Sidebar: Validation standalone above Customer Service, Admin Config moved below CS
- Admin Config: Reports first, Validation removed from submenu
- Grid cards: bold 4px priority-colored left border

**Apr 2026 - UI Polish: Default Views, Grid Cards, Header**
- Audit Logs default view: List. Customer Service default view: Grid with rich cards
- Welcome header text reduced (text-sm)

**Apr 2026 - Sidebar Navigation Restructure**
- New "System" menu: Sys Config, Audit Logs, Commission
- Reports extracted to standalone page under Admin Config
- Database page removed

**Earlier:** Audit Logs expansion, Ticket Scanner, Operator fixes, Service Status Control, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

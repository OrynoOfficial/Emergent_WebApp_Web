# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Reports Date Range Filters (P2)**
- Added From/To date inputs to Reports filter bar
- Date range badge with Clear button when dates are set
- All 8 report types accept date_from/date_to, filtering MongoDB created_at with $gte/$lte

**Apr 2026 - Cinema Film CRUD + Event Booking Layout + Restaurant Menu**
- Cinema: Film create/update with poster_url, cover image upload in Add Movie form
- Event Booking: Payment Method moved to right column under Order Summary
- Events Results: Displays event_date, ticket_price, contact_email/phone, cover_image
- Restaurant Menu: Images on cards, expandable ingredients badges

**Apr 2026 - Event Full Fields + Restaurant Menu Ingredients**
- Events: doors_open, end_date, ticket_price, contact_email, contact_phone, cover_image
- Restaurant: ingredients[] field in menu items

**Apr 2026 - Seat Selection, Cinema Permissions, Operators Fix, Laundry Fix**

**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Audit Logs, Loyalty, Stripe

## Backlog
- All P0/P1/P2 items completed

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Seat Selection, Event Creation, Cinema Management Fixes**
- Seat Selection: Optimistic UI updates (no blocking await), instant swap with background API sync
- Event Creation: Fixed field mapping (venue_name→venue, start_date→event_date, total_capacity→total_seats, added country default 'CM')
- Cinema Management: Fixed permission names (cinemas.*→cinema.*), fixed API paths (/cinemas/→/cinema/), fixed films loading, added Add Cinema/Add Movie buttons visibility

**Apr 2026 - Operators Access Filter Fix**
- Fixed `get_operator_access_filter` to fall back to legacy full access when pod has no assigned operators

**Apr 2026 - Laundry Management Blank Screen Fix**
- Fixed services array handling (objects vs strings) in LaundryManagement.jsx

**Apr 2026 - Mock Data Removal & Result Page Fixes**
- Removed all mock data fallbacks, Cinema /films route fix, Event cover image upload, Subscribe button on result cards

**Apr 2026 - Unified Booking Guest Info, Reports, Operator Scoping, Refactoring, Tabs**

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P2: Date range filters for Admin/Operator reports

## Key Technical Notes
- `operator_id` is UUID string, NOT BSON ObjectId
- Backend cinema API prefix: `/api/cinema/` (singular), frontend permissions: `cinema.*` (singular)
- Backend EventCreate requires: name, event_type, venue, city, country, event_date, start_time, end_time, ticket_price, total_seats
- Frontend form maps: venue_name→venue, start_date→event_date, doors_open→start_time, total_capacity→total_seats
- Admin in pod with no assigned operators gets legacy full access

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Super Admin (alt): superadmin@oryno.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

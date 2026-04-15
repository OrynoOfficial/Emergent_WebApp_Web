# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Event Full Fields + Restaurant Menu Images & Ingredients**
- Events: Added doors_open, end_date, ticket_price, contact_email, contact_phone, cover_image to Create/Update models
- Events form now includes all fields; Results cards display date, time, price, contact info, cover image
- Restaurant Menu: Added ingredients array field to MenuItemCreate/Update models
- Menu Item Form has ingredients textarea (comma-separated)
- Restaurant Menu page shows dish images + expandable ingredients badges

**Apr 2026 - Seat Selection, Event Creation, Cinema Management Fixes**
- Seat Selection: Optimistic UI updates, instant swap
- Event Creation: Fixed field mapping (venue_name→venue, start_date→event_date, etc.)
- Cinema Management: Fixed permission names (cinema.*), API paths (/cinema/), films endpoint

**Apr 2026 - Operators Access Filter Fix**
- Fixed admin in pod with no operators getting __no_access__

**Apr 2026 - Laundry Management Blank Screen Fix**
- Fixed services array handling (objects vs strings)

**Apr 2026 - Mock Data Removal, Unified Booking, Reports, Tabs, Refactoring**

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P2: Date range filters for Admin/Operator reports

## Key Technical Notes
- Backend EventCreate requires: name, event_type, venue, city, country, event_date, start_time, end_time, ticket_price, total_seats (+ optional: doors_open, end_date, cover_image, contact_email, contact_phone)
- Backend MenuItemCreate accepts: name, category, price, description, image, ingredients[], available, popular
- Cinema API: /api/cinema/ (singular), permissions: cinema.* (singular)
- operator_id is UUID string, NOT BSON ObjectId

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

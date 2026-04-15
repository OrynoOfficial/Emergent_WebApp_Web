# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Cinema Film CRUD + Event Booking Layout + Restaurant Menu**
- Cinema: Film create/update with poster_url, cover image upload in Add Movie form, films list returns id field
- Cinema Results: Film poster displayed as cover image
- Events Results: Displays event_date, ticket_price, contact_email, contact_phone, cover_image
- Events API: GET /events/ now returns 'id' instead of '_id'
- Event Booking: Payment Method moved to right column under Order Summary (like Travel Booking)
- Restaurant Menu: Images on menu cards, expandable ingredients badges

**Apr 2026 - Event Full Fields + Restaurant Menu Ingredients**
- Events: doors_open, end_date, ticket_price, contact_email, contact_phone, cover_image in Create/Update
- Restaurant Menu: ingredients[] field in menu items, comma-separated input in form

**Apr 2026 - Seat Selection, Cinema Permissions, Operators Fix, Laundry Fix**

**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Audit Logs, Loyalty, Stripe

## Backlog
- P2: Date range filters for Admin/Operator reports

## Key Technical Notes
- Cinema API: /api/cinema/ (singular), permissions: cinema.* (singular)
- Film CRUD uses query params (POST/PUT /cinema/films?title=X&poster_url=Y)
- Backend EventCreate: name, event_type, venue, city, country, event_date, start_time, end_time, ticket_price, total_seats + optional fields
- Restaurant MenuItemCreate: name, category, price, image, ingredients[], available, popular
- operator_id is UUID string, NOT BSON ObjectId

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

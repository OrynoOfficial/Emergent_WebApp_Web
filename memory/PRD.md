# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Unified Booking Guest Info Component**
- Created shared `BookerInfoSection` at `/components/booking/BookerInfoSection.jsx`
- Identical template across all booking pages: gradient navy header, self-fill toggle, 4 fields (First Name, Last Name, Email, Phone)
- Self-fill toggle fetches latest profile from `/api/auth/me` (full_name, email, phone)
- Applied to: Hotel, Restaurant, Cinema, Event, CarRental, Banquet, Travel, Package booking pages

**Apr 2026 - Reports with Real Data & Operator Scoping**
- 8 report types pulling real MongoDB data, operator scoping, Visual/Data/Download

**Apr 2026 - Operator Scoping for Support Tickets & Promo Codes**
- Support tickets and promo codes scoped per operator

**Apr 2026 - ValidationManagement.jsx & Login.jsx Refactoring**
- ValidationManagement: 1092 -> 367 lines. Login: 1006 -> 275 lines

**Apr 2026 - Unified Tab Styling + Sidebar Restructure**
- Full-width grid tabs, System menu, Reports page, Database removed

**Earlier:** Audit Logs, Ticket Scanner, Operator fixes, Loyalty, Notifications, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI enhancement

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

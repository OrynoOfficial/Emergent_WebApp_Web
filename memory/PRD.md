# Oryno Platform - Product Requirements Document

## Original Problem Statement
Oryno is a comprehensive services hub platform with multi-role access (Customer, Operator, Admin, Super Admin).

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Mar 2026 - Operator Rewards & Alerts Admin Tab + Login Error UX**
- New "Op. Rewards" tab in admin Loyalty page between Rewards and Members
- Shows all operator promotions (14) and alerts (18) from all operators
- Sub-tabs for Promotions/Alerts with item count badges
- Search, status filter (Pending/Approved/Rejected), operator filter
- Backend: added `item_type` filter param to GET /api/subscriptions/promotions
- Login page: error alerts now red (bg-red-600), flash (animate-pulse), auto-dismiss after 5 seconds

**Mar 2026 - Operator Sidebar Service Mismatch Fix**
- Fixed naming mismatch between admin panel (hotels/restaurants) and sidebar (hotel/restaurant)
- Normalization at 3 layers: admin UI, backend auth, sidebar hook

**Mar 2026 - Operator Promo Code Strict Scoping**
- Promo codes from operator promotions now strictly tied to that operator
- Booking pages pass operator_id for validation

**Feb 2026 - Earlier features**
- Loyalty system, notification center, deep-linking, service management, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI
- P2: Customizable Email Templates
- P3: Bulk moderation features for ratings

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

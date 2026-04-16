# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Operator Scope Filter on All Management Pages**
- Shared `OperatorScopeFilter` component with intelligent service-type filtering
- GET /api/operators/by-service?service_type=X returns only relevant operators (multi-service included)
- All 10 management pages (Travel, Restaurant, Cinema, Events, Laundry, Banquet, Package, Hotel, CarRental) wired up
- Backend: operator_id query param added to all service GET list endpoints
- Default view = cumulative (all operators). Only visible for Admin/SuperAdmin.

**Apr 2026 - Reports Date Range Filters**
- From/To date inputs, backend $gte/$lte on created_at

**Apr 2026 - Cinema Film CRUD + Event Booking Layout + Restaurant Menu**
- Film create/update with poster_url, Event Booking payment moved right, Menu images + ingredients

**Apr 2026 - Event Full Fields, Seat Selection, Cinema Permissions, Operators Fix, Laundry Fix**

**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Audit Logs, Loyalty, Stripe

## Backlog
- All previous P0/P1/P2 items completed

## Key Technical Notes
- Operator by-service filter: $or query matches service_types array, operator_type, or "multi" type
- operator_id is UUID string, NOT BSON ObjectId
- Cinema API: /api/cinema/ (singular), permissions: cinema.* (singular)

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

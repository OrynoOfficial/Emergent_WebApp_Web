# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Dashboard Hook Operator Filter**
- useRealDashboardData hook accepts operatorId as 3rd param
- Backend /api/management/dashboard-stats accepts operator_id query param for admin scoping
- All 9 management pages pass scopeOperatorId to the dashboard hook
- Dashboard, Management, and Communications tabs all filter by selected operator

**Apr 2026 - Communications Hub Operator Filter**
- ServiceCommunicationsHub accepts operatorId prop, passes to API calls

**Apr 2026 - Operator Scope Filter on All Management Pages**
- Shared OperatorScopeFilter with service-type filtering, backend operator_id on all endpoints

**Earlier:** Reports date filters, Cinema CRUD, Event Booking layout, Restaurant Menu, Event fields, Seat Selection, Cinema Permissions, Operators fix, Laundry fix, Mock data removal, Unified Booking, Reports, Tabs, Refactoring

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

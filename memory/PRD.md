# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Communications Hub Operator Filter Fix**
- ServiceCommunicationsHub now accepts operatorId prop
- All 9 management pages pass scopeOperatorId to Communications tab
- Support tickets, ratings, and promotions API calls include operator_id filter

**Apr 2026 - Operator Scope Filter on All Management Pages**
- Shared OperatorScopeFilter component with service-type filtering
- GET /api/operators/by-service?service_type=X returns relevant operators
- All 10 management pages wired up with operator_id backend filtering

**Apr 2026 - Reports Date Range Filters**
**Apr 2026 - Cinema Film CRUD + Event Booking Layout + Restaurant Menu**
**Apr 2026 - Event Full Fields, Seat Selection, Cinema Permissions, Operators Fix, Laundry Fix**
**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Audit Logs, Loyalty, Stripe

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

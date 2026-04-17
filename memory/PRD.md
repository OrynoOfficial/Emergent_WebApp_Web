# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Dynamic Popular Locations & Suggestions**
- Backend: GET /api/suggestions/popular-locations?service_type=X aggregates cities from DB ranked by listing count
- Backend: GET /api/suggestions/popular-items?service_type=X returns popular menu items, hotels, events, films
- Shared LocationInput fetches from API with per-serviceType caching, shows listing counts
- Results pages (Travel, Hotels, Restaurants) edit mode uses LocationInput with suggestions
- PackagesSearch uses shared LocationInput with serviceType=packages

**Apr 2026 - Reports Page Redesign, Dropdown Animations Removed, Sidebar Accordion**
**Apr 2026 - Dashboard/Communications/Management Operator Scoping**  
**Apr 2026 - Cinema Film CRUD, Event fields, Restaurant Menu, Seat Selection**
**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Stripe, AI chatbot

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts + Leaflet
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA
- **IMPORTANT**: Two travel route files exist - `travel_routes.py` (primary, loaded first by FastAPI) and `travel.py` (secondary). Always edit `travel_routes.py` for public route endpoints.

## Completed Features (Latest First)

**Apr 2026 - Critical Data & Backend Routing Fixes**
- ROOT CAUSE: `travel_routes.py` handles GET /api/travel/routes (not `travel.py`). Vehicle enrichment (plate_number, vehicle_images) added to correct file.
- Seeded hotels with GPS coordinates (lat/lon for Leaflet map) and 9 real policies each
- Set all 13 travel routes to is_active=True (12 were missing the field)
- Added bus images (2 per vehicle) to all 8 vehicles

**Apr 2026 - Travel Results: Bus Plate Number & Thumbnails**
- Trip cards show plate number badge + 2 bus thumbnail images
- Backend enriches routes from vehicles collection

**Apr 2026 - Hotel Details Map, Policies, Hotel Results Filters, Booking Headings**
- Hotel Details: Live Leaflet map with nearby service pins
- Hotel Details: Policies toggle (check-in/out visible, additional behind toggle)
- Hotel Results: Compact header, Grid/List, extended filters
- All Booking Pages: Navy headings
- Travel Booking: Per passenger pricing

**Earlier:** Allergens, Sidebar Flyouts, Restaurant Menu Revamp, Dynamic Locations, Reports, Operator Scoping

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

## Upcoming Tasks
- P2: Operator comparison dashboard
- P3: Scheduled/automated report emails

## Key Technical Notes
- **TWO TRAVEL FILES**: `routes/travel_routes.py` is loaded FIRST and handles GET /routes. `routes/travel.py` has duplicate endpoints that are NEVER reached. Always modify `travel_routes.py`.
- **HOTEL DATA**: Hotels MUST have `location: {lat, lon}` for map to render. Without it, shows MapPin placeholder.
- **HOTEL POLICIES**: Must be a string array. First two items should be "Check-in: HH:MM" and "Check-out: HH:MM". Rest are additional policies shown behind toggle.

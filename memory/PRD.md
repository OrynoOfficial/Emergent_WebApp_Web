# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts + Leaflet
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Travel Results: Bus Plate Number & Thumbnails**
- Backend enriches travel routes with `plate_number` and `vehicle_images` (max 2) from vehicles collection
- Trip cards show plate number badge + 2 swipeable bus thumbnail images
- Management VehicleForm already supports plate_number input and multi-image upload

**Apr 2026 - Hotel Details Map, Policies, Hotel Results Filters, Booking Headings**
- Hotel Details: Live Leaflet map in Explore area with nearby service colored pins (Restaurants, Car Rentals, Cinemas, Events)
- Hotel Details: Policies section - check-in/check-out visible by default, additional policies behind toggle
- Hotel Results: Compact search header, Grid/List toggle, extended filters (Guest Rating, Free Cancellation, Breakfast Included)
- All 9 Booking Pages: Navy bg-[#082c59] headings for Price Breakdown and Payment Method
- Travel Booking: Improved trip summary cards, price per passenger for 2+ passengers
- CRITICAL FIX: React hooks order violation in HotelDetails (useEffect before early returns)

**Apr 2026 - Allergen Tags & Ingredient-Based Search/Filter**
**Apr 2026 - Sidebar Right-Side Flyout Submenus**
**Apr 2026 - Restaurant Menu Premium Revamp + Bug Fixes**
**Earlier:** Dynamic Locations, Reports, Operator Scoping, Seat Selection, Stripe, AI chatbot

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

## Upcoming Tasks
- P2: Operator comparison dashboard (side-by-side performance metrics)
- P3: Scheduled/automated report emails (weekly/monthly)

## Key Technical Notes
- **TRAVEL VEHICLE ENRICHMENT**: Routes are enriched with `plate_number`, `vehicle_images` (max 2), `vehicle_name` from vehicles collection
- **NEARBY SERVICE PINS**: HotelDetails uses L.divIcon for colored markers. Generated from API or mock data around hotel location.
- **BOOKING HEADINGS**: All booking pages use bg-[#082c59] for Price/Payment headers
- **REACT HOOKS**: All useEffect/useState MUST come before any early returns in components
- **SIDEBAR FLYOUTS**: Right-side click flyouts, bottom items position upward
- **NO ANIMATIONS ON DROPDOWNS**: Shadcn UI animations stripped

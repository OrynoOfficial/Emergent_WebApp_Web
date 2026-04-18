# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts + Leaflet
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Hotel Results, Hotel Details Map, Booking Headings, Travel Summary**
- Hotel Results: Compact search criteria header, Grid/List view toggle, expanded filters (Guest Rating, Free Cancellation, Breakfast Included)
- Hotel Details: Live Leaflet map with nearby service pins (Restaurants, Car Rentals, Cinemas, Events) using colored markers
- Hotel Details: Policies toggle — check-in/check-out visible by default, additional policies hidden behind toggle
- All Booking Pages: Price Breakdown and Payment Method headings now use strong navy bg-[#082c59] with white text
- Travel Booking: Improved trip summary cards with route/date/time grid layout, bus icon circles, price per passenger for 2+ passengers

**Apr 2026 - Allergen Tags & Ingredient-Based Search/Filter**
- allergens field on menu items, dietary filter chips, ingredient search, allergen badges

**Apr 2026 - Sidebar Right-Side Flyout Submenus**
- Click-triggered right-side flyout panels with smart vertical positioning

**Apr 2026 - Menu Item Bug Fixes & Auto-Derived Popularity**
- Fixed image save, ingredients text, removed Popular toggle, auto-derived popularity

**Apr 2026 - Restaurant Menu Premium Revamp**
- Hero image header, swipeable carousel, Ingredients modal, compact sidebar

**Earlier:** Dynamic Locations, Reports, Animations, Operator Scoping, Seat Selection, Stripe, AI chatbot

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

## Upcoming Tasks
- P2: Operator comparison dashboard (side-by-side performance metrics)
- P3: Scheduled/automated report emails (weekly/monthly)

## Key Technical Notes
- **NEARBY SERVICE PINS**: HotelDetails uses L.divIcon for colored markers. Fetches from API or generates mock pins around hotel location.
- **BOOKING HEADINGS**: All booking pages use bg-[#082c59] for Price Breakdown and Payment headers.
- **SIDEBAR FLYOUTS**: Right-side click flyouts, bottom items position upward
- **NO ANIMATIONS ON DROPDOWNS**: Shadcn UI animations stripped
- **POPULARITY**: Auto-derived from order aggregation, NOT operator-settable
- **FONTS**: Playfair Display (serif), Manrope (sans). Primary #082c59, Champagne #C5A880

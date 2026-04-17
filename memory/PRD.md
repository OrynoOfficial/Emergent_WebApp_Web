# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Restaurant Menu Premium Revamp**
- Rebuilt RestaurantMenu.jsx with premium hero image header (Playfair Display + Manrope fonts)
- Restaurant name, location, rating, hours, cuisine badges displayed prominently in hero overlay
- Menu items with swipeable image carousel (max 3 images per item via embla-carousel)
- Ingredients modal (Shadcn Dialog) opens on "View Ingredients" click, shows ingredient badges
- Compact reservation sidebar with date/time grid layout, champagne gold accent (#C5A880)
- Multi-image upload (max 3) in management MenuItemForm for menu item images
- Backend MenuItemCreate/MenuItemUpdate models updated with `images` array field
- Backend /api/restaurants/{id}/menu endpoint returns `images` array per item

**Apr 2026 - Dynamic Popular Locations & Suggestions**
- Backend: GET /api/suggestions/popular-locations?service_type=X aggregates cities from DB ranked by listing count
- Backend: GET /api/suggestions/popular-items?service_type=X returns popular menu items, hotels, events, films
- Shared LocationInput fetches from API with per-serviceType caching, shows listing counts
- Results pages (Travel, Hotels, Restaurants) edit mode uses LocationInput with suggestions

**Apr 2026 - Reports Page Redesign, Dropdown Animations Removed, Sidebar Accordion**
**Apr 2026 - Dashboard/Communications/Management Operator Scoping**  
**Apr 2026 - Cinema Film CRUD, Event fields, Restaurant Menu, Seat Selection**
**Earlier:** Mock data removal, Unified Booking, Reports, Tabs, Refactoring, Stripe, AI chatbot

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

## Upcoming Tasks
- P2: Operator comparison dashboard (side-by-side performance metrics)
- P3: Allergen tags on restaurant ingredients for dietary filtering
- P3: Scheduled/automated report emails (weekly/monthly)
- P3: Ingredient-based search/filter for customers

## Key Technical Notes
- **NO ANIMATIONS ON DROPDOWNS**: All fly-in, slide, zoom, fade animations removed from Shadcn UI dropdowns, popovers, selects, dialogs
- **NATIVE DATE INPUTS**: Always use DatePickerField component, never native `<input type="date">`
- **OPERATOR SCOPING**: All management pages use OperatorScopeFilter for data isolation
- **FONTS**: Playfair Display (serif headings), Manrope (sans body) - imported via Google Fonts in index.css, configured in tailwind.config.js
- **COLORS**: Primary #082c59, Champagne accent #C5A880

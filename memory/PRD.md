# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Allergen Tags & Ingredient-Based Search/Filter**
- Backend: `allergens` field added to MenuItemCreate/MenuItemUpdate models
- Backend: `GET /api/restaurants/{id}/menu?exclude_allergens=peanuts,fish` filters items by allergens
- Backend: `GET /api/restaurants/{id}/menu?ingredient=Chicken` searches by ingredient name
- Frontend Menu: Dietary filter chips (No Peanuts, Gluten-Free, No Dairy, No Eggs, No Fish, No Shellfish, No Soy)
- Frontend Menu: Allergen warning badges on items, allergen section in ingredients modal
- Frontend Menu: Search now matches both dish names AND ingredient names
- Management: MenuItemForm has clickable allergen chip selector (10 common allergens)

**Apr 2026 - Sidebar Right-Side Flyout Submenus**
- Click-triggered right-side flyout panels, smart vertical positioning for bottom items

**Apr 2026 - Menu Item Bug Fixes & Auto-Derived Popularity**
- Fixed stale closure, ingredients text, removed Popular toggle, auto-derived popularity

**Apr 2026 - Restaurant Menu Premium Revamp**
- Hero image header, swipeable carousel, Ingredients modal, compact sidebar

**Apr 2026 - Dynamic Locations, Reports, Animations, Operator Scoping, Seat Selection**
**Earlier:** Mock data removal, Unified Booking, Stripe, AI chatbot

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123 (Musango Bus Service)

## Upcoming Tasks
- P2: Operator comparison dashboard (side-by-side performance metrics)
- P3: Scheduled/automated report emails (weekly/monthly)

## Key Technical Notes
- **ALLERGENS**: 10 common allergens (Peanuts, Tree Nuts, Dairy, Eggs, Gluten, Fish, Shellfish, Soy, Sesame, Celery). Stored as array on menu items. Customer menu filters client-side; API also supports server-side filtering.
- **SIDEBAR FLYOUTS**: Right-side click flyouts, bottom items position upward
- **NO ANIMATIONS ON DROPDOWNS**: Shadcn UI animations stripped
- **POPULARITY**: Auto-derived from order aggregation, NOT operator-settable
- **FONTS**: Playfair Display (serif), Manrope (sans). Primary #082c59, Champagne #C5A880

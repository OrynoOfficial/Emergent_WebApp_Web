# Oryno Platform - Product Requirements Document

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI + Recharts
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based auth with 2FA

## Completed Features (Latest First)

**Apr 2026 - Sidebar Right-Side Flyout Submenus**
- Replaced inline accordion submenus with click-triggered right-side flyout panels
- Flyout positioned at left: 288px (to the right of the sidebar) with smart vertical positioning
- Bottom items (Admin Config, System) use upward positioning (bottom-aligned) to stay within viewport
- Click outside, route change, or toggle closes the flyout; only one open at a time
- Flyout has header with parent icon/name, active route highlighting, z-index: 60

**Apr 2026 - Menu Item Bug Fixes & Auto-Derived Popularity**
- Fixed: Images field lost on save (stale closure in handleImagesChange)
- Fixed: Ingredients textarea allows commas/periods (local state with onBlur commit)
- Removed: Popular Item toggle from operator MenuItemForm
- Added: Backend auto-derives popularity from order aggregation pipeline

**Apr 2026 - Restaurant Menu Premium Revamp**
- Premium hero image header (Playfair Display + Manrope fonts, champagne gold #C5A880)
- Swipeable image carousel (max 3 images via embla-carousel), Ingredients modal
- Compact reservation sidebar, multi-image upload in management

**Apr 2026 - Dynamic Popular Locations & Suggestions**
**Apr 2026 - Reports Page Redesign, Dropdown Animations Removed**
**Apr 2026 - Dashboard/Communications/Management Operator Scoping**  
**Apr 2026 - Cinema Film CRUD, Event fields, Seat Selection**
**Earlier:** Mock data removal, Unified Booking, Stripe, AI chatbot

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
- **SIDEBAR FLYOUTS**: Submenus open as right-side flyout panels (not inline accordions). Bottom items position upward. Uses `data-submenu-trigger` and `data-submenu-flyout` attributes for click detection.
- **NO ANIMATIONS ON DROPDOWNS**: All fly-in, slide, zoom, fade animations removed from Shadcn UI
- **NATIVE DATE INPUTS**: Always use DatePickerField component
- **OPERATOR SCOPING**: All management pages use OperatorScopeFilter
- **FONTS**: Playfair Display (serif headings), Manrope (sans body)
- **COLORS**: Primary #082c59, Champagne accent #C5A880
- **POPULARITY**: Auto-derived from order aggregation, NOT operator-settable

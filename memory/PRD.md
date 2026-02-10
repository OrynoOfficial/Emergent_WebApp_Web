# Oryno Services Hub - Product Requirements Document

## Overview
Oryno is a full-stack multi-tenant services booking platform built with FastAPI + React + MongoDB. It provides hotel bookings, restaurant reservations, travel tickets, car rentals, cinema, laundry, events, packages, and banquet services.

## User Roles & Permissions (Updated Jan 9, 2026)

### Customer Role
- **Landing Page**: Dashboard (standard customer view)
- **Dashboard Button**: Customer Dashboard
- **Navigation Items**:
  - Dashboard
  - Services (all sub-menus)
  - **My Orders** (filtered by customer)
  - **Receipts** (filtered by customer)
  - **Loyalty** (customer loyalty rewards view)
  - **My Ratings** (customer's reviews)
  - **Support** (ticket management for customers)
  - Settings
- **NOT Accessible**: Team & Roles, Admin Config, Service Management, Analytics, Customer Service, Sales

### Operator Role (Updated Jan 9, 2026)
- **Landing Page**: Analytics Dashboard (personalized to their services)
- **Dashboard Button**: Analytics Dashboard (personalized)
- **Navigation Items**:
  - Dashboard (→ Analytics Dashboard, personalized with operator context banner)
  - **Sales** (NEW - top-level menu, personalized to operator)
  - Services (ONLY assigned service types)
  - Service Management (ONLY assigned service types)
  - Admin Config (LIMITED: Team & Roles, Audit Log only)
  - **My Orders** (filtered by operator's services)
  - **Receipts** (filtered by operator's services)
  - **My Ratings** (customer reviews for operator's services, with respond ability)
  - **Support** (ticket management for operators)
  - Settings
- **Audit Logs**: Can view own logs. If owner, can view team members' logs. Local permission "team_audit.view" can be assigned to allow team audit viewing.
- **NOT Accessible**: Loyalty/Loyalty Program, All Bookings, Bills (removed from Admin Config)
- **Moved to Admin Config**: Team & Roles (for owner/local_admin)

### Admin Role (Updated Jan 9, 2026)
- **Landing Page**: Admin Dashboard page
- **Dashboard Button**: Admin Dashboard (new page with admin metrics)
- **Navigation Items**:
  - Dashboard (→ Admin Dashboard)
  - Services (all)
  - Service Management (all)
  - **All Orders** (platform-wide view)
  - **All Receipts** (platform-wide view)
  - **Loyalty Program** (READ-ONLY - no create/edit/delete)
  - Admin Config (LIMITED: NO Employees, Commission, Database, NO Analytics, NO Trip Report)
  - **All Ratings** (platform-wide ratings with filters)
  - **Customer Service** (admin backend for support tickets)
  - Settings
- **Operators Management**: ✅ Full access (view all operators, edit, create)
- **Audit Logs**: Can view own logs + all operator user logs (NOT super admin or customer logs)
- **Permissions Page**: Only "User Permissions" tab (NO Roles tab, NO Matrix tab)
- **NOT Accessible in Admin Config**: Employees, Commission, Database, Analytics Dashboard, Trip Report

### Super Admin Role
- **Landing Page**: Analytics Dashboard (platform-wide)
- **Dashboard Button**: Analytics Dashboard (platform-wide)
- **Navigation Items**:
  - Dashboard (→ Analytics Dashboard)
  - **Sales** (NEW - top-level menu, cumulative for all operators)
  - Services (all)
  - Service Management (all)
  - **All Orders** (platform-wide view)
  - **All Receipts** (platform-wide view)
  - **Loyalty Program** (admin management view)
  - Admin Config (FULL access, includes "Dashboard for Admins")
  - **All Ratings** (platform-wide ratings with filters)
  - **Customer Service** (admin backend for support tickets)
  - Settings

## Key Pages & Features

### New Admin Dashboard Page
- **Path**: `/admin/admin-dashboard`
- **Access**: Admin, Super Admin
- **Features**:
  - Platform metrics overview
  - Total Orders, Revenue, Users, Support Tickets
  - Order status cards (Pending, Completed, Cancelled)
  - Orders & Revenue Trend chart
  - Order Status distribution pie chart
  - Recent Orders list
  - Quick action links

### Sales Page (Updated)
- **Path**: `/admin/sales`
- **Super Admin View**: "Platform Sales Dashboard" - Cumulative sales across all operators
- **Operator View**: "Sales Dashboard - My Business" - Personalized sales for their services
- Shows service badge indicating assigned services for operators

### Orders Page
- **Admin/Super Admin View**: "All Orders" - Shows all orders from all users/operators
- **Operator View**: "My Orders" - Shows orders for their assigned services
- **Customer View**: "My Orders" - Shows only their personal orders

### Receipts Page
- **Admin/Super Admin View**: "All Receipts" - Shows all receipts from all users/operators
- **Operator View**: "Receipts" - Shows receipts for their services
- **Customer View**: "Receipts" - Shows only their personal receipts

## Navigation Summary

| Menu Item | Customer | Operator | Admin | Super Admin |
|-----------|----------|----------|-------|-------------|
| Dashboard | ✅ Customer | ✅ Analytics | ✅ Admin Dashboard | ✅ Analytics |
| Sales | ❌ | ✅ Personal | ❌ | ✅ Cumulative |
| Services | ✅ All | ✅ Assigned | ✅ All | ✅ All |
| Service Management | ❌ | ✅ Assigned | ✅ All | ✅ All |
| All Orders / My Orders | My Orders | My Orders | All Orders | All Orders |
| Receipts | Receipts | Receipts | All Receipts | All Receipts |
| Loyalty | ✅ | ❌ | ✅ Program | ✅ Program |
| Admin Config | ❌ | ✅ Limited | ✅ No Emp/Comm/DB | ✅ Full |
| Support / CS | Support | Support | Customer Service | Customer Service |

## Admin Config Submenus by Role (Updated Jan 9, 2026)

| Submenu | Operator | Admin | Super Admin |
|---------|----------|-------|-------------|
| Analytics | ❌ | ❌ (Removed) | ❌ (in Dashboard) |
| Trip Report | ❌ | ❌ (Removed) | ✅ |
| All Bookings | ❌ | ✅ | ✅ |
| Dashboard for Admins | ❌ | ❌ | ✅ |
| User Management | ❌ | ✅ | ✅ |
| Operators | ❌ | ✅ | ✅ |
| Employees | ❌ | ❌ | ✅ |
| Commission | ❌ | ❌ | ✅ |
| Bills | ❌ | ✅ | ✅ |
| Sales | ❌ | ✅ | ❌ (top-level) |
| Audit Logs | ✅ | ✅ (Own+Operators) | ✅ (All) |
| Permissions | ❌ | ✅ (Users only) | ✅ (Full) |
| Database | ❌ | ❌ | ✅ |
| Validation | ❌ | ✅ | ✅ |
| Team & Roles | ✅ | ❌ | ❌ |

## Test Credentials
- **Super Admin**: superadmin@oryno.com / testpassword123
- **Admin**: admin@test.com / testpassword123
- **Customer**: testcustomer@test.com / testpassword123
- **Operator**: operator@test.com / testpassword123 (check "I'm logging in as a service operator")

## Completed Features (Jan 2026)
- [x] Multi-tenant permission system with 4 roles
- [x] Role-based sidebar navigation
- [x] Role-based settings page sections
- [x] Analytics page consolidation
- [x] Secure registration (always assigns customer role)
- [x] Operator service filtering
- [x] Removed Operator Dashboard modal from Dashboard
- [x] Team & Roles restricted to operators only
- [x] Support page with ticket management system
- [x] Ratings page with customer and operator views
- [x] Role-based menu labels (All Orders vs My Orders, etc.)
- [x] Admin Loyalty Program management view
- [x] Admin All Ratings view
- [x] Loyalty removed from operator navigation
- [x] Customer Service replaces Support for admins
- [x] Admin "All Orders" page - Shows all orders across platform (Jan 9, 2026)
- [x] Admin "All Receipts" page - Shows all receipts across platform (Jan 9, 2026)
- [x] Admin Ratings moderation UI - Flag/Hide/Delete buttons (Jan 9, 2026)
- [x] Loyalty Program rewards CRUD with backend API integration (Jan 9, 2026)
- [x] Customer Service "Add Member" dialog filters existing team members (Jan 9, 2026)
- [x] User Detail Modal Activity Log shows user-specific audit entries (Jan 9, 2026)
- [x] Role-specific landing pages: Super Admin→Analytics, Admin→Orders, Operator→Analytics (Jan 9, 2026)
- [x] New Admin Dashboard page with platform metrics (Jan 9, 2026)
- [x] Sales as top-level menu for Operators and Super Admins (Jan 9, 2026)
- [x] Personalized Sales Dashboard for Operators (Jan 9, 2026)
- [x] Cumulative Platform Sales Dashboard for Super Admins (Jan 9, 2026)
- [x] Team & Roles moved to Admin Config for Operators (Jan 9, 2026)
- [x] Removed Bookings, Bills from Operator Admin Config (Jan 9, 2026)
- [x] Removed Employees, Commission, Database from Admin Admin Config (Jan 9, 2026)
- [x] Service Management visible for Admin users (Jan 9, 2026)
- [x] "Dashboard for Admins" in Super Admin's Admin Config (Jan 9, 2026)
- [x] Personalized Analytics Dashboard for Operators (Jan 9, 2026)
- [x] Fixed Admin Dashboard font colors for visibility (Jan 9, 2026)
- [x] Removed Total Revenue component from Admin Dashboard (Jan 9, 2026)
- [x] Refactored CustomerServiceManagement.jsx - extracted reusable components (Jan 9, 2026)
- [x] Assigned Admin_Employee_Oryno role to admin user for permission testing (Jan 9, 2026)
- [x] Added real-time revenue calculation to Operators Management page (Jan 9, 2026)

## Backlog / Future Tasks
- [ ] Email-based invitation system for team members - P1
- [ ] Add more ratings moderation features (bulk actions, reports) - P3
- [ ] Link test orders to operators for revenue demonstration - P4
- [ ] Further refactor CustomerServiceManagement.jsx (~1365 lines) - P4
- [ ] Refactor Layout.jsx conditional logic into smaller components - P4
- [ ] Make Daily Sales Trend chart use real data (currently calculated from total) - P4

## Completed Features (Jan 9, 2026 - Session 2)
- [x] Admin landing page changed to Admin Dashboard (not /orders)
- [x] Admin menu: Removed Analytics Dashboard and Trip Report
- [x] Admin menu: Added Operators Management access
- [x] Admin Loyalty Program: Read-only (no create/edit/delete buttons)
- [x] Admin Audit Logs: Shows own logs + all operator user logs (hides super admin/customer logs)
- [x] Admin Permissions page: Only "User Permissions" tab visible (Roles and Matrix tabs hidden)
- [x] Operators Management: Added Owner and Date Joined columns
- [x] Operators Management: Enhanced Edit modal with service types checkboxes
- [x] Operators Management: Revenue calculation from orders collection
- [x] Operator Analytics Dashboard: Personalized with context banner showing assigned services
- [x] Operator Audit Logs: Owner can see team members' logs, local permission "team_audit.view" supported
- [x] Backend: Role-based audit log filtering (/api/activity/logs)
- [x] Backend: Local permissions management API (/api/activity/local-permissions)

## Completed Features (Jan 9, 2026 - Session 3)
- [x] Fixed Services page "Manage" button - now navigates to /management/* instead of /manage/*
- [x] Fixed Admin User Management - Admin can now see users (with default permissions)
- [x] Admin User Management filters out super_admin users (only super admins can see other super admins)
- [x] Added default permissions for admin role (users.view, operators.view, orders.view, etc.)
- [x] Fixed Operator Audit Logs - Added operator to requiredRoles in App.jsx route
- [x] Operator Analytics shows personalized context banner with assigned services
- [x] Backend analytics endpoint filters by operator_id for operators

## Completed Features (Jan 9, 2026 - Session 4)
- [x] **P2: Custom Role Management UI for Admins**
  - Admins can now see and access the Roles tab on Permissions page
  - "Limited Role Management" banner explains restrictions
  - Admins can create custom roles with filtered permissions (not all permissions available)
  - Admins cannot edit or delete system roles (Super Admin, Admin, Operator)
  - Added access.view_roles, access.create_roles, access.edit_roles, access.assign_roles to admin default permissions
- [x] **P3: Real Payment Methods Data in Sales Dashboard**
  - New API endpoint: /api/orders/analytics/payment-methods
  - Aggregates payment method data from real orders collection
  - Filters by operator_id for operator users
  - Sales Dashboard now displays real percentages (MTN Mobile Money, Orange Money, Card Payment, etc.)
  - Supports time range filtering (today, 7d, 30d, 90d, 1y)


## Completed Features (Jan 9, 2026 - Session 5)
- [x] **Restaurant Results Page Enhancement**
  - Added orange gradient header (matching Travel Results style)
  - Implemented editable search criteria (city, date, time, guests)
  - Edit button toggles inline editing mode
  - View Menu button correctly navigates to restaurant menu page
- [x] **Travel Results Page - Past/Future Trips**
  - Added Past Trips tabs (showing dates before selected date, only if not in actual past)
  - Added Future Trips tabs (up to 3 dates after selected date)
  - Clicking a date tab updates the search parameters and reloads results
  - Fixed Select button to properly store trip data in sessionStorage and navigate to booking page
- [x] **Car Rental Booking - Mandatory Fields Flow**
  - Extras section is now mandatory with "No Extras" option
  - Driver Information section is disabled until extras are confirmed
  - Payment Method section is disabled until driver info is complete
  - Confirm Booking button is disabled until payment method is selected
  - Added progress checklist showing completion status of all mandatory steps
  - PaymentMethodsSelection component updated to support onMethodSelected callback

## Completed Features (Jan 9, 2026 - Session 6)
- [x] **Travel Booking Page - Consistent Modal Styling**
  - All modal headers (Traveler Details, Choose Your Seats, Baggage & Extras) now use same dark blue gradient as Trip Summary
  - Color: `bg-gradient-to-r from-[#082c59] to-[#0a4a8f]` for consistency
- [x] **Hotel Results Page Enhancement**
  - Added dark blue highlighted header with hotel icon (matching Travel Results style)
  - Implemented editable search fields (destination, check-in, check-out, guests)
  - Edit button toggles inline editing mode with confirm/cancel buttons
  - Hotel cards now display description for better informed decisions
- [x] **Restaurant Results - View Menu Navigation**
  - Verified working: View Menu button navigates to /services/restaurants/menu?id={id}
- [x] **Restaurant Menu - Fixed Blank Page Bug**
  - Root cause: `opening_hours` stored as object in DB but rendered as string
  - Added `formatOpeningHours()` helper to handle both formats
  - Fixed rating display to use `average_rating` from database
  - Now works with real restaurant data (e.g., Le Safoutier)

## Completed Features (Jan 10, 2026 - Session 7)
- [x] **P0: Revenue Bug Fixed**
  - Root cause: Orders had `operator_id` values pointing to non-existent operators
  - Fix: Linked orders to actual operators in database (West Region Tours, Royal Events Cameroon)
  - Revenue now displays correctly: 169,325 FCFA and 262,500 FCFA respectively
- [x] **P2: Advanced Ratings Moderation**
  - Added bulk selection (checkbox on each rating + select all)
  - Added bulk actions bar: Flag All, Unflag All, Hide All, Show All, Delete All
  - Created backend endpoint `/api/ratings/bulk-moderate` for batch operations
  - Added bulk action confirmation dialog with reason input
- [x] **P3: Refactored CustomerServiceManagement.jsx**
  - Extracted `TicketCard.jsx` component (100+ lines)
  - Extracted `FiltersPanel.jsx` component (100+ lines)
  - Extracted `TicketDetailModal.jsx` component (200+ lines)
  - File reduced from 1365 to 1255 lines (~8% reduction)
  - All components properly exported from index.js

## Completed Features (Jan 10, 2026 - Session 8)
- [x] **Operator-Scoped Management Pages**
  - Created test data for Musango Bus Service (routes, vehicles, orders)
  - Updated operator user to link to Musango Bus operator_id
  - Analytics Dashboard: Shows operator-specific data, zeros when no activity
  - Travel Management: Filtered by operator_id, shows only assigned routes/vehicles
  - Sales Dashboard: Shows operator-specific sales (70,000 FCFA from 10 orders)
  - All mock data removed for operators - shows real data only
- [x] **Backend Route Filtering**
  - Added `/api/travel/routes/management` endpoint with operator filtering
  - Operators can only see routes they created or are assigned to
  - All stats reset to real values (no more fake numbers)

## Completed Features (Jan 10, 2026 - Session 9)
- [x] **P0: Fixed Operator CRUD Operations**
  - Made `duration` field optional in `TravelRouteCreate` model (backend/models/travel_route.py)
  - Fixed vehicle_id return bug in create vehicle endpoint (backend/routes/vehicles.py)
  - Updated frontend API to use correct `/travel/management/my-routes` endpoint (frontend/src/api/management.js)
  - Operators can now create, edit, delete routes and vehicles for their services
  - All CRUD operations properly scope to operator_id
- [x] **P1: Fixed Analytics Dashboard Data Display**
  - Fixed Analytics.jsx to properly use `/analytics/overview` response data
  - Removed duplicate API call that was failing (getStats called non-existent endpoint)
  - Analytics now shows correct operator-scoped data (70,000 FCFA revenue, 10 bookings)
  - Sales Dashboard and Analytics Dashboard now show consistent data
- [x] **Verified Data Scoping**
  - Travel Management: Shows 5 routes, 4 vehicles for Musango Bus Service

## Completed Features (Jan 10, 2026 - Session 10)
- [x] **Operator Suspend/Reactivate/Delete Cascade**
  - Updated backend to cascade suspend to ALL users (not just owner), routes, vehicles, hotels, restaurants, etc.
  - Fixed frontend to call `/reactivate` endpoint instead of `/approve` when reactivating
  - Added proper notifications to all affected users
  - Delete now disables users (not deletes) and removes all associated services
- [x] **Deleted Trip Report Page**
  - Removed TripReport.jsx and its route from App.jsx
  - Removed from navigation menu
- [x] **Moved All Bookings to Main Menu**
  - Moved from Admin Config submenu to main menu
  - Now appears between "All Receipts" and "Loyalty Program"
- [x] **Created Document Templates Page**
  - New page at /admin/employees/templates
  - Backend API: /api/document-templates with full CRUD
  - Categories: Employment Contract, Sick Leave, Termination, Promotion, Warning Letter, etc.
  - Variables support ({{employee_name}}, {{date}}, etc.)
  - Added "Document Templates" button to Employees Management page
- [x] **Fixed Monthly Payroll Calculation**
  - Now excludes only 'suspended' and 'terminated' employees
  - Employees on leave, active, or other statuses still count towards payroll
- [x] **Rebuilt Database Management Page**
  - Now dynamically pulls real data from MongoDB
  - Shows all collections with document counts, sizes, indexes, last modified
  - Full CRUD operations on any collection
  - Search and filter functionality
  - Recent operations tab
- [x] **Fixed Loyalty Program Rewards**
  - Fixed reward create/update/delete to reload from server after changes
  - Backend APIs working correctly (/api/loyalty/admin/rewards)
  - Sales Dashboard: Shows 70,000 FCFA total sales, 10 orders
  - Analytics Dashboard: Shows 70,000 FCFA revenue, 10 bookings, Travel 100%
  - All tests passed (15/15 backend tests)

## Backlog (Updated)
- [ ] **P1: Email Invitation System** - Allow inviting new users via email
- [ ] **P4: Mobile App (Customer Only)** - Capacitor + React for iOS/Android
  - Reuse 90%+ of existing React code
  - Native features: Push notifications, Camera, GPS, Offline mode
  - App Store & Play Store distribution

## Completed Features (Jan 10, 2026 - Session 11)
- [x] **P2: Advanced Ratings Reports**
  - New Reports tab on Ratings page for Admin/Super Admin users
  - Summary stats: Total ratings, Average rating, Response rate, Flagged count
  - Rating Trends chart (line + bar) showing daily trends
  - Reviews by Category pie chart
  - Service Category Breakdown table with distribution bars, response rates
  - Top Operators by Response Rate list
  - Flagged Reviews Analysis by category
  - Time range filter (7d, 30d, 90d, 1y, all)
  - New backend endpoint: GET /api/ratings/reports/analytics
- [x] **P3: CustomerServiceManagement.jsx Refactoring**
  - Reduced from 1255 lines to 776 lines (38% reduction)
  - Extracted components:
    - DashboardTab.jsx - Dashboard stats and charts
    - TeamTab.jsx - Team member management UI
    - AssignModal.jsx & BulkAssignModal.jsx - Ticket assignment modals
    - AddMemberModal.jsx - Add team member dialog
  - All tabs (Dashboard, Tickets, Team) still functional
- [x] **P0: SMS OTP Verification for Phone Signups**
  - Integrated Infobip SMS API for OTP delivery
  - New backend service: /app/backend/services/infobip_service.py
  - New OTP routes: /api/otp/send, /api/otp/verify, /api/otp/resend
  - Phone signup now requires OTP verification before registration
  - Frontend OTP verification screen with:
    - 6-digit OTP input
    - 5-minute countdown timer
    - Resend button (rate limited)
    - Back to signup link
  - Rate limiting: 3 OTP requests per 5 minutes per phone number
  - OTP stored in MongoDB with TTL index (auto-expires)
- [x] **Date Format & Timezone Update**
  - Changed date format from American (MM/DD/YYYY) to European (DD.MM.YYYY)
  - Set timezone to Africa/Douala (Cameroon, UTC+1)
  - Created centralized date utility: /app/frontend/src/utils/dateUtils.js
  - Updated all date formatting across the application
- [x] **Past Services Greyed Out Feature**
  - Time-sensitive services (Travel, Events, Cinema showtimes) now show past items greyed out
  - Past items are visible but non-bookable with "Departed", "Past Event", "Passed" indicators
  - Added `isPast()`, `isToday()`, `isShowtimePast()` utility functions
  - **Session 12 Fix**: Original implementation was in Events.jsx/Travel.jsx but app routes to EventsResults.jsx/TravelResults.jsx
  - Fixed: Added grey-out styling to EventsResults.jsx (EventCardGrid, EventCardList)
  - Fixed: Added grey-out styling to TravelResults.jsx (TripCardGrid, TripCardList)
  - Both Grid and List views now properly grey out past items
  - Click blocking added to handleBook() and handleTripSelect() functions
- [x] **All Tests Passed**: 15/15 backend tests, 100% frontend

## Technical Debt
- [ ] Break down Permissions.jsx into smaller components
- [ ] Move hardcoded admin permissions to config/database

## Test Credentials
- **Super Admin**: superadmin@oryno.com / testpassword123
- **Admin**: admin@test.com / testpassword123
- **Operator**: operator@test.com / testpassword123
- **Customer**: customer@test.com / testpassword123
- **Phone Login**: +237677111222 / testpassword123

## Infobip Integration
- **Base URL**: m9p9r6.api.infobip.com
- **SMS Sender**: Oryno
- **Email From**: oryno@selfserve.worlds-connected.co
- **Services**: SMS OTP verification, Email delivery

## Completed Features (Feb 7, 2026 - Session 12)
- [x] **Access Control Diagram Created**
  - Created comprehensive textual diagram at /app/memory/ACCESS_CONTROL_DIAGRAM.md
  - Documents: Role hierarchy, Data scope, Permission enforcement flow
  - Navigation access control by role, API permission mapping
  - Database collections related to access control
- [x] **P0 Fix: Grey Out Past Services in Results Pages**
  - Root cause identified: Original grey-out code was in Events.jsx/Travel.jsx but app routes to EventsResults.jsx/TravelResults.jsx
  - Fixed EventsResults.jsx: Added isPast() import, updated EventCardGrid and EventCardList with:
    - Grayscale filter and opacity styling
    - "Past Event" badge
    - "Ended" button (disabled)
    - Click blocking via cursor-not-allowed style
  - Fixed TravelResults.jsx: Added isPast() import, updated TripCardGrid and TripCardList with:
    - Grayscale filter and opacity styling  
    - "Departed" badge
    - "Unavailable" button (disabled)
    - "No longer available" text
  - Added isPast() guards to handleBook() and handleTripSelect() functions
  - Updated MOCK_EVENTS to have realistic mix of past (Jan-Feb 2026) and future (Mar-Apr 2026) dates
  - Testing agent verified: All 5 tests PASS (100% frontend success rate)

- [x] **Advanced Access Control System Implementation**
  - **Geography Management (Countries & Regions)**
    - Backend: `/app/backend/routes/geography.py` - CRUD for countries and regions
    - Frontend: `/app/frontend/src/pages/admin/GeographyManagement.jsx`
    - Initialized: 6 countries (CM, NG, GA, GQ, TD, CF), 10 Cameroon regions
    - Route: `/admin/geography`
  
  - **Pod-Based Team Structure**
    - Backend: `/app/backend/routes/pods.py` - Pod CRUD, member management, operator assignment
    - Models: `/app/backend/models/pod.py` - Pod, PodMembership, PodRole (team_lead, bdr, csm, technician, support_agent)
    - Frontend: `/app/frontend/src/pages/admin/PodManagement.jsx`
    - Features: Create pods, add members, assign operators, enforce one-employee-one-pod rule
    - Route: `/admin/pods`
  
  - **Employee Access Scopes (Attribute-Based Scoping)**
    - Backend: `/app/backend/routes/employee_scopes.py` - Scope CRUD, user assignment
    - Models: `/app/backend/models/employee_scope.py` - EmployeeAccessScope, EmployeeScopeAssignment
    - Frontend: `/app/frontend/src/pages/admin/EmployeeScopeManagement.jsx`
    - Default scopes: Cameroon SME Manager, Enterprise Manager, Travel Services, Hotel Services, Douala Region, Yaoundé Region, Global Access
    - Route: `/admin/employee-scopes`
  
  - **Customer Location Filtering**
    - Backend: `/app/backend/routes/customer_location.py` - Location resolution, visibility filtering
    - Utility: `/app/backend/utils/geolocation.py` - CustomerLocationContext, priority-based resolution
    - Priority: GPS > IP geolocation > SIM country > Profile country > Manual override
    - Rule: In Africa = country-filtered, Outside Africa = global
  
  - **Authorization Service**
    - Backend: `/app/backend/services/authorization_service.py` - AuthorizationContext builder
    - Enhanced middleware: `/app/backend/middleware/auth.py` - Builds authorization context for employees
  
  - **Operator Model Enhanced**
    - Added: country (ISO code), region (region code), market_segment (sme/enterprise/strategic)
    - Added: assigned_pod_id, assigned_pod_name
  
  - **Navigation Updated**
    - Added to Admin Config (Super Admin only): Pod Management, Access Scopes, Geography
  
  - **Testing**: 100% backend (20 passed), 100% frontend (3 pages working)

## P2 Implementation (Feb 7, 2026 - Session 12 continued)
- [x] **Authorization Context Wired to Operators API**
  - Updated `/app/backend/routes/operators.py` with `get_operator_access_filter()` function
  - Operators listing now respects user's authorization context:
    - Super Admin: Sees all operators (has_global_access: true)
    - Admin with scopes: Filtered by scope attributes (country, region, segment, service)
    - Admin in pod: Filtered by pod's assigned operators
    - Legacy admins (no scopes/pods): Default to seeing all (backwards compatible)
  - Response includes `access_info` object with filtering metadata
  - Updated `get_operator()` to check authorization before returning

- [x] **Customer Location Selection Modal**
  - Created `/app/frontend/src/components/LocationSelectionModal.jsx`
  - Custom dropdown (not Radix Select) to work inside Dialog modal
  - Features:
    - Auto-detects location via IP geolocation
    - Lists African countries first (local mode)
    - Saves to localStorage for persistence
    - Shows visibility scope explanation
  - Integrated into Layout.jsx - appears 2 seconds after customer login
  - Location indicator added to header for customers

- [x] **Customer Location API**
  - `/api/customer-location/ip-info` - Get IP-based location
  - `/api/customer-location/resolve` - Priority-based resolution
  - `/api/customer-location/services` - Location-filtered operators


## Completed Features (Feb 7, 2026 - Session 13)
- [x] **P0: Location-Based Service Filtering for Customers**
  - Created reusable backend utility `/app/backend/utils/location_filter.py`
  - Two filtering strategies:
    - Direct `country` field match for hotels, events, restaurants
    - Operator-based lookup for car_rental, cinema, pressing, banquets, packages, travel
  - Added `country` query parameter to ALL 9 service GET endpoints:
    - `/api/hotels/`, `/api/events/`, `/api/restaurants/`, `/api/car-rental/`
    - `/api/travel/routes`, `/api/cinema/`, `/api/pressing/`, `/api/banquets/`, `/api/packages/`
  - Visibility rules:
    - African country code → filter to that country only
    - Non-African country code → show all (global view)
    - No country param → show all (no filtering)
  - Frontend `getLocationParam()` helper reads `oryno_user_location` from localStorage
  - Updated `api/services.js` to automatically include country param in all service searches
  - Updated direct API calls in HotelsResults, RestaurantsResults, CarRentalResults pages
  - Fixed EventsResults.jsx: was calling undefined `eventsAPI.list()`, now uses `eventsApi.search()` from services.js
  - Data migration: Fixed orphaned operator references in events, cinemas, pressings collections
  - **Testing**: 100% backend (16/16), 100% frontend - All location features verified

- [x] **LocationSelectionModal Verification**
  - Custom dropdown working correctly inside Dialog modal
  - Shows African countries (CM, CF, TD, GQ, GA, NG) grouped under "Africa" header
  - Saves selection to localStorage as `oryno_user_location`
  - Header shows country name + "Local" badge after selection

## Backlog (Updated Feb 10, 2026)
- [ ] **P3: Email Invitation System** - Invite new users via email
- [ ] **P4: Capacitor Mobile App** - Customer-facing mobile app
- [ ] **P5: Default Document Templates**
- [ ] **MINOR: Fix mixed content warning** - Notifications API endpoint HTTP vs HTTPS

## Completed Features (Feb 10, 2026 - Session 15)
- [x] **Permissions moved under User Management** - Sub-tab at `/admin/users/permissions`
- [x] **Geography moved under Operator Management** - Sub-tab at `/admin/operators/geography`
- [x] **Operator table visual improvements**
  - Colored service type badges (pink=hotels, blue=travel, amber=restaurants, etc.)
  - Colored market segment badges (blue=SME, violet=Enterprise, amber=Strategic)
  - Pagination (10 items/page, controls appear when >10 operators)
- [x] **Market Segments CRUD** - New page at `/admin/market-segments`
  - Full CRUD API: GET/POST/PUT/DELETE on `/api/geography/market-segments`
  - Dynamic segments stored in MongoDB `market_segments` collection
  - Custom colors with color picker and preset palette
  - Auto-seeded defaults (SME, Enterprise, Strategic) on first access
- [x] Sidebar reorganized: Permissions/Geography removed as separate items, Market Segments added
- [x] Backwards compatible: old routes (`/admin/permissions`, `/admin/geography`) still work
- **Testing**: 100% backend (7/7) + frontend (iteration_35)

## Completed Features (Feb 8, 2026 - Session 14)
- [x] **Geography Integration in Operator Forms**
  - Added Country, Region, Market Segment dropdowns to Create Operator dialog
  - Added Country, Region, Market Segment dropdowns to Edit Operator dialog
  - Country dropdown pulls from `/api/geography/countries` (6 countries)
  - Region dropdown dynamically filters based on selected country
  - Market Segment: SME / Enterprise / Strategic
  - Operator table now shows "Location" column (country, region, segment badge)
  - Detail view shows country, region, segment info
  - Create defaults: Country=CM, Segment=SME
  - Edit form pre-fills with operator's current values
  - Fixed Edit dialog crash: country name→code normalization, SelectItem value fix
  - Data migration: normalized all operator countries from full names to ISO codes (Cameroon→CM)
  - **Testing**: 100% backend + frontend (iteration_33)

## Completed Features (Feb 7, 2026 - Session 13d)
- [x] **Employee Cards show Pod & Team Lead**
  - Employee cards on `/admin/employees` now display pod name, role badge, and team lead name
  - Fetches pod memberships on page load and merges client-side by user_id/email
  - Conditional rendering: only shows when employee is assigned to a pod
  - **Testing**: 100% (iteration_31)

- [x] **Assign Operators Modal - Search & Filters**
  - Added search input to filter operators by name in real-time
  - Added status filter (All / Active / Pending / Suspended)
  - Added service type filter (dynamic from operator data)
  - Added country filter (dynamic from operator data)
  - Filters reset when modal closes
  - **Testing**: 100% (iteration_31)

- [x] **Add Member Dropdown - Pulls from Employee List**
  - Dropdown now combines employees from `/api/employees/` and admin users from `/api/users/`
  - Employees with linked user accounts appear directly; admin users show with "(platform)" suffix
  - Employee department and city shown for context
  - **Testing**: 100% (iteration_32)

- [x] **Team Lead Removable/Changeable**
  - Team Lead section now shows "Remove" button (`data-testid='remove-team-lead-btn'`)
  - Members list shows remove button for ALL members including team leads
  - Backend already handled team lead removal (clears `team_lead_id`/`team_lead_name`)
  - After removal, user becomes available for reassignment to same or different pod
  - **Testing**: 100% (iteration_32)

## Completed Features (Feb 7, 2026 - Session 13c)
- [x] **Rename: Employees → Employee Management**
  - Updated sidebar label in `useSidebarMenu.js`
  - Updated page title in `EmployeesManagement.jsx`
  - Updated search items in `Layout.jsx`
- [x] **Rename: Operators → Operator Management**
  - Updated sidebar label in `useSidebarMenu.js`
  - Updated page title in `OperatorsManagement.jsx`
  - Updated reference in `TeamRolesManagement.jsx`
- [x] **Moved Pod Management & Access Scopes under Employee Management**
  - Removed from sidebar Admin Config submenu
  - Added as sub-pages with tab navigation: `/admin/employees/pods`, `/admin/employees/access-scopes`
  - All 3 pages (Employees, Pod Management, Access Scopes) share consistent tab navigation
  - Old routes (`/admin/pods`, `/admin/employee-scopes`) kept for backwards compatibility
  - **Testing**: 100% (11/11 frontend tests passed, iteration_30)

## Completed Features (Feb 7, 2026 - Session 13b)
- [x] **P1: Data Migration**
  - Created migration script `/app/backend/scripts/migrate_access_control.py`
  - All 6 operators: added `region` (CM-SW, CM-CE, CM-OU, CM-LT) and `market_segment` (sme)
  - All 9 users: added `country` field (Cameroon)
  - All service collections (car_rentals, cinemas, pressings, banquets, packages, travel_routes): added `country` from operator
  - Cleaned up test data (removed TEST_Tanzania country)
  - Ensured all 10 CM regions exist in regions collection
  - **Testing**: 100% verified via iteration_29

- [x] **P2: Frontend Scope Filtering**
  - Exposed `authorization_context` in `/api/auth/me` response for admin users
  - Context includes: `user_type`, `pod_membership`, `access_scopes`, `accessible_operator_ids`, `has_global_access`
  - Operators listing already filtered by backend based on auth context
  - Frontend management pages implicitly respect scoped access
  - **Testing**: 100% verified

- [x] **P3: Pod Management Hierarchical Logic**
  - Added `GET /api/pods/my/team` - Any pod member can see their team + assigned operators
  - Added `POST /api/pods/my/team/members` - Team lead can add members without `pods.manage_members` permission
  - Added `DELETE /api/pods/my/team/members/{user_id}` - Team lead can remove members
  - Added `PUT /api/pods/my/team/members/{user_id}/role` - Team lead can change member roles
  - Enforced rules: team leads cannot assign team_lead role, cannot remove themselves
  - Non-team-leads get 403 on management endpoints
  - **Testing**: 100% verified

- [x] **P4: Layout.jsx Refactoring**
  - Extracted navigation menu config into `useSidebarMenu.js` hook (229 lines)
  - Extracted `ICON_COLORS` and `USER_ROLES` constants
  - Layout.jsx reduced from **1249 → 842 lines** (33% reduction)
  - All sidebar navigation, flyout menus, role-based filtering preserved
  - **Testing**: 100% - all navigation items render and click correctly


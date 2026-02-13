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

## Completed Features (Feb 10, 2026 - Session 15c)
- [x] **Market Segment assignment fix** — Backend `OperatorUpdate` model changed from hardcoded enum to `str`, allowing dynamic segments (e.g., "micro") to be assigned to operators
- [x] **Service tags expandable** — Operators with >2 services show hover dropdown revealing all services
- [x] **Audit Log route fix** — Added `/admin/audit-log` route (sidebar was linking to singular, route was plural)
- [x] **Customer location first-visit-only** — Modal only appears on first-ever visit (`oryno_location_prompted` flag). Subsequent visits auto-detect IP silently. Manual overrides respected.
- [x] **Location in Settings** — Customer Settings page has "Location" section showing current country, mode (Local/Global), and "Change Location" button
- [x] **Settings role detection fix** — Customer with stale `operator_id` was getting Operator settings; now uses `role` field only
- **Testing**: 100% backend (6/6), 95% frontend (iteration_37)

## Completed Features (Feb 10, 2026 - Session 15d)
- [x] **Scope-Pod Integration** — Access Scopes can now assign pods. Pod operator assignment filters by scope criteria.
  - Added `assigned_pod_ids` to scope model and create/edit forms
  - Assign Operators modal shows scope info banner and filters operators when pod has a scope
  - New endpoint: `GET /api/employee-scopes/{id}/matching-operators`
- [x] **Dynamic market segment colors** — Operator table badges use colors from `/api/geography/market-segments` API
- [x] **Operator owner fallback** — Owner column now resolves via `owner_user_id → created_by → operator_role=owner` chain
- **Testing**: 100% backend (9/9) + frontend (iteration_38)

## Backlog (Updated Feb 10, 2026)
- [ ] **P3: Email Invitation System** - Invite new users via email
- [ ] **P4: Capacitor Mobile App** - Customer-facing mobile app
- [ ] **P5: Default Document Templates**
- [ ] **MINOR: Fix mixed content warning** - Notifications API endpoint HTTP vs HTTPS

## Completed Features (Feb 10, 2026 - Session 15b)
- [x] **Sales renamed to Revenue** - Sidebar label, page titles updated
- [x] **Transactions dropdown** - All Orders, All Receipts, All Bookings grouped under "Transactions" submenu for Admin/Super Admin
- [x] **Market Segments moved under Operator Management** - Sub-tab at `/admin/operators/market-segments`

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


## Session: Feb 12, 2026 - Bug Fixes & UI Improvements

### Completed Tasks

- [x] **Login Page: Removed Operator Checkbox**
  - Removed the "I'm logging in as a service operator" checkbox from the login form
  - Cleaned up `isOperator` state variable and `FileText` import from Login.jsx
  - **Testing**: 100% verified via iteration_39

- [x] **Pod Member Assignment Fix: Employee Role Users**
  - Root cause: `routes/pods.py` only allowed `admin`/`super_admin` roles to be added to pods
  - Employees created with `system_role: "employee"` got `role: "employee"` in the users collection, which was rejected
  - Fix: Updated role validation in both `add_pod_member` and `team_lead_add_member` endpoints to accept `["admin", "super_admin", "employee"]`
  - Also updated `PodManagement.jsx` to include `employee`-role users in the available members list
  - **Testing**: 100% verified via iteration_39

- [x] **Geography Page: Country→Region Parent-Child View**
  - Redesigned GeographyManagement.jsx to show countries as expandable rows with nested regions (like hotels→rooms)
  - Removed the old separate "Countries" and "Regions" tabs
  - Each country row shows region count badge, click to expand/collapse
  - "Add Region" button available inside each country's expansion area
  - Search filters both countries and their regions
  - **Testing**: 100% verified via iteration_39

### Known Issues (Pre-existing)
- Mixed content warning on notifications websocket (ws:// vs wss://) - cosmetic, non-blocking

### Session: Feb 12, 2026 (Part 2) - Search/Filter Enhancements

- [x] **Pod Management - Add Member Modal**: Replaced Select dropdown with searchable radio list + department filter
- [x] **Access Scopes - Assign Employee Modal**: Added search input, now shows employees with `role: "employee"` in addition to admin/super_admin
- [x] **Access Scopes - Create/Edit Scope Modal**: Added search to Countries and Market Segments sections
- [x] **Access Scopes - Backend Fix**: `POST /api/employee-scopes/{scope_id}/assign` now accepts `role: "employee"` users
- [x] **Employees Page**: Added grid/list view toggle (table view with Employee, Contact, Department, Pod, Status, Salary, Actions columns)
- **Testing**: 100% verified via iteration_40


### Session: Feb 12, 2026 (Part 3) - Cascade & Status Sync

- [x] **Employee Status → User Account Sync**: Changing employee status cascades to linked user account (active→active, on_leave→active, suspended→suspended, terminated→suspended, inactive→suspended)
- [x] **Employee Delete → Cascade Cleanup**: Deleting an employee removes their linked user from all pods (deactivates memberships) and scopes
- [x] **User Delete → Cascade Cleanup**: Deleting a user account removes them from all pods and scopes automatically
- [x] **EmployeeStatus Enum**: Added `SUSPENDED` to backend model
- [x] **New utility**: `/app/backend/utils/cascade.py` — shared cascade functions
- [x] **Default list view**: Employees page defaults to list view
- **Testing**: 100% verified via iteration_41

### Session: Feb 12, 2026 (Part 4) - Modal UI Revamp

- [x] **Shared AdminModal Component**: Created `/app/frontend/src/components/shared/AdminModal.jsx` with gradient headers, accent colors (blue/emerald/violet/amber/slate), sections, FormField, StyledInput exports
- [x] **View Operator Modal**: Enlarged to `max-w-4xl`, market segment displayed with correct color, info grid with colored icons, gradient stats cards, Team tab with emerald intro, Roles tab with violet intro
- [x] **Edit Operator Modal**: Amber gradient header, sectioned layout (Basic Info, Geography, Services) with colored backgrounds
- [x] **Create Operator Modal**: Emerald gradient header, structured sections with visual hierarchy
- [x] **Pod Management Modals**: Create Pod (blue header), Add Member (emerald header) — all using AdminModal
- [x] **Access Scopes Modals**: Create/Edit Scope (violet header with colored sections), Assign Employee (emerald header) — all using AdminModal
- **Testing**: 100% verified via iteration_42

### Session: Feb 12, 2026 (Part 5) - Phase 1: OTP Flow, Activity Logs, Tier Badge

- [x] **OTP Flow Enhancement**: After OTP verification, shows green checkmark success animation + "Account activated!" message, then redirects to login (no auto-login). On error, shows "Resend Code" and "Edit Info" action buttons
- [x] **Email Registration**: No longer auto-logs in — redirects to login with success message
- [x] **User Activity Log Fix**: Backend was querying by `user_id` but activity_logs use `actor_email`. Fixed to query by `actor_id` OR `actor_email`, confirmed filtering (superadmin=728, admin=95)
- [x] **Loyalty Tier Badge in Header**: Customer users see their tier badge (🥉 Bronze, 🥈 Silver, 🥇 Gold, 💎 Platinum) next to their name in the top-right header. Not shown for admin/operator.
- **Testing**: 100% verified via iteration_43

### Upcoming (Phase 2 & 3) — Loyalty Program Overhaul
- Loyalty Admin Overview with visual charts/stats
- Loyalty Rewards CRUD with enhanced modals and backend APIs
- ~~Loyalty Members: clickable with activity modal, tier badges, filters~~ DONE
- Customer Loyalty Frontend: 3-tab redesign (Rewards/Activity/My Rewards)
- Referral System with codes and tracking
- UI color refinements (subtle palette)

### Session: Feb 12, 2026 (Part 6) - Phase 2: Loyalty Program Admin Overhaul

- [x] **Admin Overview Revamp**: Gradient stat cards (blue/amber/emerald/violet), tier distribution with emoji symbols (🥉🥈🥇💎) and progress bars, Tier Symbols Guide, Points Flow visualization, Earning Rules section
- [x] **Rewards CRUD Enhanced**: AdminModal with violet header, 4 sections (Details, Points & Eligibility, Type & Value, Availability & Limits). New fields: valid_from, valid_to, max_redemptions, total_available. Rewards displayed as cards with tier-colored left borders. Loading spinner on save.
- [x] **Members Enhanced**: Tier emoji next to member name, tier filter dropdown, clickable rows opening member detail modal (AdminModal blue header) showing tier card, point activity transactions, redemptions
- [x] **Backend**: Extended RewardCreate/RewardUpdate models with new fields. New endpoints: `GET /loyalty/admin/members/{user_id}` (member detail with transactions/redemptions), `GET /loyalty/admin/stats/tier-history` (tier distribution data)
- [x] **Bug Fix**: Member list was returning loyalty program ID instead of user ID — fixed for proper detail modal
- **Testing**: 100% verified via iteration_44

### Session: Feb 12, 2026 (Part 7) - Phase 3: Customer Loyalty & Referral System

- [x] **Customer Loyalty Redesign**: 3-tab layout — "My Rewards" (tier roadmap with 4 circles + connecting progress, redeemed rewards), "Activity" (point transactions with earn/redeem styling), "Rewards" (redeemable cards with tier badges and progress)
- [x] **Tier Roadmap**: Visual road with 4 tier circles (🥉→🥈→🥇→💎), connecting progress line, current tier highlighted, next tier progress bar
- [x] **Tier Card**: Gradient header matching tier color, member since date, available points, stats grid
- [x] **Referral System Backend**: `GET /loyalty/referral` (get/create referral code + stats), `POST /loyalty/referral/claim?referral_code=X` (claim a referral, award points to referrer). Collections: `referrals`, `referral_claims`
- [x] **UI Color Refinement**: Referral card changed from bright green gradient to subtle blue/slate palette (bg-blue-50, border-blue-200)
- [x] **Tier Auto-Recalculation**: GET /loyalty/program now auto-upgrades tier if total_points exceed threshold (fixed stale tier bug)
- **Testing**: 100% verified via iteration_45


### Session: Feb 12, 2026 (Part 8) - Loyalty Redeem Flow & Redeemable Codes

- [x] **Redeem Flow Fix**: Backend reward ID was missing (`_id: 0` projection stripped it). Fixed `/loyalty/rewards` to convert `_id` → `id`. Redeem endpoint now supports both `_id` and `id` lookups.
- [x] **Redeem Success State**: After clicking "Confirm Redemption", shows green checkmark + generated code + expiry date + Copy Code button + direction to Redeemable Codes section
- [x] **Redeemable Codes Section**: Replaced "Refer Friends & Earn" with "Redeemable Codes" — shows referral code as first row ("Refer a Friend") + all active redemption codes with expiry status (Xd left / Expired) and copy buttons
- [x] **Rewards Tab**: Now only shows rewards NOT already redeemed by user. Shows expiry date when `valid_to` is set.
- [x] **Activity Tab**: Shows point transactions from bookings with earn/redeem styling and service type labels
- [x] **Expiry Info**: All codes show days-left countdown (color-coded: green for OK, amber for ≤7 days, red for expired) + formatted expiry date
- **Testing**: Verified via screenshots — full redeem flow working end-to-end

### Session: Feb 12, 2026 (Part 9) - Copy Button Fix & Full Loyalty Audit

- [x] **Copy Button Fix**: Added clipboard fallback for non-HTTPS (`document.execCommand('copy')`). Visual feedback: Copy icon → Check (green) for 2 seconds + toast "Code copied to clipboard!"
- [x] **Full Loyalty Audit**: All endpoints verified working:
  - Admin: stats, tier-history, members list, member detail, rewards CRUD (create/update/delete with all fields)
  - Customer: program (auto tier recalc), rewards (with id), transactions, redemptions, referral
- **Testing**: 100% verified via iteration_46 (10/10 backend, all frontend features)


### Session: Feb 12, 2026 (Part 10) - Refactoring & Code Quality

- [x] **Loyalty.jsx Refactoring**: Split from 838 lines into clean modular structure:
  - `frontend/src/pages/loyalty/constants.js` — Shared TIER_CONFIG, TIER_SYMBOLS, DEFAULT_REWARDS, getExpiryInfo
  - `frontend/src/pages/loyalty/CustomerLoyaltyView.jsx` — Customer-facing loyalty view
  - `frontend/src/pages/loyalty/AdminLoyaltyView.jsx` — Admin loyalty management view
  - `frontend/src/pages/Loyalty.jsx` — Lean router component (43 lines)
- [x] **Settings.jsx Role Detection Fix**: Standardized isCustomer logic — removed redundant duplicate definition in renderSectionContent (was `user?.role === 'customer' || !user?.role`, now uses single consistent `!isAdmin && !isOperator`)
- [x] **Mixed Content WebSocket Investigation**: Confirmed no WebSocket usage in frontend (NotificationContext uses HTTP polling). Backend WebSocket endpoints exist for live chat but frontend doesn't connect to them. Non-issue.
- **Testing**: 100% verified via iteration_47 (9/9 backend, all frontend features)


### Session: Feb 12, 2026 (Part 11) - Permissions & Access Control Audit

- [x] **Permission Enforcement Audit**: Replaced manual role checks (`if role not in [...]`) with `require_permission()`/`require_any_permission()` dependency injection across 14 route files:
  - `restaurants.py` — CRUD + menu management (restaurants.create/edit/delete/manage_menu)
  - `cinema.py` — CRUD + films + showtimes (cinema.create/edit/delete/manage_screenings)
  - `banquets.py` — CRUD (banquets.create/edit/delete)
  - `pressing.py` — CRUD (pressing.create/edit/delete)
  - `packages.py` — CRUD (packages.create/edit/delete)
  - `travel.py` — CRUD (travel.create/edit/delete)
  - `events.py` — CRUD (events.create/edit/delete)
  - `rooms.py` — Update/Delete (hotels.manage_rooms)
  - `users.py` — Full CRUD + role/activity (users.create/edit/delete/manage_roles/view_activity)
  - `employees.py` — Full CRUD (employees.view/create/edit/delete)
  - `loyalty.py` — Admin endpoints (loyalty.view/manage_rewards/manage_programs)
  - `promo_codes.py` — Full CRUD (promo.view/create/edit/delete)
  - `activity_log.py` — View + Export (activity.view/export)
  - `orders.py` — Edit + Process (orders.edit/process)
- [x] **New Endpoints Created**:
  - `PUT /api/events/{id}` — Update event (requires events.edit)
  - `DELETE /api/events/{id}` — Delete event (requires events.delete)
  - `PUT /api/orders/{id}` — Update order (requires orders.edit)
  - `PUT /api/orders/{id}/process` — Process pending order (requires orders.process)
  - `GET /api/activity/export` — Export activity logs (requires activity.export)
- [x] **Admin Default Permissions Expanded**: Added 40+ permissions for admin role including all service CRUD, employee/pod/scope management, geography management, validation, orders, promo codes
- **Testing**: 100% verified via iteration_48 (41/42 passed, 1 skipped)


### Session: Feb 12, 2026 (Part 12) - Frontend Permissions Update & Audit Trail

- [x] **Frontend Permission Matrix Updated**: Replaced old PERMISSION_MODULES (26 aspirational modules) with 26 modules aligned to backend enforcement. Added `enforced: true` flag to permissions with actual backend API enforcement. "API" badge shown in Matrix tab for enforced permissions.
- [x] **Permission Audit Trail (Backend)**: Added `_log_permission_denial()` to `permissions.py` — logs every blocked action to `permission_audit_trail` MongoDB collection with user_id, email, role, required_permissions, and timestamp. Called from `require_permission`, `require_any_permission`, and `require_all_permissions`.
- [x] **Permission Audit Trail (API)**: New `GET /api/access/audit-trail` endpoint with pagination, filtering by permission/user, and aggregated stats (total_denials, top_denied_users, top_denied_permissions). Requires `access.view_permissions`.
- [x] **Permission Audit Trail (Frontend)**: New "Audit Trail" tab on Permissions page (super_admin only). Features: 3 stats cards (Total Denials, Top Blocked Users, Most Blocked Permissions), denial log table (Time, User, Role, Required Permissions), filter by permission, pagination.
- [x] **ADMIN_ASSIGNABLE_PERMISSIONS Updated**: Expanded to match all new backend-enforced permissions across all service modules.
- **Testing**: 100% verified via iteration_49 (15/15 backend, all frontend features)


### Session: Feb 12, 2026 (Part 13) - Bills Page Move

- [x] **Bills moved to Transactions**: Moved "Bills" from Admin Config submenu to the Transactions dropdown in the main sidebar. Renamed to "All Bills" to match the "All Orders", "All Receipts", "All Bookings" naming convention. Transactions dropdown now has 4 items: All Orders, All Receipts, All Bookings, All Bills.
- [x] **Page title updated**: BillsManagement.jsx heading changed from "Bills & Invoices" to "All Bills"


### Session: Feb 12, 2026 (Part 14) - Operator Management Enhancements

- [x] **Owner Account Creation in Create Operator Modal**: Added "Owner Account" section with toggle checkbox. When enabled, shows Owner Full Name, Email, Phone, Password fields. Backend creates a user with `role: operator`, `operator_role: owner`, linked via `operator_id`. Owner can immediately login. Default password: Oryno@2024.
  - Backend: Updated `OperatorCreate` model with `create_owner_account`, `owner_full_name`, `owner_email`, `owner_phone`, `owner_password` fields
  - Backend: `POST /api/operators/` now conditionally creates owner user account and links it to the operator
- [x] **Data Correctness Verified**: All table columns pull correct data from backend:
  - Services: From `service_types` array with colored badges
  - Owner: Resolved from `owner_user_id` -> users collection (name + email)
  - Date Joined: From `created_at` timestamp
  - Status: From `status` field with colored badges
  - Revenue: Computed in real-time from orders collection aggregation
- [x] **Enhanced Filters**: Added "Filters" toggle button next to search bar that expands to show:
  - Owner filter (search by owner name/email)
  - Date From / Date To (filter by join date range)
  - Existing Status and Service type filters preserved
  - Active filter count badge + Clear All button
- **Testing**: 100% verified via iteration_50 (6/6 backend, all frontend tests passed)


### Session: Feb 12, 2026 (Part 15) - Phase 1: Travel Booking Critical Fixes

- [x] **P0: Fix Payment Verification Bug**: `PaymentSuccess.jsx` was using raw `fetch()` with `localStorage.getItem('token')` but the app stores auth as `access_token`. This caused 401 errors on `/checkout/status/` → 5 retries → "Verification Error". Fixed by replacing with `api.get()` from the Axios client which correctly reads `access_token`. Also increased max attempts to 8 and poll interval to 2.5s.
- [x] **P0: Fix Live Seat Selection Over-Reservation**: Added three validation layers to `POST /api/seat-bookings/reserve`:
  1. Total availability check: rejects if `requested_count > available_count` (prevents over-reservation)
  2. Duplicate check: rejects already reserved/booked seats (existing)
  3. Seat range validation: rejects seat numbers outside 1 to total_seats
- [x] **P0: Dynamic Seat Count on Travel Results**: 
  - New endpoint: `GET /api/seat-bookings/available-counts?route_ids=X,Y&travel_date=YYYY-MM-DD` — returns real-time available counts per route (total - booked/reserved)
  - Frontend `TravelResults.jsx` now fetches dynamic seat counts after loading routes and updates `available_seats` field
  - Shows "Sold Out" when `available_seats === 0`
- **Testing**: 100% verified via iteration_51 (16/16 backend tests passed)


### Session: Feb 12, 2026 (Part 16) - Phase 2: Travel Booking Page UX Overhaul

- [x] **Redesigned Trip Summary & Price Breakdown**: Split into 2 separate cards:
  - Trip Summary card: Blue header, outbound in blue-tinted bg, return in emerald-tinted bg, with icons and date formatting
  - Price Breakdown card: Clean white bg with clear subtotal, commission, promo code input, and prominent total
  - Removed the dark slate-800/900 gradient that made text hard to read
- [x] **Fixed "Enable" Button for Seat Selection**: Moved the Switch toggle from inside the dark gradient header to a prominent clickable card below it. Card style: green border when enabled, slate when disabled. Shows "Enable Seat Selection" / "Seat Selection Enabled" text. Much more visible and accessible.
- [x] **Payment Method Logos**: Replaced generic lucide-react icons with branded SVG logos:
  - Stripe: Shows Visa + Mastercard logo marks
  - MTN MoMo: Yellow bg with MTN MoMo branding text
  - Orange Money: Orange bg with OM branding
- [x] **Round Trip → 2 Tickets, 1 Receipt**: Backend `POST /api/orders/create` now detects `is_round_trip=true` + `service_type=travel` and creates:
  - 2 separate order records (outbound + return) linked by `trip_group_id`
  - Each order has `trip_leg` field ("outbound" or "return")
  - 1 receipt in `receipts` collection with `order_ids` array referencing both orders
  - Frontend passes `outbound_price` for correct per-leg pricing split
  - Single trip orders remain 100% backwards compatible
- **Testing**: 100% verified via iteration_52 (8/8 backend tests passed)


### Session: Feb 12, 2026 (Part 17) - Phase 3: Loyalty Promo Codes

- [x] **Promo Code Generation from Rewards**: New endpoint `POST /api/loyalty/admin/rewards/{id}/generate-promo` creates a promo code from a loyalty reward. Code format: `LYL-XXXXXX`. Maps reward type to discount_type (discount→percentage, others→fixed). Stores in `promo_codes` collection with `source: 'loyalty_reward'` and `reward_id` link.
- [x] **Admin Promo Codes View**: New `GET /api/loyalty/admin/promo-codes` endpoint returns all loyalty-generated promos. Frontend Rewards tab now shows:
  - Tag icon "Generate Promo Code" button on each reward card
  - "Generated Promo Codes" table showing: Code, Reward, Discount, Used/Limit, Valid Until, Status (Active/Expired/Exhausted), Copy button
- [x] **Customer Booking Integration**: Fixed TravelBooking.jsx promo code flow:
  - Replaced raw `fetch` with `api.post` for correct auth
  - Passes `service_type` and `order_amount` for proper validation
  - Handles both percentage and fixed discount calculations
  - Records promo usage via `POST /api/promo-codes/use` after successful booking
- [x] **End-to-End Status Tracking**: 
  - `times_used` increments on each use (visible in admin promo table)
  - `per_user_limit` prevents reuse by same customer (default: 1)
  - `usage_limit` prevents over-use (from reward's max_redemptions)
  - Status shows Active/Expired/Exhausted based on dates and usage
- **Testing**: 100% verified via iteration_53 (16/16 backend tests passed)


### Session: Feb 12, 2026 (Part 18) - Loyalty Redemption ↔ Promo Code Alignment

- [x] **Bridge: Redemption → Promo Code**: `POST /api/loyalty/redeem/{id}` now creates entries in BOTH `loyalty_redemptions` (with status "active") AND `promo_codes` (with `source: "loyalty_redemption"`, `redemption_id` link, `usage_limit: 1`). Codes are immediately usable in booking pages.
- [x] **Feedback Loop: Use → Status Update**: `POST /api/promo-codes/use` now:
  - Increments `times_used` on promo code
  - Sets `is_active=false` when usage_limit reached
  - Updates linked `loyalty_redemptions` record: `status="used"`, `used_in_order=order_id`
- [x] **Admin View Unified**: `GET /api/loyalty/admin/promo-codes` returns both `source="loyalty_reward"` (admin-generated) AND `source="loyalty_redemption"` (customer-redeemed) codes. Customer-redeemed codes show redeemer name/email.
- [x] **Customer View**: Redemptions page shows "used" status with blue badge after code is consumed. Active codes in "Redeemable Codes" section. Used codes in "All Redeemed" section.
- [x] **Reuse Prevention**: Used code returns 404 on validation (deactivated after single use).
- **Testing**: 100% verified via iteration_54 (21/21 backend E2E tests passed)


### Session: Feb 12, 2026 (Part 19) - Phase 3: Communications & Travel Analytics

- [x] **Generic Communications API**: New `backend/routes/communications.py` replaces hardcoded hotel-specific endpoints. Works for ALL service management pages.
  - `POST /api/communications/announcements` — Create service announcement (title, message, service_type)
  - `GET /api/communications/announcements?service_type=X` — Get filtered announcements
  - `POST /api/communications/alerts` — Create alert (title, message, service_type, severity)
  - `GET /api/communications/alerts?service_type=X&status=active` — Get active alerts
  - `PUT /api/communications/alerts/{id}/resolve` — Resolve alert
  - `GET /api/communications/recent?service_type=X` — Combined feed (notifications + announcements + alerts) with `comm_type` labels
  - Data stored in `service_announcements` and `service_alerts` MongoDB collections
  - All endpoints support operator_id filtering for multi-tenant access
- [x] **Frontend Communications Fixed**: `ServiceCommunicationsHub.jsx` updated to use `/api/communications/` endpoints instead of `/hotels/` endpoints. Quick Actions (send announcement, create alert, submit support ticket, schedule meeting) now work for all services.
- [x] **Travel Analytics Dashboard with Real Data**: New `GET /api/travel/analytics/dashboard` endpoint:
  - `monthly_trend`: Last 6 months of real bookings + revenue from orders collection
  - `route_popularity`: Top routes ranked by booking count
  - `vehicle_utilization`: Real utilization percentages from seat_bookings data
  - `summary`: total_bookings, total_revenue, active_routes, active_vehicles from DB
  - Frontend `TravelAnalyticsSection` fetches from API (replaced hardcoded mock data)
- **Testing**: 100% verified via iteration_55 (26/26 backend tests passed). Testing agent also fixed datetime comparison bug in communications recent feed.


### Session: Feb 12, 2026 (Part 20) - Phase A: Favourites System

- [x] **Backend Favourites API**: New `/api/favourites/` CRUD endpoints:
  - `POST /` — Add item to favourites (service_type, item_id, item_name, image, location, price, rating, extra metadata)
  - `GET /` — Get user's favourites (with service_type filter, pagination)
  - `DELETE /{service_type}/{item_id}` — Remove favourite
  - `GET /ids?service_type=X` — Bulk get favourite IDs (for results pages)
  - `GET /check?service_type=X&item_id=Y` — Check single favourite status
  - Duplicate-safe, user-scoped, supports all 9 service types
- [x] **Reusable Frontend Hook**: `useFavourites(serviceType)` hook at `/hooks/useFavourites.js`
  - Loads favourite IDs on mount, provides `isFav(id)` and `toggleFav(item)` functions
  - Optimistic UI updates with rollback on error
  - Integrated across ALL results pages: Hotels, Travel, CarRental, Restaurants, Events, Cinema, Laundry, Banquet, Packages
- [x] **Settings → Favourites Page**: New "Favourites" section in customer Settings with:
  - Service type filter dropdown
  - Cards showing image, name, service type badge, location, rating, price
  - Remove button per item
  - Empty state with helpful prompt
- **Testing**: 100% verified via iteration_56 (27/27 backend tests passed)


### Session: Feb 12, 2026 (Part 21) - Phase B: Hotel Booking Fixes

- [x] **Photo Navigation Always Visible**: Gallery modal nav buttons changed from transparent `hover:bg-white/20` to solid `bg-black/50 hover:bg-black/70` with larger 48px hit targets. Always visible without hovering.
- [x] **Fixed Double X Close Button**: Added `[&>button]:hidden` to both gallery DialogContent elements to hide the default shadcn close button, keeping only the custom X button. Applied to both hotel gallery and room card gallery.
- [x] **Payment Section Redesigned**: Removed purple gradient header, replaced with clean white card layout matching the Travel booking style. Simplified "Pay" button styling.
- [x] **Removed Page Transition Animation**: Added `useEffect(() => { window.scrollTo(0, 0); }, [])` to both HotelDetails and HotelBooking components. Pages now load at the top instead of showing a scroll-down animation.
- [x] **Dynamic "Rooms Left"**: Updated `GET /api/rooms/` to accept optional `check_in` and `check_out` params. Dynamically calculates `available_rooms = total_rooms - active_bookings` by counting overlapping reservations in `room_bookings` collection. Frontend passes dates when loading rooms. Backwards compatible without dates.
- **Testing**: 100% verified via iteration_57 (14/14 backend tests passed)


### Session: Feb 12, 2026 (Part 22) - Phase C: Car Rental Fixes

- [x] **Fixed Navigation Flow: Results → Details → Booking**: `handleSelectVehicle` in CarRentalResults now navigates to `/services/car-rental/details/{id}` instead of directly to `/services/car-rental/booking`. The existing CarRentalDetails page (which was unused) is now properly in the flow.
- [x] **Fixed Rental Details Display**: CarRentalBooking right column redesigned as clean white cards (was dark gradient). Shows vehicle image, name, specs (seats, transmission, fuel), rental details (location, dates, duration), selected extras, and price breakdown. All data properly mapped from both `carRentalBookingDetails` and `selectedVehicle` sessionStorage keys.
- [x] **Vehicle Image Support**: Backend `POST /api/car-rental/` already accepts `images` array (up to 6 URLs). Images stored in car_rentals collection and returned by GET endpoints. Frontend can use `/api/uploads/` for file uploads.
- [x] **Payment on Right Side**: Price breakdown and confirm button moved to clean right column card layout (matching Hotel Booking style). Dark gradient removed.
- [x] **Scroll-to-Top**: Added `window.scrollTo(0, 0)` on mount for CarRentalBooking.
- [x] **Bug Fix**: Added missing return statement in `get_my_car_bookings` endpoint.
- **Testing**: 100% verified via iteration_58 (10/10 backend tests passed)


### Session: Feb 12, 2026 (Part 23) - Phase D: Restaurant Booking Fixes

- [x] **Fixed Reservation Details Display**: Complete rewrite of `RestaurantBooking.jsx`. Now reads from `restaurantOrder` sessionStorage (set by Menu page) which contains items with prices, reservation date/time, guests, order type. Right column shows:
  - Restaurant image/name/location
  - Reservation details (date, time, guests, order type) in orange-tinted card
  - Selected items with quantities and prices (scrollable list)
- [x] **Removed 30% Deposit**: Removed `DEPOSIT_PERCENTAGE = 30`. Customer now pays full item price + 5% commission. No more "remaining balance at restaurant" — payment is complete upfront.
- [x] **Payment on Right Side**: Payment section moved to right column in clean `bg-slate-50` card (matching Hotel/Travel booking style). Includes promo code input, commission breakdown, and "Confirm Reservation" button.
- [x] **Promo Code Integration**: Uses `api.post('/promo-codes/validate')` with `service_type: 'restaurant'`. Handles both percentage and fixed discounts. Records usage after successful payment.
- **Testing**: 100% verified via iteration_59 (8/8 backend tests passed)


### Session: Feb 12, 2026 (Part 24) - Phase E: Management Pages

- [x] **Section Navigation Redesigned**: All 4 management pages (Hotels, Travel, Restaurant, CarRental) updated to match Events Management style:
  - Changed from `bg-white border shadow-sm p-1 rounded-xl` with custom `data-[state=active]` colors to `grid w-full grid-cols-N` full-width tabs
  - Consistent across all pages: Dashboard, Management, Communications tabs evenly distributed
  - Hotels has 4 tabs (Dashboard, Hotels, Rooms, Communications)
- [x] **Refresh Buttons Verified**: All management pages (Hotels, Travel, Restaurant, CarRental) have working Refresh buttons with proper onClick handlers that reload data. Loading spinners animate during refresh.
- [x] **Restaurant Image Upload**: Replaced URL textarea in RestaurantForm with `ImageUploader` component:
  - Grid display with image previews and remove buttons
  - Upload via `/api/uploads/` with drag-and-click support
  - Max 6 images per restaurant
  - Images stored as URLs and displayed in restaurant results pages
- [x] **Menu Item Image Upload**: Replaced URL input in MenuItemForm with `MenuImageUploader`:
  - Upload button with preview and remove
  - Uses same `/api/uploads/` endpoint with `folder: 'menu-items'`
- [x] **Bug Fix**: Testing agent fixed upload endpoint — `POST /api/uploads/` now accepts `folder` from both form-data and query params (was only accepting query param).
- **Testing**: 100% verified via iteration_60 (11/11 backend tests passed)


### Session: Feb 12, 2026 (Part 25) - P1: Payment Logos & Hotel UI Improvements

- [x] **Payment Logos (P1)**: Replaced generic SVG payment icons in `PaymentMethodsSelection.jsx` with actual user-provided logo images:
  - Visa/Mastercard: `/assets/payment-logos/card-payment.png`
  - MTN MoMo: `/assets/payment-logos/mtn-momo.png`
  - Orange Money: `/assets/payment-logos/orange-money.png`
  - Logos scaled small (w-10 h-10 object-contain) to fit modal/button contexts
  - Applied to ALL booking pages via the shared `PaymentMethodsSelection` component
- [x] **Hotel Results - "View Deal" Fix**: Changed grid view button text from "View Deal" to "View Details" for consistency with list view in `HotelsResults.jsx`
- [x] **Hotel Details - "About this property" Revamp**: Modern card design with:
  - Clean white card with border
  - Expandable amenities accordion (shows first 4, click to expand all)
  - "+N more amenities" link when collapsed
  - Toggle button with Sparkles icon and chevron indicator
- [x] **Hotel Details - "Explore the area" Enhancement**:
  - Improved map section with 16:10 aspect ratio
  - Added "Oryno Services Nearby" section showing platform services (Restaurants, Car Rentals, Cinemas, Events)
  - Each service type has colored icon and background
- [x] **Hotel Details - "Choose your room" Improvements**:
  - Added Grid/List view toggle buttons for room cards
  - Grid mode shows rooms in 2-column layout, List mode shows full-width cards
  - Room count badge now prominently displayed with dark blue `bg-[#082c59]` background and white text
- [x] **Hotel Booking - Summary Improvements**:
  - Added Check-in/Check-out policy boxes (green/amber colored) showing "From 14:00" / "Before 12:00"
  - Room type highlighted with `border-2 border-[#082c59]/20` accent styling
  - Room type also shown in pricing breakdown section
  - Removed percentage "(10%)" from "Taxes & Fees" line


### Session: Feb 12, 2026 (Part 26) - Restaurant Menu, Payment Labels, Travel & Car Rental UI

- [x] **Restaurant Menu Revamp**: Full rewrite of `RestaurantMenu.jsx` with:
  - Warm color scheme (`bg-[#f0ebe3]`, `bg-[#faf7f2]`, `border-[#e0d5c7]`)
  - Modern search bar and category pills in gradient header
  - Cart items with hover states and active border on selected items
  - Removed promo code section (already exists on booking page)
  - Button changed from "Proceed to Booking - [price]" to "Final Step" with "You will not be charged yet" message
- [x] **Payment Logo Labels Removed**: Updated `PaymentMethodsSelection.jsx` to show only logo images - removed all text labels ("Pay with Card", "MTN MoMo", "Orange Money", descriptions). Also removed method-specific info text below the selector.
- [x] **Travel Booking Trip Summary Modernized**: 
  - Added warm gradient background (`from-[#f8f6f2] to-white`) to summary area
  - Trip cards now white with shadow and colored borders
  - Extra luggage shown in amber-highlighted row
  - Commission calculation fixed: only applies to trip fare, NOT luggage extras
  - Price breakdown shows "Trip Fare" label instead of "Subtotal"
- [x] **Car Rental Results Cards Compacted**:
  - Grid cards: image height reduced from h-52 to h-36, content padding from p-5 to p-3
  - List cards: image width reduced from lg:w-2/5 to md:w-56, height from h-64/min-h-[250px] to h-44/min-h-[160px]
  - Smaller text sizes and tighter spacing throughout
- [x] **Car Rental Details Modernized**:
  - Warm color scheme matching restaurant (`bg-[#f0ebe3]`, `bg-[#faf7f2]`)
  - Sidebar booking widget with gradient header and warm background
  - Features/policies/owner tabs with warm styling
  - "Book Now" changed to "Final Step" with "You will not be charged yet" message
- **Testing**: 100% verified via iteration_62 (6/6 frontend tests passed)

### Session: Feb 12, 2026 (Part 27) - Color Scheme Fix & Car Rental Payment Layout

- [x] **Color Scheme Overhaul**: Replaced all brownish/warm colors (#f0ebe3, #faf7f2, #e0d5c7, etc.) with modern slate/navy palette across:
  - `RestaurantMenu.jsx` → `bg-gradient-to-br from-slate-50 via-white to-blue-50`, `bg-slate-50`, `border-slate-200`
  - `CarRentalDetails.jsx` → same slate palette, gallery placeholders now `from-slate-200 to-slate-300`
  - `TravelBooking.jsx` → trip summary gradient now `from-slate-50 to-white`
  - Section headers use `from-[#082c59]/5 to-slate-100` for subtle navy tint
- [x] **Car Rental Booking - Payment Moved to Right**: Removed payment section from left column, placed it in right column alongside Vehicle Summary and Price Breakdown, matching the layout pattern of all other booking pages.
- **Testing**: 100% verified via iteration_63 (all brownish colors confirmed removed, payment position confirmed right column)

### Session: Feb 12, 2026 (Part 28) - P2: WebSocket Seat Selection & P3: Email Invitations

**P2: Airline-Style Live Seat Selection via WebSockets**
- [x] **Backend WebSocket**: New `/api/ws/seats/{route_id}/{travel_date}` endpoint in `seat_ws.py`
  - `SeatConnectionManager` manages connected clients grouped by route+date
  - Sends full seat snapshot on connect
  - Responds to `ping` and `refresh` client messages
  - `broadcast_seat_change()` sends updates to all connected clients
- [x] **Backend Integration**: `seat_bookings.py` now calls `_notify_seat_change()` after reserve, release, and confirm operations, triggering real-time broadcasts to all viewers
- [x] **Frontend LiveSeatMap**: Rewritten to connect via WebSocket with HTTP polling fallback
  - Shows real-time "Live" badge when WebSocket connected, "Polling" when falling back
  - WebSocket auto-reconnects on disconnect (3-second delay)
  - HTTP polling only runs when WebSocket is disconnected
  - All seat reservation/release still via HTTP API (WebSocket is read-only broadcast)

**P3: Email Invitation System**
- [x] **Backend API**: New `/api/invitations/` routes in `invitations.py`
  - `POST /send` - Admin/operator sends invitation with email, role, optional message
  - `GET /validate/{token}` - Public endpoint to validate invite link
  - `POST /accept` - Creates user account from invitation (with username, status, email_verified fields)
  - `GET /` - Lists invitations (filtered by sender for non-admins)
  - `DELETE /{token}` - Revokes pending invitation
  - Sends styled HTML email via existing email utility (mock mode)
  - 7-day token expiry, duplicate prevention
- [x] **Frontend Admin Page**: `InvitationsManagement.jsx` at `/admin/invitations`
  - Send invitation dialog with email, role, personal message
  - List view with status badges (pending/used/expired/revoked)
  - Copy invite link, revoke pending invitations
  - Stats dashboard showing counts per status
- [x] **Frontend Registration**: `Register.jsx` updated to handle `?invite={token}` URL parameter
  - Validates token on mount and shows inviter name, role, message
  - Pre-fills email (disabled), creates account via `/invitations/accept`
- [x] **Sidebar**: Added "Invitations" link under Admin Config for admins/operators
- [x] **Bug Fixes** (found by testing agent):
  - Added missing `status`, `email_verified`, `username` fields to invited user creation
  - Fixed datetime comparison for pending invitation check (ISO string vs datetime object)
- **Testing**: 100% verified via iteration_64 (18/18 backend tests, all frontend UI verified)
- [x] **Step Indicators - Travel & Restaurant Booking**:
  - Added `TravelStepIndicator`: "Traveler Details > Seats & Extras > Payment"
  - Added `RestaurantStepIndicator`: "Guest Details > Review Order > Payment"
  - Both use consistent pill-shaped design matching Hotel booking's step indicator
  - Steps advance to 3 when payment is initiated
- **Testing**: 100% verified via iteration_61 (10/10 frontend tests passed)

### Session: Feb 12, 2026 (Part 29) - Navigation Restructuring & Seat Fixes

- [x] **Audit Logs → Permissions Page**: Moved Audit Logs page into Permissions as 5th tab (after Audit Trail). Super admins see 5 tabs: Roles, User Permissions, Matrix, Audit Trail, Audit Logs. AuditLogs component embedded via import. TabsList expanded to `grid-cols-5 max-w-3xl`.
- [x] **Invitations → Users Page**: 
  - Replaced "Add User" button with Popover dropdown: "Standard Add" (opens Create User modal) + "Invite User" (switches to invitations view)
  - Added "Invitations" as 3rd tab in Users sub-page tabs (after Users, Permissions)
  - InvitationsManagement component embedded inline when active
  - Removed standalone "Invitations" sidebar item from Admin Config
- [x] **Seat Reservation Timeout → 3 minutes**: 
  - Backend `RESERVATION_TIMEOUT_MINUTES` changed from 10 to 3
  - Frontend TravelBooking text changed from "15 minutes" to "3 minutes"
  - All fallback timeouts in LiveSeatMap changed from `10 * 60 * 1000` to `3 * 60 * 1000`
- [x] **Seat Selection Swap**: LiveSeatMap already had correct swap logic (release oldest → reserve new), verified working with API calls
- **Testing**: 100% verified via iteration_65 (all 9 features passed)

### Session: Feb 13, 2026 (Part 30) - Hotel Details/Booking UI & Payment Header

- [x] **Hotel Details - Policies**: Revamped from plain list to expandable card (matching About section style) with check-in/check-out policy boxes at top and collapsible "Additional Policies" toggle
- [x] **Hotel Details - Live Map**: Fixed blank map by switching from Google Maps embed (requires API key) to OpenStreetMap embed (no key needed)
- [x] **Hotel Details - Oryno Services Nearby**: Converted from static labels to clickable filter buttons with active/inactive toggle states and dynamic filter text
- [x] **Hotel Booking - Guest Toggle**: Changed color from blue to `#082c59` (brand color) with matching Switch accent
- [x] **Hotel Booking - Hotel Card**: Replaced "Selected Room" + hardcoded amenity list with check-in/check-out policy boxes + expandable amenities (4 visible, expandable to all)
- [x] **Hotel Booking - Booking Summary**: Restructured with:
  - `bg-slate-400` header (consistent with payment sections)
  - Separate mini-cards for Guests (blue), Duration/Nights (indigo), Room Selected (navy with "Your Selected Room" label)
  - Tighter spacing, room card moved below guests/nights
- [x] **Payment Header slate-400 Across All Booking Pages**: Updated 9 booking pages (Hotel, Travel, Car Rental, Restaurant, Cinema, Event, Laundry, Banquet, Package) to use `bg-slate-400` for payment section headers
- [x] **AdminModal Fix**: Fixed footer visibility with flex layout (from Part 29)
- **Testing**: Code review 100% via iteration_66 (all 7 feature groups verified in source code)

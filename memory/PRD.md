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
  - Updated: Travel.jsx, Events.jsx, FilmDetails.jsx
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

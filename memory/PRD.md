# Oryno Services Hub - Product Requirements Document

## Overview
Oryno is a full-stack multi-tenant services booking platform built with FastAPI + React + MongoDB. It provides hotel bookings, restaurant reservations, travel tickets, car rentals, cinema, laundry, events, packages, and banquet services.

## User Roles & Permissions (Updated Jan 2026)

### Customer Role
- **Landing**: Dashboard (standard customer view)
- **Navigation Items**:
  - Dashboard
  - Services (all sub-menus)
  - **My Orders** (filtered by customer)
  - **Receipts** (filtered by customer)
  - **Loyalty** (customer loyalty rewards view)
  - **My Ratings** (customer's reviews)
  - **Support** (ticket management for customers)
  - Settings
- **NOT Accessible**: Team & Roles, Admin Config, Service Management, Analytics, Customer Service

### Operator Role
- **Landing**: Analytics page (redirected from Dashboard)
- **Navigation Items**:
  - Dashboard (shows Analytics)
  - Services (ONLY assigned service types)
  - Service Management (ONLY assigned service types)
  - Team & Roles (for owner/local_admin)
  - Admin Config (LIMITED: All Bookings, Bills, Sales, Audit Log only)
  - **My Orders** (filtered by operator's services)
  - **Receipts** (filtered by operator's services)
  - **My Ratings** (customer reviews for operator's services, with respond ability)
  - **Support** (ticket management for operators)
  - Settings
- **NOT Accessible**: Loyalty/Loyalty Program (completely removed for operators)

### Admin / Super Admin Role
- **Landing**: Dashboard
- **Navigation Items**:
  - Dashboard
  - Services (all)
  - Service Management (all)
  - **All Orders** (platform-wide view)
  - **All Receipts** (platform-wide view)
  - **Loyalty Program** (admin management view - create/edit/delete rewards, view members, configure tiers)
  - Admin Config (full access)
  - **All Ratings** (platform-wide ratings with filters)
  - **Customer Service** (admin backend for support tickets - replaces Support menu)
  - Settings

## Key Pages & Features

### Orders Page
- **Admin View**: "All Orders" - Shows all orders from all users/operators across the platform
- **Operator View**: "My Orders" - Shows orders for their assigned services
- **Customer View**: "My Orders" - Shows only their personal orders

### Receipts Page
- **Admin View**: "All Receipts" - Shows all receipts from all users/operators
- **Operator View**: "Receipts" - Shows receipts for their services
- **Customer View**: "Receipts" - Shows only their personal receipts

### Loyalty Page
- **Admin View**: "Loyalty Program" - Management interface with:
  - Stats cards (Total Members, Points Issued, Points Redeemed, Active Rewards, Members by Tier)
  - Tabs: Overview, Rewards, Members
  - Tier Configuration display
  - Point Earning Rules configuration
  - Add/Edit/Delete rewards functionality
  - Members list with search
- **Customer View**: "Loyalty Rewards" - Personal loyalty interface with:
  - Current tier, available points, total earned, redeemed
  - Referral code section
  - Available rewards to redeem
  - Activity history
  - Redemption history
- **Operator View**: Access Restricted (no access to loyalty)

### Ratings Page
- **Admin View**: "All Ratings" - Platform-wide ratings with:
  - Stats (Total Reviews, Avg Rating, Responded, Needs Response)
  - Rating distribution chart
  - Filters by service and rating
  - Search by service, customer, operator
  - View all ratings across the platform
- **Operator View**: "Customer Reviews" - Service-specific ratings with:
  - Reviews for their assigned services
  - Ability to respond to customer reviews
  - Filters by service and rating
- **Customer View**: "My Ratings & Reviews" - Personal reviews with:
  - Their submitted reviews
  - Ability to edit reviews
  - View operator responses

### Support Page
- **Admins**: Use "Customer Service" in Admin Config (backend support management)
- **Operators/Customers**: Use "Support" (ticket management frontend with AI chatbot)

## Navigation Summary

| Menu Item | Customer | Operator | Admin/Super Admin |
|-----------|----------|----------|-------------------|
| Dashboard | ✅ | ✅ (→ Analytics) | ✅ |
| Services | ✅ All | ✅ Assigned Only | ✅ All |
| Service Management | ❌ | ✅ Assigned Only | ✅ All |
| Team & Roles | ❌ | ✅ (owner/admin) | ❌ |
| My Orders / All Orders | My Orders | My Orders | All Orders |
| Receipts / All Receipts | Receipts | Receipts | All Receipts |
| Loyalty / Loyalty Program | Loyalty | ❌ REMOVED | Loyalty Program |
| My Ratings / All Ratings | My Ratings | My Ratings | All Ratings |
| Support / Customer Service | Support | Support | Customer Service |
| Admin Config | ❌ | ✅ Limited | ✅ Full |
| Settings | ✅ | ✅ | ✅ |

## Test Credentials
- **Super Admin**: superadmin@oryno.com / testpassword123
- **Customer**: testcustomer@test.com / testpassword123
- **Operator**: testoperator@test.com / testpassword123 (check "I'm logging in as a service operator")

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

## Backlog / Future Tasks
- [ ] Refactor `CustomerServiceManagement.jsx` (~1470 lines)
- [ ] Email-based invitation system for team members
- [ ] Custom role/permission management UI for Admins
- [ ] Operator audit log visibility (owner sees team members' logs)
- [ ] Connect admin loyalty management to backend APIs
- [ ] Connect admin ratings management to backend APIs

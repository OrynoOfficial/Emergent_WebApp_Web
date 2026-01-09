# Oryno Services Hub - Product Requirements Document

## Overview
Oryno is a full-stack multi-tenant services booking platform built with FastAPI + React + MongoDB. It provides hotel bookings, restaurant reservations, travel tickets, car rentals, cinema, laundry, events, packages, and banquet services.

## User Roles & Permissions (Implemented Jan 2026)

### Customer Role
- **Landing**: Dashboard (standard customer view)
- **Navigation Items**:
  - Dashboard
  - Services (all sub-menus - browse, hotels, restaurants, travel, car-rental, events, packages, laundry, cinema, banquet)
  - My Orders
  - Receipts
  - Loyalty
  - My Ratings
  - Support
  - Settings
- **Settings Sections**: Profile, Security, Notifications, Preferences, Payment Methods, Data Protection, Legal Information, About/Impressum
- **Registration**: All self-registered users automatically get `customer` role (enforced in backend)

### Operator Role
- **Landing**: Analytics page (redirected from Dashboard)
- **Navigation Items**:
  - Dashboard (shows Analytics)
  - Services (ONLY assigned service types visible)
  - Service Management (ONLY assigned service types)
  - Team & Roles (for owner/local_admin)
  - Admin Config (LIMITED: All Bookings, Bills, Sales, Audit Log only)
  - My Ratings
  - Support
  - Settings
- **Settings Sections**: Profile, Security, Notifications, Preferences, Data Protection, Legal Information, About/Impressum (NO Payment Methods)
- **Account Creation**: Operator accounts can ONLY be created by Admins/Super Admins - cannot self-register

### Admin Role
- **Access**: Controlled by Super Admin via custom roles and permissions
- **Navigation Items**: Based on assigned permissions
- **Settings Sections**: All sections including System Configuration and API Keys

### Super Admin Role
- **Access**: Full platform control
- **Navigation Items**: All items visible
- **Settings Sections**: All sections including System Configuration and API Keys

## Key Technical Implementation

### Role-Based Navigation (Layout.jsx)
- `navigationItems` useMemo hook with 3 distinct sections:
  1. Customer navigation (basic user view)
  2. Operator navigation (service-specific, limited admin)
  3. Admin/Super Admin navigation (full access)
- Service filtering based on `operatorServiceTypes` and `operatorType`

### Role-Based Settings (Settings.jsx)
- `CUSTOMER_SETTINGS_SECTIONS`: Includes Payment Methods
- `OPERATOR_SETTINGS_SECTIONS`: Excludes Payment Methods
- `ADMIN_SETTINGS_SECTIONS`: System Configuration + API Keys
- `getSettingsSections()` function determines which sections to display

### Analytics Page (Consolidated)
- `/admin/analytics` now includes all DataAnalytics content:
  - Extended Summary Stats (Total Users, Bookings, Revenue, Avg Order, Conversion, Returning Rate)
  - Revenue & Bookings Trend Chart
  - Revenue by Service Pie Chart
  - Service Performance Grid
  - Daily Revenue Trend
  - Top Performing Services Table
- DataAnalytics.jsx has been deleted
- `/admin/data-analytics` route removed

### Registration Security (auth.py)
- `register()` function always assigns `role = "customer"` regardless of input
- Prevents privilege escalation through registration

### Browse Services Filtering (BrowseServices.jsx)
- `getVisibleServices()` function filters services based on:
  - Admin/Super Admin: All services visible
  - Operator: Only assigned service types visible
  - Customer: All services visible

## Current Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── auth.py (registration with enforced customer role)
│   │   └── ...
│   └── utils/
│       └── permissions.py
└── frontend/
    └── src/
        ├── components/
        │   ├── Layout.jsx (role-based navigation)
        │   └── ...
        ├── pages/
        │   ├── Settings.jsx (role-based sections)
        │   ├── BrowseServices.jsx (service filtering)
        │   └── admin/
        │       └── Analytics.jsx (consolidated analytics)
        └── contexts/
            └── AuthContext.jsx
```

## Test Credentials
- **Super Admin**: superadmin@oryno.com / testpassword123
- **Customer**: testcustomer@test.com / testpassword123
- **Operator**: testoperator@test.com / testpassword123 (check "I'm logging in as a service operator")

## Completed Features
- [x] Multi-tenant permission system with 4 roles
- [x] Role-based sidebar navigation
- [x] Role-based settings page sections
- [x] Analytics page consolidation (merged DataAnalytics)
- [x] Secure registration (always assigns customer role)
- [x] Operator service filtering (Browse Services)
- [x] Operator landing page redirect to Analytics

## Backlog / Future Tasks
- [ ] Refactor `CustomerServiceManagement.jsx` (~1470 lines) using shared component pattern
- [ ] Email-based invitation system for adding team members
- [ ] Custom role and permission management UI for Admins

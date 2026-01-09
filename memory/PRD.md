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
  - My Ratings (view their reviews, edit reviews)
  - Support (ticket management system)
  - Settings
- **Settings Sections**: Profile, Security, Notifications, Preferences, Payment Methods, Data Protection, Legal Information, About/Impressum
- **Registration**: All self-registered users automatically get `customer` role (enforced in backend)
- **NOT Accessible**: Team & Roles, Admin Config, Service Management, Analytics

### Operator Role
- **Landing**: Analytics page (redirected from Dashboard)
- **Navigation Items**:
  - Dashboard (shows Analytics)
  - Services (ONLY assigned service types visible)
  - Service Management (ONLY assigned service types)
  - Team & Roles (for owner/local_admin only)
  - Admin Config (LIMITED: All Bookings, Bills, Sales, Audit Log only)
  - My Ratings (view customer reviews for their services, respond to reviews)
  - Support (ticket management system)
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

## Key Pages & Features

### Dashboard (Dashboard.jsx)
- Customer view: Shows orders, spending, activity
- Removed "Operator Dashboard" modal (was showing for all users)
- Clean stats cards with spending by category, weekly activity

### Support Page (Support.jsx) - NEW
- **Ticket Management System**:
  - Stats cards: Total Tickets, Open, In Progress, Resolved
  - Quick contact options: Call Us, Email Us, Live Chat
  - My Tickets tab: View/search/filter tickets
  - FAQ tab: Expandable FAQ sections
  - Create new ticket dialog with category, priority
  - View ticket detail with conversation history
  - Reply to tickets
- **AI Chatbot**: Floating chat button, AI assistant for quick help
- Modern UI with gradient cards and clean design

### Ratings Page (Ratings.jsx) - REVAMPED
- **Customer View (My Ratings & Reviews)**:
  - Stats: Total Reviews, Helpful Votes, Average Rating
  - List of user's reviews with service icons and colors
  - See operator responses to their reviews
  - Edit their own reviews
  - Modern card design with color accent bars

- **Operator View (Customer Reviews)**:
  - Stats: Total Reviews, Avg Rating, Responded, Needs Response
  - List of customer reviews for their assigned services
  - Filter by service type and rating
  - Respond to customer reviews
  - Status indicators (Needs Response badge)
  - Modern card design with status bars

### Analytics Page (Analytics.jsx)
- Consolidated view (merged from DataAnalytics)
- Extended summary stats
- Revenue & Bookings trend chart
- Revenue by service pie chart
- Service performance grid
- Daily revenue trend
- Top performing services table

## Key Technical Implementation

### Role-Based Navigation (Layout.jsx)
- `navigationItems` useMemo hook with 3 distinct sections:
  1. Customer navigation (basic user view)
  2. Operator navigation (service-specific, limited admin)
  3. Admin/Super Admin navigation (full access)
- Service filtering based on `operatorServiceTypes` and `operatorType`
- Team & Roles: Only shows for operators with `operator_id` AND `owner` or `local_admin` role

### Backend API Endpoints

**Ratings APIs** (/api/ratings):
- `GET /my` - User's own ratings
- `GET /operator` - Ratings for operator's assigned services
- `POST /{rating_id}/respond` - Operator responds to rating
- `PUT /{rating_id}` - User updates their rating

**Support Tickets APIs** (/api/support-tickets):
- `GET /my` - User's support tickets
- `POST /` - Create new ticket
- `POST /{ticket_id}/reply` - Reply to ticket

## Current Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── auth.py (registration with enforced customer role)
│   │   ├── ratings.py (my, operator, respond endpoints)
│   │   └── support_tickets.py (my endpoint)
│   └── utils/
│       └── permissions.py
└── frontend/
    └── src/
        ├── components/
        │   ├── Layout.jsx (role-based navigation)
        │   └── ...
        ├── pages/
        │   ├── Dashboard.jsx (no Operator Dashboard modal)
        │   ├── Settings.jsx (role-based sections)
        │   ├── BrowseServices.jsx (service filtering)
        │   ├── Support.jsx (ticket management system)
        │   ├── Ratings.jsx (customer/operator views)
        │   └── admin/
        │       └── Analytics.jsx (consolidated analytics)
        └── contexts/
            └── AuthContext.jsx
```

## Test Credentials
- **Super Admin**: superadmin@oryno.com / testpassword123
- **Customer**: testcustomer@test.com / testpassword123
- **Operator**: testoperator@test.com / testpassword123 (check "I'm logging in as a service operator")

## Completed Features (Jan 2026)
- [x] Multi-tenant permission system with 4 roles
- [x] Role-based sidebar navigation
- [x] Role-based settings page sections
- [x] Analytics page consolidation (merged DataAnalytics)
- [x] Secure registration (always assigns customer role)
- [x] Operator service filtering (Browse Services)
- [x] Operator landing page redirect to Analytics
- [x] Removed Operator Dashboard modal from Dashboard
- [x] Team & Roles restricted to operators only (owner/local_admin)
- [x] Support page with ticket management system
- [x] Ratings page with customer and operator views
- [x] Backend APIs for ratings and support tickets

## Backlog / Future Tasks
- [ ] Refactor `CustomerServiceManagement.jsx` (~1470 lines) using shared component pattern
- [ ] Email-based invitation system for adding team members
- [ ] Custom role and permission management UI for Admins
- [ ] Operator audit log visibility (owner sees team members' logs)

# Oryno Platform - Product Requirements Document

## Original Problem Statement
Oryno is a comprehensive services hub platform (hotels, travel, restaurants, cinema, events, car rental, laundry, banquets) with multi-role access (Customer, Operator, Admin, Super Admin). The platform includes loyalty programs, subscription systems, notifications, ratings, and service management.

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Auth:** Custom JWT-based authentication with 2FA support

## What's Been Implemented

### Completed Features (Latest First)

**Feb 2026 - Bug Fix: Service Validation Approval**
- Fixed service approve/reject URL mismatch in ValidationManagement.jsx
- Was: `/validation/services/{id}/approve?collection={type}` (404)
- Now: `/validation/services/{type}/{id}/approve` (matches backend route)

**Feb 2026 - Loyalty Page Search, Filters & Promotion Enhancements**
- Collapsible "All Redeemed" section, search/filter on all sections
- Create Promotion modal: title 50 chars, message 300 chars, type=discount only, % input
- Operator-scoped promo code validation

**Feb 2026 - Loyalty Promotion Redemption System**
- Collapsible "Redeemable Codes", operator promotion redemption, operator-scoped promo codes

**Feb 2026 - Unified Notification Center & Deep-Linking**
- Deep-linking, unified Messages tab, mark-as-read, HighlightableItem

**Earlier Features**
- Full loyalty, subscriptions, ratings & moderation, service management, WebSocket seats
- Stripe, AI chatbot, email invitations, promo codes

## Backlog (Prioritized)
- **P1:** "Airline-Style" Live Seat Selection UI enhancement
- **P2:** Customizable Email Templates for admin
- **P3:** Further bulk moderation features for ratings
- **Refactoring:** ValidationManagement.jsx (900+ lines), Ratings.jsx decomposition

## Test Credentials
- Admin: admin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

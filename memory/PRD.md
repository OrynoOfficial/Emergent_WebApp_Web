# Oryno Platform - Product Requirements Document

## Original Problem Statement
Oryno is a comprehensive services hub platform (hotels, travel, restaurants, cinema, events, car rental, laundry, banquets) with multi-role access (Customer, Operator, Admin, Super Admin).

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver), DB: oryno_webapp
- **Auth:** Custom JWT-based authentication with 2FA support

## What's Been Implemented

### Completed Features (Latest First)

**Feb 2026 - Fix: Operator Promo Code Validation**
- Root cause: validate endpoint rejected operator-scoped codes when booking pages didn't pass operator_id
- Fix: Changed validation to only reject when a WRONG operator_id is explicitly provided
- Updated booking pages (TravelBooking, HotelBooking, RestaurantBooking) to pass operator_id from service context
- Validate response now includes operator_id, operator_name, service_types

**Feb 2026 - Fix: Service Validation Approval**
- Fixed URL mismatch in ValidationManagement.jsx for service approve/reject

**Feb 2026 - Loyalty Enhancements**
- Collapsible codes sections, search/filters, Create Promotion modal improvements
- Operator-scoped promo code generation and validation

**Earlier:** Notification center, deep-linking, loyalty program, subscriptions, ratings, service management, Stripe, AI chatbot

## Backlog
- P1: "Airline-Style" Live Seat Selection UI
- P2: Customizable Email Templates
- P3: Bulk moderation features for ratings

## Test Credentials
- Admin: admin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

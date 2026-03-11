# Oryno Platform - Product Requirements Document

## Original Problem Statement
Oryno is a comprehensive services hub platform (hotels, travel, restaurants, cinema, events, car rental, laundry, banquets) with multi-role access (Customer, Operator, Admin, Super Admin). The platform includes loyalty programs, subscription systems, notifications, ratings, and service management.

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Auth:** Custom JWT-based authentication with 2FA support

## What's Been Implemented

### Completed Features (Latest First)

**Feb 2026 - Loyalty Page Search, Filters & Promotion Enhancements**
- Collapsible "All Redeemed" section (default collapsed, expands downward)
- Redeemable promotions count badge on Rewards tab
- Search + filter on Redeemable Codes (by type: all/referral/loyalty/operator)
- Search + filter on All Redeemed (by status: all/active/used; by source: loyalty/operator)
- Search + filter on Rewards tab (All/Available/Locked/Promotions)
- Filter on Activity tab (All/Earned/Redeemed)
- Create Promotion modal: title max 50 chars, message max 300 chars, type locked to "discount", discount value as percentage with % suffix
- Operator-scoped promo code validation: codes from operator promotions ONLY valid for that specific operator (rejects if no operator_id or wrong operator_id passed)

**Feb 2026 - Loyalty Promotion Redemption System**
- Collapsible "Redeemable Codes" section (default collapsed)
- Operator promotion redemption: generates unique promo codes scoped to operator + service
- Backend endpoints: redeem promotion, get my-redeemed, updated validate with operator_id
- New DB collection: `promotion_redemptions`

**Feb 2026 - Unified Notification Center & Deep-Linking**
- Deep-linking system for all notifications
- Unified "Messages" tab in Ratings page for all user roles
- Mark-as-read, HighlightableItem component

**Earlier Features**
- Full loyalty program (tiers, points, rewards, referrals, redemptions)
- Subscription system (subscribe to operators, alerts, promotions with admin approval)
- Ratings & moderation, Service management, Real-time WebSocket seat selection
- Stripe payment, AI Assistant chatbot, Email invitations, Promo codes system

## Key API Endpoints
- `POST /api/subscriptions/promotions/{id}/redeem` — Redeem operator promotion
- `GET /api/subscriptions/promotions/my-redeemed` — User's redeemed promotions
- `POST /api/promo-codes/validate` — Validate promo code (with operator_id scope enforcement)
- `POST /api/promo-codes/use` — Use promo code (updates promotion_redemptions)

## Backlog (Prioritized)
- **P1:** "Airline-Style" Live Seat Selection UI enhancement
- **P2:** Customizable Email Templates for admin
- **P3:** Further bulk moderation features for ratings
- **Refactoring:** ValidationManagement.jsx (900+ lines), Ratings.jsx decomposition

## Test Credentials
- Admin: admin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

## 3rd Party Integrations
- OpenAI GPT-4o (via Emergent LLM Key), Stripe, react-leaflet / OpenStreetMap

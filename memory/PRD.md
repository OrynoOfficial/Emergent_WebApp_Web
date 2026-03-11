# Oryno Platform - Product Requirements Document

## Original Problem Statement
Oryno is a comprehensive services hub platform (hotels, travel, restaurants, cinema, events, car rental, laundry, banquets) with multi-role access (Customer, Operator, Admin, Super Admin). The platform includes loyalty programs, subscription systems, notifications, ratings, and service management.

## Core Architecture
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Auth:** Custom JWT-based authentication with 2FA support

## What's Been Implemented

### Completed Features (Latest First)

**Feb 2026 - Loyalty Promotion Redemption System**
- Collapsible "Redeemable Codes" section on Loyalty page (default collapsed, expands downward)
- Operator promotion redemption: approved promotions generate unique promo codes scoped to specific operator + service
- Backend: `POST /api/subscriptions/promotions/{promotion_id}/redeem` — generates operator-scoped promo code
- Backend: `GET /api/subscriptions/promotions/my-redeemed` — fetches user's redeemed promotion codes
- Backend: Updated `POST /api/promo-codes/validate` — enforces `operator_id` check for operator-scoped codes
- Backend: Updated `POST /api/promo-codes/use` — marks `promotion_redemptions` status as "used"
- Frontend: Redeem Offer button on promotion cards in Rewards tab
- Frontend: Confirmation dialog showing operator + service scope before redemption
- Frontend: Active promo codes display in collapsible section; used codes show in "All Redeemed" section
- New DB collection: `promotion_redemptions` — tracks user promotion redemptions with operator/service scope

**Feb 2026 - Unified Notification Center & Deep-Linking**
- Deep-linking system for all notifications (navigates to specific item, scrolls, highlights)
- Unified "Messages" tab in Ratings page for all user roles
- Mark-as-read on notification click
- Operator alerts and notifications sub-tabs
- HighlightableItem component for scroll-into-view + highlight effect

**Earlier Features**
- Full loyalty program (tiers, points, rewards, referrals, redemptions)
- Subscription system (subscribe to operators, alerts, promotions with admin approval)
- Ratings & moderation (queue, audit log, bulk moderation)
- Service management (hotels, travel, restaurants, cinema, events, car rental, laundry, banquets)
- Real-time WebSocket seat selection
- Stripe payment integration
- AI Assistant chatbot (OpenAI GPT-4o via Emergent LLM Key)
- Email invitations system
- Promo codes system with loyalty integration

## Key API Endpoints
- `POST /api/subscriptions/promotions/{id}/redeem` — Redeem operator promotion
- `GET /api/subscriptions/promotions/my-redeemed` — User's redeemed promotions
- `POST /api/promo-codes/validate` — Validate promo code (with operator_id scope)
- `POST /api/promo-codes/use` — Use promo code (updates promotion_redemptions)
- `GET /api/subscriptions/user-alerts` — User's alerts and approved promotions
- `PUT /api/notifications/{id}/read` — Mark notification as read

## Key DB Collections
- `promotion_redemptions` — Tracks operator promotion redemptions per user
- `promo_codes` — Promo codes (loyalty, operator promotions, admin-created)
- `promotions` — Operator promotions and alerts
- `loyalty_programs`, `loyalty_rewards`, `loyalty_redemptions`, `loyalty_transactions`
- `subscriptions`, `notifications`

## Backlog (Prioritized)
- **P1:** "Airline-Style" Live Seat Selection UI enhancement
- **P2:** Customizable Email Templates for admin
- **P3:** Further bulk moderation features for ratings
- **Refactoring:** ValidationManagement.jsx (900+ lines), Ratings.jsx decomposition

## Test Credentials
- Admin: admin@test.com / testpassword123
- Super Admin: superadmin@test.com / testpassword123
- Customer: customer@test.com / testpassword123
- Operator: operator@test.com / testpassword123

## 3rd Party Integrations
- OpenAI GPT-4o (via Emergent LLM Key)
- Stripe (payment processing)
- react-leaflet / OpenStreetMap (maps)

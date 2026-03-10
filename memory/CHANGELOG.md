# Oryno Platform — Changelog

## Mar 10, 2026 — Real Dashboard Data, Communications Revamp & Subscription System

### Phase 1: Real Operator-Scoped Dashboard Data
- New backend API: `GET /api/management/dashboard-stats?service_type=X&period=Y`
- Removed ALL mock data generators from 9 service management pages
- Created shared hook: `useRealDashboardData(serviceType)`
- Removed default mock chart data from `ServiceExecutiveDashboard.jsx`
- Files changed: management_dashboard.py (new), useRealDashboardData.js (new), 9 management pages, ServiceExecutiveDashboard.jsx

### Phase 2: Communications Page Revamp
- Complete redesign of `ServiceCommunicationsHub.jsx`
- 3 stat cards: Subscribers, Open Tickets, Promotions Sent
- Support Tickets panel, Recent Reviews panel, Promotions grid
- Create Promotion dialog with type, discount, expiry

### Phase 3: Subscription System
- Backend: `/api/subscriptions` (subscribe, unsubscribe, check, my, operator-count, promotions)
- Frontend: `useSubscription` hook, `SubscribeButton` component
- Settings page: "Subscriptions" section for customers
- Promotion → Notification flow for subscribers
- Files: subscriptions.py (new), useSubscription.js (new), SubscribeButton.jsx (new), Settings.jsx, HotelDetails.jsx, RestaurantMenu.jsx

### Testing
- 25/25 backend tests passed
- 100% frontend verified (iteration_72)

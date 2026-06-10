"""
Management Dashboard API — Provides real operator-scoped dashboard stats
for all service management pages (Hotels, Travel, Restaurants, etc.)
Pulls from orders, ratings collections — no mock data.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from config.database import get_database
from middleware.auth import get_current_active_user
from datetime import datetime, timezone, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/management", tags=["Management Dashboard"])

SERVICE_CATEGORY_MAP = {
    "hotels": ["hotel", "hotels"],
    "travel": ["travel", "bus", "transport"],
    "restaurants": ["restaurant", "restaurants", "dining"],
    "car_rental": ["car_rental", "car-rental", "carrental"],
    "cinema": ["cinema", "movie"],
    "events": ["event", "events"],
    "laundry": ["laundry", "pressing"],
    "banquets": ["banquet", "banquets"],
    "packages": ["package", "packages"],
}


def get_categories_for_service(service_type: str) -> list:
    return SERVICE_CATEGORY_MAP.get(service_type, [service_type])


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    service_type: str = Query(..., description="Service type: hotels, travel, restaurants, etc."),
    period: str = Query("30days", description="Time period: 7days, 30days, 90days"),
    operator_id: Optional[str] = Query(None, description="Filter by operator ID (admin only)"),
    current_user: dict = Depends(get_current_active_user),
):
    """Get real operator-scoped dashboard stats for a service management page."""
    db = get_database()

    # Determine time window
    days_map = {"7days": 7, "30days": 30, "90days": 90, "1year": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Build operator filter
    resolved_operator_id = None
    if current_user.get("role") in ("admin", "super_admin") and operator_id:
        resolved_operator_id = operator_id
    elif current_user.get("role") == "operator":
        resolved_operator_id = current_user.get("operator_id")

    categories = get_categories_for_service(service_type)

    # Base query for orders
    order_query = {"service_category": {"$in": categories}}
    if resolved_operator_id:
        order_query["operator_id"] = resolved_operator_id

    # --- Fetch orders ---
    all_orders = await db.orders.find(order_query).to_list(10000)

    def make_aware(dt):
        if dt and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    period_orders = [o for o in all_orders if make_aware(o.get("created_at")) and make_aware(o["created_at"]) >= start_date]

    # --- Core stats ---
    total_bookings = len(period_orders)
    total_revenue = sum(o.get("total_amount", 0) for o in period_orders)

    # Status breakdown
    status_counts = defaultdict(int)
    for o in period_orders:
        status_counts[o.get("status", "unknown")] += 1

    pending = status_counts.get("pending", 0) + status_counts.get("not_confirmed", 0)
    confirmed = status_counts.get("confirmed", 0)
    completed = status_counts.get("completed", 0)
    cancelled = status_counts.get("cancelled", 0) + status_counts.get("refunded", 0)

    # --- Average rating ---
    rating_query = {"entity_type": {"$in": categories}}
    if resolved_operator_id:
        rating_query["operator_id"] = resolved_operator_id
    ratings = await db.ratings.find(rating_query).to_list(10000)
    avg_rating = round(sum(r.get("rating", 0) for r in ratings) / len(ratings), 1) if ratings else 0

    # --- Growth (compare to previous period) ---
    prev_start = start_date - timedelta(days=days)
    prev_orders = [o for o in all_orders if make_aware(o.get("created_at")) and prev_start <= make_aware(o["created_at"]) < start_date]
    prev_revenue = sum(o.get("total_amount", 0) for o in prev_orders)
    prev_bookings = len(prev_orders)

    revenue_growth = round(((total_revenue - prev_revenue) / prev_revenue * 100), 1) if prev_revenue > 0 else 0
    bookings_growth = round(((total_bookings - prev_bookings) / prev_bookings * 100), 1) if prev_bookings > 0 else 0

    # --- Occupancy/utilization estimate ---
    occupancy_rate = 0
    if total_bookings > 0:
        occupancy_rate = min(95, max(5, round(completed / max(total_bookings, 1) * 100)))

    # --- Item counts (service-specific) ---
    item_count = 0
    secondary_count = 0
    active_items = 0
    collection_map = {
        "hotels": ("hotels", "rooms"),
        "travel": ("travel_routes", "vehicles"),
        "restaurants": ("restaurants", None),
        "car_rental": ("car_rentals", None),
        "cinema": ("cinemas", None),
        "events": ("events", None),
        "laundry": ("pressings", None),
        "banquets": ("banquets", None),
        "packages": ("packages", None),
    }
    primary_col, secondary_col = collection_map.get(service_type, (None, None))

    if primary_col:
        item_query = {}
        if resolved_operator_id:
            item_query["operator_id"] = resolved_operator_id
        item_count = await db[primary_col].count_documents(item_query)
        active_query = {**item_query}
        # Try status-based active count
        active_items = await db[primary_col].count_documents({**item_query, "status": "active"})
        if active_items == 0:
            active_items = item_count  # If no status field, all are active

    if secondary_col:
        sec_query = {}
        if resolved_operator_id:
            sec_query["operator_id"] = resolved_operator_id
        secondary_count = await db[secondary_col].count_documents(sec_query)

    # Cinema-specific: "Screens" are embedded as a `screens` array on each cinema
    # document (no separate collection). Sum the sizes — fallback to total_screens
    # field if present, else array length.
    if service_type == "cinema":
        cin_query = {}
        if resolved_operator_id:
            cin_query["operator_id"] = resolved_operator_id
        screen_agg = await db.cinemas.aggregate([
            {"$match": cin_query},
            {"$project": {
                "n": {
                    "$ifNull": [
                        "$total_screens",
                        {"$size": {"$ifNull": ["$screens", []]}}
                    ]
                }
            }},
            {"$group": {"_id": None, "total": {"$sum": "$n"}}}
        ]).to_list(1)
        secondary_count = screen_agg[0]["total"] if screen_agg else 0

    # --- Daily trend (last 7 days) ---
    daily_trend = []
    for i in range(6, -1, -1):
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_orders = [o for o in period_orders if make_aware(o.get("created_at")) and day_start <= make_aware(o["created_at"]) < day_end]
        daily_trend.append({
            "date": day_start.strftime("%a"),
            "bookings": len(day_orders),
            "revenue": sum(o.get("total_amount", 0) for o in day_orders),
        })

    # --- Distribution (orders by status) ---
    distribution_colors = {
        "confirmed": "#10B981",
        "pending": "#F59E0B",
        "completed": "#3B82F6",
        "cancelled": "#EF4444",
        "not_confirmed": "#8B5CF6",
    }
    distribution = [
        {"type": s.replace("_", " ").title(), "count": c, "color": distribution_colors.get(s, "#94A3B8")}
        for s, c in status_counts.items() if c > 0
    ]

    # --- Recent bookings ---
    recent_orders = sorted(period_orders, key=lambda o: make_aware(o.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:5]
    recent_bookings = []
    for o in recent_orders:
        recent_bookings.append({
            "id": str(o.get("_id", "")),
            "customer_name": o.get("customer_email", o.get("user_id", "Guest"))[:30],
            "service_name": o.get("service_name", "Booking"),
            "amount": o.get("total_amount", 0),
            "status": o.get("status", "unknown"),
            "date": o.get("created_at").isoformat() if o.get("created_at") else None,
        })

    return {
        "stats": {
            "totalItems": item_count,
            "activeItems": active_items,
            "totalBookings": total_bookings,
            "totalRevenue": total_revenue,
            "avgRating": avg_rating,
            "occupancyRate": occupancy_rate,
            "bookingsGrowth": bookings_growth,
            "revenueGrowth": revenue_growth,
        },
        "bookingsByStatus": {
            "confirmed": confirmed,
            "pending": pending,
            "completed": completed,
            "cancelled": cancelled,
        },
        "dailyTrend": daily_trend,
        "distribution": distribution,
        "recentBookings": recent_bookings,
        "secondaryCount": secondary_count,
        "period": period,
        "service_type": service_type,
    }

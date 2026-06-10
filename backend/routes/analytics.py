from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Statuses that count as a "successful" booking for revenue & completion-rate
# computations. Operators use `confirmed` (paid + acknowledged) and `completed`
# (after service rendered) interchangeably across services — both flow money.
SUCCESS_STATUSES = ["confirmed", "completed", "delivered", "checked_in", "fulfilled"]

def get_period_days(period: str) -> int:
    """Convert period string to number of days"""
    periods = {
        "7days": 7,
        "30days": 30,
        "3months": 90,
        "6months": 180,
        "1year": 365
    }
    return periods.get(period, 30)

@router.get("/dashboard")
async def get_dashboard_analytics(
    current_user: dict = Depends(get_current_active_user)
):
    """Get dashboard analytics for current user - public for logged-in users"""
    db = get_database()
    
    # Single aggregation pipeline computes all stats in MongoDB
    week_ago = datetime.utcnow() - timedelta(days=7)
    pipeline = [
        {"$match": {"user_id": current_user["_id"]}},
        {"$facet": {
            "totals": [{"$group": {
                "_id": None,
                "total_orders": {"$sum": 1},
                "total_spent": {"$sum": {"$ifNull": ["$total_amount", 0]}},
                "completed": {"$sum": {"$cond": [{"$in": ["$status", SUCCESS_STATUSES]}, 1, 0]}},
                "pending": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
                "recent": {"$sum": {"$cond": [{"$gt": ["$created_at", week_ago]}, 1, 0]}},
            }}],
            "by_category": [
                {"$group": {
                    "_id": {"$ifNull": ["$service_category", "other"]},
                    "count": {"$sum": 1}
                }}
            ]
        }}
    ]
    agg_result = await db.orders.aggregate(pipeline).to_list(1)
    facet = agg_result[0] if agg_result else {"totals": [], "by_category": []}
    totals = facet["totals"][0] if facet["totals"] else {}
    total_orders = totals.get("total_orders", 0)
    total_spent = totals.get("total_spent", 0)
    completed_orders = totals.get("completed", 0)
    pending_orders = totals.get("pending", 0)
    recent_orders_count = totals.get("recent", 0)
    orders_by_category = {row["_id"]: row["count"] for row in facet["by_category"]}
    
    return {
        "total_orders": total_orders,
        "total_spent": total_spent,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders,
        "average_order_value": total_spent / total_orders if total_orders > 0 else 0,
        "orders_by_category": orders_by_category,
        "recent_orders_count": recent_orders_count
    }

@router.get("/admin/overview")
async def get_admin_analytics(
    current_user: dict = Depends(require_permission("analytics.view_dashboard"))
):
    """Get admin analytics overview - requires analytics.view_dashboard permission"""
    db = get_database()
    
    # Count totals
    total_users = await db.users.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_services = await db.services.count_documents({})
    total_revenue = 0
    
    # Calculate revenue via MongoDB aggregation (no document transfer).
    # Revenue counts any "successful" status — operators primarily use `confirmed`
    # while `completed` is set post-service-rendered. Both flow money.
    revenue_agg = await db.orders.aggregate([
        {"$match": {"status": {"$in": SUCCESS_STATUSES}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_amount", 0]}}}}
    ]).to_list(1)
    total_revenue = revenue_agg[0]["total"] if revenue_agg else 0
    
    # Orders by status via MongoDB aggregation
    status_agg = await db.orders.aggregate([
        {"$group": {"_id": {"$ifNull": ["$status", "unknown"]}, "count": {"$sum": 1}}}
    ]).to_list(None)
    orders_by_status = {row["_id"]: row["count"] for row in status_agg}
    
    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "total_services": total_services,
        "total_revenue": total_revenue,
        "orders_by_status": orders_by_status
    }


@router.get("/overview")
async def get_data_analytics_overview(
    period: str = Query("6months", description="Time period"),
    operator_id: Optional[str] = Query(None, description="Operator ID for filtering"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get comprehensive data analytics for DataAnalytics page"""
    db = get_database()
    
    # Check if admin or operator
    if current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Admin or operator only")
    
    days = get_period_days(period)
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Build order query - filter by operator if operator user
    order_query = {"created_at": {"$gte": start_date}}
    
    # For operators, filter data by their operator_id
    is_operator = current_user["role"] == "operator"
    effective_operator_id = None
    
    if is_operator:
        # Operator users can only see their own data
        effective_operator_id = current_user.get("operator_id") or operator_id
        if effective_operator_id:
            order_query["operator_id"] = effective_operator_id
    elif operator_id:
        # Admin/super admin can filter by specific operator
        order_query["operator_id"] = operator_id
    
    # Get all orders in period — projection trims payload to just the fields we use
    all_orders = await db.orders.find(
        order_query,
        {"_id": 0, "created_at": 1, "total_amount": 1, "status": 1,
         "service_category": 1, "service_name": 1, "user_id": 1}
    ).to_list(None)
    
    # Get users - for operators, only count users in their operator
    user_query = {}
    if effective_operator_id:
        user_query["operator_id"] = effective_operator_id
    
    total_users = await db.users.count_documents(user_query)
    new_users = await db.users.count_documents({**user_query, "created_at": {"$gte": start_date}})
    active_users = await db.users.count_documents({**user_query, "last_login": {"$gte": start_date}})
    
    # Calculate summary stats
    total_bookings = len(all_orders)
    total_revenue = sum(o.get("total_amount", 0) for o in all_orders)
    avg_order_value = total_revenue / total_bookings if total_bookings > 0 else 0
    completed_orders = len([o for o in all_orders if o.get("status") in SUCCESS_STATUSES])
    conversion_rate = (completed_orders / total_bookings * 100) if total_bookings > 0 else 0
    
    # Calculate growth rate (compare to previous period) - with same operator filter
    prev_start = start_date - timedelta(days=days)
    prev_query = {"created_at": {"$gte": prev_start, "$lt": start_date}}
    if effective_operator_id:
        prev_query["operator_id"] = effective_operator_id
    prev_revenue_agg = await db.orders.aggregate([
        {"$match": prev_query},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$total_amount", 0]}}}}
    ]).to_list(1)
    prev_revenue = prev_revenue_agg[0]["total"] if prev_revenue_agg else 0
    growth_rate = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    
    # Revenue by service category
    revenue_by_service = defaultdict(lambda: {"value": 0, "bookings": 0})
    for order in all_orders:
        category = order.get("service_category", "other")
        revenue_by_service[category]["value"] += order.get("total_amount", 0)
        revenue_by_service[category]["bookings"] += 1
    
    # Format for frontend
    service_names = {
        "travel": "Travel", "hotels": "Hotels", "hotel": "Hotels",
        "car_rental": "Car Rental", "restaurants": "Restaurants", "restaurant": "Restaurants",
        "events": "Events", "event": "Events", "cinema": "Cinema",
        "packages": "Packages", "package": "Packages", "laundry": "Laundry", "other": "Other"
    }
    
    revenue_by_service_list = [
        {"name": service_names.get(k, k.title()), "value": v["value"], "bookings": v["bookings"]}
        for k, v in sorted(revenue_by_service.items(), key=lambda x: x[1]["value"], reverse=True)
    ]
    
    # Monthly trend data
    monthly_trend = []
    for i in range(min(6, days // 30 + 1)):
        month_start = datetime.utcnow() - timedelta(days=30 * (i + 1))
        month_end = datetime.utcnow() - timedelta(days=30 * i)
        month_orders = [o for o in all_orders 
                       if month_start <= o.get("created_at", datetime.min) < month_end]
        month_users = await db.users.count_documents({
            "created_at": {"$gte": month_start, "$lt": month_end}
        })
        monthly_trend.insert(0, {
            "month": month_end.strftime("%b"),
            "revenue": sum(o.get("total_amount", 0) for o in month_orders),
            "bookings": len(month_orders),
            "users": month_users
        })
    
    # Top performing services
    service_performance = defaultdict(lambda: {"bookings": 0, "revenue": 0})
    for order in all_orders:
        service_name = order.get("service_name", "Unknown Service")
        category = order.get("service_category", "other")
        key = f"{service_name}|{category}"
        service_performance[key]["bookings"] += 1
        service_performance[key]["revenue"] += order.get("total_amount", 0)
    
    top_services = sorted([
        {
            "service": k.split("|")[0],
            "category": k.split("|")[1] if "|" in k else "other",
            "bookings": v["bookings"],
            "revenue": v["revenue"]
        }
        for k, v in service_performance.items()
    ], key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Returning users calculation — RESPECT operator filter so an operator
    # only sees repeat customers within their own orders.
    returning_match = {"created_at": {"$gte": start_date}}
    if effective_operator_id:
        returning_match["operator_id"] = effective_operator_id
    elif operator_id and current_user.get("role") in ("admin", "super_admin"):
        returning_match["operator_id"] = operator_id
    repeat_users = await db.orders.aggregate([
        {"$match": returning_match},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]).to_list(10000)
    returning_rate = (len(repeat_users) / active_users * 100) if active_users > 0 else 0

    # ---------------------------------------------------------------
    # Daily trend — last 14 days of real per-day aggregates.
    # Used by the "Daily Orders Summary" table and the daily sales chart.
    # ---------------------------------------------------------------
    daily_window_days = 14
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_start = today_start - timedelta(days=daily_window_days - 1)
    daily_query = {"created_at": {"$gte": daily_start}}
    if effective_operator_id:
        daily_query["operator_id"] = effective_operator_id
    elif operator_id and current_user.get("role") in ("admin", "super_admin"):
        daily_query["operator_id"] = operator_id

    daily_orders = await db.orders.find(daily_query, {
        "_id": 0, "created_at": 1, "total_amount": 1, "status": 1,
    }).to_list(20000)
    buckets: dict = {}
    for d in range(daily_window_days):
        day = (daily_start + timedelta(days=d)).date()
        buckets[day.isoformat()] = {"orders": 0, "revenue": 0.0}
    for o in daily_orders:
        ts = o.get("created_at")
        if not ts:
            continue
        key = ts.date().isoformat() if hasattr(ts, "date") else None
        if key and key in buckets:
            buckets[key]["orders"] += 1
            buckets[key]["revenue"] += float(o.get("total_amount") or 0)
    daily_trend = [
        {
            "date": day_iso,
            "label": datetime.fromisoformat(day_iso).strftime("%b %d"),
            "orders": v["orders"],
            "revenue": v["revenue"],
        }
        for day_iso, v in sorted(buckets.items())
    ]

    return {
        "summary": {
            "totalUsers": total_users,
            "totalBookings": total_bookings,
            "totalRevenue": total_revenue,
            "avgOrderValue": round(avg_order_value),
            "conversionRate": round(conversion_rate, 1),
            "growthRate": round(growth_rate, 1)
        },
        "revenueByService": revenue_by_service_list,
        "monthlyTrend": monthly_trend,
        "dailyTrend": daily_trend,
        "topServices": top_services,
        "userMetrics": {
            "newUsers": new_users,
            "activeUsers": active_users,
            "returningRate": round(returning_rate),
            "avgSessionTime": "8m 34s"
        }
    }


@router.get("/trips")
async def get_trip_analytics(
    from_date: str = Query(..., description="Start date YYYY-MM-DD"),
    to_date: str = Query(..., description="End date YYYY-MM-DD"),
    view: str = Query("daily", description="View mode: daily, weekly, monthly"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get trip analytics for TripReport page"""
    db = get_database()
    
    # Check if admin or operator
    if current_user["role"] not in ["admin", "super_admin", "operator"]:
        raise HTTPException(status_code=403, detail="Admin or operator only")
    
    try:
        start_date = datetime.strptime(from_date, "%Y-%m-%d")
        end_date = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Get travel routes
    routes = await db.travel_routes.find({}).to_list(1000)
    route_map = {str(r.get("_id", r.get("id"))): r for r in routes}
    
    # Get all travel bookings in the period
    travel_orders = await db.orders.find({
        "service_category": {"$in": ["travel", "bus", "transport"]},
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(10000)
    
    # If no real orders, also check seat_bookings collection
    seat_bookings = await db.seat_bookings.find({
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(10000)
    
    # Combine data sources
    all_trips = travel_orders + seat_bookings
    
    # Calculate summary stats
    total_trips = len(all_trips)
    total_passengers = sum(b.get("passengers", b.get("quantity", 1)) for b in all_trips)
    total_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in all_trips)
    cancelled = len([b for b in all_trips if b.get("status") == "cancelled"])
    
    # Get unique routes
    unique_routes = set()
    for booking in all_trips:
        route_id = booking.get("route_id")
        if route_id:
            unique_routes.add(route_id)
    
    # Daily data aggregation
    daily_data = defaultdict(lambda: {"trips": 0, "passengers": 0, "revenue": 0, "cancellations": 0})
    for booking in all_trips:
        date_key = booking.get("created_at", datetime.utcnow()).strftime("%Y-%m-%d")
        daily_data[date_key]["trips"] += 1
        daily_data[date_key]["passengers"] += booking.get("passengers", booking.get("quantity", 1))
        daily_data[date_key]["revenue"] += booking.get("total_amount", booking.get("amount", 0))
        if booking.get("status") == "cancelled":
            daily_data[date_key]["cancellations"] += 1
    
    daily_list = [
        {"date": k, **v}
        for k, v in sorted(daily_data.items())
    ]
    
    # Route stats
    route_stats = defaultdict(lambda: {"trips": 0, "passengers": 0, "revenue": 0, "occupancy": 70})
    for booking in all_trips:
        route_id = booking.get("route_id")
        route_info = route_map.get(str(route_id), {})
        route_name = f"{route_info.get('origin', 'Unknown')} → {route_info.get('destination', 'Unknown')}"
        route_stats[route_name]["trips"] += 1
        route_stats[route_name]["passengers"] += booking.get("passengers", booking.get("quantity", 1))
        route_stats[route_name]["revenue"] += booking.get("total_amount", booking.get("amount", 0))
    
    route_list = [
        {"route": k, **v}
        for k, v in sorted(route_stats.items(), key=lambda x: x[1]["revenue"], reverse=True)
    ][:10]
    
    # Operator stats
    operator_stats = defaultdict(lambda: {"trips": 0, "passengers": 0, "revenue": 0, "rating": 4.5})
    operators = await db.operators.find({}).to_list(100)
    operator_map = {str(o.get("_id", o.get("id"))): o.get("name", "Unknown") for o in operators}
    
    for booking in all_trips:
        operator_id = booking.get("operator_id")
        operator_name = operator_map.get(str(operator_id), "General Transport")
        operator_stats[operator_name]["trips"] += 1
        operator_stats[operator_name]["passengers"] += booking.get("passengers", booking.get("quantity", 1))
        operator_stats[operator_name]["revenue"] += booking.get("total_amount", booking.get("amount", 0))
    
    operator_list = [
        {"operator": k, **v}
        for k, v in sorted(operator_stats.items(), key=lambda x: x[1]["revenue"], reverse=True)
    ][:10]
    
    # Calculate average occupancy
    avg_occupancy = 72
    if total_trips > 0 and total_passengers > 0:
        avg_occupancy = min(95, max(50, int((total_passengers / (total_trips * 40)) * 100)))
    
    return {
        "summary": {
            "totalTrips": total_trips,
            "totalPassengers": total_passengers,
            "routesCovered": len(unique_routes) or len(route_list),
            "avgOccupancy": avg_occupancy,
            "cancellations": cancelled,
            "revenue": total_revenue
        },
        "dailyData": daily_list,
        "routeStats": route_list,
        "operatorStats": operator_list
    }


@router.get("/operator/dashboard")
async def get_operator_dashboard_analytics(
    period: str = Query("30days", description="Time period"),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get dashboard analytics for operator users (operator-scoped).
    Super admin and admin can see all data.
    Operator users can only see their operator's data.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    days = get_period_days(period)
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Build base query with operator filter
    base_filter = get_operator_filter(current_user)
    
    # Get orders for this operator — projection trims unused fields
    order_query = {**base_filter, "created_at": {"$gte": start_date}}
    orders = await db.orders.find(
        order_query,
        {"_id": 0, "created_at": 1, "total_amount": 1, "status": 1, "service_category": 1}
    ).to_list(None)
    
    # Calculate summary stats
    total_orders = len(orders)
    total_revenue = sum(o.get("total_amount", 0) for o in orders)
    completed_orders = len([o for o in orders if o.get("status") in SUCCESS_STATUSES])
    pending_orders = len([o for o in orders if o.get("status") == "pending"])
    cancelled_orders = len([o for o in orders if o.get("status") in ["cancelled", "refunded"]])
    
    # Average order value
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    
    # Completion rate
    completion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
    
    # Orders by service category
    orders_by_category = {}
    for order in orders:
        category = order.get("service_category", "other")
        orders_by_category[category] = orders_by_category.get(category, 0) + 1
    
    # Revenue by service category
    revenue_by_category = {}
    for order in orders:
        category = order.get("service_category", "other")
        revenue_by_category[category] = revenue_by_category.get(category, 0) + order.get("total_amount", 0)
    
    # Daily revenue for chart
    daily_revenue = defaultdict(float)
    daily_orders = defaultdict(int)
    for order in orders:
        created = order.get("created_at")
        if created:
            day_key = created.strftime("%Y-%m-%d")
            daily_revenue[day_key] += order.get("total_amount", 0)
            daily_orders[day_key] += 1
    
    # Sort and limit to last 30 days
    sorted_days = sorted(daily_revenue.keys())[-30:]
    daily_data = [
        {"date": day, "revenue": daily_revenue[day], "orders": daily_orders[day]}
        for day in sorted_days
    ]
    
    # Calculate growth (compare to previous period)
    prev_start = start_date - timedelta(days=days)
    prev_query = {**base_filter, "created_at": {"$gte": prev_start, "$lt": start_date}}
    prev_agg = await db.orders.aggregate([
        {"$match": prev_query},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": {"$ifNull": ["$total_amount", 0]}},
            "count": {"$sum": 1}
        }}
    ]).to_list(1)
    prev_revenue = prev_agg[0]["total_revenue"] if prev_agg else 0
    prev_count = prev_agg[0]["count"] if prev_agg else 0
    
    revenue_growth = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    orders_growth = ((total_orders - prev_count) / prev_count * 100) if prev_count > 0 else 0
    
    # Get operator context info
    operator_context = current_user.get("_operator_context", {})
    
    return {
        "summary": {
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "completed_orders": completed_orders,
            "pending_orders": pending_orders,
            "cancelled_orders": cancelled_orders,
            "avg_order_value": round(avg_order_value, 2),
            "completion_rate": round(completion_rate, 1),
            "revenue_growth": round(revenue_growth, 1),
            "orders_growth": round(orders_growth, 1),
        },
        "orders_by_category": orders_by_category,
        "revenue_by_category": revenue_by_category,
        "daily_data": daily_data,
        "period": period,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"],
        "operator_name": operator_context.get("operator_name") if operator_context else None
    }



@router.get("/admin/operator-comparison")
async def get_operator_comparison(
    operator_ids: str = Query(..., description="Comma-separated operator IDs (2-3)"),
    period: str = Query("30days"),
    current_user: dict = Depends(require_permission("analytics.view_dashboard"))
):
    """Side-by-side comparison of 2-3 operators across the same period.

    Returns per-operator metrics suitable for stacked KPI cards + a shared
    daily-revenue chart on the admin dashboard.
    """
    db = get_database()
    ids = [oid.strip() for oid in (operator_ids or "").split(",") if oid.strip()]
    if len(ids) < 2 or len(ids) > 3:
        raise HTTPException(status_code=400, detail="Pick 2 or 3 operator_ids to compare")

    days = get_period_days(period)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Look up operator display names once
    operator_docs = await db.operators.find(
        {"_id": {"$in": ids}}, {"_id": 1, "name": 1, "operator_name": 1, "company_name": 1}
    ).to_list(len(ids))
    name_by_id = {
        d["_id"]: d.get("name") or d.get("operator_name") or d.get("company_name") or d["_id"]
        for d in operator_docs
    }

    # ---- One aggregation pass over orders for all operators ----------
    pipeline = [
        {"$match": {
            "operator_id": {"$in": ids},
            "created_at": {"$gte": start_date},
        }},
        {"$group": {
            "_id": {
                "operator_id": "$operator_id",
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "status": "$status",
                "category": {"$ifNull": ["$service_category", "other"]},
            },
            "count": {"$sum": 1},
            "revenue": {"$sum": {"$ifNull": ["$total_amount", 0]}},
        }},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(None)

    # Initialise per-operator buckets
    out = {}
    for oid in ids:
        out[oid] = {
            "operator_id": oid,
            "operator_name": name_by_id.get(oid, oid),
            "total_orders": 0,
            "total_revenue": 0,
            "completed_orders": 0,
            "pending_orders": 0,
            "cancelled_orders": 0,
            "_daily": defaultdict(lambda: {"revenue": 0, "orders": 0}),
            "_categories": defaultdict(lambda: {"orders": 0, "revenue": 0}),
        }

    for row in rows:
        key = row["_id"] or {}
        oid = key.get("operator_id")
        if oid not in out:
            continue
        bucket = out[oid]
        order_status = key.get("status") or ""
        cnt = row.get("count", 0)
        rev = row.get("revenue", 0)

        bucket["total_orders"] += cnt
        bucket["_daily"][key.get("day")]["orders"] += cnt
        bucket["_categories"][key.get("category")]["orders"] += cnt
        if order_status in SUCCESS_STATUSES:
            bucket["total_revenue"] += rev
            bucket["completed_orders"] += cnt
            bucket["_daily"][key.get("day")]["revenue"] += rev
            bucket["_categories"][key.get("category")]["revenue"] += rev
        elif order_status == "pending":
            bucket["pending_orders"] += cnt
        elif order_status in ("cancelled", "refunded", "abandoned", "failed"):
            bucket["cancelled_orders"] += cnt

    # Materialise per-operator response
    operators = []
    for oid in ids:
        b = out[oid]
        total_orders = b["total_orders"]
        total_revenue = b["total_revenue"]
        avg = (total_revenue / total_orders) if total_orders > 0 else 0
        comp_rate = (b["completed_orders"] / total_orders * 100) if total_orders > 0 else 0
        daily_sorted = sorted(b["_daily"].keys())
        operators.append({
            "operator_id": oid,
            "operator_name": b["operator_name"],
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "completed_orders": b["completed_orders"],
            "pending_orders": b["pending_orders"],
            "cancelled_orders": b["cancelled_orders"],
            "avg_order_value": round(avg, 2),
            "completion_rate": round(comp_rate, 1),
            "daily_data": [
                {"date": d, "revenue": b["_daily"][d]["revenue"], "orders": b["_daily"][d]["orders"]}
                for d in daily_sorted
            ],
            "by_category": [
                {"category": cat, **vals}
                for cat, vals in b["_categories"].items()
            ],
        })

    return {"operators": operators, "period": period, "days": days}

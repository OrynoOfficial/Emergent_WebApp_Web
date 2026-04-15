from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/reports", tags=["reports"])

client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = client[os.environ.get("DB_NAME", "oryno_webapp")]

# Auth dependency (reuse from auth module)
from middleware.auth import get_current_user


def require_non_customer(user: dict):
    """Block customers from reports."""
    if user.get("role") == "customer":
        raise HTTPException(403, "Customers do not have access to reports")
    return user


def get_operator_filter(user: dict, operator_id: Optional[str]):
    """Build operator_id filter based on role and requested scope."""
    role = user.get("role")
    if role in ("admin", "super_admin"):
        if operator_id and operator_id != "all":
            return {"operator_id": operator_id}
        return {}  # all operators
    if role == "operator":
        op_ctx = user.get("operator_context", {})
        oid = op_ctx.get("operator_id")
        if not oid:
            raise HTTPException(400, "No operator context found")
        return {"operator_id": oid}
    raise HTTPException(403, "Access denied")


@router.get("/operators-list")
async def list_operators_for_scope(user: dict = Depends(get_current_user)):
    require_non_customer(user)
    role = user.get("role")
    if role in ("admin", "super_admin"):
        ops = []
        async for op in db.operators.find({}, {"_id": 0, "name": 1, "operator_type": 1, "service_types": 1}):
            # Get operator id from the operators collection
            ops.append(op)
        # Re-fetch with id
        ops = []
        async for op in db.operators.find({}):
            ops.append({
                "id": str(op["_id"]),
                "name": op.get("name", "Unknown"),
                "operator_type": op.get("operator_type", ""),
            })
        return {"operators": ops}
    return {"operators": []}


@router.get("/generate")
async def generate_report(
    report_id: str = Query(...),
    operator_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    require_non_customer(user)
    op_filter = get_operator_filter(user, operator_id)

    # Date range
    date_filter = {}
    if date_from:
        try:
            date_filter["$gte"] = datetime.fromisoformat(date_from)
        except ValueError:
            pass
    if date_to:
        try:
            date_filter["$lte"] = datetime.fromisoformat(date_to)
        except ValueError:
            pass

    # Map report_id to generator
    generators = {
        "booking-report": gen_booking_report,
        "revenue-analysis": gen_revenue_report,
        "financial-summary": gen_financial_summary,
        "customer-insights": gen_customer_insights,
        "operational-efficiency": gen_operational_efficiency,
        "service-performance": gen_service_performance,
        "customer-satisfaction": gen_customer_satisfaction,
        "booking-analytics": gen_booking_analytics,
    }

    gen = generators.get(report_id)
    if not gen:
        raise HTTPException(400, f"Report '{report_id}' is not yet available")

    data = await gen(op_filter, date_filter)
    scope_label = "All Operators"
    if operator_id and operator_id != "all":
        op = await db.operators.find_one({"_id": operator_id})
        scope_label = op.get("name", operator_id) if op else operator_id
    elif user.get("role") == "operator":
        scope_label = user.get("operator_context", {}).get("operator_name", "My Business")

    data["scope"] = scope_label
    data["generated_at"] = datetime.now(timezone.utc).isoformat()
    return data


# ========== REPORT GENERATORS ==========

async def gen_booking_report(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    pipeline_status = [{"$match": match}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    pipeline_category = [{"$match": match}, {"$group": {"_id": "$service_category", "count": {"$sum": 1}, "revenue": {"$sum": "$total_amount"}}}]
    pipeline_payment = [{"$match": match}, {"$group": {"_id": "$payment_status", "count": {"$sum": 1}}}]
    pipeline_daily = [
        {"$match": match},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}, "revenue": {"$sum": "$total_amount"}}},
        {"$sort": {"_id": 1}},
        {"$limit": 30},
    ]

    total = await db.orders.count_documents(match)
    by_status = {r["_id"]: r["count"] async for r in db.orders.aggregate(pipeline_status) if r["_id"]}
    by_category = []
    async for r in db.orders.aggregate(pipeline_category):
        if r["_id"]:
            by_category.append({"category": r["_id"], "count": r["count"], "revenue": r["revenue"]})
    by_payment = {r["_id"]: r["count"] async for r in db.orders.aggregate(pipeline_payment) if r["_id"]}
    daily = []
    async for r in db.orders.aggregate(pipeline_daily):
        daily.append({"date": r["_id"], "count": r["count"], "revenue": r["revenue"]})

    confirmed = by_status.get("confirmed", 0) + by_status.get("completed", 0)
    cancelled = by_status.get("cancelled", 0)
    cancel_rate = round((cancelled / total * 100), 1) if total > 0 else 0

    return {
        "report_id": "booking-report",
        "title": "Booking Report",
        "summary": {"total_bookings": total, "confirmed": confirmed, "cancelled": cancelled, "cancellation_rate": cancel_rate},
        "charts": [
            {"type": "pie", "title": "Bookings by Status", "data": [{"name": k, "value": v} for k, v in by_status.items()]},
            {"type": "bar", "title": "Bookings by Category", "data": [{"name": c["category"], "bookings": c["count"], "revenue": c["revenue"]} for c in by_category]},
            {"type": "line", "title": "Daily Bookings", "data": daily},
        ],
        "table": {
            "headers": ["Category", "Bookings", "Revenue (XAF)"],
            "rows": [[c["category"], c["count"], c["revenue"]] for c in by_category],
        },
        "details": {"by_status": by_status, "by_payment_status": by_payment},
    }


async def gen_revenue_report(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter
    match_paid = {**match, "payment_status": {"$in": ["paid", "completed"]}}

    pipeline_cat = [{"$match": match_paid}, {"$group": {"_id": "$service_category", "revenue": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}]
    pipeline_monthly = [
        {"$match": match_paid},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}}, "revenue": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 12},
    ]
    pipeline_method = [{"$match": match_paid}, {"$group": {"_id": "$payment_method", "revenue": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}]

    total_rev_cursor = db.orders.aggregate([{"$match": match_paid}, {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}])
    total_doc = await total_rev_cursor.to_list(1)
    total_revenue = total_doc[0]["total"] if total_doc else 0
    total_paid = total_doc[0]["count"] if total_doc else 0

    by_cat = []
    async for r in db.orders.aggregate(pipeline_cat):
        if r["_id"]:
            by_cat.append({"category": r["_id"], "revenue": r["revenue"], "count": r["count"]})
    monthly = []
    async for r in db.orders.aggregate(pipeline_monthly):
        monthly.append({"month": r["_id"], "revenue": r["revenue"], "count": r["count"]})
    by_method = []
    async for r in db.orders.aggregate(pipeline_method):
        if r["_id"]:
            by_method.append({"method": r["_id"], "revenue": r["revenue"], "count": r["count"]})

    avg_order = round(total_revenue / total_paid, 0) if total_paid > 0 else 0

    return {
        "report_id": "revenue-analysis",
        "title": "Revenue Analysis",
        "summary": {"total_revenue": total_revenue, "total_transactions": total_paid, "avg_order_value": avg_order, "currency": "XAF"},
        "charts": [
            {"type": "pie", "title": "Revenue by Category", "data": [{"name": c["category"], "value": c["revenue"]} for c in by_cat]},
            {"type": "bar", "title": "Monthly Revenue", "data": monthly},
            {"type": "pie", "title": "Revenue by Payment Method", "data": [{"name": m["method"], "value": m["revenue"]} for m in by_method]},
        ],
        "table": {
            "headers": ["Category", "Transactions", "Revenue (XAF)", "Avg Order"],
            "rows": [[c["category"], c["count"], c["revenue"], round(c["revenue"] / c["count"]) if c["count"] else 0] for c in by_cat],
        },
        "details": {"by_method": by_method},
    }


async def gen_financial_summary(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    total_orders = await db.orders.count_documents(match)
    match_paid = {**match, "payment_status": {"$in": ["paid", "completed"]}}
    match_failed = {**match, "payment_status": {"$in": ["failed", "timed_out"]}}
    match_pending = {**match, "payment_status": "processing"}

    rev_cur = db.orders.aggregate([{"$match": match_paid}, {"$group": {"_id": None, "t": {"$sum": "$total_amount"}, "c": {"$sum": 1}}}])
    rev_doc = await rev_cur.to_list(1)
    total_revenue = rev_doc[0]["t"] if rev_doc else 0
    paid_count = rev_doc[0]["c"] if rev_doc else 0

    failed_count = await db.orders.count_documents(match_failed)
    pending_count = await db.orders.count_documents(match_pending)
    success_rate = round((paid_count / total_orders * 100), 1) if total_orders > 0 else 0

    # Top services
    pipeline_top = [{"$match": match_paid}, {"$group": {"_id": "$service_category", "revenue": {"$sum": "$total_amount"}}}, {"$sort": {"revenue": -1}}, {"$limit": 5}]
    top = []
    async for r in db.orders.aggregate(pipeline_top):
        if r["_id"]:
            top.append({"category": r["_id"], "revenue": r["revenue"]})

    return {
        "report_id": "financial-summary",
        "title": "Financial Summary",
        "summary": {"total_revenue": total_revenue, "total_orders": total_orders, "paid_orders": paid_count, "failed_payments": failed_count, "pending_payments": pending_count, "payment_success_rate": success_rate, "currency": "XAF"},
        "charts": [
            {"type": "pie", "title": "Payment Status", "data": [{"name": "Paid", "value": paid_count}, {"name": "Failed", "value": failed_count}, {"name": "Pending", "value": pending_count}]},
            {"type": "bar", "title": "Top Revenue Categories", "data": [{"name": t["category"], "revenue": t["revenue"]} for t in top]},
        ],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Total Revenue", f"{total_revenue:,.0f} XAF"], ["Total Orders", total_orders], ["Paid Orders", paid_count],
                ["Failed Payments", failed_count], ["Payment Success Rate", f"{success_rate}%"],
            ],
        },
    }


async def gen_customer_insights(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    # Top customers by order count
    pipeline_top = [
        {"$match": match},
        {"$group": {"_id": "$user_id", "orders": {"$sum": 1}, "revenue": {"$sum": "$total_amount"}, "email": {"$first": "$customer_email"}}},
        {"$sort": {"orders": -1}}, {"$limit": 10},
    ]
    top_customers = []
    async for r in db.orders.aggregate(pipeline_top):
        top_customers.append({"user_id": r["_id"], "email": r.get("email", "N/A"), "orders": r["orders"], "revenue": r["revenue"]})

    # Unique customers
    unique_cur = db.orders.aggregate([{"$match": match}, {"$group": {"_id": "$user_id"}}, {"$count": "total"}])
    unique_doc = await unique_cur.to_list(1)
    unique = unique_doc[0]["total"] if unique_doc else 0

    # Repeat vs new (customers with >1 order)
    repeat_cur = db.orders.aggregate([{"$match": match}, {"$group": {"_id": "$user_id", "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$count": "total"}])
    repeat_doc = await repeat_cur.to_list(1)
    repeat = repeat_doc[0]["total"] if repeat_doc else 0
    new_customers = unique - repeat
    retention = round((repeat / unique * 100), 1) if unique > 0 else 0

    # Category preference
    cat_cur = db.orders.aggregate([{"$match": match}, {"$group": {"_id": {"user": "$user_id", "cat": "$service_category"}}}, {"$group": {"_id": "$_id.cat", "customers": {"$sum": 1}}}, {"$sort": {"customers": -1}}])
    cat_pref = []
    async for r in cat_cur:
        if r["_id"]:
            cat_pref.append({"category": r["_id"], "customers": r["customers"]})

    return {
        "report_id": "customer-insights",
        "title": "Customer Insights",
        "summary": {"unique_customers": unique, "repeat_customers": repeat, "new_customers": new_customers, "retention_rate": retention},
        "charts": [
            {"type": "pie", "title": "New vs Repeat Customers", "data": [{"name": "New", "value": new_customers}, {"name": "Repeat", "value": repeat}]},
            {"type": "bar", "title": "Category Preference", "data": [{"name": c["category"], "customers": c["customers"]} for c in cat_pref]},
        ],
        "table": {
            "headers": ["Customer Email", "Orders", "Revenue (XAF)"],
            "rows": [[c["email"], c["orders"], c["revenue"]] for c in top_customers],
        },
    }


async def gen_operational_efficiency(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    total = await db.orders.count_documents(match)
    confirmed = await db.orders.count_documents({**match, "status": {"$in": ["confirmed", "completed"]}})
    cancelled = await db.orders.count_documents({**match, "status": "cancelled"})
    fulfillment = round((confirmed / total * 100), 1) if total > 0 else 0

    # By category
    pipeline = [{"$match": match}, {"$group": {"_id": "$service_category", "total": {"$sum": 1}, "confirmed": {"$sum": {"$cond": [{"$in": ["$status", ["confirmed", "completed"]]}, 1, 0]}}, "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}}}}]
    cats = []
    async for r in db.orders.aggregate(pipeline):
        if r["_id"]:
            rate = round((r["confirmed"] / r["total"] * 100), 1) if r["total"] > 0 else 0
            cats.append({"category": r["_id"], "total": r["total"], "confirmed": r["confirmed"], "cancelled": r["cancelled"], "rate": rate})

    return {
        "report_id": "operational-efficiency",
        "title": "Operational Efficiency",
        "summary": {"total_orders": total, "fulfilled": confirmed, "cancelled": cancelled, "fulfillment_rate": fulfillment},
        "charts": [
            {"type": "bar", "title": "Fulfillment by Category", "data": [{"name": c["category"], "rate": c["rate"], "total": c["total"]} for c in cats]},
            {"type": "pie", "title": "Order Outcomes", "data": [{"name": "Fulfilled", "value": confirmed}, {"name": "Cancelled", "value": cancelled}, {"name": "Other", "value": max(0, total - confirmed - cancelled)}]},
        ],
        "table": {
            "headers": ["Category", "Total Orders", "Confirmed", "Cancelled", "Fulfillment Rate"],
            "rows": [[c["category"], c["total"], c["confirmed"], c["cancelled"], f"{c['rate']}%"] for c in cats],
        },
    }


async def gen_service_performance(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$service_category",
            "total_bookings": {"$sum": 1},
            "total_revenue": {"$sum": "$total_amount"},
            "avg_value": {"$avg": "$total_amount"},
            "paid": {"$sum": {"$cond": [{"$in": ["$payment_status", ["paid", "completed"]]}, 1, 0]}},
        }},
        {"$sort": {"total_revenue": -1}},
    ]
    services = []
    async for r in db.orders.aggregate(pipeline):
        if r["_id"]:
            services.append({
                "category": r["_id"], "bookings": r["total_bookings"],
                "revenue": r["total_revenue"], "avg_value": round(r["avg_value"]),
                "paid": r["paid"],
            })

    return {
        "report_id": "service-performance",
        "title": "Service Performance",
        "summary": {"total_services": len(services), "total_bookings": sum(s["bookings"] for s in services), "total_revenue": sum(s["revenue"] for s in services)},
        "charts": [
            {"type": "bar", "title": "Revenue by Service", "data": [{"name": s["category"], "revenue": s["revenue"], "bookings": s["bookings"]} for s in services]},
            {"type": "pie", "title": "Booking Distribution", "data": [{"name": s["category"], "value": s["bookings"]} for s in services]},
        ],
        "table": {
            "headers": ["Service", "Bookings", "Revenue (XAF)", "Avg Order (XAF)", "Paid"],
            "rows": [[s["category"], s["bookings"], s["revenue"], s["avg_value"], s["paid"]] for s in services],
        },
    }


async def gen_customer_satisfaction(op_filter: dict, date_filter: dict):
    match_ratings = {}
    if op_filter.get("operator_id"):
        match_ratings["operator_id"] = op_filter["operator_id"]
    if date_filter:
        match_ratings["created_at"] = date_filter

    total_ratings = await db.ratings.count_documents(match_ratings)
    pipeline_avg = [{"$match": match_ratings}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    avg_doc = await db.ratings.aggregate(pipeline_avg).to_list(1)
    avg_rating = round(avg_doc[0]["avg"], 1) if avg_doc else 0

    pipeline_dist = [{"$match": match_ratings}, {"$group": {"_id": "$rating", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]
    distribution = []
    async for r in db.ratings.aggregate(pipeline_dist):
        distribution.append({"rating": r["_id"], "count": r["count"]})

    positive = sum(d["count"] for d in distribution if d["rating"] and d["rating"] >= 4)
    positive_rate = round((positive / total_ratings * 100), 1) if total_ratings > 0 else 0

    # Support tickets
    ticket_match = {}
    if op_filter.get("operator_id"):
        ticket_match["operator_id"] = op_filter["operator_id"]
    tickets_total = await db.support_tickets.count_documents(ticket_match)
    tickets_resolved = await db.support_tickets.count_documents({**ticket_match, "status": "resolved"})

    return {
        "report_id": "customer-satisfaction",
        "title": "Customer Satisfaction",
        "summary": {"total_ratings": total_ratings, "avg_rating": avg_rating, "positive_rate": positive_rate, "support_tickets": tickets_total, "resolved_tickets": tickets_resolved},
        "charts": [
            {"type": "bar", "title": "Rating Distribution", "data": [{"name": f"{d['rating']} Stars", "count": d["count"]} for d in distribution]},
            {"type": "pie", "title": "Ticket Resolution", "data": [{"name": "Resolved", "value": tickets_resolved}, {"name": "Open", "value": max(0, tickets_total - tickets_resolved)}]},
        ],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [["Average Rating", f"{avg_rating}/5"], ["Total Reviews", total_ratings], ["Positive Rate", f"{positive_rate}%"], ["Support Tickets", tickets_total], ["Resolved", tickets_resolved]],
        },
    }


async def gen_booking_analytics(op_filter: dict, date_filter: dict):
    match = {**op_filter}
    if date_filter:
        match["created_at"] = date_filter

    # Hourly distribution
    pipeline_hourly = [{"$match": match}, {"$group": {"_id": {"$hour": "$created_at"}, "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]
    hourly = []
    async for r in db.orders.aggregate(pipeline_hourly):
        hourly.append({"hour": f"{r['_id']:02d}:00", "bookings": r["count"]})

    # Day of week
    pipeline_dow = [{"$match": match}, {"$group": {"_id": {"$dayOfWeek": "$created_at"}, "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    dow = []
    async for r in db.orders.aggregate(pipeline_dow):
        dow.append({"day": days[r["_id"] - 1] if 1 <= r["_id"] <= 7 else str(r["_id"]), "bookings": r["count"]})

    total = await db.orders.count_documents(match)
    paid = await db.orders.count_documents({**match, "payment_status": {"$in": ["paid", "completed"]}})
    conversion = round((paid / total * 100), 1) if total > 0 else 0
    peak_hour = max(hourly, key=lambda x: x["bookings"])["hour"] if hourly else "N/A"
    peak_day = max(dow, key=lambda x: x["bookings"])["day"] if dow else "N/A"

    return {
        "report_id": "booking-analytics",
        "title": "Booking Analytics",
        "summary": {"total_bookings": total, "conversion_rate": conversion, "peak_hour": peak_hour, "peak_day": peak_day},
        "charts": [
            {"type": "bar", "title": "Bookings by Hour", "data": hourly},
            {"type": "bar", "title": "Bookings by Day of Week", "data": dow},
        ],
        "table": {
            "headers": ["Hour", "Bookings"],
            "rows": [[h["hour"], h["bookings"]] for h in hourly],
        },
    }

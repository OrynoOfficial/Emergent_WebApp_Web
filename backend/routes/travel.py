"""
Travel management & analytics endpoints.
NOTE: Public CRUD routes (/routes, /routes/{id}) are in travel_routes.py
Do NOT add duplicate endpoints here — travel_routes.py is loaded first and takes precedence.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission, require_any_permission
from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/travel", tags=["Travel Management"])


@router.get("/routes/management")
async def get_travel_routes_management(
    current_user: dict = Depends(get_current_active_user),
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get travel routes for management - filtered by operator for operator users"""
    db = get_database()
    
    query = {}
    if current_user["role"] in ("admin", "super_admin") and operator_id:
        query["operator_id"] = operator_id
    elif current_user["role"] == "operator":
        op_id = current_user.get("operator_id")
        if op_id:
            query["$or"] = [
                {"operator_id": op_id},
                {"created_by": current_user["_id"]}
            ]
        else:
            query["created_by"] = current_user["_id"]
    
    routes = await db.travel_routes.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    for route in routes:
        route["id"] = str(route.pop("_id", route.get("id", "")))
        if route.get("vehicle_id"):
            vehicle = await db.vehicles.find_one({"_id": route["vehicle_id"]})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])[:2]
                route["vehicle_name"] = vehicle.get("vehicle_name", vehicle.get("name", ""))
                route["plate_number"] = vehicle.get("plate_number", "")
    
    return {
        "routes": routes, 
        "total": total,
        "is_operator_scoped": current_user["role"] == "operator"
    }


@router.get("/management/my-routes")
async def get_my_travel_routes(
    search: Optional[str] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """Get travel routes for the current user's operator (operator-scoped)."""
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    if current_user["role"] in ("admin", "super_admin") and operator_id:
        query = {"operator_id": operator_id}
    else:
        query = get_operator_filter(current_user)
    
    if search:
        query["$or"] = [
            {"route_name": {"$regex": search, "$options": "i"}},
            {"origin": {"$regex": search, "$options": "i"}},
            {"destination": {"$regex": search, "$options": "i"}}
        ]
    if origin:
        query["origin"] = {"$regex": origin, "$options": "i"}
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    
    routes = await db.travel_routes.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.travel_routes.count_documents(query)
    
    for route in routes:
        route["id"] = str(route.pop("_id", ""))
        vehicle_id = route.get("vehicle_id")
        if vehicle_id:
            vehicle = await db.vehicles.find_one({"_id": vehicle_id}, {"images": 1, "plate_number": 1})
            if vehicle:
                route["vehicle_images"] = vehicle.get("images", [])[:2]
                route["plate_number"] = vehicle.get("plate_number", "")
    
    return {
        "routes": routes, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }


@router.get("/analytics/dashboard")
async def get_travel_analytics(
    current_user: dict = Depends(get_current_active_user)
):
    """Get travel analytics data for the management dashboard"""
    db = get_database()

    op_filter = {}
    if current_user.get("role") == "operator":
        op_id = current_user.get("operator_id")
        if op_id:
            op_filter = {"operator_id": op_id}

    from dateutil.relativedelta import relativedelta
    now = datetime.utcnow()
    monthly_data = []
    for i in range(5, -1, -1):
        month_start = (now - relativedelta(months=i)).replace(day=1, hour=0, minute=0, second=0)
        if i > 0:
            month_end = (now - relativedelta(months=i-1)).replace(day=1, hour=0, minute=0, second=0)
        else:
            month_end = now

        query = {
            "service_category": "travel",
            "created_at": {"$gte": month_start, "$lt": month_end},
            **op_filter
        }
        month_orders = await db.orders.find(query).to_list(1000)
        bookings = len(month_orders)
        revenue = sum(o.get("total_amount", 0) for o in month_orders)

        monthly_data.append({
            "month": month_start.strftime("%b"),
            "bookings": bookings,
            "revenue": revenue
        })

    route_popularity = []
    routes = await db.travel_routes.find({**op_filter, "status": "active"}).to_list(100)
    for r in routes[:10]:
        rid = r.get("_id") or r.get("id")
        booking_count = await db.orders.count_documents({
            "service_category": "travel",
            "service_id": rid,
            **op_filter
        })
        route_popularity.append({
            "route": f"{r.get('origin', r.get('from_city', '?'))} → {r.get('destination', r.get('to_city', '?'))}",
            "bookings": booking_count,
            "revenue": booking_count * (r.get("price", 0))
        })
    route_popularity.sort(key=lambda x: x["bookings"], reverse=True)

    vehicle_util = []
    vehicles = await db.vehicles.find(op_filter).to_list(50)
    for v in vehicles[:8]:
        total_trips = await db.travel_routes.count_documents({"vehicle_id": v.get("_id"), **op_filter})
        booked_seats = await db.seat_bookings.count_documents({"vehicle_id": v.get("_id"), "status": "booked"})
        capacity = v.get("capacity", v.get("total_seats", 45))
        utilization = min(100, round((booked_seats / max(1, capacity * max(1, total_trips))) * 100))
        vehicle_util.append({
            "name": (v.get("vehicle_name") or v.get("name", "Vehicle"))[:15],
            "utilization": utilization
        })

    total_bookings = await db.orders.count_documents({"service_category": "travel", **op_filter})
    total_revenue_pipeline = [
        {"$match": {"service_category": "travel", **op_filter}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    rev_result = await db.orders.aggregate(total_revenue_pipeline).to_list(1)
    total_revenue = rev_result[0]["total"] if rev_result else 0

    return {
        "monthly_trend": monthly_data,
        "route_popularity": route_popularity[:6],
        "vehicle_utilization": vehicle_util,
        "summary": {
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "active_routes": len(routes),
            "active_vehicles": len(vehicles)
        }
    }

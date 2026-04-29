"""
Public API Routes - No Authentication Required
These endpoints are for the landing website to fetch public data
"""

from fastapi import APIRouter, HTTPException
from config.database import get_database
from typing import Optional

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/services")
async def get_public_services():
    """Get list of available service categories"""
    return {
        "services": [
            {"id": "hotels", "name": "Hotels", "icon": "hotel", "description": "Find and book hotels across Cameroon"},
            {"id": "travel", "name": "Travel", "icon": "bus", "description": "Book bus tickets between cities"},
            {"id": "car-rental", "name": "Car Rental", "icon": "car", "description": "Rent vehicles for your trips"},
            {"id": "restaurants", "name": "Restaurants", "icon": "utensils", "description": "Discover and reserve tables"},
            {"id": "events", "name": "Events", "icon": "calendar", "description": "Find concerts, festivals, and more"},
            {"id": "cinema", "name": "Cinema", "icon": "film", "description": "Book movie tickets"},
            {"id": "laundry", "name": "Laundry", "icon": "shirt", "description": "Professional laundry services"},
            {"id": "banquet", "name": "Banquet Halls", "icon": "building", "description": "Venues for your events"},
            {"id": "packages", "name": "Travel Packages", "icon": "package", "description": "All-inclusive travel deals"}
        ]
    }


@router.get("/featured-hotels")
async def get_featured_hotels(limit: int = 6):
    """Get featured hotels for landing page"""
    db = get_database()
    if db is None:
        return {"hotels": []}
    
    hotels_cursor = db.hotels.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("average_rating", -1).limit(limit)
    
    hotels = await hotels_cursor.to_list(limit)
    return {"hotels": hotels}


@router.get("/featured-packages")
async def get_featured_packages(limit: int = 6):
    """Get latest physical package shipments for landing page (logistics showcase)."""
    db = get_database()
    if db is None:
        return {"packages": []}

    packages = await db.packages.find(
        {},
        {"_id": 0, "id": "$_id", "tracking_number": 1, "origin_city": 1,
         "destination_city": 1, "package_type": 1, "status": 1, "price": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    return {"packages": packages}


@router.get("/featured-events")
async def get_featured_events(limit: int = 6):
    """Get upcoming events for landing page"""
    db = get_database()
    if db is None:
        return {"events": []}
    
    from datetime import datetime
    events = await db.events.find(
        {"is_active": True, "date": {"$gte": datetime.now().strftime('%Y-%m-%d')}},
        {"_id": 0, "id": "$_id", "name": 1, "type": 1, "city": 1, "date": 1, "price_from": 1, "price_to": 1}
    ).sort("date", 1).limit(limit).to_list(limit)
    
    return {"events": events}


@router.get("/popular-routes")
async def get_popular_routes(limit: int = 8):
    """Get popular travel routes"""
    db = get_database()
    if db is None:
        return {"routes": []}
    
    # Get unique routes
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": {"from": "$from_city", "to": "$to_city"},
            "min_price": {"$min": "$price"},
            "operators_count": {"$sum": 1}
        }},
        {"$sort": {"operators_count": -1}},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "from_city": "$_id.from",
            "to_city": "$_id.to",
            "min_price": 1,
            "operators_count": 1
        }}
    ]
    
    routes = await db.travel_routes.aggregate(pipeline).to_list(limit)
    return {"routes": routes}


@router.get("/cities")
async def get_available_cities():
    """Get list of cities with services"""
    return {
        "cities": [
            {"id": "yaounde", "name": "Yaoundé", "region": "Centre"},
            {"id": "douala", "name": "Douala", "region": "Littoral"},
            {"id": "bafoussam", "name": "Bafoussam", "region": "West"},
            {"id": "bamenda", "name": "Bamenda", "region": "North-West"},
            {"id": "kribi", "name": "Kribi", "region": "South"},
            {"id": "limbe", "name": "Limbe", "region": "South-West"},
            {"id": "buea", "name": "Buea", "region": "South-West"},
            {"id": "garoua", "name": "Garoua", "region": "North"}
        ]
    }


@router.get("/stats")
async def get_platform_stats():
    """Get platform statistics for landing page"""
    db = get_database()
    if db is None:
        return {
            "total_hotels": 50,
            "total_routes": 100,
            "total_vehicles": 200,
            "total_events": 30,
            "cities_covered": 8,
            "happy_customers": 10000
        }
    
    hotels = await db.hotels.count_documents({"is_active": True})
    routes = await db.travel_routes.count_documents({"status": "active"})
    vehicles = await db.vehicles.count_documents({"is_active": True})
    events = await db.events.count_documents({"is_active": True})
    
    return {
        "total_hotels": hotels or 50,
        "total_routes": routes or 100,
        "total_vehicles": vehicles or 200,
        "total_events": events or 30,
        "cities_covered": 8,
        "happy_customers": 10000
    }


@router.get("/testimonials")
async def get_testimonials():
    """Get customer testimonials for landing page"""
    return {
        "testimonials": [
            {
                "id": "1",
                "name": "Jean-Pierre M.",
                "city": "Douala",
                "rating": 5,
                "comment": "Excellent service! I booked my hotel and bus tickets all in one place. Very convenient.",
                "service": "Hotels & Travel"
            },
            {
                "id": "2",
                "name": "Marie T.",
                "city": "Yaoundé",
                "rating": 5,
                "comment": "The car rental was smooth and the vehicle was in perfect condition. Will use again!",
                "service": "Car Rental"
            },
            {
                "id": "3",
                "name": "Paul N.",
                "city": "Bafoussam",
                "rating": 4,
                "comment": "Great platform for finding events in my city. The booking process is simple.",
                "service": "Events"
            },
            {
                "id": "4",
                "name": "Aminata K.",
                "city": "Kribi",
                "rating": 5,
                "comment": "Loved the beach package! Everything was organized perfectly. Highly recommend.",
                "service": "Packages"
            }
        ]
    }

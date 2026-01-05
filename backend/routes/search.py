from fastapi import APIRouter, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from typing import Optional, List
import re

router = APIRouter(prefix="/api/search", tags=["Global Search"])

# All locations in Cameroon
LOCATIONS = [
    'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua',
    'Maroua', 'Ngaoundéré', 'Bertoua', 'Kribi', 'Limbe',
    'Buea', 'Ebolowa', 'Edéa', 'Kumba', 'Nkongsamba'
]

@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Global search across all services, operators, locations, routes, etc.
    Returns categorized results for comprehensive search experience.
    """
    db = get_database()
    query = q.strip().lower()
    results = []
    
    # Create regex for case-insensitive search
    regex_pattern = {"$regex": query, "$options": "i"}
    
    # 1. Search Locations - return all services available in that location
    matching_locations = [loc for loc in LOCATIONS if query in loc.lower()]
    for location in matching_locations[:3]:
        results.append({
            "type": "location",
            "label": location,
            "description": f"View all services in {location}",
            "path": f"/search?location={location}",
            "icon": "MapPin",
            "color": "#EF4444",
            "meta": {"location": location}
        })
    
    # 2. Search Operators
    operators = await db.operators.find(
        {"$or": [
            {"company_name": regex_pattern},
            {"business_type": regex_pattern},
            {"contact_name": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "company_name": 1, "business_type": 1, "services": 1}
    ).limit(5).to_list(5)
    
    for op in operators:
        services_text = ", ".join(op.get("services", [])[:3]) if op.get("services") else "Multiple services"
        results.append({
            "type": "operator",
            "label": op.get("company_name", "Unknown Operator"),
            "description": f"Operator • {services_text}",
            "path": f"/admin/operators?search={op.get('company_name', '')}",
            "icon": "Building2",
            "color": "#8B5CF6",
            "meta": {"operator_id": op.get("id"), "services": op.get("services", [])}
        })
    
    # 3. Search Travel Routes (by city or operator)
    routes = await db.travel_routes.find(
        {"$or": [
            {"from_city": regex_pattern},
            {"to_city": regex_pattern},
            {"operator_name": regex_pattern},
            {"vehicle_name": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "from_city": 1, "to_city": 1, "operator_name": 1, "price": 1, "departure_time": 1}
    ).limit(5).to_list(5)
    
    for route in routes:
        results.append({
            "type": "travel_route",
            "label": f"{route.get('from_city', '')} → {route.get('to_city', '')}",
            "description": f"Bus • {route.get('operator_name', 'Unknown')} • {route.get('departure_time', '')}",
            "path": f"/services/travel/results?from={route.get('from_city', '')}&to={route.get('to_city', '')}",
            "icon": "Bus",
            "color": "#3B82F6",
            "meta": {"route_id": route.get("id"), "price": route.get("price")}
        })
    
    # 4. Search Hotels (by name, city, or features)
    hotels = await db.hotels.find(
        {"$or": [
            {"name": regex_pattern},
            {"city": regex_pattern},
            {"address": regex_pattern},
            {"amenities": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "star_rating": 1, "price_per_night": 1}
    ).limit(5).to_list(5)
    
    for hotel in hotels:
        stars = "⭐" * (hotel.get("star_rating", 3) or 3)
        results.append({
            "type": "hotel",
            "label": hotel.get("name", "Unknown Hotel"),
            "description": f"Hotel in {hotel.get('city', 'Unknown')} • {stars}",
            "path": f"/services/hotels/results?destination={hotel.get('city', '')}",
            "icon": "Hotel",
            "color": "#EC4899",
            "meta": {"hotel_id": hotel.get("id"), "city": hotel.get("city")}
        })
    
    # 5. Search Restaurants (by name, city, or cuisine)
    restaurants = await db.restaurants.find(
        {"$or": [
            {"name": regex_pattern},
            {"city": regex_pattern},
            {"cuisine_type": regex_pattern},
            {"address": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "cuisine_type": 1, "rating": 1}
    ).limit(5).to_list(5)
    
    for rest in restaurants:
        results.append({
            "type": "restaurant",
            "label": rest.get("name", "Unknown Restaurant"),
            "description": f"Restaurant in {rest.get('city', 'Unknown')} • {rest.get('cuisine_type', 'Various')}",
            "path": f"/services/restaurants/results?city={rest.get('city', '')}",
            "icon": "Utensils",
            "color": "#F59E0B",
            "meta": {"restaurant_id": rest.get("id"), "city": rest.get("city")}
        })
    
    # 6. Search Events (by name, city, or type)
    events = await db.events.find(
        {"$or": [
            {"name": regex_pattern},
            {"title": regex_pattern},
            {"city": regex_pattern},
            {"event_type": regex_pattern},
            {"venue": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "name": 1, "title": 1, "city": 1, "event_type": 1, "date": 1}
    ).limit(5).to_list(5)
    
    for event in events:
        event_name = event.get("name") or event.get("title", "Unknown Event")
        results.append({
            "type": "event",
            "label": event_name,
            "description": f"Event in {event.get('city', 'Unknown')} • {event.get('event_type', 'General')}",
            "path": f"/services/events/results?city={event.get('city', '')}",
            "icon": "Calendar",
            "color": "#F97316",
            "meta": {"event_id": event.get("id"), "city": event.get("city")}
        })
    
    # 7. Search Car Rentals (by city or vehicle type)
    vehicles = await db.rental_vehicles.find(
        {"$or": [
            {"city": regex_pattern},
            {"vehicle_name": regex_pattern},
            {"vehicle_type": regex_pattern},
            {"manufacturer": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "vehicle_name": 1, "city": 1, "vehicle_type": 1, "daily_rate": 1}
    ).limit(5).to_list(5)
    
    for vehicle in vehicles:
        results.append({
            "type": "car_rental",
            "label": vehicle.get("vehicle_name", "Unknown Vehicle"),
            "description": f"Car Rental in {vehicle.get('city', 'Unknown')} • {vehicle.get('vehicle_type', 'Standard')}",
            "path": f"/services/car-rental/results?pickup={vehicle.get('city', '')}",
            "icon": "Car",
            "color": "#10B981",
            "meta": {"vehicle_id": vehicle.get("id"), "city": vehicle.get("city")}
        })
    
    # 8. Search Cinema/Movies (by city or movie name)
    movies = await db.cinema_movies.find(
        {"$or": [
            {"title": regex_pattern},
            {"city": regex_pattern},
            {"genre": regex_pattern},
            {"cinema_name": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "title": 1, "city": 1, "genre": 1, "cinema_name": 1}
    ).limit(5).to_list(5)
    
    for movie in movies:
        results.append({
            "type": "cinema",
            "label": movie.get("title", "Unknown Movie"),
            "description": f"Cinema in {movie.get('city', 'Unknown')} • {movie.get('genre', 'Movie')}",
            "path": f"/services/cinema/results?city={movie.get('city', '')}",
            "icon": "Film",
            "color": "#06B6D4",
            "meta": {"movie_id": movie.get("id"), "city": movie.get("city")}
        })
    
    # 9. Search Banquet/Venues (by city or venue type)
    venues = await db.banquet_venues.find(
        {"$or": [
            {"name": regex_pattern},
            {"city": regex_pattern},
            {"venue_type": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "venue_type": 1, "capacity": 1}
    ).limit(5).to_list(5)
    
    for venue in venues:
        results.append({
            "type": "banquet",
            "label": venue.get("name", "Unknown Venue"),
            "description": f"Venue in {venue.get('city', 'Unknown')} • Capacity: {venue.get('capacity', 'N/A')}",
            "path": f"/services/banquet/results?city={venue.get('city', '')}",
            "icon": "PartyPopper",
            "color": "#14B8A6",
            "meta": {"venue_id": venue.get("id"), "city": venue.get("city")}
        })
    
    # 10. Search Users (admin only)
    if current_user.get("role") == "admin":
        users = await db.users.find(
            {"$or": [
                {"email": regex_pattern},
                {"full_name": regex_pattern},
                {"first_name": regex_pattern},
                {"last_name": regex_pattern},
                {"phone": regex_pattern}
            ]},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1, "first_name": 1, "last_name": 1, "role": 1}
        ).limit(5).to_list(5)
        
        for u in users:
            name = u.get("full_name") or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("email", "Unknown")
            results.append({
                "type": "user",
                "label": name,
                "description": f"User • {u.get('email', '')} • {u.get('role', 'customer')}",
                "path": f"/admin/users?search={u.get('email', '')}",
                "icon": "User",
                "color": "#64748B",
                "meta": {"user_id": u.get("id"), "email": u.get("email")}
            })
    
    # 11. Search Orders/Bookings
    orders = await db.orders.find(
        {"$or": [
            {"order_id": regex_pattern},
            {"booking_reference": regex_pattern},
            {"service_type": regex_pattern},
            {"customer_name": regex_pattern}
        ]},
        {"_id": 0, "id": 1, "order_id": 1, "booking_reference": 1, "service_type": 1, "status": 1, "total_amount": 1}
    ).limit(5).to_list(5)
    
    for order in orders:
        order_ref = order.get("order_id") or order.get("booking_reference") or order.get("id", "Unknown")
        results.append({
            "type": "order",
            "label": f"Order #{order_ref}",
            "description": f"{order.get('service_type', 'Service')} • {order.get('status', 'pending')}",
            "path": f"/orders?search={order_ref}",
            "icon": "Receipt",
            "color": "#9575CD",
            "meta": {"order_id": order.get("id"), "status": order.get("status")}
        })
    
    # Sort results by relevance (exact matches first)
    def relevance_score(item):
        label = item.get("label", "").lower()
        if label == query:
            return 0  # Exact match
        elif label.startswith(query):
            return 1  # Starts with
        elif query in label:
            return 2  # Contains
        else:
            return 3  # Keyword match
    
    results.sort(key=relevance_score)
    
    return {
        "query": q,
        "results": results[:limit],
        "total": len(results)
    }


@router.get("/suggestions")
async def get_search_suggestions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get popular search suggestions"""
    return {
        "popular_locations": ["Douala", "Yaoundé", "Bafoussam", "Kribi", "Limbe"],
        "popular_services": ["Hotels", "Bus Tickets", "Car Rental", "Events", "Restaurants"],
        "recent_searches": []  # Can be personalized per user
    }

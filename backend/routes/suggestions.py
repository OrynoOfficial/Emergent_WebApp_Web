from fastapi import APIRouter, Query
from typing import Optional
from config.database import get_database

router = APIRouter(prefix="/api/suggestions", tags=["Suggestions"])


@router.get("/popular-locations")
async def get_popular_locations(
    service_type: Optional[str] = Query(None, description="Service type: travel, restaurant, hotel, cinema, event, pressing, banquet, packages, car_rental")
):
    """
    Returns popular locations dynamically from the database.
    Aggregates cities from the relevant service collections + orders,
    ranked by how many listings/bookings exist per city.
    """
    db = get_database()
    city_counts = {}

    async def count_cities(collection, field):
        pipeline = [
            {"$match": {field: {"$exists": True, "$ne": None, "$ne": ""}}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        ]
        async for doc in db[collection].aggregate(pipeline):
            city = doc["_id"]
            if city:
                city_counts[city] = city_counts.get(city, 0) + doc["count"]

    # Aggregate based on service type, or all if not specified
    service_map = {
        "travel": [("travel_routes", "from_city"), ("travel_routes", "to_city")],
        "restaurant": [("restaurants", "city")],
        "hotel": [("hotels", "city")],
        "cinema": [("cinemas", "city")],
        "event": [("events", "city")],
        "events": [("events", "city")],
        "pressing": [("pressings", "city")],
        "laundry": [("pressings", "city")],
        "banquet": [("banquets", "city")],
        "packages": [("packages", "destination"), ("packages", "origin")],
        "car_rental": [("car_rentals", "city")],
    }

    if service_type and service_type in service_map:
        targets = service_map[service_type]
    else:
        # All services
        targets = []
        for v in service_map.values():
            targets.extend(v)
        # Deduplicate
        targets = list(set(targets))

    for collection, field in targets:
        await count_cities(collection, field)

    # Also count from orders for booking-based popularity
    order_category = service_type or None
    order_pipeline = [
        {"$match": {"service_details.city": {"$exists": True, "$ne": None}}}
    ]
    if order_category:
        order_pipeline[0]["$match"]["service_category"] = order_category
    order_pipeline.extend([
        {"$group": {"_id": "$service_details.city", "count": {"$sum": 1}}},
    ])
    try:
        async for doc in db.orders.aggregate(order_pipeline):
            city = doc["_id"]
            if city:
                # Bookings weigh 3x more than listings
                city_counts[city] = city_counts.get(city, 0) + doc["count"] * 3
    except Exception:
        pass

    # Sort by count descending
    ranked = sorted(city_counts.items(), key=lambda x: x[1], reverse=True)

    # Build response
    all_locations = [city for city, _ in ranked]
    popular = [city for city, _ in ranked[:5]]  # top 5 as "popular"

    # If we got very few from the DB, supplement with known Cameroon cities
    fallback_cities = [
        'Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua',
        'Maroua', 'Ngaoundéré', 'Bertoua', 'Kribi', 'Limbe',
        'Buea', 'Ebolowa', 'Edéa', 'Kumba', 'Nkongsamba'
    ]
    for city in fallback_cities:
        if city not in all_locations:
            all_locations.append(city)
    if len(popular) < 3:
        for city in fallback_cities:
            if city not in popular:
                popular.append(city)
            if len(popular) >= 3:
                break

    return {
        "all_locations": all_locations,
        "popular": popular,
        "counts": {city: count for city, count in ranked[:10]},
    }


@router.get("/popular-items")
async def get_popular_items(
    service_type: Optional[str] = Query(None, description="Service type: restaurant, hotel, cinema, event, etc."),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Returns popular service items (menu dishes, hotels, events, etc.)
    based on bookings, ratings, and the 'popular' flag.
    """
    db = get_database()
    items = []

    if service_type == "restaurant":
        # Aggregate most-ordered menu items from orders + popular flags
        pipeline = [
            {"$match": {"is_available": {"$ne": False}}},
            {"$sort": {"popular": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "category": 1, "price": 1, "image": 1, "popular": 1, "restaurant_id": 1}},
        ]
        async for item in db.restaurant_menu.aggregate(pipeline):
            items.append(item)

        # Also get from orders
        order_pipeline = [
            {"$match": {"service_category": "restaurant", "service_details.items": {"$exists": True}}},
            {"$unwind": "$service_details.items"},
            {"$group": {"_id": "$service_details.items.name", "order_count": {"$sum": 1}}},
            {"$sort": {"order_count": -1}},
            {"$limit": limit},
        ]
        try:
            ordered_items = []
            async for doc in db.orders.aggregate(order_pipeline):
                if doc["_id"]:
                    ordered_items.append({"name": doc["_id"], "order_count": doc["order_count"]})
            if ordered_items:
                items = ordered_items + [i for i in items if i.get("name") not in [o["name"] for o in ordered_items]]
        except Exception:
            pass

    elif service_type == "hotel":
        pipeline = [
            {"$match": {"is_active": True}},
            {"$sort": {"total_ratings": -1, "rating": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "city": 1, "rating": 1, "price_range": 1}},
        ]
        async for item in db.hotels.aggregate(pipeline):
            items.append(item)

    elif service_type in ("event", "events"):
        pipeline = [
            {"$sort": {"tickets_sold": -1, "created_at": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": {"$toString": "$_id"}, "name": 1, "city": 1, "event_type": 1, "ticket_price": 1}},
        ]
        async for item in db.events.aggregate(pipeline):
            items.append(item)

    elif service_type == "cinema":
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": {"$toString": "$_id"}, "title": 1, "genre": 1, "rating": 1, "poster_url": 1}},
        ]
        async for item in db.films.aggregate(pipeline):
            items.append(item)

    elif service_type == "travel":
        pipeline = [
            {"$sort": {"total_bookings": -1, "created_at": -1}},
            {"$limit": limit},
            {"$project": {"_id": 0, "id": {"$toString": "$_id"}, "from_city": 1, "to_city": 1, "operator_name": 1, "base_price": 1}},
        ]
        async for item in db.travel_routes.aggregate(pipeline):
            items.append(item)

    return {"items": items[:limit], "service_type": service_type}

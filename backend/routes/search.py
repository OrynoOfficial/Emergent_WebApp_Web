"""
Global search across the platform.

iter 247 overhaul:
  - Uses the CURRENT canonical collections (event_showtimes, showtimes/films/cinemas,
    car_rentals, banquets, restaurants, hotels, pressings, travel_routes, operators).
  - Returns a `thumbnail` URL for each row so the dropdown / preview modal can
    render rich rows. When the row has no image, the frontend falls back to
    the service-type icon over a colour swatch.
  - Returns a `deep_link` that points to the actual detail/profile page rather
    than a results-list page, so a click pivots straight to the item.
  - Accent + case insensitive matching for city/name fields so "yaounde" still
    finds shows hosted in "Yaoundé".
"""
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, Query

from config.database import get_database
from middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/search", tags=["Global Search"])


# All locations in Cameroon — used to surface a "search by city" row when the
# user types a known location.
LOCATIONS = [
    "Yaoundé", "Douala", "Bafoussam", "Bamenda", "Garoua",
    "Maroua", "Ngaoundéré", "Bertoua", "Kribi", "Limbe",
    "Buea", "Ebolowa", "Edéa", "Kumba", "Nkongsamba",
]


# Accent-insensitive regex helper. Expands each vowel into a Unicode char-class
# so "Yaounde" still matches "Yaoundé". MongoDB's regex doesn't honour
# diacritic-insensitive collation natively.
_ACCENT_CLASSES = {
    "a": "[aàáâãäå]", "e": "[eéèêë]", "i": "[iíìîï]",
    "o": "[oóòôõö]", "u": "[uúùûü]", "c": "[cç]",
    "n": "[nñ]", "y": "[yýÿ]",
}


def _ai_pattern(s: str) -> str:
    """Accent + case insensitive regex pattern for ``s``."""
    folded = "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )
    return "".join(_ACCENT_CLASSES.get(c.lower(), re.escape(c)) for c in folded)


def _row(*, type_, label, subtitle, deep_link, icon, color,
         thumbnail=None, meta=None):
    """Shape every result row the same way so the frontend renders uniformly."""
    return {
        "type": type_,
        "label": label,
        "subtitle": subtitle,
        # backwards-compat — older frontend reads .description
        "description": subtitle,
        "path": deep_link,
        "deep_link": deep_link,
        "icon": icon,
        "color": color,
        "thumbnail": thumbnail,
        "meta": meta or {},
    }


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(40, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """Rich global search with thumbnails and deep links."""
    db = get_database()
    query = q.strip()
    if not query:
        return {"query": q, "results": [], "total": 0, "by_type": {}}

    rx = {"$regex": _ai_pattern(query), "$options": "i"}
    results = []

    # ── 1. Locations ────────────────────────────────────────────────────────
    matching_locations = [
        loc for loc in LOCATIONS
        if re.search(_ai_pattern(query), loc, re.IGNORECASE)
    ]
    for location in matching_locations[:3]:
        results.append(_row(
            type_="location",
            label=location,
            subtitle=f"View every service in {location}",
            deep_link=f"/services?location={location}",
            icon="MapPin", color="#EF4444",
            meta={"location": location},
        ))

    # ── 2. Operators ────────────────────────────────────────────────────────
    ops_cursor = db.operators.find(
        {"$or": [
            {"name": rx},
            {"contact_email": rx},
            {"description": rx},
        ]},
        {"_id": 1, "name": 1, "logo_url": 1, "service_types": 1, "city": 1},
    ).limit(6)
    async for op in ops_cursor:
        st = ", ".join((op.get("service_types") or [])[:3]) or "Multiple services"
        results.append(_row(
            type_="operator",
            label=op.get("name", "Unknown Operator"),
            subtitle=f"Operator · {st}" + (f" · {op['city']}" if op.get("city") else ""),
            deep_link=f"/admin/operators?search={op['_id']}",
            icon="Building2", color="#8B5CF6",
            thumbnail=op.get("logo_url"),
            meta={"operator_id": op["_id"], "service_types": op.get("service_types") or []},
        ))

    # ── 3. Hotels ──────────────────────────────────────────────────────────
    hotels_cursor = db.hotels.find(
        {"$or": [{"name": rx}, {"city": rx}, {"address": rx}, {"amenities": rx}]},
        {"_id": 1, "name": 1, "city": 1, "star_rating": 1, "price_per_night": 1,
         "image_url": 1, "images": 1, "operator_name": 1},
    ).limit(6)
    async for h in hotels_cursor:
        stars = "⭐" * int(h.get("star_rating") or 0) if h.get("star_rating") else ""
        price = h.get("price_per_night")
        price_chip = f" · from {int(price):,} FCFA" if price else ""
        results.append(_row(
            type_="hotel",
            label=h.get("name", "Hotel"),
            subtitle=f"Hotel · {h.get('city', 'Unknown')}{stars and ' · ' + stars}{price_chip}",
            deep_link=f"/services/hotels/details/{h['_id']}",
            icon="Hotel", color="#EC4899",
            thumbnail=(h.get("image_url") or (h.get("images") or [None])[0]),
            meta={"hotel_id": h["_id"], "city": h.get("city"),
                  "operator_name": h.get("operator_name")},
        ))

    # ── 4. Event showtimes (Concerts, Sports, etc) ─────────────────────────
    # Pull location details in one query so we can render the city + venue.
    show_cursor = db.event_showtimes.find(
        {"$or": [
            {"title": rx}, {"event_type": rx}, {"description": rx},
            {"location_name": rx}, {"operator_name": rx},
        ], "status": "published"},
        {"_id": 1, "title": 1, "event_type": 1, "location_id": 1,
         "location_name": 1, "operator_name": 1, "start_datetime": 1,
         "poster_url": 1, "images": 1, "classes": 1},
    ).limit(6)
    show_rows = await show_cursor.to_list(6)
    loc_ids = [s.get("location_id") for s in show_rows if s.get("location_id")]
    loc_city = {}
    if loc_ids:
        async for loc in db.event_locations.find({"_id": {"$in": loc_ids}}, {"_id": 1, "city": 1}):
            loc_city[loc["_id"]] = loc.get("city")
    for s in show_rows:
        city = loc_city.get(s.get("location_id"), "")
        date_str = (s.get("start_datetime") or "").split("T")[0]
        prices = [c.get("price") for c in (s.get("classes") or []) if c.get("price") is not None]
        from_price = f" · from {int(min(prices)):,} FCFA" if prices else ""
        results.append(_row(
            type_="event",
            label=s.get("title", "Event"),
            subtitle=f"{(s.get('event_type') or 'Event').title()} · {s.get('location_name') or '—'}"
                     + (f", {city}" if city else "")
                     + (f" · {date_str}" if date_str else "")
                     + from_price,
            deep_link=f"/services/showtimes/{s['_id']}",
            icon="Calendar", color="#F97316",
            thumbnail=(s.get("poster_url") or (s.get("images") or [None])[0]),
            meta={"showtime_id": s["_id"], "city": city,
                  "operator_name": s.get("operator_name")},
        ))

    # ── 5. Cinema films + showtimes ────────────────────────────────────────
    films_cursor = db.films.find(
        {"$or": [{"title": rx}, {"genre": rx}, {"genres": rx}, {"director": rx}, {"cast": rx}]},
        {"_id": 1, "title": 1, "genre": 1, "genres": 1, "poster_url": 1, "image_url": 1, "duration": 1},
    ).limit(5)
    async for f in films_cursor:
        genre = f.get("genre") or (f.get("genres") or [None])[0] or "Movie"
        duration = f.get("duration")
        results.append(_row(
            type_="cinema",
            label=f.get("title", "Film"),
            subtitle=f"Film · {genre}" + (f" · {duration} min" if duration else ""),
            deep_link=f"/services/cinema/film/{f['_id']}",
            icon="Film", color="#06B6D4",
            thumbnail=(f.get("poster_url") or f.get("image_url")),
            meta={"film_id": f["_id"]},
        ))

    # ── 6. Restaurants ─────────────────────────────────────────────────────
    rest_cursor = db.restaurants.find(
        {"$or": [{"name": rx}, {"city": rx}, {"cuisine_type": rx},
                 {"cuisine_types": rx}, {"address": rx}]},
        {"_id": 1, "name": 1, "city": 1, "cuisine_type": 1, "cuisine_types": 1,
         "rating": 1, "image_url": 1, "images": 1},
    ).limit(5)
    async for r in rest_cursor:
        cuisine = r.get("cuisine_type") or ", ".join((r.get("cuisine_types") or [])[:2]) or "Various"
        results.append(_row(
            type_="restaurant",
            label=r.get("name", "Restaurant"),
            subtitle=f"Restaurant · {r.get('city', 'Unknown')} · {cuisine}",
            deep_link=f"/services/restaurants/details/{r['_id']}",
            icon="Utensils", color="#F59E0B",
            thumbnail=(r.get("image_url") or (r.get("images") or [None])[0]),
            meta={"restaurant_id": r["_id"], "city": r.get("city")},
        ))

    # ── 7. Travel routes ───────────────────────────────────────────────────
    routes_cursor = db.travel_routes.find(
        {"$or": [
            {"from_city": rx}, {"to_city": rx},
            {"origin_city": rx}, {"destination_city": rx},
            {"operator_name": rx},
        ]},
        {"_id": 1, "from_city": 1, "to_city": 1, "origin_city": 1, "destination_city": 1,
         "operator_name": 1, "price": 1, "departure_time": 1, "operator_logo_url": 1},
    ).limit(5)
    async for rt in routes_cursor:
        from_c = rt.get("from_city") or rt.get("origin_city") or "—"
        to_c = rt.get("to_city") or rt.get("destination_city") or "—"
        price = rt.get("price")
        results.append(_row(
            type_="travel_route",
            label=f"{from_c} → {to_c}",
            subtitle=f"Bus · {rt.get('operator_name', 'Operator')}"
                     + (f" · {rt['departure_time']}" if rt.get("departure_time") else "")
                     + (f" · {int(price):,} FCFA" if price else ""),
            deep_link=f"/services/travel/results?from={from_c}&to={to_c}",
            icon="Bus", color="#3B82F6",
            thumbnail=rt.get("operator_logo_url"),
            meta={"route_id": rt["_id"]},
        ))

    # ── 8. Car rentals ─────────────────────────────────────────────────────
    cars_cursor = db.car_rentals.find(
        {"$or": [
            {"vehicle_name": rx}, {"name": rx}, {"model": rx},
            {"make": rx}, {"city": rx}, {"vehicle_type": rx},
            {"category": rx}, {"operator_name": rx},
        ]},
        {"_id": 1, "vehicle_name": 1, "name": 1, "make": 1, "model": 1, "city": 1,
         "vehicle_type": 1, "category": 1, "daily_rate": 1, "price_per_day": 1,
         "image_url": 1, "images": 1, "operator_name": 1},
    ).limit(5)
    async for v in cars_cursor:
        label = v.get("vehicle_name") or v.get("name") or f"{v.get('make','')} {v.get('model','')}".strip() or "Car"
        rate = v.get("daily_rate") or v.get("price_per_day")
        results.append(_row(
            type_="car_rental",
            label=label,
            subtitle=f"Car rental · {v.get('city', 'Unknown')}"
                     + (f" · {v.get('vehicle_type') or v.get('category')}" if (v.get("vehicle_type") or v.get("category")) else "")
                     + (f" · {int(rate):,} FCFA/day" if rate else ""),
            deep_link=f"/services/car-rental/details/{v['_id']}",
            icon="Car", color="#10B981",
            thumbnail=(v.get("image_url") or (v.get("images") or [None])[0]),
            meta={"vehicle_id": v["_id"], "city": v.get("city")},
        ))

    # ── 9. Banquet venues ──────────────────────────────────────────────────
    banquet_cursor = db.banquets.find(
        {"$or": [
            {"name": rx}, {"city": rx}, {"venue_type": rx},
            {"category": rx}, {"operator_name": rx},
        ]},
        {"_id": 1, "name": 1, "city": 1, "venue_type": 1, "category": 1,
         "capacity": 1, "max_capacity": 1, "base_price": 1, "image_url": 1, "images": 1},
    ).limit(5)
    async for b in banquet_cursor:
        cap = b.get("capacity") or b.get("max_capacity")
        results.append(_row(
            type_="banquet",
            label=b.get("name", "Venue"),
            subtitle=f"Venue · {b.get('city', 'Unknown')}"
                     + (f" · {b.get('venue_type') or b.get('category')}" if (b.get("venue_type") or b.get("category")) else "")
                     + (f" · cap. {cap}" if cap else ""),
            deep_link=f"/services/banquet/results?city={b.get('city', '')}",
            icon="PartyPopper", color="#14B8A6",
            thumbnail=(b.get("image_url") or (b.get("images") or [None])[0]),
            meta={"venue_id": b["_id"], "city": b.get("city")},
        ))

    # ── 10. Laundry / Pressing ─────────────────────────────────────────────
    pressing_cursor = db.pressings.find(
        {"$or": [
            {"name": rx}, {"city": rx}, {"shop_type": rx}, {"address": rx},
            {"operator_name": rx},
        ]},
        {"_id": 1, "name": 1, "city": 1, "shop_type": 1,
         "price_per_kg": 1, "image_url": 1, "images": 1, "operator_name": 1},
    ).limit(5)
    async for p in pressing_cursor:
        price = p.get("price_per_kg")
        results.append(_row(
            type_="laundry",
            label=p.get("name", "Pressing"),
            subtitle=f"Laundry · {p.get('city', 'Unknown')}"
                     + (f" · {p.get('shop_type')}" if p.get("shop_type") else "")
                     + (f" · {int(price):,} FCFA/kg" if price else ""),
            deep_link=f"/services/laundry/results?city={p.get('city', '')}",
            icon="Shirt", color="#0EA5E9",
            thumbnail=(p.get("image_url") or (p.get("images") or [None])[0]),
            meta={"pressing_id": p["_id"], "city": p.get("city"),
                  "operator_name": p.get("operator_name")},
        ))

    # ── 11. Admin-only: users + orders ─────────────────────────────────────
    if current_user.get("role") in ("admin", "super_admin"):
        users_cursor = db.users.find(
            {"$or": [
                {"email": rx}, {"full_name": rx},
                {"first_name": rx}, {"last_name": rx}, {"phone": rx},
            ]},
            {"_id": 1, "email": 1, "full_name": 1, "first_name": 1, "last_name": 1, "role": 1},
        ).limit(5)
        async for u in users_cursor:
            name = (u.get("full_name") or
                    f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or
                    u.get("email", "User"))
            results.append(_row(
                type_="user",
                label=name,
                subtitle=f"{(u.get('role') or 'customer').replace('_', ' ').title()} · {u.get('email', '')}",
                deep_link=f"/admin/users?search={u.get('email', '')}",
                icon="User", color="#64748B",
                meta={"user_id": u["_id"], "email": u.get("email")},
            ))

        orders_cursor = db.orders.find(
            {"$or": [{"order_number": rx}, {"_id": rx}, {"service_name": rx}]},
            {"_id": 1, "order_number": 1, "service_type": 1, "service_name": 1,
             "status": 1, "total_amount": 1, "currency": 1},
        ).limit(5)
        async for o in orders_cursor:
            ref = o.get("order_number") or o["_id"][:8].upper()
            amt = o.get("total_amount")
            results.append(_row(
                type_="order",
                label=f"Order #{ref}",
                subtitle=f"{(o.get('service_type') or 'Service').title()} · {o.get('status', 'pending')}"
                         + (f" · {int(amt):,} {o.get('currency') or 'FCFA'}" if amt else ""),
                deep_link=f"/orders?search={ref}",
                icon="Receipt", color="#9575CD",
                meta={"order_id": o["_id"], "status": o.get("status")},
            ))

    # ── Relevance sort ─────────────────────────────────────────────────────
    q_lower = query.lower()

    def relevance(item):
        label = (item.get("label") or "").lower()
        if label == q_lower:
            return 0
        if label.startswith(q_lower):
            return 1
        if q_lower in label:
            return 2
        return 3

    results.sort(key=relevance)

    # Group by type for the "View all" modal sections.
    by_type: dict[str, list] = {}
    for r in results:
        by_type.setdefault(r["type"], []).append(r)

    return {
        "query": q,
        "results": results[:limit],
        "total": len(results),
        "by_type": {k: v for k, v in by_type.items()},
    }


@router.get("/suggestions")
async def search_suggestions(
    q: Optional[str] = Query(None, max_length=50),
):
    """Lightweight suggestions used by the search omnibar to render quick chips.

    Returns up to 8 popular locations + service-type shortcuts that match the
    optional `q` filter. No auth required.
    """
    q_lower = (q or "").strip().lower()
    locations = [
        loc for loc in LOCATIONS
        if not q_lower or re.search(_ai_pattern(q_lower), loc, re.IGNORECASE)
    ][:8]
    return {"locations": locations}

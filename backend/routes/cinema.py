from fastapi import APIRouter, HTTPException, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_any_permission
from models.cinema import CinemaCreate, CinemaUpdate, CinemaStatus, FilmStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/cinema", tags=["Cinema"])

# Cinema Management
@router.post("/")
async def create_cinema(
    cinema_data: CinemaCreate,
    current_user: dict = Depends(require_any_permission(["cinema.create", "operator.services.create"]))
):
    """Create a new cinema - requires cinema.create permission"""
    db = get_database()
    
    operator_id = cinema_data.operator_id or current_user.get("operator_id")
    operator_name = cinema_data.operator_name or current_user.get("operator_name", "")
    
    cinema = {
        "_id": str(uuid.uuid4()),
        **cinema_data.dict(exclude={"operator_id", "operator_name"}),
        "operator_id": operator_id,
        "operator_name": operator_name,
        "status": CinemaStatus.ACTIVE,
        "rating": 0,
        "total_reviews": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.cinemas.insert_one(cinema)
    
    return {"message": "Cinema created", "cinema_id": cinema["_id"]}

@router.get("/")
async def get_cinemas(
    city: Optional[str] = None,
    country: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get cinemas - optionally filtered by country via operator"""
    db = get_database()
    
    query = {"status": CinemaStatus.ACTIVE}
    if operator_id:
        query["operator_id"] = operator_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    # Apply country filter via operator lookup (cinemas has no country field)
    if country:
        from utils.location_filter import get_operator_country_filter
        op_filter = await get_operator_country_filter(db, country)
        query.update(op_filter)
    
    cinemas = await db.cinemas.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.cinemas.count_documents(query)
    
    # Transform _id to id for each cinema
    for cinema in cinemas:
        cinema["id"] = str(cinema.pop("_id", ""))
    
    return {"cinemas": cinemas, "total": total}

@router.get("/films")
async def get_films(
    status: Optional[str] = None,
    genre: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get films. When `city` is provided, only films that have at least one showtime
    in a cinema located in that city are returned (case-insensitive match on cinema.city)."""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if genre:
        # Genres are stored as a list — match if any genre tag equals/contains the requested value
        query["genre"] = {"$regex": f"^{genre}$", "$options": "i"}

    # City filter: derive the set of film_ids that have showtimes in a cinema in that city
    if city:
        cinema_ids_in_city = await db.cinemas.distinct(
            "_id",
            {"city": {"$regex": f"^{city}$", "$options": "i"}}
        )
        film_ids_in_city = []
        if cinema_ids_in_city:
            film_ids_in_city = await db.showtimes.distinct(
                "film_id",
                {"cinema_id": {"$in": cinema_ids_in_city}}
            )
        if film_ids_in_city:
            query["_id"] = {"$in": film_ids_in_city}
        else:
            # No films play in this city right now → return empty result fast
            return {"films": [], "total": 0}
    
    films_list = []
    for f in await db.films.find(query).sort("title", 1).skip(skip).limit(limit).to_list(limit):
        f["id"] = str(f.pop("_id", ""))
        films_list.append(f)
    total = await db.films.count_documents(query)

    # Enrich each film with `cinema_names` (unique cinema names where it's playing)
    # and `price_from` (min showtime price). If `city` is set, restrict the
    # showtime lookup to cinemas in that city so the user sees only relevant venues.
    if films_list:
        film_ids = [f["id"] for f in films_list]
        showtime_query = {"film_id": {"$in": film_ids}, "is_active": {"$ne": False}}
        if city:
            # Reuse cinema_ids_in_city if we computed it above; otherwise compute now.
            try:
                cinema_ids_filter = cinema_ids_in_city  # noqa: F821 — defined when city is set
            except NameError:
                cinema_ids_filter = await db.cinemas.distinct(
                    "_id", {"city": {"$regex": f"^{city}$", "$options": "i"}}
                )
            showtime_query["cinema_id"] = {"$in": cinema_ids_filter}

        showtimes = await db.showtimes.find(
            showtime_query,
            {"_id": 1, "film_id": 1, "cinema_id": 1, "cinema_name": 1, "price": 1, "total_seats": 1, "show_date": 1, "show_time": 1},
        ).to_list(2000)

        # Build a cinema_id → name lookup for showtimes missing cinema_name.
        missing_cinema_ids = {s["cinema_id"] for s in showtimes if not s.get("cinema_name") and s.get("cinema_id")}
        cinema_name_by_id = {}
        if missing_cinema_ids:
            async for c in db.cinemas.find(
                {"_id": {"$in": list(missing_cinema_ids)}}, {"name": 1}
            ):
                cinema_name_by_id[c["_id"]] = c.get("name")

        # Compute LIVE available_seats per showtime (mirrors /films/{id}/showtimes
        # logic). We count seats actively held in BOTH the legacy
        # `cinema_bookings` and the new unified `orders` pipelines, so the
        # "min_available_seats" surfaced on the film card matches reality.
        # We restrict the live count to UPCOMING showtimes (show_date >= today)
        # — past showtimes never trigger a "selling out" sticker.
        today_iso = datetime.utcnow().date().isoformat()
        upcoming_showtime_ids = [
            s["_id"] for s in showtimes
            if s.get("_id") and (s.get("show_date") or "") >= today_iso
        ]
        booked_count = {sid: 0 for sid in upcoming_showtime_ids}
        if upcoming_showtime_ids:
            async for b in db.cinema_bookings.find(
                {"showtime_id": {"$in": upcoming_showtime_ids},
                 "status": {"$in": ["reserved", "confirmed", "paid"]}},
                {"_id": 0, "showtime_id": 1, "seats": 1},
            ):
                booked_count[b["showtime_id"]] = booked_count.get(b["showtime_id"], 0) + len(b.get("seats") or [])
            async for o in db.orders.find(
                {"service_type": "cinema",
                 "booking_details.showtime_id": {"$in": upcoming_showtime_ids},
                 "status": {"$nin": ["cancelled", "abandoned", "failed"]}},
                {"_id": 0, "booking_details.showtime_id": 1, "booking_details.seats": 1},
            ):
                bd = o.get("booking_details") or {}
                sid = bd.get("showtime_id")
                if sid in booked_count:
                    booked_count[sid] = booked_count.get(sid, 0) + len(bd.get("seats") or [])

        # Aggregate per film
        by_film = {fid: {"cinemas": set(), "min_price": None, "min_avail": None} for fid in film_ids}
        for s in showtimes:
            fid = s.get("film_id")
            if fid not in by_film:
                continue
            cname = s.get("cinema_name") or cinema_name_by_id.get(s.get("cinema_id"))
            if cname:
                by_film[fid]["cinemas"].add(cname)
            price = s.get("price")
            if price is not None:
                try:
                    p = float(price)
                    cur = by_film[fid]["min_price"]
                    if cur is None or p < cur:
                        by_film[fid]["min_price"] = p
                except (TypeError, ValueError):
                    pass
            # min_available_seats — only consider upcoming showtimes
            sid = s.get("_id")
            if sid in booked_count:
                total = int(s.get("total_seats") or 0)
                avail = max(0, total - booked_count.get(sid, 0))
                cur_avail = by_film[fid]["min_avail"]
                if cur_avail is None or avail < cur_avail:
                    by_film[fid]["min_avail"] = avail

        for f in films_list:
            agg = by_film.get(f["id"], {})
            f["cinema_names"] = sorted(agg.get("cinemas") or [])
            if agg.get("min_price") is not None:
                f["price_from"] = agg["min_price"]
            if agg.get("min_avail") is not None:
                f["min_available_seats"] = agg["min_avail"]

        # Enrich each film with the **customer rating** aggregated from the
        # /api/ratings endpoint (entity_type='film'). This is the rating the
        # public results page should surface instead of `imdb_rating` (which is
        # an editorial / catalogue value entered by the operator).
        rating_agg = await db.ratings.aggregate([
            {"$match": {"entity_type": "film", "entity_id": {"$in": film_ids}}},
            {"$group": {"_id": "$entity_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
        ]).to_list(len(film_ids))
        rating_by_film = {r["_id"]: r for r in rating_agg}
        for f in films_list:
            r = rating_by_film.get(f["id"])
            if r and r.get("count"):
                f["customer_rating"] = round(float(r["avg"]), 1)
                f["customer_rating_count"] = int(r["count"])
            else:
                f["customer_rating"] = None
                f["customer_rating_count"] = 0

    return {"films": films_list, "total": total}

@router.get("/films/{film_id}")
async def get_film(film_id: str):
    """Get film details"""
    db = get_database()
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")
    film["id"] = film.pop("_id")
    # Inline customer-rating aggregation so FilmDetails can display it too.
    rating_agg = await db.ratings.aggregate([
        {"$match": {"entity_type": "film", "entity_id": film["id"]}},
        {"$group": {"_id": "$entity_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    if rating_agg:
        film["customer_rating"] = round(float(rating_agg[0]["avg"]), 1)
        film["customer_rating_count"] = int(rating_agg[0]["count"])
    else:
        film["customer_rating"] = None
        film["customer_rating_count"] = 0
    return film


@router.get("/films/{film_id}/showtimes")
async def get_film_showtimes(film_id: str, city: Optional[str] = None):
    """Public: list every ACTIVE showtime for a film across every cinema, enriched
    with cinema_name + screen_type. Used by the customer-facing
    /services/cinema/film/{id} page to render the showtime ladder grouped by date.
    Soft-deleted showtimes (is_active=False) are excluded.
    """
    db = get_database()

    # Verify film exists (avoid leaking the public showtime stream for unknown ids).
    film = await db.films.find_one({"_id": film_id}, {"_id": 1})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")

    query = {
        "film_id": film_id,
        "is_active": {"$ne": False},
        # Defensive: never surface rows with missing required fields to
        # customers — they cannot be booked and look like fictive entries.
        "price": {"$ne": None, "$exists": True},
        "screen_name": {"$nin": [None, ""], "$exists": True},
        "show_date": {"$nin": [None, ""], "$exists": True},
        "show_time": {"$nin": [None, ""], "$exists": True},
        "end_time": {"$nin": [None, ""], "$exists": True},
    }

    # Optional city scope
    if city:
        cinema_ids_in_city = await db.cinemas.distinct(
            "_id", {"city": {"$regex": f"^{city}$", "$options": "i"}}
        )
        if not cinema_ids_in_city:
            return {"showtimes": [], "total": 0}
        query["cinema_id"] = {"$in": cinema_ids_in_city}

    showtimes = await db.showtimes.find(query).sort(
        [("show_date", 1), ("show_time", 1)]
    ).to_list(1000)

    # Backfill cinema_name where missing.
    missing_cinema_ids = {
        s["cinema_id"] for s in showtimes if not s.get("cinema_name") and s.get("cinema_id")
    }
    cinema_lookup = {}
    if missing_cinema_ids:
        async for c in db.cinemas.find(
            {"_id": {"$in": list(missing_cinema_ids)}}, {"name": 1, "city": 1}
        ):
            cinema_lookup[c["_id"]] = {"name": c.get("name"), "city": c.get("city")}

    # Compute live `available_seats` for every showtime in ONE round-trip per
    # source collection. Counting seats actively held by orders/bookings is
    # the source of truth — the stored `available_seats` field drifts when
    # abandoned/cancelled orders are deleted, so we deliberately ignore it.
    showtime_ids = [s.get("_id") for s in showtimes if s.get("_id")]
    booked_count = {sid: 0 for sid in showtime_ids}
    if showtime_ids:
        # (a) Legacy /cinema/.../book bookings live in `cinema_bookings`.
        async for b in db.cinema_bookings.find(
            {"showtime_id": {"$in": showtime_ids},
             "status": {"$in": ["reserved", "confirmed", "paid"]}},
            {"_id": 0, "showtime_id": 1, "seats": 1},
        ):
            booked_count[b["showtime_id"]] = booked_count.get(b["showtime_id"], 0) + len(b.get("seats") or [])
        # (b) New unified orders pipeline stores seats under booking_details.
        async for o in db.orders.find(
            {"service_type": "cinema",
             "booking_details.showtime_id": {"$in": showtime_ids},
             "status": {"$nin": ["cancelled", "abandoned", "failed"]}},
            {"_id": 0, "booking_details.showtime_id": 1, "booking_details.seats": 1},
        ):
            bd = o.get("booking_details") or {}
            sid = bd.get("showtime_id")
            if sid in booked_count:
                booked_count[sid] = booked_count.get(sid, 0) + len(bd.get("seats") or [])

    for s in showtimes:
        raw_id = s.pop("_id", None)
        s["id"] = str(raw_id) if raw_id is not None else None
        if not s.get("cinema_name"):
            lk = cinema_lookup.get(s.get("cinema_id"))
            if lk:
                s["cinema_name"] = lk["name"]
                s.setdefault("cinema_city", lk["city"])
        # Recompute available_seats from the live booked tally.
        taken = booked_count.get(raw_id, 0)
        total = int(s.get("total_seats") or 0)
        s["available_seats"] = max(0, total - taken)
        s["booked_seats_count"] = taken

    return {"showtimes": showtimes, "total": len(showtimes)}


@router.get("/{cinema_id}")
async def get_cinema(cinema_id: str):
    """Get cinema details"""
    db = get_database()
    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    cinema["id"] = cinema.pop("_id")
    return cinema

@router.put("/{cinema_id}")
async def update_cinema(
    cinema_id: str,
    cinema_data: CinemaUpdate,
    current_user: dict = Depends(require_any_permission(["cinema.edit", "operator.services.edit"]))
):
    """Update a cinema - requires cinema.edit permission"""
    db = get_database()
    
    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    
    if current_user["role"] == "operator" and cinema["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in cinema_data.dict().items() if v is not None}
    
    if current_user["role"] == "operator":
        # Operators cannot reassign their cinemas to another operator
        update_data.pop("operator_id", None)
        update_data.pop("operator_name", None)
        update_data.pop("status", None)
        if {k for k in update_data if k not in ("updated_at",)}:
            update_data["status"] = "pending"
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.cinemas.update_one({"_id": cinema_id}, {"$set": update_data})
    
    return {"message": "Cinema updated"}

@router.delete("/{cinema_id}")
async def delete_cinema(
    cinema_id: str,
    current_user: dict = Depends(require_any_permission(["cinema.delete", "operator.services.delete"]))
):
    """Delete a cinema - requires cinema.delete permission"""
    db = get_database()
    
    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    
    if current_user["role"] == "operator" and cinema["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.cinemas.delete_one({"_id": cinema_id})
    
    return {"message": "Cinema deleted"}

# Films
@router.post("/films")
async def create_film(
    title: str,
    duration_minutes: int,
    genre: List[str] = Query(default_factory=list),
    description: Optional[str] = None,
    language: str = "English",
    subtitles: List[str] = Query(default_factory=list),
    rating: str = "PG",
    director: Optional[str] = None,
    cast: List[str] = Query(default_factory=list),
    poster_url: Optional[str] = None,
    trailer_url: Optional[str] = None,
    release_date: Optional[str] = None,
    status: Optional[str] = None,
    imdb_rating: Optional[float] = None,
    operator_id: Optional[str] = None,
    operator_name: Optional[str] = None,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "cinema.create"]))
):
    """Create a new film - requires cinema.manage_screenings permission"""
    db = get_database()
    
    # Operators can only assign films to themselves; admins can pick any operator
    effective_operator_id = operator_id
    effective_operator_name = operator_name
    if current_user.get("role") not in ("admin", "super_admin"):
        effective_operator_id = current_user.get("operator_id")
        effective_operator_name = current_user.get("operator_name") or operator_name

    film = {
        "_id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "genre": genre,
        "duration_minutes": duration_minutes,
        "language": language,
        "subtitles": subtitles,
        "rating": rating,
        "director": director,
        "cast": cast,
        "poster_url": poster_url,
        "trailer_url": trailer_url,
        "release_date": release_date,
        "imdb_rating": imdb_rating,
        "status": status or FilmStatus.NOW_SHOWING,
        "operator_id": effective_operator_id,
        "operator_name": effective_operator_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.films.insert_one(film)
    
    return {"message": "Film created", "film_id": film["_id"]}


@router.put("/films/{film_id}")
async def update_film(
    film_id: str,
    title: Optional[str] = None,
    duration_minutes: Optional[int] = None,
    genre: Optional[List[str]] = Query(default=None),
    description: Optional[str] = None,
    language: Optional[str] = None,
    rating: Optional[str] = None,
    director: Optional[str] = None,
    cast: Optional[List[str]] = Query(default=None),
    poster_url: Optional[str] = None,
    trailer_url: Optional[str] = None,
    release_date: Optional[str] = None,
    imdb_rating: Optional[float] = None,
    status: Optional[str] = None,
    operator_id: Optional[str] = None,
    operator_name: Optional[str] = None,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "cinema.edit"]))
):
    """Update a film"""
    db = get_database()
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")

    # Operators cannot reassign their films to another operator
    is_operator = current_user.get("role") == "operator"
    if is_operator and film.get("operator_id") and film["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {}
    for field, value in [("title", title), ("duration_minutes", duration_minutes), ("genre", genre),
                         ("description", description), ("language", language), ("rating", rating),
                         ("director", director), ("cast", cast), ("poster_url", poster_url),
                         ("trailer_url", trailer_url), ("release_date", release_date),
                         ("imdb_rating", imdb_rating), ("status", status),
                         ("operator_id", operator_id), ("operator_name", operator_name)]:
        if value is not None:
            update_data[field] = value

    if is_operator:
        # Strip operator reassignment attempts from non-admins
        update_data.pop("operator_id", None)
        update_data.pop("operator_name", None)

    update_data["updated_at"] = datetime.utcnow()
    await db.films.update_one({"_id": film_id}, {"$set": update_data})
    return {"message": "Film updated"}


# Showtimes
@router.post("/{cinema_id}/showtimes")
async def create_showtime(
    cinema_id: str,
    film_id: str,
    screen_name: str,
    show_date: str,
    show_time: str,
    end_time: str,
    price: float,
    screen_type: str = "2d",
    vip_price: Optional[float] = None,
    child_price: Optional[float] = None,
    senior_price: Optional[float] = None,
    total_seats: int = 100,
    refund_policy_preset: Optional[str] = None,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "operator.services.edit"]))
):
    """Create a showtime - requires cinema.manage_screenings permission"""
    db = get_database()
    
    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    
    if current_user["role"] == "operator" and cinema["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")

    # Idempotency: refuse to create a row that already exists for the same
    # (cinema, film, screen, date, time) — prevents duplicates when an admin
    # double-clicks "Schedule" or retries a partially-failed recurring batch.
    existing = await db.showtimes.find_one({
        "cinema_id": cinema_id,
        "film_id": film_id,
        "screen_name": screen_name,
        "show_date": show_date,
        "show_time": show_time,
        "is_active": {"$ne": False},
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A showtime already exists for {screen_name} on {show_date} at {show_time}",
        )

    showtime = {
        "_id": str(uuid.uuid4()),
        "cinema_id": cinema_id,
        "film_id": film_id,
        "film_title": film["title"],
        "screen_name": screen_name,
        "screen_type": screen_type,
        "show_date": show_date,
        "show_time": show_time,
        "end_time": end_time,
        "price": price,
        "vip_price": vip_price,
        "child_price": child_price,
        "senior_price": senior_price,
        "total_seats": total_seats,
        "available_seats": total_seats,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    if refund_policy_preset:
        showtime["refund_policy"] = {"preset": refund_policy_preset}
    # Copy seat_layout from the cinema's screen (if defined) so the booking
    # page can render the exact visual layout the operator configured.
    for s in (cinema.get("screens") or []):
        if (s.get("name") == screen_name) and s.get("seat_layout"):
            showtime["seat_layout"] = s["seat_layout"]
            break
    
    await db.showtimes.insert_one(showtime)
    
    return {"message": "Showtime created", "showtime_id": showtime["_id"]}

@router.get("/{cinema_id}/showtimes")
async def get_showtimes(
    cinema_id: str,
    date: Optional[str] = None,
    film_id: Optional[str] = None
):
    """Get showtimes for a cinema"""
    db = get_database()
    
    query = {"cinema_id": cinema_id, "is_active": True}
    if date:
        query["show_date"] = date
    if film_id:
        query["film_id"] = film_id
    
    showtimes = await db.showtimes.find(query).sort("show_time", 1).to_list(100)
    for s in showtimes:
        s["id"] = s.pop("_id", "")
    
    return {"showtimes": showtimes}

@router.get("/showtimes/operator")
async def list_operator_showtimes(
    cinema_id: Optional[str] = None,
    date: Optional[str] = None,
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """List all showtimes for the current operator (or all if admin). Returns IDs."""
    if current_user["role"] not in ("operator", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_database()
    cinema_query = {}
    if current_user["role"] == "operator":
        cinema_query["operator_id"] = current_user.get("operator_id")
    elif operator_id:
        # Admin override: scope to a specific operator
        cinema_query["operator_id"] = operator_id
    if cinema_id:
        cinema_query["_id"] = cinema_id
    cinema_ids = await db.cinemas.distinct("_id", cinema_query)

    query = {"cinema_id": {"$in": cinema_ids}}
    if date:
        query["show_date"] = date
    showtimes = await db.showtimes.find(query).sort([("show_date", 1), ("show_time", 1)]).to_list(500)

    # Build a quick lookup so each showtime carries its cinema_name (older records may be missing it)
    cinemas_map = {}
    if cinema_ids:
        async for c in db.cinemas.find({"_id": {"$in": cinema_ids}}, {"name": 1, "city": 1}):
            cinemas_map[c["_id"]] = {"name": c.get("name"), "city": c.get("city")}

    for s in showtimes:
        s["id"] = s.pop("_id", None)
        cm = cinemas_map.get(s.get("cinema_id"))
        if cm:
            # Only fill when missing — don't clobber existing values
            s.setdefault("cinema_name", cm["name"])
            s.setdefault("cinema_city", cm["city"])
    return {"showtimes": showtimes, "total": len(showtimes)}


@router.put("/showtimes/{showtime_id}")
async def update_showtime(
    showtime_id: str,
    body: dict,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "operator.services.edit"]))
):
    """Update an existing showtime (price, time, screen, film, active flag, capacity)."""
    db = get_database()
    st = await db.showtimes.find_one({"_id": showtime_id})
    if not st:
        raise HTTPException(status_code=404, detail="Showtime not found")
    cinema = await db.cinemas.find_one({"_id": st["cinema_id"]}, {"operator_id": 1})
    if (
        current_user["role"] == "operator"
        and cinema
        and cinema.get("operator_id") != current_user.get("operator_id")
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {
        "film_id", "film_title", "screen_name", "screen_type",
        "show_date", "show_time", "end_time",
        "price", "vip_price", "child_price", "senior_price",
        "total_seats", "is_active",
        "refund_policy",
    }
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if "film_id" in updates and "film_title" not in updates:
        film = await db.films.find_one({"_id": updates["film_id"]}, {"title": 1})
        if film:
            updates["film_title"] = film.get("title")
    updates["updated_at"] = datetime.utcnow()
    await db.showtimes.update_one({"_id": showtime_id}, {"$set": updates})
    return {"message": "Showtime updated", "showtime_id": showtime_id}


@router.delete("/showtimes/{showtime_id}")
async def delete_showtime(
    showtime_id: str,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "operator.services.edit"]))
):
    """Hard-delete a showtime. Refuses if there are active bookings — operators should use the Replace flow instead."""
    db = get_database()
    st = await db.showtimes.find_one({"_id": showtime_id})
    if not st:
        raise HTTPException(status_code=404, detail="Showtime not found")
    cinema = await db.cinemas.find_one({"_id": st["cinema_id"]}, {"operator_id": 1})
    if (
        current_user["role"] == "operator"
        and cinema
        and cinema.get("operator_id") != current_user.get("operator_id")
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Guard: refuse if any active bookings reference this showtime.
    active_bookings = await db.orders.count_documents({
        "service_type": "cinema",
        "booking_details.showtime_id": showtime_id,
        "status": {"$in": ["pending", "confirmed", "paid"]},
    })
    if active_bookings > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{active_bookings} active booking(s) reference this showtime. "
                "Use 'Replace' to migrate them to another showtime first, then delete."
            ),
        )

    # Hard-delete: remove the showtime document entirely from the collection so
    # it cannot resurface in any listing or aggregation.
    result = await db.showtimes.delete_one({"_id": showtime_id})
    if result.deleted_count == 0:
        # Lost a race against another concurrent delete — treat as 404.
        raise HTTPException(status_code=404, detail="Showtime not found")
    return {
        "message": "Showtime deleted",
        "showtime_id": showtime_id,
        "deleted_count": result.deleted_count,
    }


@router.post("/showtimes")
async def create_showtime_body(
    body: dict,
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "operator.services.edit"])),
):
    """Body-based showtime creation (preferred over the legacy query-param form).

    Expected body: {cinema_id, film_id, screen_name, show_date, show_time,
                    end_time, price, screen_type?, vip_price?, total_seats?}
    """
    db = get_database()
    cinema_id = body.get("cinema_id")
    film_id = body.get("film_id")
    if not cinema_id or not film_id:
        raise HTTPException(status_code=400, detail="cinema_id and film_id are required")

    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    if (
        current_user["role"] == "operator"
        and cinema.get("operator_id") != current_user.get("operator_id")
    ):
        raise HTTPException(status_code=403, detail="Not authorized")
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")

    total_seats = int(body.get("total_seats", 100))
    st = {
        "_id": str(uuid.uuid4()),
        "cinema_id": cinema_id,
        "cinema_name": cinema.get("name"),
        "film_id": film_id,
        "film_title": film.get("title"),
        "screen_name": body.get("screen_name"),
        "screen_type": body.get("screen_type", "2d"),
        "show_date": body.get("show_date"),
        "show_time": body.get("show_time"),
        "end_time": body.get("end_time"),
        "price": float(body.get("price", 0)),
        "vip_price": body.get("vip_price"),
        "total_seats": total_seats,
        # Informational only — read path computes live availability.
        "available_seats": total_seats,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    if body.get("refund_policy"):
        st["refund_policy"] = body.get("refund_policy")
    # Copy seat_layout from the cinema's matching screen (if any) so
    # CinemaBooking.jsx can render the same visual layout the operator built.
    for s in (cinema.get("screens") or []):
        if (s.get("name") == body.get("screen_name")) and s.get("seat_layout"):
            st["seat_layout"] = s["seat_layout"]
            break
    await db.showtimes.insert_one(st)
    return {"message": "Showtime created", "showtime_id": st["_id"]}


@router.get("/showtimes/{showtime_id}/details")
async def get_showtime_details(showtime_id: str):
    """Public endpoint: returns one showtime + film + cinema + booked seats so
    the booking page can render the seat map and order summary in a single
    network roundtrip."""
    db = get_database()
    st = await db.showtimes.find_one({"_id": showtime_id})
    if not st:
        raise HTTPException(status_code=404, detail="Showtime not found")
    film = await db.films.find_one({"_id": st.get("film_id")}, {"_id": 0}) if st.get("film_id") else None
    cinema = await db.cinemas.find_one({"_id": st.get("cinema_id")}) if st.get("cinema_id") else None

    # If the showtime didn't carry a seat_layout (legacy rows), fall back to
    # the cinema's matching screen layout. Additionally, always overlay the
    # cinema screen's vip_rows when present — vip_rows is configured on the
    # screen (not the showtime), so it's authoritative.
    seat_layout = st.get("seat_layout")
    if cinema:
        matching_screen = next(
            (s for s in (cinema.get("screens") or []) if s.get("name") == st.get("screen_name")),
            None,
        )
        if matching_screen:
            screen_layout = matching_screen.get("seat_layout") or {}
            if not seat_layout:
                seat_layout = screen_layout
            else:
                # Overlay vip_rows from the cinema screen if the showtime layout
                # doesn't have them (or has an empty list).
                cinema_vip_rows = screen_layout.get("vip_rows") or []
                if cinema_vip_rows and not (seat_layout.get("vip_rows") or []):
                    seat_layout = {**seat_layout, "vip_rows": cinema_vip_rows}

    # Aggregate booked / reserved seats for this showtime — from BOTH the
    # legacy cinema_bookings collection AND the new unified orders pipeline.
    booked_seats: list = []
    async for b in db.cinema_bookings.find(
        {"showtime_id": showtime_id, "status": {"$in": ["reserved", "confirmed", "paid"]}},
        {"_id": 0, "seats": 1},
    ):
        booked_seats.extend(b.get("seats", []) or [])
    async for o in db.orders.find(
        {"service_type": "cinema",
         "booking_details.showtime_id": showtime_id,
         "status": {"$nin": ["cancelled", "abandoned", "failed"]}},
        {"_id": 0, "booking_details.seats": 1},
    ):
        booked_seats.extend(((o.get("booking_details") or {}).get("seats") or []))
    booked_seats = sorted(set(booked_seats))

    total_seats_val = int(st.get("total_seats") or 0)
    showtime_out = {
        "id": st.get("_id"),
        "cinema_id": st.get("cinema_id"),
        "cinema_name": cinema.get("name") if cinema else st.get("cinema_name"),
        "city": cinema.get("city") if cinema else None,
        "film_id": st.get("film_id"),
        "film_title": st.get("film_title"),
        "screen_name": st.get("screen_name"),
        "screen_type": st.get("screen_type", "2d"),
        "show_date": st.get("show_date"),
        "show_time": st.get("show_time"),
        "end_time": st.get("end_time"),
        "price": st.get("price"),
        "vip_price": st.get("vip_price"),
        "child_price": st.get("child_price"),
        "senior_price": st.get("senior_price"),
        "total_seats": total_seats_val,
        # Live availability — drift-free, derived from the live booking tally.
        "available_seats": max(0, total_seats_val - len(booked_seats)),
    }

    return {
        "showtime": showtime_out,
        "film": film,
        "seat_layout": seat_layout,
        "booked_seats": booked_seats,
    }


@router.post("/showtimes/{showtime_id}/book")
async def book_cinema_seats(
    showtime_id: str,
    seats: List[str],
    current_user: dict = Depends(get_current_active_user)
):
    """Book cinema seats"""
    db = get_database()
    
    showtime = await db.showtimes.find_one({"_id": showtime_id})
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")
    
    # Get film and cinema details for order
    film = await db.films.find_one({"_id": showtime["film_id"]})
    cinema = await db.cinemas.find_one({"_id": showtime["cinema_id"]})
    
    # Check seat availability
    booked = await db.cinema_bookings.find({
        "showtime_id": showtime_id,
        "seats": {"$in": seats},
        "status": {"$in": ["reserved", "confirmed"]}
    }).to_list(100)
    
    if booked:
        taken = set()
        for b in booked:
            taken.update(b.get("seats", []))
        raise HTTPException(status_code=400, detail=f"Seats already taken: {', '.join(taken & set(seats))}")
    
    # Compute total price with VIP/regular split. When the showtime has a
    # `vip_price` AND its screen's seat_layout marks one or more rows as VIP,
    # seats whose row letter is in `vip_rows` charge the VIP rate; the rest
    # charge the regular `price`. If either the VIP price or the VIP rows are
    # missing we fall back to a flat regular price (preserves legacy behaviour).
    regular_price = float(showtime.get("price") or 0)
    vip_price_val = showtime.get("vip_price")
    vip_rows = []
    try:
        screen_layout = next(
            (s for s in (cinema.get("screens") or []) if s.get("name") == showtime.get("screen_name")),
            None,
        )
        if screen_layout and isinstance(screen_layout.get("seat_layout"), dict):
            vip_rows = list(screen_layout["seat_layout"].get("vip_rows") or [])
    except Exception:  # noqa: BLE001 — never let pricing break booking
        vip_rows = []

    vip_set = {str(r).upper() for r in vip_rows}
    use_vip_pricing = bool(vip_set) and vip_price_val is not None
    seat_breakdown = []
    total_price = 0.0
    for seat in seats:
        # Seat ids look like "A12" — the leading non-digit prefix is the row.
        row_letter = "".join(ch for ch in str(seat) if ch.isalpha()).upper()
        is_vip = use_vip_pricing and row_letter in vip_set
        unit_price = float(vip_price_val) if is_vip else regular_price
        seat_breakdown.append({"seat": seat, "tier": "vip" if is_vip else "regular", "price": unit_price})
        total_price += unit_price
    booking_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    
    # Generate order number
    order_count = await db.orders.count_documents({"service_category": "cinema"})
    order_number = f"CIN-{order_count + 1:06d}"
    
    # Create service-specific booking
    booking = {
        "_id": booking_id,
        "order_id": order_id,  # Link to central order
        "showtime_id": showtime_id,
        "cinema_id": showtime["cinema_id"],
        "film_id": showtime["film_id"],
        "user_id": current_user["_id"],
        "seats": seats,
        "seat_breakdown": seat_breakdown,
        "total_price": total_price,
        "status": "reserved",
        "payment_status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await db.cinema_bookings.insert_one(booking)
    
    # Create central order record
    order = {
        "_id": order_id,
        "order_number": order_number,
        "service_category": "cinema",
        "service_booking_id": booking_id,  # Link back to service booking
        "service_name": f"Cinema - {film.get('title', 'Film')} at {cinema.get('name', 'Cinema')}",
        "service_id": showtime["cinema_id"],
        "user_id": current_user["_id"],
        "operator_id": cinema.get("operator_id") if cinema else None,
        "operator_name": cinema.get("operator_name") if cinema else None,
        "total_amount": total_price,
        "currency": "XAF",
        "status": "pending",
        "payment_status": "pending",
        "booking_details": {
            "showtime_id": showtime_id,
            "seats": seats,
            "seat_breakdown": seat_breakdown,
            "show_date": showtime.get("date"),
            "show_time": showtime.get("time"),
            "film_title": film.get("title") if film else None
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)

    # NOTE: We deliberately do NOT $inc available_seats on the showtime
    # document. The read path (GET /films/{id}/showtimes and
    # GET /showtimes/{id}) computes `available_seats` live from the union
    # of cinema_bookings + orders, which is drift-free against abandoned /
    # cancelled / deleted orders. Mutating the stored field here would
    # cause double-counting and stale-restore bugs.

    return {
        "message": "Seats reserved",
        "booking_id": booking_id,
        "order_id": order_id,
        "order_number": order_number,
        "total_price": total_price,
        "seats": seats
    }

@router.get("/bookings/my")
async def get_my_cinema_bookings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's cinema bookings"""
    db = get_database()
    
    bookings = await db.cinema_bookings.find(
        {"user_id": current_user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.cinema_bookings.count_documents({"user_id": current_user["_id"]})
    
    return {"bookings": bookings, "total": total}



@router.get("/management/my-cinemas")
async def get_my_cinemas(
    search: Optional[str] = None,
    city: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get cinemas for the current user's operator (operator-scoped).
    Super admin and admin can see all cinemas.
    Operator users can only see cinemas belonging to their operator.
    """
    from middleware.auth import get_operator_filter
    
    db = get_database()
    
    # Build base query with operator filter
    query = get_operator_filter(current_user)
    if operator_id and current_user.get("role") in ("super_admin", "admin"):
        query["operator_id"] = operator_id
    
    # Add optional filters
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}}
        ]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    cinemas = await db.cinemas.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.cinemas.count_documents(query)
    
    # Transform _id to id
    for cinema in cinemas:
        cinema["id"] = str(cinema.pop("_id", ""))
    
    return {
        "cinemas": cinemas, 
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"]
    }


@router.get("/management/my-films")
async def get_my_films(
    status: Optional[str] = None,
    genre: Optional[str] = None,
    operator_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get films scoped to the current operator.
    Admin / super_admin can see all films (or filter by an explicit operator_id).
    Operator users only see films belonging to their operator.
    Films without operator_id are surfaced only to admins.
    """
    from middleware.auth import get_operator_filter

    db = get_database()
    query: dict = {}

    if current_user.get("role") in ("super_admin", "admin"):
        if operator_id:
            query["operator_id"] = operator_id
    else:
        op_filter = get_operator_filter(current_user)
        query.update(op_filter)

    if status:
        query["status"] = status
    if genre:
        query["genre"] = genre

    cursor = db.films.find(query).sort("title", 1).skip(skip).limit(limit)
    films_list = []
    for f in await cursor.to_list(limit):
        f["id"] = str(f.pop("_id", ""))
        films_list.append(f)
    total = await db.films.count_documents(query)

    return {
        "films": films_list,
        "total": total,
        "is_operator_scoped": current_user.get("role") not in ["super_admin", "admin"],
    }


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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get films"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if genre:
        query["genre"] = genre
    
    films_list = []
    for f in await db.films.find(query).sort("title", 1).skip(skip).limit(limit).to_list(limit):
        f["id"] = str(f.pop("_id", ""))
        films_list.append(f)
    total = await db.films.count_documents(query)
    
    return {"films": films_list, "total": total}

@router.get("/films/{film_id}")
async def get_film(film_id: str):
    """Get film details"""
    db = get_database()
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")
    film["id"] = film.pop("_id")
    return film

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
    current_user: dict = Depends(require_any_permission(["cinema.manage_screenings", "cinema.edit"]))
):
    """Update a film"""
    db = get_database()
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")
    
    update_data = {}
    for field, value in [("title", title), ("duration_minutes", duration_minutes), ("genre", genre),
                         ("description", description), ("language", language), ("rating", rating),
                         ("director", director), ("cast", cast), ("poster_url", poster_url),
                         ("trailer_url", trailer_url), ("release_date", release_date),
                         ("imdb_rating", imdb_rating), ("status", status)]:
        if value is not None:
            update_data[field] = value
    
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
    total_seats: int = 100,
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
        "total_seats": total_seats,
        "available_seats": total_seats,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
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
    
    showtimes = await db.showtimes.find(query, {"_id": 0}).sort("show_time", 1).to_list(100)
    
    return {"showtimes": showtimes}

@router.get("/showtimes/operator")
async def list_operator_showtimes(
    cinema_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    """List all showtimes for the current operator (or all if admin). Returns IDs."""
    if current_user["role"] not in ("operator", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    db = get_database()
    cinema_query = {}
    if current_user["role"] == "operator":
        cinema_query["operator_id"] = current_user.get("operator_id")
    if cinema_id:
        cinema_query["_id"] = cinema_id
    cinema_ids = await db.cinemas.distinct("_id", cinema_query)

    query = {"cinema_id": {"$in": cinema_ids}}
    if date:
        query["show_date"] = date
    showtimes = await db.showtimes.find(query).sort([("show_date", 1), ("show_time", 1)]).to_list(500)
    for s in showtimes:
        s["id"] = s.pop("_id", None)
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
        "price", "vip_price", "total_seats", "is_active",
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
    """Soft-delete (deactivate) a showtime. Refuses if there are active bookings — operators should use the Replace flow instead."""
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

    await db.showtimes.update_one(
        {"_id": showtime_id},
        {"$set": {"is_active": False, "deleted_at": datetime.utcnow()}},
    )
    return {"message": "Showtime deactivated", "showtime_id": showtime_id}


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
        "available_seats": total_seats,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
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
    # the cinema's matching screen layout.
    seat_layout = st.get("seat_layout")
    if not seat_layout and cinema:
        for s in (cinema.get("screens") or []):
            if s.get("name") == st.get("screen_name") and s.get("seat_layout"):
                seat_layout = s["seat_layout"]
                break

    # Aggregate booked / reserved seats for this showtime
    booked_cursor = db.cinema_bookings.find(
        {"showtime_id": showtime_id, "status": {"$in": ["reserved", "confirmed", "paid"]}},
        {"_id": 0, "seats": 1},
    )
    booked_seats: list = []
    async for b in booked_cursor:
        booked_seats.extend(b.get("seats", []) or [])

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
        "total_seats": st.get("total_seats"),
        "available_seats": st.get("available_seats"),
    }

    return {
        "showtime": showtime_out,
        "film": film,
        "seat_layout": seat_layout,
        "booked_seats": sorted(set(booked_seats)),
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
    
    total_price = showtime["price"] * len(seats)
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
            "show_date": showtime.get("date"),
            "show_time": showtime.get("time"),
            "film_title": film.get("title") if film else None
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    # Update available seats
    await db.showtimes.update_one(
        {"_id": showtime_id},
        {"$inc": {"available_seats": -len(seats)}}
    )
    
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


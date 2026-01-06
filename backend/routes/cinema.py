from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from models.cinema import CinemaCreate, CinemaUpdate, CinemaStatus, FilmStatus
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/cinema", tags=["Cinema"])

# Cinema Management
@router.post("/")
async def create_cinema(
    cinema_data: CinemaCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new cinema"""
    db = get_database()
    
    if current_user["role"] not in ["operator", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get cinemas"""
    db = get_database()
    
    query = {"status": CinemaStatus.ACTIVE}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    cinemas = await db.cinemas.find(query).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.cinemas.count_documents(query)
    
    # Transform _id to id for each cinema
    for cinema in cinemas:
        cinema["id"] = str(cinema.pop("_id", ""))
    
    return {"cinemas": cinemas, "total": total}

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
    current_user: dict = Depends(get_current_active_user)
):
    """Update a cinema"""
    db = get_database()
    
    cinema = await db.cinemas.find_one({"_id": cinema_id})
    if not cinema:
        raise HTTPException(status_code=404, detail="Cinema not found")
    
    if current_user["role"] == "operator" and cinema["operator_id"] != current_user.get("operator_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in cinema_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.cinemas.update_one({"_id": cinema_id}, {"$set": update_data})
    
    return {"message": "Cinema updated"}

@router.delete("/{cinema_id}")
async def delete_cinema(
    cinema_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a cinema"""
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
    genre: List[str] = [],
    description: Optional[str] = None,
    language: str = "English",
    subtitles: List[str] = [],
    rating: str = "PG",
    director: Optional[str] = None,
    cast: List[str] = [],
    poster_url: Optional[str] = None,
    trailer_url: Optional[str] = None,
    release_date: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new film"""
    db = get_database()
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
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
        "status": FilmStatus.NOW_SHOWING,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.films.insert_one(film)
    
    return {"message": "Film created", "film_id": film["_id"]}

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
    
    films = await db.films.find(query, {"_id": 0}).sort("title", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.films.count_documents(query)
    
    return {"films": films, "total": total}

@router.get("/films/{film_id}")
async def get_film(film_id: str):
    """Get film details"""
    db = get_database()
    film = await db.films.find_one({"_id": film_id})
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")
    film["id"] = film.pop("_id")
    return film

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
    current_user: dict = Depends(get_current_active_user)
):
    """Create a showtime"""
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


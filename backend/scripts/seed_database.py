"""
Database Seed Script for Oryno Application
Populates the database with realistic sample data for all services
"""

import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
import random
from motor.motor_asyncio import AsyncIOMotorClient
import os

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('MONGO_DB_NAME', 'oryno_webapp')

# Sample data
CITIES = ['Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Kribi', 'Limbe', 'Buea', 'Garoua']

HOTEL_NAMES = [
    ('Hilton', 5), ('Sawa Hotel', 4), ('La Falaise', 4), ('Akwa Palace', 4),
    ('Mont Febe', 5), ('Djeuga Palace', 4), ('Franco Hotel', 3), ('Star Land', 3),
    ('Hotel de la Paix', 3), ('Merina Hotel', 4)
]

RESTAURANT_NAMES = [
    'La Belle Époque', 'Chez Wou', 'Le Jardin', 'Mami Nyanga', 'Le Boukarou',
    'Safari Restaurant', 'Black & White', 'Le Meridien', 'Dolce Vita', 'Golden Gate'
]

VEHICLE_TYPES = [
    ('Toyota Corolla', 'sedan', 35000), ('Honda CR-V', 'suv', 55000),
    ('Mercedes C-Class', 'luxury', 95000), ('Toyota Hiace', 'van', 75000),
    ('Suzuki Swift', 'economy', 25000), ('BMW X5', 'suv', 120000),
    ('Hyundai Accent', 'compact', 30000), ('Land Cruiser Prado', 'suv', 150000)
]

TRAVEL_OPERATORS = ['Touristique Express', 'General Voyage', 'Vatican Express', 'Buca Voyage', 'Finex Transport']

EVENTS = [
    ('Afro Nation Festival', 'Festival', 15000, 50000),
    ('Tech Summit Cameroon', 'Conference', 25000, 75000),
    ('Lions vs Elephants', 'Sports', 5000, 25000),
    ('Jazz Night Douala', 'Concert', 10000, 30000),
    ('Comedy Night', 'Entertainment', 8000, 20000),
    ('Food Festival', 'Festival', 5000, 15000)
]

FILMS = [
    ('Black Panther: Wakanda Forever', ['Action', 'Sci-Fi'], 161, 'PG-13'),
    ('Avatar: The Way of Water', ['Action', 'Adventure'], 192, 'PG-13'),
    ('The Little Mermaid', ['Fantasy', 'Musical'], 135, 'PG'),
    ('Oppenheimer', ['Drama', 'History'], 180, 'R'),
    ('Barbie', ['Comedy', 'Fantasy'], 114, 'PG-13'),
    ('Mission Impossible 7', ['Action', 'Thriller'], 163, 'PG-13')
]

PACKAGES = [
    ('Kribi Beach Escape', 'travel', 'Kribi', 3, 150000),
    ('Romantic Honeymoon', 'honeymoon', 'Limbe', 5, 350000),
    ('Mount Cameroon Trek', 'adventure', 'Buea', 4, 200000),
    ('Family Fun Week', 'family', 'Yaoundé', 7, 500000),
    ('Business Trip Package', 'business', 'Douala', 3, 180000),
    ('Luxury Safari', 'luxury', 'Waza', 6, 800000),
    ('Cultural Heritage Tour', 'travel', 'Foumban', 4, 220000),
    ('Coastal Paradise', 'honeymoon', 'Kribi', 6, 420000)
]


async def seed_database():
    """Main seeding function"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🌱 Starting database seeding...")
    
    # Clear existing data (optional - comment out in production)
    collections = ['hotels', 'rooms', 'restaurants', 'vehicles', 'travel_routes', 
                   'events', 'films', 'cinemas', 'showtimes', 'banquets', 
                   'packages', 'pressing_services']
    for coll in collections:
        await db[coll].delete_many({})
    print("✓ Cleared existing data")
    
    # Seed Hotels
    hotels = []
    for city in CITIES[:4]:
        for name, stars in random.sample(HOTEL_NAMES, 3):
            hotel = {
                "_id": str(uuid4()),
                "name": f"{name} {city}",
                "description": f"Experience luxury at {name} in the heart of {city}",
                "address": f"Boulevard Principal, {city}",
                "city": city,
                "country": "Cameroon",
                "star_rating": stars,
                "average_rating": round(random.uniform(4.0, 4.9), 1),
                "total_ratings": random.randint(50, 500),
                "amenities": random.sample(['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'room_service'], 5),
                "phone": f"+237 6{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}",
                "email": f"reservations@{name.lower().replace(' ', '')}.cm",
                "price_per_night": random.randint(50, 200) * 1000,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            hotels.append(hotel)
    
    await db.hotels.insert_many(hotels)
    print(f"✓ Seeded {len(hotels)} hotels")
    
    # Seed Rooms for each hotel
    rooms = []
    room_types = [
        ('Standard Room', 1.0, 2), ('Deluxe Room', 1.3, 2), 
        ('Suite', 1.8, 4), ('Executive Suite', 2.5, 4)
    ]
    for hotel in hotels:
        base_price = hotel['price_per_night']
        for room_type, multiplier, capacity in room_types:
            room = {
                "_id": str(uuid4()),
                "hotel_id": hotel['_id'],
                "room_type": room_type,
                "description": f"Comfortable {room_type.lower()} with modern amenities",
                "price": int(base_price * multiplier),
                "capacity": capacity,
                "amenities": ['wifi', 'tv', 'ac', 'minibar'],
                "bed_type": "King" if capacity > 2 else "Queen",
                "size_sqm": random.randint(25, 60),
                "total_rooms": random.randint(5, 20),
                "available_rooms": random.randint(1, 10),
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            rooms.append(room)
    
    await db.rooms.insert_many(rooms)
    print(f"✓ Seeded {len(rooms)} rooms")
    
    # Seed Restaurants
    restaurants = []
    cuisines = [['african', 'local'], ['french', 'european'], ['chinese', 'asian'], ['african', 'fusion']]
    for city in CITIES[:4]:
        for i, name in enumerate(random.sample(RESTAURANT_NAMES, 4)):
            restaurant = {
                "_id": str(uuid4()),
                "name": name,
                "description": f"Fine dining experience at {name}",
                "cuisine_type": random.choice(cuisines),
                "address": f"Rue {random.randint(1, 100)}, {city}",
                "city": city,
                "rating": round(random.uniform(4.0, 4.9), 1),
                "reviews_count": random.randint(30, 300),
                "price_range": random.choice(['$$', '$$$', '$$$$']),
                "opening_hours": "11:00 - 22:00",
                "phone": f"+237 6{random.randint(10, 99)} {random.randint(100, 999)} {random.randint(100, 999)}",
                "amenities": random.sample(['wifi', 'parking', 'outdoor', 'delivery', 'reservations'], 3),
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            restaurants.append(restaurant)
    
    await db.restaurants.insert_many(restaurants)
    print(f"✓ Seeded {len(restaurants)} restaurants")
    
    # Seed Vehicles
    vehicles = []
    for name, vtype, price in VEHICLE_TYPES:
        for city in CITIES[:3]:
            vehicle = {
                "_id": str(uuid4()),
                "name": name,
                "brand": name.split()[0],
                "model": ' '.join(name.split()[1:]) or name,
                "type": vtype,
                "year": random.randint(2020, 2024),
                "price_per_day": price,
                "city": city,
                "seats": 5 if vtype != 'van' else 15,
                "transmission": random.choice(['automatic', 'manual']),
                "fuel_type": random.choice(['petrol', 'diesel']),
                "features": random.sample(['ac', 'bluetooth', 'gps', 'sunroof', 'leather', '4wd'], 3),
                "rating": round(random.uniform(4.3, 4.9), 1),
                "trips": random.randint(20, 150),
                "available": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            vehicles.append(vehicle)
    
    await db.vehicles.insert_many(vehicles)
    print(f"✓ Seeded {len(vehicles)} vehicles")
    
    # Seed Travel Routes
    routes = []
    route_pairs = [
        ('Douala', 'Yaoundé', 3.5, 5000), ('Yaoundé', 'Douala', 3.5, 5000),
        ('Douala', 'Bafoussam', 4, 4500), ('Yaoundé', 'Bamenda', 5, 6000),
        ('Douala', 'Buea', 1.5, 2500), ('Yaoundé', 'Kribi', 3, 4000),
        ('Douala', 'Limbe', 1, 2000), ('Bamenda', 'Bafoussam', 2, 3000)
    ]
    
    departure_times = ['06:00', '07:30', '09:00', '11:00', '14:00', '16:00']
    
    for from_city, to_city, duration, base_price in route_pairs:
        for operator in random.sample(TRAVEL_OPERATORS, 3):
            for dep_time in random.sample(departure_times, 3):
                hours = int(duration)
                mins = int((duration - hours) * 60)
                arr_hour = int(dep_time.split(':')[0]) + hours
                arr_min = int(dep_time.split(':')[1]) + mins
                if arr_min >= 60:
                    arr_hour += 1
                    arr_min -= 60
                arrival_time = f"{arr_hour:02d}:{arr_min:02d}"
                
                route = {
                    "_id": str(uuid4()),
                    "operator_id": str(uuid4()),
                    "operator_name": operator,
                    "from_city": from_city,
                    "to_city": to_city,
                    "departure_time": dep_time,
                    "arrival_time": arrival_time,
                    "duration": f"{hours}h {mins}m" if mins else f"{hours}h",
                    "price": base_price + random.randint(-500, 1000),
                    "vehicle_type": random.choice(['VIP', 'Comfort', 'Normal']),
                    "total_seats": random.choice([30, 40, 50, 70]),
                    "available_seats": random.randint(10, 40),
                    "amenities": random.sample(['Air Conditioning', 'WiFi', 'Refreshments', 'Comfortable Seats'], 2),
                    "status": "active",
                    "is_active": True,
                    "created_at": datetime.utcnow()
                }
                routes.append(route)
    
    await db.travel_routes.insert_many(routes)
    print(f"✓ Seeded {len(routes)} travel routes")
    
    # Seed Events
    events = []
    for name, etype, price_from, price_to in EVENTS:
        for city in random.sample(CITIES[:3], 2):
            event = {
                "_id": str(uuid4()),
                "name": f"{name} - {city}",
                "type": etype,
                "description": f"Experience {name} in {city}",
                "venue": f"Centre Culturel, {city}",
                "city": city,
                "date": (datetime.now() + timedelta(days=random.randint(7, 90))).strftime('%Y-%m-%d'),
                "time": f"{random.randint(16, 20)}:00",
                "price_from": price_from,
                "price_to": price_to,
                "capacity": random.randint(500, 5000),
                "tickets_sold": random.randint(100, 400),
                "organizer": f"{name.split()[0]} Productions",
                "status": "active",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            events.append(event)
    
    await db.events.insert_many(events)
    print(f"✓ Seeded {len(events)} events")
    
    # Seed Cinemas and Films
    cinemas = []
    for city in CITIES[:3]:
        cinema = {
            "_id": str(uuid4()),
            "name": f"CanalOlympia {city}",
            "city": city,
            "address": f"Avenue Kennedy, {city}",
            "screens": random.randint(3, 6),
            "amenities": ['3d', 'imax', 'parking', 'snacks'],
            "rating": round(random.uniform(4.0, 4.8), 1),
            "status": "active",
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        cinemas.append(cinema)
    
    await db.cinemas.insert_many(cinemas)
    print(f"✓ Seeded {len(cinemas)} cinemas")
    
    # Seed Films
    films = []
    for title, genres, duration, rating in FILMS:
        film = {
            "_id": str(uuid4()),
            "title": title,
            "genre": genres,
            "duration_minutes": duration,
            "rating": rating,
            "language": "English",
            "subtitles": ["French"],
            "description": f"A thrilling {genres[0].lower()} film",
            "status": "now_showing" if random.random() > 0.3 else "coming_soon",
            "release_date": (datetime.now() - timedelta(days=random.randint(0, 60))).strftime('%Y-%m-%d'),
            "created_at": datetime.utcnow()
        }
        films.append(film)
    
    await db.films.insert_many(films)
    print(f"✓ Seeded {len(films)} films")
    
    # Seed Packages
    packages = []
    for name, ptype, dest, days, price in PACKAGES:
        package = {
            "_id": str(uuid4()),
            "name": name,
            "package_type": ptype,
            "destination": dest,
            "description": f"Discover the beauty of {dest} with our {name}",
            "duration_days": days,
            "duration_nights": days - 1,
            "base_price": price,
            "original_price": int(price * 1.2),
            "inclusions": random.sample(['hotel', 'transport', 'meals', 'guide', 'activities', 'flights'], 4),
            "rating": round(random.uniform(4.4, 4.9), 1),
            "total_reviews": random.randint(20, 100),
            "total_bookings": random.randint(30, 200),
            "featured": random.random() > 0.5,
            "status": "active",
            "departure_dates": [(datetime.now() + timedelta(days=i*7)).strftime('%Y-%m-%d') for i in range(1, 5)],
            "created_at": datetime.utcnow()
        }
        packages.append(package)
    
    await db.packages.insert_many(packages)
    print(f"✓ Seeded {len(packages)} packages")
    
    # Seed Banquet Venues
    banquets = []
    venue_types = ['wedding', 'conference', 'birthday', 'corporate']
    for city in CITIES[:3]:
        for i in range(3):
            banquet = {
                "_id": str(uuid4()),
                "name": f"{'Grand Palace' if i == 0 else 'Elite' if i == 1 else 'Garden'} Hall - {city}",
                "city": city,
                "address": f"Quartier {random.choice(['Bastos', 'Bonanjo', 'Centre Ville'])}, {city}",
                "venue_type": random.choice(venue_types),
                "capacity_min": random.choice([30, 50, 100]),
                "capacity_max": random.choice([150, 300, 500]),
                "base_price": random.randint(200, 800) * 1000,
                "price_type": "per_event",
                "amenities": random.sample(['catering', 'decoration', 'sound_system', 'parking', 'outdoor'], 3),
                "rating": round(random.uniform(4.3, 4.9), 1),
                "total_reviews": random.randint(15, 80),
                "status": "active",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            banquets.append(banquet)
    
    await db.banquets.insert_many(banquets)
    print(f"✓ Seeded {len(banquets)} banquet venues")
    
    # Seed Laundry Services
    laundry = []
    laundry_names = ['Express Clean', 'Royal Pressing', 'Quick Wash', 'Premium Laundry']
    for city in CITIES[:3]:
        for name in random.sample(laundry_names, 2):
            service = {
                "_id": str(uuid4()),
                "name": f"{name} - {city}",
                "city": city,
                "address": f"Rue {random.randint(1, 50)}, {city}",
                "rating": round(random.uniform(4.2, 4.9), 1),
                "reviews_count": random.randint(20, 150),
                "delivery": random.random() > 0.3,
                "express": random.random() > 0.4,
                "price_per_item": random.choice([400, 500, 750, 1000]),
                "services": random.sample(['washing', 'ironing', 'dry_cleaning', 'alterations', 'leather_care'], 3),
                "status": "active",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            laundry.append(service)
    
    await db.pressing_services.insert_many(laundry)
    print(f"✓ Seeded {len(laundry)} laundry services")
    
    print("\n✅ Database seeding complete!")
    print(f"""
    Summary:
    - Hotels: {len(hotels)}
    - Rooms: {len(rooms)}
    - Restaurants: {len(restaurants)}
    - Vehicles: {len(vehicles)}
    - Travel Routes: {len(routes)}
    - Events: {len(events)}
    - Cinemas: {len(cinemas)}
    - Films: {len(films)}
    - Packages: {len(packages)}
    - Banquet Venues: {len(banquets)}
    - Laundry Services: {len(laundry)}
    """)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())

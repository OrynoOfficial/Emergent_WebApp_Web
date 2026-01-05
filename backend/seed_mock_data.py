"""
Comprehensive Mock Data Seeding Script for Oryno Platform
Creates realistic test data for all services across Yaoundé, Douala, and Bafoussam
"""

import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from typing import List, Dict, Any
import random

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "oryno_webapp")

# ============== REAL STOCK PHOTOS FROM UNSPLASH/PEXELS ==============

HOTEL_IMAGES = {
    "luxury": [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
        "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"
    ],
    "business": [
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
        "https://images.unsplash.com/photo-1529290130-4ca3753253ae?w=800"
    ],
    "boutique": [
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800",
        "https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=800",
        "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800"
    ]
}

ROOM_IMAGES = [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    "https://images.unsplash.com/photo-1609949279531-cf48d64bed89?w=800"
]

RESTAURANT_IMAGES = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
    "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
    "https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800"
]

BUS_IMAGES = [
    "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800",
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=800"
]

CAR_IMAGES = {
    "sedan": [
        "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800",
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800"
    ],
    "suv": [
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800",
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800"
    ],
    "luxury": [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800"
    ]
}

CINEMA_IMAGES = [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800",
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",
    "https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=800"
]

MOVIE_POSTERS = [
    "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400",
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400",
    "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400",
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400",
    "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400"
]

EVENT_IMAGES = [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800",
    "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"
]

BANQUET_IMAGES = [
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800",
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800",
    "https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=800",
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800"
]

LAUNDRY_IMAGES = [
    "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800",
    "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800",
    "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800"
]

PACKAGE_IMAGES = [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800",
    "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800"
]

# Cities in Cameroon
CITIES = ["Yaoundé", "Douala", "Bafoussam"]

# ============== OPERATORS ==============

def generate_operators() -> List[Dict[str, Any]]:
    """Generate mix of multi-service and specialized operators"""
    now = datetime.now(timezone.utc).isoformat()
    
    operators = [
        # Multi-service operators
        {
            "_id": str(uuid.uuid4()),
            "name": "Oryno Travel & Hospitality",
            "business_name": "Oryno Travel & Hospitality SARL",
            "operator_type": "multi",
            "service_types": ["travel", "hotel", "car_rental", "event"],
            "email": "contact@orynotravel.cm",
            "phone": "+237 699 123 456",
            "address": "Avenue Kennedy, Quartier Bastos",
            "city": "Yaoundé",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200",
            "description": "Premier travel and hospitality company in Central Africa offering hotels, transport, car rentals and event services.",
            "status": "active",
            "commission_rate": 5.0,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Cameroon Express Services",
            "business_name": "Cameroon Express Services SA",
            "operator_type": "multi",
            "service_types": ["travel", "hotel", "restaurant"],
            "email": "info@camexpress.cm",
            "phone": "+237 677 888 999",
            "address": "Rue Joffre, Akwa",
            "city": "Douala",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1606857521015-7f9fcf423571?w=200",
            "description": "Leading transport and hospitality provider connecting major cities across Cameroon.",
            "status": "active",
            "commission_rate": 4.5,
            "created_at": now,
            "updated_at": now
        },
        # Specialized operators
        {
            "_id": str(uuid.uuid4()),
            "name": "West Region Tours",
            "business_name": "West Region Tours SARL",
            "operator_type": "travel",
            "service_types": ["travel"],
            "email": "booking@westregion.cm",
            "phone": "+237 655 444 333",
            "address": "Carrefour Total, Centre Ville",
            "city": "Bafoussam",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200",
            "description": "Specialized bus transport connecting the Western highlands to major cities.",
            "status": "active",
            "commission_rate": 5.0,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "CinéPlus Cameroun",
            "business_name": "CinéPlus Entertainment SA",
            "operator_type": "cinema",
            "service_types": ["cinema"],
            "email": "contact@cineplus.cm",
            "phone": "+237 698 111 222",
            "address": "Mall of Douala, Bonapriso",
            "city": "Douala",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200",
            "description": "Premium cinema experience with latest blockbusters and local films.",
            "status": "active",
            "commission_rate": 6.0,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Prestige Pressing",
            "business_name": "Prestige Pressing & Dry Cleaning",
            "operator_type": "laundry",
            "service_types": ["laundry"],
            "email": "service@prestigepressing.cm",
            "phone": "+237 677 555 666",
            "address": "Rue de l'Intendance, Bonapriso",
            "city": "Douala",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=200",
            "description": "Professional laundry and dry cleaning services with express delivery.",
            "status": "active",
            "commission_rate": 4.0,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Royal Events Cameroon",
            "business_name": "Royal Events & Banquets SA",
            "operator_type": "banquet",
            "service_types": ["banquet", "event"],
            "email": "events@royalevents.cm",
            "phone": "+237 699 777 888",
            "address": "Boulevard de la Liberté",
            "city": "Yaoundé",
            "country": "Cameroon",
            "logo_url": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200",
            "description": "Luxury event venues and complete event management services.",
            "status": "active",
            "commission_rate": 5.5,
            "created_at": now,
            "updated_at": now
        }
    ]
    return operators


# ============== HOTELS ==============

def generate_hotels(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate 5 hotels across the 3 cities"""
    now = datetime.now(timezone.utc).isoformat()
    multi_ops = [op for op in operators if op["operator_type"] == "multi"]
    
    hotels = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Hilton Yaoundé",
            "description": "Experience luxury at its finest at Hilton Yaoundé. Located in the heart of the capital, our 5-star hotel offers stunning city views, world-class dining, and exceptional service.",
            "operator_id": multi_ops[0]["_id"],
            "address": "Boulevard du 20 Mai, Centre Ville",
            "city": "Yaoundé",
            "country": "Cameroon",
            "postal_code": "BP 1234",
            "latitude": 3.8667,
            "longitude": 11.5167,
            "star_rating": 5,
            "average_rating": 4.7,
            "total_ratings": 245,
            "amenities": ["wifi", "pool", "spa", "gym", "restaurant", "bar", "parking", "room_service", "conference_room", "airport_shuttle"],
            "images": HOTEL_IMAGES["luxury"][:3],
            "thumbnail": HOTEL_IMAGES["luxury"][0],
            "total_rooms": 200,
            "available_rooms": 45,
            "phone": "+237 222 234 567",
            "email": "reservations@hiltonyaounde.cm",
            "website": "https://hilton.com/yaounde",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Sawa Hotel Douala",
            "description": "Modern business hotel in the economic capital. Perfect for business travelers with fully equipped conference facilities and easy access to the port and industrial areas.",
            "operator_id": multi_ops[1]["_id"],
            "address": "Rue Joss, Bonanjo",
            "city": "Douala",
            "country": "Cameroon",
            "postal_code": "BP 5678",
            "latitude": 4.0511,
            "longitude": 9.7679,
            "star_rating": 4,
            "average_rating": 4.3,
            "total_ratings": 189,
            "amenities": ["wifi", "gym", "restaurant", "bar", "parking", "conference_room", "business_center", "laundry"],
            "images": HOTEL_IMAGES["business"],
            "thumbnail": HOTEL_IMAGES["business"][0],
            "total_rooms": 150,
            "available_rooms": 32,
            "phone": "+237 233 456 789",
            "email": "booking@sawahotel.cm",
            "website": "https://sawahotel.cm",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "La Falaise Hotel",
            "description": "Boutique hotel offering personalized service and authentic Cameroonian hospitality. Nestled in the cool highlands with breathtaking mountain views.",
            "operator_id": multi_ops[0]["_id"],
            "address": "Route de Bamenda, Quartier Administratif",
            "city": "Bafoussam",
            "country": "Cameroon",
            "latitude": 5.4737,
            "longitude": 10.4179,
            "star_rating": 4,
            "average_rating": 4.5,
            "total_ratings": 156,
            "amenities": ["wifi", "restaurant", "bar", "parking", "garden", "terrace", "mountain_view"],
            "images": HOTEL_IMAGES["boutique"],
            "thumbnail": HOTEL_IMAGES["boutique"][0],
            "total_rooms": 60,
            "available_rooms": 18,
            "phone": "+237 699 234 567",
            "email": "info@lafalaise.cm",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Merina Hotel",
            "description": "Central Yaoundé hotel offering comfortable accommodation at competitive prices. Ideal for both business and leisure travelers.",
            "operator_id": multi_ops[1]["_id"],
            "address": "Avenue Monseigneur Vogt, Messa",
            "city": "Yaoundé",
            "country": "Cameroon",
            "latitude": 3.8750,
            "longitude": 11.5000,
            "star_rating": 3,
            "average_rating": 4.1,
            "total_ratings": 203,
            "amenities": ["wifi", "restaurant", "parking", "laundry", "room_service"],
            "images": [HOTEL_IMAGES["business"][2], HOTEL_IMAGES["business"][3]],
            "thumbnail": HOTEL_IMAGES["business"][2],
            "total_rooms": 80,
            "available_rooms": 25,
            "phone": "+237 222 345 678",
            "email": "reservations@merina.cm",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Akwa Palace Hotel",
            "description": "Iconic Douala landmark offering a blend of colonial charm and modern amenities. Located in the vibrant Akwa district.",
            "operator_id": multi_ops[0]["_id"],
            "address": "Boulevard de la Liberté, Akwa",
            "city": "Douala",
            "country": "Cameroon",
            "latitude": 4.0483,
            "longitude": 9.7043,
            "star_rating": 5,
            "average_rating": 4.6,
            "total_ratings": 312,
            "amenities": ["wifi", "pool", "spa", "gym", "restaurant", "bar", "parking", "casino", "nightclub", "boutique"],
            "images": HOTEL_IMAGES["luxury"][2:],
            "thumbnail": HOTEL_IMAGES["luxury"][2],
            "total_rooms": 250,
            "available_rooms": 67,
            "phone": "+237 233 567 890",
            "email": "info@akwapalace.cm",
            "website": "https://akwapalace.cm",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    return hotels


def generate_rooms(hotels: List[Dict]) -> List[Dict[str, Any]]:
    """Generate rooms for each hotel"""
    now = datetime.now(timezone.utc).isoformat()
    rooms = []
    
    room_types = [
        {"type": "single", "capacity": 1, "beds": 1, "bed_type": "single", "base_multiplier": 1.0},
        {"type": "double", "capacity": 2, "beds": 1, "bed_type": "double", "base_multiplier": 1.3},
        {"type": "twin", "capacity": 2, "beds": 2, "bed_type": "single", "base_multiplier": 1.3},
        {"type": "suite", "capacity": 4, "beds": 2, "bed_type": "king", "base_multiplier": 2.5},
        {"type": "deluxe", "capacity": 2, "beds": 1, "bed_type": "king", "base_multiplier": 1.8}
    ]
    
    for hotel in hotels:
        base_price = 35000 if hotel["star_rating"] == 5 else 25000 if hotel["star_rating"] == 4 else 15000
        
        for i, rt in enumerate(room_types[:4]):  # 4 room types per hotel
            room = {
                "_id": str(uuid.uuid4()),
                "hotel_id": hotel["_id"],
                "room_number": f"{(i+1)*100 + 1}",
                "room_type": rt["type"],
                "floor": i + 1,
                "capacity": rt["capacity"],
                "beds": rt["beds"],
                "bed_type": rt["bed_type"],
                "size_sqm": 25 + (i * 10),
                "base_price": base_price * rt["base_multiplier"],
                "amenities": ["wifi", "ac", "tv", "minibar", "safe"] if i >= 2 else ["wifi", "ac", "tv"],
                "images": [ROOM_IMAGES[i % len(ROOM_IMAGES)], ROOM_IMAGES[(i+1) % len(ROOM_IMAGES)]],
                "description": f"Comfortable {rt['type']} room with modern amenities and city views.",
                "status": "available",
                "created_at": now,
                "updated_at": now
            }
            rooms.append(room)
    
    return rooms


# ============== RESTAURANTS ==============

def generate_restaurants(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate 5 restaurants across the 3 cities"""
    now = datetime.now(timezone.utc).isoformat()
    multi_ops = [op for op in operators if "restaurant" in op.get("service_types", [])]
    
    restaurants = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Le Safoutier",
            "description": "Fine dining restaurant featuring authentic Cameroonian cuisine with a modern twist. Our chefs use only the freshest local ingredients.",
            "operator_id": multi_ops[0]["_id"] if multi_ops else operators[0]["_id"],
            "address": "Rue Joseph Mballa Eloumden, Bastos",
            "city": "Yaoundé",
            "country": "Cameroon",
            "latitude": 3.8833,
            "longitude": 11.5000,
            "cuisine_type": ["Cameroonian", "African", "French"],
            "average_rating": 4.6,
            "total_ratings": 178,
            "price_range": "$$$",
            "average_cost_for_two": 35000,
            "currency": "XAF",
            "images": [RESTAURANT_IMAGES[0], RESTAURANT_IMAGES[1]],
            "thumbnail": RESTAURANT_IMAGES[0],
            "phone": "+237 699 888 111",
            "email": "reservation@lesafoutier.cm",
            "opening_hours": {"monday": {"open": "12:00", "close": "22:00"}, "tuesday": {"open": "12:00", "close": "22:00"}, "wednesday": {"open": "12:00", "close": "22:00"}, "thursday": {"open": "12:00", "close": "22:00"}, "friday": {"open": "12:00", "close": "23:00"}, "saturday": {"open": "18:00", "close": "23:00"}, "sunday": {"open": "12:00", "close": "16:00"}},
            "features": ["fine_dining", "private_rooms", "wine_cellar", "valet_parking"],
            "accepts_reservations": True,
            "total_tables": 25,
            "max_capacity": 80,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Chez Wou",
            "description": "Popular Chinese restaurant serving authentic Cantonese and Sichuan dishes. Family-friendly atmosphere with generous portions.",
            "operator_id": operators[0]["_id"],
            "address": "Boulevard de la Liberté, Akwa",
            "city": "Douala",
            "country": "Cameroon",
            "latitude": 4.0500,
            "longitude": 9.7000,
            "cuisine_type": ["Chinese", "Asian"],
            "average_rating": 4.4,
            "total_ratings": 234,
            "price_range": "$$",
            "average_cost_for_two": 18000,
            "currency": "XAF",
            "images": [RESTAURANT_IMAGES[2], RESTAURANT_IMAGES[3]],
            "thumbnail": RESTAURANT_IMAGES[2],
            "phone": "+237 233 444 555",
            "opening_hours": {"monday": {"open": "11:30", "close": "22:30"}, "tuesday": {"open": "11:30", "close": "22:30"}, "wednesday": {"open": "11:30", "close": "22:30"}, "thursday": {"open": "11:30", "close": "22:30"}, "friday": {"open": "11:30", "close": "23:00"}, "saturday": {"open": "11:30", "close": "23:00"}, "sunday": {"open": "12:00", "close": "21:00"}},
            "features": ["family_friendly", "takeaway", "delivery", "group_dining"],
            "accepts_reservations": True,
            "total_tables": 40,
            "max_capacity": 150,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "La Terrasse Bafoussam",
            "description": "Rooftop restaurant with panoramic mountain views. Serving both local specialties and international favorites.",
            "operator_id": operators[0]["_id"],
            "address": "Rue Principale, Centre Commercial",
            "city": "Bafoussam",
            "country": "Cameroon",
            "latitude": 5.4750,
            "longitude": 10.4200,
            "cuisine_type": ["Cameroonian", "Continental", "Grills"],
            "average_rating": 4.3,
            "total_ratings": 89,
            "price_range": "$$",
            "average_cost_for_two": 15000,
            "currency": "XAF",
            "images": [RESTAURANT_IMAGES[4]],
            "thumbnail": RESTAURANT_IMAGES[4],
            "phone": "+237 677 222 333",
            "opening_hours": {"monday": {"open": "10:00", "close": "22:00"}, "tuesday": {"open": "10:00", "close": "22:00"}, "wednesday": {"open": "10:00", "close": "22:00"}, "thursday": {"open": "10:00", "close": "22:00"}, "friday": {"open": "10:00", "close": "23:00"}, "saturday": {"open": "10:00", "close": "23:00"}, "sunday": {"open": "10:00", "close": "21:00"}},
            "features": ["rooftop", "mountain_view", "live_music_weekends"],
            "accepts_reservations": True,
            "total_tables": 30,
            "max_capacity": 100,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Ocean Basket Douala",
            "description": "Fresh seafood restaurant specializing in grilled fish, prawns, and lobster. Catch of the day directly from the Atlantic.",
            "operator_id": operators[1]["_id"],
            "address": "Rue de l'Hôpital, Bonapriso",
            "city": "Douala",
            "country": "Cameroon",
            "latitude": 4.0450,
            "longitude": 9.6950,
            "cuisine_type": ["Seafood", "Mediterranean"],
            "average_rating": 4.5,
            "total_ratings": 156,
            "price_range": "$$$",
            "average_cost_for_two": 28000,
            "currency": "XAF",
            "images": [RESTAURANT_IMAGES[5], RESTAURANT_IMAGES[6]],
            "thumbnail": RESTAURANT_IMAGES[5],
            "phone": "+237 233 555 666",
            "email": "douala@oceanbasket.cm",
            "opening_hours": {"monday": {"open": "12:00", "close": "22:00"}, "tuesday": {"open": "12:00", "close": "22:00"}, "wednesday": {"open": "12:00", "close": "22:00"}, "thursday": {"open": "12:00", "close": "22:00"}, "friday": {"open": "12:00", "close": "23:00"}, "saturday": {"open": "12:00", "close": "23:00"}, "sunday": {"open": "12:00", "close": "21:00"}},
            "features": ["seafood_specialist", "waterfront", "outdoor_seating"],
            "accepts_reservations": True,
            "total_tables": 35,
            "max_capacity": 120,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Le Carnivore",
            "description": "Premium steakhouse featuring aged beef and exotic game meats. The ultimate destination for meat lovers.",
            "operator_id": operators[0]["_id"],
            "address": "Avenue Charles de Gaulle, Nlongkak",
            "city": "Yaoundé",
            "country": "Cameroon",
            "latitude": 3.8700,
            "longitude": 11.5100,
            "cuisine_type": ["Steakhouse", "Grills", "American"],
            "average_rating": 4.7,
            "total_ratings": 201,
            "price_range": "$$$$",
            "average_cost_for_two": 45000,
            "currency": "XAF",
            "images": [RESTAURANT_IMAGES[6], RESTAURANT_IMAGES[0]],
            "thumbnail": RESTAURANT_IMAGES[6],
            "phone": "+237 222 777 888",
            "email": "booking@lecarnivore.cm",
            "opening_hours": {"monday": "closed", "tuesday": {"open": "18:00", "close": "23:00"}, "wednesday": {"open": "18:00", "close": "23:00"}, "thursday": {"open": "18:00", "close": "23:00"}, "friday": {"open": "18:00", "close": "24:00"}, "saturday": {"open": "12:00", "close": "24:00"}, "sunday": {"open": "12:00", "close": "22:00"}},
            "features": ["premium_meats", "wine_pairing", "cigar_lounge", "private_dining"],
            "accepts_reservations": True,
            "total_tables": 20,
            "max_capacity": 60,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    return restaurants


# ============== TRAVEL ROUTES & VEHICLES ==============

def generate_vehicles(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate vehicles for transport operators"""
    now = datetime.now(timezone.utc).isoformat()
    travel_ops = [op for op in operators if "travel" in op.get("service_types", []) or op["operator_type"] == "travel"]
    
    vehicles = []
    vehicle_configs = [
        {"name": "VIP Coaster", "type": "vip", "seats": 30, "amenities": ["wifi", "ac", "power_outlet", "tv_screen", "reclining_seats", "refreshments"]},
        {"name": "Express Bus", "type": "normal", "seats": 50, "amenities": ["ac", "reclining_seats"]},
        {"name": "Luxury Coach", "type": "luxury", "seats": 25, "amenities": ["wifi", "ac", "power_outlet", "restroom", "tv_screen", "reclining_seats", "refreshments", "usb_charging"]},
        {"name": "Standard Bus", "type": "normal", "seats": 45, "amenities": ["ac"]},
        {"name": "VIP Express", "type": "vip", "seats": 35, "amenities": ["wifi", "ac", "power_outlet", "reclining_seats"]}
    ]
    
    for i, config in enumerate(vehicle_configs):
        op = travel_ops[i % len(travel_ops)]
        vehicle = {
            "_id": str(uuid.uuid4()),
            "vehicle_name": config["name"],
            "vehicle_type": config["type"],
            "plate_number": f"LT {random.randint(100, 999)} {chr(65 + i)}",
            "manufacturer": random.choice(["Mercedes-Benz", "Toyota", "Volvo", "MAN"]),
            "model": random.choice(["Tourismo", "Coaster", "9900", "Lion's Coach"]),
            "year": random.randint(2019, 2024),
            "operator_id": op["_id"],
            "operator_name": op["name"],
            "amenities": config["amenities"],
            "seat_layout": {
                "rows": config["seats"] // 4,
                "columns": 4,
                "layout_type": "2-2",
                "driver_position": "left",
                "total_seats": config["seats"]
            },
            "total_seats": config["seats"],
            "maintenance_status": "active",
            "created_at": now,
            "updated_at": now
        }
        vehicles.append(vehicle)
    
    return vehicles


def generate_travel_routes(operators: List[Dict], vehicles: List[Dict]) -> List[Dict[str, Any]]:
    """Generate travel routes between cities"""
    now = datetime.now(timezone.utc).isoformat()
    travel_ops = [op for op in operators if "travel" in op.get("service_types", []) or op["operator_type"] == "travel"]
    
    routes_config = [
        {"from": "Yaoundé", "to": "Douala", "duration": "3h 30m", "price": 5000},
        {"from": "Douala", "to": "Yaoundé", "duration": "3h 30m", "price": 5000},
        {"from": "Yaoundé", "to": "Bafoussam", "duration": "4h 00m", "price": 6000},
        {"from": "Bafoussam", "to": "Yaoundé", "duration": "4h 00m", "price": 6000},
        {"from": "Douala", "to": "Bafoussam", "duration": "4h 30m", "price": 5500},
    ]
    
    routes = []
    departure_times = ["06:00", "08:00", "10:00", "14:00", "18:00"]
    
    for i, config in enumerate(routes_config):
        op = travel_ops[i % len(travel_ops)]
        vehicle = vehicles[i % len(vehicles)]
        dep_time = departure_times[i % len(departure_times)]
        
        # Calculate arrival time
        hours = int(config["duration"].split("h")[0])
        minutes = int(config["duration"].split("h")[1].replace("m", "").strip())
        dep_hour, dep_min = map(int, dep_time.split(":"))
        arr_hour = (dep_hour + hours + (dep_min + minutes) // 60) % 24
        arr_min = (dep_min + minutes) % 60
        arr_time = f"{arr_hour:02d}:{arr_min:02d}"
        
        # Price multiplier for vehicle type
        price_mult = 1.0 if vehicle["vehicle_type"] == "normal" else 1.5 if vehicle["vehicle_type"] == "vip" else 2.0
        
        route = {
            "_id": str(uuid.uuid4()),
            "from_city": config["from"],
            "to_city": config["to"],
            "departure_time": dep_time,
            "arrival_time": arr_time,
            "duration": config["duration"],
            "price": int(config["price"] * price_mult),
            "operator_id": op["_id"],
            "operator_name": op["name"],
            "vehicle_id": vehicle["_id"],
            "vehicle_name": vehicle["vehicle_name"],
            "vehicle_type": vehicle["vehicle_type"],
            "total_seats": vehicle["total_seats"],
            "available_seats": vehicle["total_seats"] - random.randint(5, 15),
            "seat_layout": vehicle["seat_layout"],
            "amenities": vehicle["amenities"],
            "status": "active",
            "active": True,
            "valid_from": datetime.now(timezone.utc).date().isoformat(),
            "valid_to": (datetime.now(timezone.utc) + timedelta(days=180)).date().isoformat(),
            "created_at": now,
            "updated_at": now
        }
        routes.append(route)
    
    return routes


# ============== CAR RENTALS ==============

def generate_car_rentals(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate car rental vehicles"""
    now = datetime.now(timezone.utc).isoformat()
    car_ops = [op for op in operators if "car_rental" in op.get("service_types", [])]
    if not car_ops:
        car_ops = operators[:2]
    
    cars_config = [
        {"make": "Toyota", "model": "Corolla", "year": 2023, "type": "sedan", "seats": 5, "transmission": "automatic", "price": 35000},
        {"make": "Toyota", "model": "Land Cruiser", "year": 2022, "type": "suv", "seats": 7, "transmission": "automatic", "price": 85000},
        {"make": "Mercedes-Benz", "model": "E-Class", "year": 2023, "type": "luxury", "seats": 5, "transmission": "automatic", "price": 120000},
        {"make": "Honda", "model": "CR-V", "year": 2023, "type": "suv", "seats": 5, "transmission": "automatic", "price": 55000},
        {"make": "Hyundai", "model": "Accent", "year": 2024, "type": "sedan", "seats": 5, "transmission": "manual", "price": 25000},
    ]
    
    cars = []
    cities = ["Yaoundé", "Douala", "Bafoussam"]
    
    for i, config in enumerate(cars_config):
        op = car_ops[i % len(car_ops)]
        img_key = "sedan" if config["type"] == "sedan" else "suv" if config["type"] == "suv" else "luxury"
        
        car = {
            "_id": str(uuid.uuid4()),
            "make": config["make"],
            "model": config["model"],
            "year": config["year"],
            "vehicle_type": config["type"],
            "seats": config["seats"],
            "doors": 4,
            "transmission": config["transmission"],
            "fuel_type": "petrol",
            "price_per_day": config["price"],
            "price_per_hour": int(config["price"] / 8),
            "operator_id": op["_id"],
            "operator_name": op["name"],
            "city": cities[i % len(cities)],
            "images": [CAR_IMAGES[img_key][0]] if img_key in CAR_IMAGES else [],
            "features": ["ac", "bluetooth", "usb", "gps"] if config["type"] != "luxury" else ["ac", "bluetooth", "usb", "gps", "leather_seats", "sunroof", "premium_sound"],
            "is_available": True,
            "average_rating": round(random.uniform(4.0, 5.0), 1),
            "total_ratings": random.randint(10, 50),
            "created_at": now,
            "updated_at": now
        }
        cars.append(car)
    
    return cars


# ============== CINEMAS & FILMS ==============

def generate_cinemas(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate cinemas across cities"""
    now = datetime.now(timezone.utc).isoformat()
    cinema_ops = [op for op in operators if op["operator_type"] == "cinema"]
    if not cinema_ops:
        cinema_ops = operators[:1]
    
    cinemas = [
        {
            "_id": str(uuid.uuid4()),
            "name": "CinéPlus Akwa",
            "description": "Premium multiplex cinema with 6 screens including IMAX. Located in the heart of Douala.",
            "operator_id": cinema_ops[0]["_id"],
            "operator_name": cinema_ops[0]["name"],
            "address": "Mall of Douala, Boulevard de la Liberté",
            "city": "Douala",
            "phone": "+237 233 999 888",
            "email": "akwa@cineplus.cm",
            "images": [CINEMA_IMAGES[0], CINEMA_IMAGES[1]],
            "screens": [
                {"name": "IMAX", "capacity": 300, "screen_type": "imax"},
                {"name": "Screen 2", "capacity": 150, "screen_type": "3d"},
                {"name": "Screen 3", "capacity": 120, "screen_type": "2d"},
                {"name": "VIP Lounge", "capacity": 40, "screen_type": "vip"}
            ],
            "amenities": ["parking", "snacks", "vip_lounge", "3d", "imax", "wheelchair_access"],
            "operating_hours": {"monday": {"open": "10:00", "close": "23:00"}, "tuesday": {"open": "10:00", "close": "23:00"}, "wednesday": {"open": "10:00", "close": "23:00"}, "thursday": {"open": "10:00", "close": "23:00"}, "friday": {"open": "10:00", "close": "24:00"}, "saturday": {"open": "09:00", "close": "24:00"}, "sunday": {"open": "10:00", "close": "22:00"}},
            "status": "active",
            "rating": 4.5,
            "total_reviews": 234,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Canal Olympia Yaoundé",
            "description": "Modern cinema complex featuring the latest releases and special events.",
            "operator_id": cinema_ops[0]["_id"],
            "operator_name": cinema_ops[0]["name"],
            "address": "Quartier du Lac, Centre Ville",
            "city": "Yaoundé",
            "phone": "+237 222 888 777",
            "email": "yaounde@canalolympia.cm",
            "images": [CINEMA_IMAGES[2], CINEMA_IMAGES[3]],
            "screens": [
                {"name": "Grand Screen", "capacity": 250, "screen_type": "2d"},
                {"name": "Screen 2", "capacity": 150, "screen_type": "2d"},
                {"name": "Screen 3", "capacity": 100, "screen_type": "2d"}
            ],
            "amenities": ["parking", "snacks", "wheelchair_access", "outdoor_seating"],
            "operating_hours": {"monday": {"open": "14:00", "close": "22:00"}, "tuesday": {"open": "14:00", "close": "22:00"}, "wednesday": {"open": "14:00", "close": "22:00"}, "thursday": {"open": "14:00", "close": "22:00"}, "friday": {"open": "14:00", "close": "23:00"}, "saturday": {"open": "10:00", "close": "23:00"}, "sunday": {"open": "10:00", "close": "21:00"}},
            "status": "active",
            "rating": 4.2,
            "total_reviews": 156,
            "created_at": now,
            "updated_at": now
        }
    ]
    return cinemas


def generate_films() -> List[Dict[str, Any]]:
    """Generate films currently showing"""
    now = datetime.now(timezone.utc).isoformat()
    
    films = [
        {
            "_id": str(uuid.uuid4()),
            "title": "Black Panther: Wakanda Forever",
            "description": "The people of Wakanda fight to protect their home from intervening world powers as they mourn the death of King T'Challa.",
            "genre": ["Action", "Adventure", "Drama"],
            "duration_minutes": 161,
            "language": "English",
            "subtitles": ["French"],
            "rating": "PG-13",
            "director": "Ryan Coogler",
            "cast": ["Letitia Wright", "Angela Bassett", "Tenoch Huerta"],
            "poster_url": MOVIE_POSTERS[0],
            "release_date": "2024-11-11",
            "status": "now_showing",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "title": "Avatar: The Way of Water",
            "description": "Jake Sully and Neytiri have formed a family and are doing everything to stay together.",
            "genre": ["Action", "Adventure", "Fantasy"],
            "duration_minutes": 192,
            "language": "English",
            "subtitles": ["French"],
            "rating": "PG-13",
            "director": "James Cameron",
            "cast": ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"],
            "poster_url": MOVIE_POSTERS[1],
            "release_date": "2024-12-16",
            "status": "now_showing",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "title": "La Nuit des Rois",
            "description": "A young man is sent to a prison in Ivory Coast, ruled by its inmates.",
            "genre": ["Drama", "Thriller"],
            "duration_minutes": 93,
            "language": "French",
            "subtitles": ["English"],
            "rating": "R",
            "director": "Philippe Lacôte",
            "cast": ["Koné Bakary", "Steve Tientcheu", "Digbeu Jean Cyrille"],
            "poster_url": MOVIE_POSTERS[2],
            "release_date": "2024-10-01",
            "status": "now_showing",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "title": "Dune: Part Two",
            "description": "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators.",
            "genre": ["Action", "Adventure", "Sci-Fi"],
            "duration_minutes": 166,
            "language": "English",
            "subtitles": ["French"],
            "rating": "PG-13",
            "director": "Denis Villeneuve",
            "cast": ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"],
            "poster_url": MOVIE_POSTERS[3],
            "release_date": "2025-03-01",
            "status": "coming_soon",
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "title": "Mission Cameroun",
            "description": "A local Cameroonian action thriller following an elite team on a dangerous mission.",
            "genre": ["Action", "Thriller"],
            "duration_minutes": 118,
            "language": "French",
            "subtitles": ["English"],
            "rating": "PG-13",
            "director": "Jean-Pierre Bekolo",
            "cast": ["Essomba Ndedi", "Marie Claire Nnana"],
            "poster_url": MOVIE_POSTERS[4],
            "release_date": "2024-12-25",
            "status": "now_showing",
            "created_at": now,
            "updated_at": now
        }
    ]
    return films


def generate_showtimes(cinemas: List[Dict], films: List[Dict]) -> List[Dict[str, Any]]:
    """Generate showtimes for films at cinemas"""
    now = datetime.now(timezone.utc)
    showtimes = []
    
    show_times = ["10:00", "13:00", "16:00", "19:00", "21:30"]
    
    for cinema in cinemas:
        for film in films:
            if film["status"] == "coming_soon":
                continue
            
            screen = random.choice(cinema["screens"])
            for i in range(3):  # 3 days of showtimes
                show_date = (now + timedelta(days=i)).date().isoformat()
                for time_slot in random.sample(show_times, 3):  # 3 shows per day
                    # Calculate end time
                    start_hour, start_min = map(int, time_slot.split(":"))
                    end_minutes = start_hour * 60 + start_min + film["duration_minutes"]
                    end_hour = (end_minutes // 60) % 24
                    end_min = end_minutes % 60
                    end_time = f"{end_hour:02d}:{end_min:02d}"
                    
                    showtime = {
                        "_id": str(uuid.uuid4()),
                        "cinema_id": cinema["_id"],
                        "cinema_name": cinema["name"],
                        "film_id": film["_id"],
                        "film_title": film["title"],
                        "screen_name": screen["name"],
                        "screen_type": screen["screen_type"],
                        "show_date": show_date,
                        "show_time": time_slot,
                        "end_time": end_time,
                        "price": 3000 if screen["screen_type"] == "2d" else 4500 if screen["screen_type"] == "3d" else 6000,
                        "vip_price": 8000 if screen["screen_type"] == "vip" else None,
                        "total_seats": screen["capacity"],
                        "available_seats": screen["capacity"] - random.randint(10, 50),
                        "is_active": True,
                        "created_at": now.isoformat()
                    }
                    showtimes.append(showtime)
    
    return showtimes


# ============== EVENTS ==============

def generate_events(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate events across cities"""
    now = datetime.now(timezone.utc)
    event_ops = [op for op in operators if "event" in op.get("service_types", [])]
    if not event_ops:
        event_ops = operators[:2]
    
    events = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Douala Music Festival 2025",
            "description": "The biggest music festival in Central Africa featuring local and international artists. Three days of non-stop music, food, and culture.",
            "event_type": "festival",
            "operator_id": event_ops[0]["_id"],
            "operator_name": event_ops[0]["name"],
            "venue_name": "Stade Omnisport de Douala",
            "venue_address": "Rue du Stade, Bepanda",
            "city": "Douala",
            "start_date": (now + timedelta(days=30)).isoformat(),
            "end_date": (now + timedelta(days=32)).isoformat(),
            "doors_open": "16:00",
            "images": [EVENT_IMAGES[0], EVENT_IMAGES[1]],
            "ticket_types": [
                {"name": "General Admission", "price": 15000, "quantity": 5000, "sold": 2345},
                {"name": "VIP", "price": 50000, "quantity": 500, "sold": 234},
                {"name": "VVIP", "price": 150000, "quantity": 100, "sold": 45}
            ],
            "total_capacity": 5600,
            "tickets_sold": 2624,
            "status": "published",
            "featured": True,
            "tags": ["music", "festival", "entertainment"],
            "contact_email": "info@doualamusic.cm",
            "contact_phone": "+237 699 111 222",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Tech Summit Cameroon 2025",
            "description": "Premier technology conference bringing together innovators, entrepreneurs, and investors from across Africa.",
            "event_type": "conference",
            "operator_id": event_ops[0]["_id"],
            "operator_name": event_ops[0]["name"],
            "venue_name": "Yaoundé Congress Center",
            "venue_address": "Boulevard du 20 Mai",
            "city": "Yaoundé",
            "start_date": (now + timedelta(days=45)).isoformat(),
            "end_date": (now + timedelta(days=47)).isoformat(),
            "doors_open": "08:00",
            "images": [EVENT_IMAGES[2]],
            "ticket_types": [
                {"name": "Standard Pass", "price": 25000, "quantity": 1000, "sold": 456},
                {"name": "VIP Pass", "price": 75000, "quantity": 200, "sold": 89},
                {"name": "Speaker Pass", "price": 0, "quantity": 50, "sold": 50}
            ],
            "total_capacity": 1250,
            "tickets_sold": 595,
            "status": "published",
            "featured": True,
            "tags": ["tech", "conference", "business", "innovation"],
            "contact_email": "summit@techcameroon.cm",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "West Region Cultural Festival",
            "description": "Celebrate the rich cultural heritage of the Western Region with traditional music, dance, and cuisine.",
            "event_type": "festival",
            "operator_id": event_ops[0]["_id"] if len(event_ops) > 0 else operators[0]["_id"],
            "operator_name": event_ops[0]["name"] if len(event_ops) > 0 else operators[0]["name"],
            "venue_name": "Place des Fêtes",
            "venue_address": "Centre Ville",
            "city": "Bafoussam",
            "start_date": (now + timedelta(days=60)).isoformat(),
            "end_date": (now + timedelta(days=61)).isoformat(),
            "doors_open": "10:00",
            "images": [EVENT_IMAGES[3], EVENT_IMAGES[4]],
            "ticket_types": [
                {"name": "Adult", "price": 5000, "quantity": 3000, "sold": 1234},
                {"name": "Child", "price": 2000, "quantity": 1000, "sold": 567},
                {"name": "Family Pack", "price": 12000, "quantity": 500, "sold": 189}
            ],
            "total_capacity": 4500,
            "tickets_sold": 1990,
            "status": "published",
            "featured": False,
            "tags": ["culture", "traditional", "family"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Comedy Night Douala",
            "description": "A night of laughter featuring Cameroon's top comedians. Get ready for an unforgettable evening!",
            "event_type": "party",
            "operator_id": event_ops[0]["_id"],
            "operator_name": event_ops[0]["name"],
            "venue_name": "Sawa Hotel Conference Room",
            "venue_address": "Rue Joss, Bonanjo",
            "city": "Douala",
            "start_date": (now + timedelta(days=14)).isoformat(),
            "end_date": (now + timedelta(days=14)).isoformat(),
            "doors_open": "19:00",
            "images": [EVENT_IMAGES[1]],
            "ticket_types": [
                {"name": "Standard", "price": 10000, "quantity": 300, "sold": 178},
                {"name": "VIP Table (6 seats)", "price": 100000, "quantity": 20, "sold": 12}
            ],
            "total_capacity": 420,
            "tickets_sold": 250,
            "status": "published",
            "featured": False,
            "tags": ["comedy", "entertainment", "nightlife"],
            "age_restriction": 18,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Startup Pitch Competition",
            "description": "Showcase your startup to investors and win funding! Open to all Cameroonian entrepreneurs.",
            "event_type": "conference",
            "operator_id": event_ops[0]["_id"],
            "operator_name": event_ops[0]["name"],
            "venue_name": "Silicon Mountain Hub",
            "venue_address": "Quartier Bastos",
            "city": "Yaoundé",
            "start_date": (now + timedelta(days=21)).isoformat(),
            "end_date": (now + timedelta(days=21)).isoformat(),
            "doors_open": "09:00",
            "images": [EVENT_IMAGES[2]],
            "ticket_types": [
                {"name": "Spectator", "price": 5000, "quantity": 200, "sold": 89},
                {"name": "Participant", "price": 0, "quantity": 30, "sold": 30}
            ],
            "total_capacity": 230,
            "tickets_sold": 119,
            "status": "published",
            "featured": True,
            "tags": ["startup", "business", "investment"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
    ]
    return events


# ============== BANQUETS ==============

def generate_banquets(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate banquet halls"""
    now = datetime.now(timezone.utc).isoformat()
    banquet_ops = [op for op in operators if op["operator_type"] == "banquet" or "banquet" in op.get("service_types", [])]
    if not banquet_ops:
        banquet_ops = operators[:2]
    
    banquets = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Royal Palace Banquet Hall",
            "description": "Elegant venue perfect for weddings and grand celebrations. Features stunning chandeliers and a beautiful garden.",
            "operator_id": banquet_ops[0]["_id"],
            "operator_name": banquet_ops[0]["name"],
            "venue_type": "hall",
            "address": "Avenue du Mont Fébé",
            "city": "Yaoundé",
            "capacity_min": 50,
            "capacity_max": 500,
            "base_price": 500000,
            "price_type": "per_event",
            "images": [BANQUET_IMAGES[0], BANQUET_IMAGES[1]],
            "amenities": ["parking", "catering", "decoration", "sound_system", "lighting", "air_conditioning", "garden", "bridal_suite"],
            "packages": [
                {"name": "Silver", "description": "Basic venue rental with sound system", "price": 500000, "includes": ["venue", "sound_system", "tables", "chairs"]},
                {"name": "Gold", "description": "Venue with decoration and catering", "price": 1200000, "includes": ["venue", "sound_system", "decoration", "catering_basic"]},
                {"name": "Platinum", "description": "All-inclusive premium package", "price": 2500000, "includes": ["venue", "sound_system", "premium_decoration", "premium_catering", "photography", "entertainment"]}
            ],
            "catering_options": [
                {"name": "Basic Buffet", "price_per_person": 5000, "menu_items": ["Rice", "Chicken", "Fish", "Salads", "Drinks"]},
                {"name": "Premium Buffet", "price_per_person": 12000, "menu_items": ["Multiple courses", "Live stations", "Premium drinks"]},
                {"name": "Gourmet Menu", "price_per_person": 25000, "menu_items": ["5-course meal", "Wine pairing", "Custom menu"]}
            ],
            "advance_booking_days": 14,
            "cancellation_policy": "Full refund 30 days before. 50% refund 14 days before. No refund within 7 days.",
            "phone": "+237 699 777 888",
            "email": "events@royalpalace.cm",
            "status": "active",
            "rating": 4.7,
            "total_reviews": 89,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Garden Terrace Events",
            "description": "Beautiful outdoor venue with panoramic views. Perfect for intimate gatherings and garden parties.",
            "operator_id": banquet_ops[0]["_id"],
            "operator_name": banquet_ops[0]["name"],
            "venue_type": "garden",
            "address": "Quartier Bonapriso",
            "city": "Douala",
            "capacity_min": 30,
            "capacity_max": 200,
            "base_price": 300000,
            "price_type": "per_event",
            "images": [BANQUET_IMAGES[2]],
            "amenities": ["parking", "catering", "decoration", "sound_system", "outdoor_lighting", "tent_available"],
            "packages": [
                {"name": "Garden Basic", "description": "Venue with basic setup", "price": 300000, "includes": ["venue", "basic_setup"]},
                {"name": "Garden Premium", "description": "Full garden party package", "price": 750000, "includes": ["venue", "tent", "decoration", "lighting", "catering"]}
            ],
            "advance_booking_days": 7,
            "phone": "+237 233 666 777",
            "email": "booking@gardenterrace.cm",
            "status": "active",
            "rating": 4.4,
            "total_reviews": 56,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Conference Center West",
            "description": "Modern conference facility with state-of-the-art AV equipment. Ideal for corporate events.",
            "operator_id": banquet_ops[0]["_id"],
            "operator_name": banquet_ops[0]["name"],
            "venue_type": "conference",
            "address": "Route de Bamenda",
            "city": "Bafoussam",
            "capacity_min": 20,
            "capacity_max": 300,
            "base_price": 200000,
            "price_type": "per_event",
            "images": [BANQUET_IMAGES[3]],
            "amenities": ["parking", "projector", "sound_system", "video_conferencing", "wifi", "catering", "breakout_rooms"],
            "packages": [
                {"name": "Half Day", "description": "4 hours venue rental", "price": 150000, "includes": ["venue", "av_equipment", "wifi"]},
                {"name": "Full Day", "description": "8 hours with catering", "price": 350000, "includes": ["venue", "av_equipment", "wifi", "lunch", "coffee_breaks"]}
            ],
            "advance_booking_days": 3,
            "phone": "+237 677 888 999",
            "email": "info@ccwest.cm",
            "status": "active",
            "rating": 4.2,
            "total_reviews": 34,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Sunset Rooftop Venue",
            "description": "Stunning rooftop venue with city views. Perfect for cocktail parties and evening events.",
            "operator_id": banquet_ops[0]["_id"],
            "operator_name": banquet_ops[0]["name"],
            "venue_type": "rooftop",
            "address": "Akwa Tower, 15th Floor",
            "city": "Douala",
            "capacity_min": 40,
            "capacity_max": 150,
            "base_price": 400000,
            "price_type": "per_event",
            "images": [BANQUET_IMAGES[1]],
            "amenities": ["bar", "lounge_seating", "sound_system", "city_views", "elevator_access"],
            "packages": [
                {"name": "Cocktail Evening", "description": "4 hours with bar service", "price": 600000, "includes": ["venue", "bar_service", "canapes"]},
                {"name": "Private Dinner", "description": "Exclusive dinner event", "price": 900000, "includes": ["venue", "full_catering", "bar", "dj"]}
            ],
            "advance_booking_days": 7,
            "phone": "+237 233 444 555",
            "status": "active",
            "rating": 4.6,
            "total_reviews": 67,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Traditional Ceremony Hall",
            "description": "Authentic venue designed for traditional ceremonies. Celebrates Cameroonian cultural heritage.",
            "operator_id": banquet_ops[0]["_id"],
            "operator_name": banquet_ops[0]["name"],
            "venue_type": "traditional",
            "address": "Quartier Nsimeyong",
            "city": "Yaoundé",
            "capacity_min": 100,
            "capacity_max": 400,
            "base_price": 350000,
            "price_type": "per_event",
            "images": [BANQUET_IMAGES[0]],
            "amenities": ["traditional_decor", "catering", "parking", "changing_rooms", "traditional_music"],
            "packages": [
                {"name": "Traditional Basic", "description": "Venue with traditional setup", "price": 350000, "includes": ["venue", "traditional_decor", "seating"]},
                {"name": "Full Traditional", "description": "Complete traditional ceremony", "price": 800000, "includes": ["venue", "decor", "traditional_catering", "musicians", "coordinator"]}
            ],
            "advance_booking_days": 21,
            "phone": "+237 699 222 333",
            "status": "active",
            "rating": 4.8,
            "total_reviews": 112,
            "created_at": now,
            "updated_at": now
        }
    ]
    return banquets


# ============== LAUNDRY/PRESSING ==============

def generate_laundry_services(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate laundry/pressing services"""
    now = datetime.now(timezone.utc).isoformat()
    laundry_ops = [op for op in operators if op["operator_type"] == "laundry"]
    if not laundry_ops:
        laundry_ops = operators[:1]
    
    services = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Prestige Pressing Bonapriso",
            "description": "Premium dry cleaning and laundry services. Expert care for your finest garments.",
            "operator_id": laundry_ops[0]["_id"],
            "operator_name": laundry_ops[0]["name"],
            "address": "Rue de l'Intendance, Bonapriso",
            "city": "Douala",
            "phone": "+237 677 555 666",
            "email": "bonapriso@prestigepressing.cm",
            "images": [LAUNDRY_IMAGES[0]],
            "services": [
                {"name": "Shirt - Wash & Iron", "type": "wash_iron", "price": 1000, "description": "Professional wash and press"},
                {"name": "Pants/Trousers", "type": "wash_iron", "price": 1500, "description": "Wash and iron"},
                {"name": "Suit (2 pieces)", "type": "dry_clean", "price": 5000, "description": "Professional dry cleaning"},
                {"name": "Dress", "type": "dry_clean", "price": 3500, "description": "Delicate care"},
                {"name": "Bedding Set", "type": "wash", "price": 4000, "description": "Complete bedding wash"},
                {"name": "Traditional Attire", "type": "full_service", "price": 6000, "description": "Special care for traditional wear"}
            ],
            "operating_hours": {"monday": {"open": "07:00", "close": "19:00"}, "tuesday": {"open": "07:00", "close": "19:00"}, "wednesday": {"open": "07:00", "close": "19:00"}, "thursday": {"open": "07:00", "close": "19:00"}, "friday": {"open": "07:00", "close": "19:00"}, "saturday": {"open": "08:00", "close": "16:00"}, "sunday": "closed"},
            "delivery_available": True,
            "delivery_fee": 1500,
            "express_available": True,
            "express_surcharge": 50,
            "min_order_amount": 3000,
            "status": "active",
            "rating": 4.6,
            "total_reviews": 234,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Quick Clean Yaoundé",
            "description": "Fast and affordable laundry services in the heart of Yaoundé. Same-day service available.",
            "operator_id": laundry_ops[0]["_id"],
            "operator_name": laundry_ops[0]["name"],
            "address": "Avenue Kennedy, Bastos",
            "city": "Yaoundé",
            "phone": "+237 699 888 999",
            "email": "yaounde@quickclean.cm",
            "images": [LAUNDRY_IMAGES[1]],
            "services": [
                {"name": "Shirt - Wash & Iron", "type": "wash_iron", "price": 800, "description": "Standard service"},
                {"name": "Pants/Trousers", "type": "wash_iron", "price": 1200, "description": "Wash and iron"},
                {"name": "Suit (2 pieces)", "type": "dry_clean", "price": 4000, "description": "Dry cleaning"},
                {"name": "Laundry by KG", "type": "wash", "price": 2000, "description": "Per kilogram"},
                {"name": "Ironing Only", "type": "iron", "price": 500, "description": "Per item"}
            ],
            "operating_hours": {"monday": {"open": "06:30", "close": "20:00"}, "tuesday": {"open": "06:30", "close": "20:00"}, "wednesday": {"open": "06:30", "close": "20:00"}, "thursday": {"open": "06:30", "close": "20:00"}, "friday": {"open": "06:30", "close": "20:00"}, "saturday": {"open": "07:00", "close": "18:00"}, "sunday": {"open": "08:00", "close": "14:00"}},
            "delivery_available": True,
            "delivery_fee": 1000,
            "express_available": True,
            "express_surcharge": 30,
            "min_order_amount": 2000,
            "status": "active",
            "rating": 4.3,
            "total_reviews": 178,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Fresh & Clean Bafoussam",
            "description": "Your trusted laundry partner in Bafoussam. Quality service at affordable prices.",
            "operator_id": laundry_ops[0]["_id"],
            "operator_name": laundry_ops[0]["name"],
            "address": "Carrefour Total, Centre Ville",
            "city": "Bafoussam",
            "phone": "+237 677 333 444",
            "email": "bafoussam@freshclean.cm",
            "images": [LAUNDRY_IMAGES[2]],
            "services": [
                {"name": "Shirt - Wash & Iron", "type": "wash_iron", "price": 700, "description": "Standard service"},
                {"name": "Pants/Trousers", "type": "wash_iron", "price": 1000, "description": "Wash and iron"},
                {"name": "Suit (2 pieces)", "type": "dry_clean", "price": 3500, "description": "Dry cleaning"},
                {"name": "Blanket/Duvet", "type": "wash", "price": 3000, "description": "Large item wash"}
            ],
            "operating_hours": {"monday": {"open": "07:00", "close": "18:00"}, "tuesday": {"open": "07:00", "close": "18:00"}, "wednesday": {"open": "07:00", "close": "18:00"}, "thursday": {"open": "07:00", "close": "18:00"}, "friday": {"open": "07:00", "close": "18:00"}, "saturday": {"open": "08:00", "close": "15:00"}, "sunday": "closed"},
            "delivery_available": False,
            "delivery_fee": 0,
            "express_available": True,
            "express_surcharge": 25,
            "min_order_amount": 1500,
            "status": "active",
            "rating": 4.1,
            "total_reviews": 67,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Executive Dry Cleaners",
            "description": "Specialized in corporate and executive wear. Premium service for professionals.",
            "operator_id": laundry_ops[0]["_id"],
            "operator_name": laundry_ops[0]["name"],
            "address": "Rue Joss, Bonanjo",
            "city": "Douala",
            "phone": "+237 233 777 888",
            "email": "bonanjo@executivedry.cm",
            "images": [LAUNDRY_IMAGES[0]],
            "services": [
                {"name": "Executive Shirt", "type": "wash_iron", "price": 1500, "description": "Premium shirt service"},
                {"name": "Business Suit", "type": "dry_clean", "price": 7000, "description": "Full suit care"},
                {"name": "Tie/Scarf", "type": "dry_clean", "price": 1000, "description": "Accessory cleaning"},
                {"name": "Corporate Uniform (5 items)", "type": "wash_iron", "price": 5000, "description": "Weekly service"}
            ],
            "operating_hours": {"monday": {"open": "07:00", "close": "19:00"}, "tuesday": {"open": "07:00", "close": "19:00"}, "wednesday": {"open": "07:00", "close": "19:00"}, "thursday": {"open": "07:00", "close": "19:00"}, "friday": {"open": "07:00", "close": "19:00"}, "saturday": {"open": "08:00", "close": "14:00"}, "sunday": "closed"},
            "delivery_available": True,
            "delivery_fee": 2000,
            "express_available": True,
            "express_surcharge": 75,
            "min_order_amount": 5000,
            "status": "active",
            "rating": 4.7,
            "total_reviews": 145,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Green Wash Eco Laundry",
            "description": "Eco-friendly laundry using biodegradable detergents. Good for you and the environment.",
            "operator_id": laundry_ops[0]["_id"],
            "operator_name": laundry_ops[0]["name"],
            "address": "Quartier Nlongkak",
            "city": "Yaoundé",
            "phone": "+237 699 444 555",
            "email": "info@greenwash.cm",
            "images": [LAUNDRY_IMAGES[1]],
            "services": [
                {"name": "Eco Wash (per kg)", "type": "wash", "price": 2500, "description": "Eco-friendly wash"},
                {"name": "Eco Dry Clean", "type": "dry_clean", "price": 4500, "description": "Green dry cleaning"},
                {"name": "Baby Clothes (per kg)", "type": "wash", "price": 3000, "description": "Gentle baby care"},
                {"name": "Allergy-Safe Wash", "type": "wash", "price": 3500, "description": "Hypoallergenic service"}
            ],
            "operating_hours": {"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "friday": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "09:00", "close": "15:00"}, "sunday": "closed"},
            "delivery_available": True,
            "delivery_fee": 1500,
            "express_available": False,
            "express_surcharge": 0,
            "min_order_amount": 4000,
            "status": "active",
            "rating": 4.4,
            "total_reviews": 89,
            "created_at": now,
            "updated_at": now
        }
    ]
    return services


# ============== PACKAGES ==============

def generate_packages(operators: List[Dict]) -> List[Dict[str, Any]]:
    """Generate travel packages"""
    now = datetime.now(timezone.utc).isoformat()
    multi_ops = [op for op in operators if op["operator_type"] == "multi"]
    
    packages = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Discover Cameroon - 7 Days",
            "description": "Experience the best of Cameroon! From the beaches of Kribi to the mountains of the West, this comprehensive tour covers all major attractions.",
            "package_type": "tour",
            "operator_id": multi_ops[0]["_id"],
            "operator_name": multi_ops[0]["name"],
            "destination": "Cameroon",
            "origin": "Douala",
            "duration_days": 7,
            "duration_nights": 6,
            "images": [PACKAGE_IMAGES[0], PACKAGE_IMAGES[1]],
            "itinerary": [
                {"day": 1, "title": "Arrival in Douala", "description": "Airport pickup, hotel check-in, city tour", "activities": ["Airport transfer", "Akwa district tour", "Welcome dinner"]},
                {"day": 2, "title": "Douala to Kribi", "description": "Drive to the beautiful coastal town", "activities": ["Beach relaxation", "Lobe Falls visit", "Seafood dinner"]},
                {"day": 3, "title": "Kribi Beach Day", "description": "Full day at the beach", "activities": ["Swimming", "Boat tour", "Fresh lobster lunch"]},
                {"day": 4, "title": "Kribi to Yaoundé", "description": "Travel to the capital", "activities": ["Scenic drive", "National Museum visit", "Evening city tour"]},
                {"day": 5, "title": "Yaoundé Exploration", "description": "Discover the capital", "activities": ["Mont Fébé", "Craft markets", "Local cuisine"]},
                {"day": 6, "title": "Yaoundé to Bafoussam", "description": "Journey to the highlands", "activities": ["Coffee plantation visit", "Traditional chiefdom tour"]},
                {"day": 7, "title": "Departure", "description": "Return to Douala", "activities": ["Morning market visit", "Airport transfer"]}
            ],
            "inclusions": ["Airport transfers", "6 nights accommodation", "Daily breakfast", "Air-conditioned transport", "Professional guide", "All entrance fees", "Welcome and farewell dinners"],
            "exclusions": ["International flights", "Personal expenses", "Travel insurance", "Optional activities", "Gratuities"],
            "base_price": 750000,
            "price_per_person": True,
            "min_travelers": 2,
            "max_travelers": 12,
            "departure_dates": [(datetime.now(timezone.utc) + timedelta(days=i*7)).date().isoformat() for i in range(1, 9)],
            "hotels_included": [{"name": "4-star hotels", "stars": 4, "nights": 6}],
            "meals_included": {"breakfast": 6, "lunch": 3, "dinner": 3},
            "transport_included": ["private_vehicle"],
            "activities_included": ["city_tours", "nature", "culture"],
            "status": "active",
            "featured": True,
            "tags": ["bestseller", "family", "nature", "culture"],
            "cancellation_policy": "Free cancellation up to 14 days before departure. 50% refund 7-14 days before. No refund within 7 days.",
            "rating": 4.8,
            "total_reviews": 156,
            "total_bookings": 234,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Wildlife Safari - 4 Days",
            "description": "Explore Cameroon's diverse wildlife in the northern parks. Spot elephants, lions, and rare bird species.",
            "package_type": "adventure",
            "operator_id": multi_ops[0]["_id"],
            "operator_name": multi_ops[0]["name"],
            "destination": "Waza National Park",
            "origin": "Douala",
            "duration_days": 4,
            "duration_nights": 3,
            "images": [PACKAGE_IMAGES[2]],
            "itinerary": [
                {"day": 1, "title": "Flight to Maroua", "description": "Domestic flight and transfer to camp", "activities": ["Flight", "Camp setup", "Sunset game drive"]},
                {"day": 2, "title": "Full Day Safari", "description": "Game drives in Waza", "activities": ["Morning safari", "Bird watching", "Evening safari"]},
                {"day": 3, "title": "Safari & Culture", "description": "Wildlife and local villages", "activities": ["Safari", "Village visit", "Traditional dinner"]},
                {"day": 4, "title": "Return", "description": "Final game drive and departure", "activities": ["Morning safari", "Return flight"]}
            ],
            "inclusions": ["Domestic flights", "3 nights safari camp", "All meals", "Game drives", "Professional guide", "Park fees"],
            "exclusions": ["International flights", "Personal expenses", "Travel insurance", "Drinks"],
            "base_price": 950000,
            "price_per_person": True,
            "min_travelers": 4,
            "max_travelers": 8,
            "departure_dates": [(datetime.now(timezone.utc) + timedelta(days=i*14)).date().isoformat() for i in range(1, 5)],
            "hotels_included": [{"name": "Safari Camp", "stars": 3, "nights": 3}],
            "meals_included": {"breakfast": 3, "lunch": 3, "dinner": 3},
            "transport_included": ["domestic_flight", "safari_vehicle"],
            "activities_included": ["safari", "nature", "culture"],
            "status": "active",
            "featured": True,
            "tags": ["adventure", "wildlife", "nature"],
            "rating": 4.9,
            "total_reviews": 89,
            "total_bookings": 123,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Business Traveler Package",
            "description": "Convenient package for business travelers. Includes airport transfers, hotel, and workspace.",
            "package_type": "business",
            "operator_id": multi_ops[1]["_id"],
            "operator_name": multi_ops[1]["name"],
            "destination": "Yaoundé",
            "origin": "Douala",
            "duration_days": 3,
            "duration_nights": 2,
            "images": [PACKAGE_IMAGES[3]],
            "itinerary": [
                {"day": 1, "title": "Arrival", "description": "Transfer and check-in", "activities": ["Airport pickup", "Business center access"]},
                {"day": 2, "title": "Business Day", "description": "Full day for meetings", "activities": ["Breakfast", "Workspace", "City transfer if needed"]},
                {"day": 3, "title": "Departure", "description": "Checkout and transfer", "activities": ["Breakfast", "Airport transfer"]}
            ],
            "inclusions": ["Airport transfers", "2 nights 4-star hotel", "Daily breakfast", "Business center access", "WiFi", "City transfers"],
            "exclusions": ["Meals", "Personal expenses"],
            "base_price": 180000,
            "price_per_person": True,
            "min_travelers": 1,
            "max_travelers": None,
            "departure_dates": [],
            "hotels_included": [{"name": "Business Hotel", "stars": 4, "nights": 2}],
            "meals_included": {"breakfast": 2},
            "transport_included": ["airport_transfer"],
            "activities_included": ["business"],
            "status": "active",
            "featured": False,
            "tags": ["business", "corporate"],
            "rating": 4.5,
            "total_reviews": 67,
            "total_bookings": 189,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Romantic Getaway - Kribi Beach",
            "description": "Perfect honeymoon or romantic escape. Private beach resort, couples spa, and romantic dinners.",
            "package_type": "honeymoon",
            "operator_id": multi_ops[0]["_id"],
            "operator_name": multi_ops[0]["name"],
            "destination": "Kribi",
            "origin": "Douala",
            "duration_days": 5,
            "duration_nights": 4,
            "images": [PACKAGE_IMAGES[1]],
            "itinerary": [
                {"day": 1, "title": "Arrival", "description": "Welcome to paradise", "activities": ["Transfer", "Champagne welcome", "Sunset dinner"]},
                {"day": 2, "title": "Beach Day", "description": "Relax on pristine beaches", "activities": ["Beach", "Couples massage", "Candlelit dinner"]},
                {"day": 3, "title": "Adventure", "description": "Explore the area", "activities": ["Boat tour", "Lobe Falls", "Fresh seafood"]},
                {"day": 4, "title": "Relaxation", "description": "Spa and beach", "activities": ["Spa day", "Private beach", "Romantic dinner"]},
                {"day": 5, "title": "Departure", "description": "Farewell breakfast", "activities": ["Breakfast", "Transfer"]}
            ],
            "inclusions": ["Transfers", "4 nights beach resort", "Daily breakfast", "2 romantic dinners", "Couples spa treatment", "Boat tour", "Champagne"],
            "exclusions": ["Flights", "Personal expenses", "Additional spa treatments"],
            "base_price": 650000,
            "price_per_person": False,
            "min_travelers": 2,
            "max_travelers": 2,
            "departure_dates": [],
            "hotels_included": [{"name": "Beach Resort", "stars": 5, "nights": 4}],
            "meals_included": {"breakfast": 4, "dinner": 2},
            "transport_included": ["private_transfer"],
            "activities_included": ["beach", "spa", "romance"],
            "status": "active",
            "featured": True,
            "tags": ["honeymoon", "romantic", "beach", "couples"],
            "rating": 4.9,
            "total_reviews": 78,
            "total_bookings": 145,
            "created_at": now,
            "updated_at": now
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Western Highlands Explorer - 3 Days",
            "description": "Discover the beautiful western region. Visit traditional kingdoms, coffee plantations, and scenic landscapes.",
            "package_type": "tour",
            "operator_id": multi_ops[0]["_id"],
            "operator_name": multi_ops[0]["name"],
            "destination": "Bafoussam",
            "origin": "Yaoundé",
            "duration_days": 3,
            "duration_nights": 2,
            "images": [PACKAGE_IMAGES[0]],
            "itinerary": [
                {"day": 1, "title": "Journey to the West", "description": "Scenic drive through the highlands", "activities": ["Drive", "Foumban Palace", "Hotel check-in"]},
                {"day": 2, "title": "Cultural Immersion", "description": "Traditional chiefdoms and crafts", "activities": ["Chiefdom visit", "Craft market", "Coffee tour"]},
                {"day": 3, "title": "Nature & Return", "description": "Lake and return", "activities": ["Lake Nyos area", "Return to Yaoundé"]}
            ],
            "inclusions": ["Transport", "2 nights hotel", "Daily breakfast", "Guide", "Entrance fees"],
            "exclusions": ["Lunches", "Personal expenses", "Craft purchases"],
            "base_price": 280000,
            "price_per_person": True,
            "min_travelers": 2,
            "max_travelers": 8,
            "departure_dates": [(datetime.now(timezone.utc) + timedelta(days=i*7)).date().isoformat() for i in range(1, 6)],
            "hotels_included": [{"name": "Highland Hotel", "stars": 3, "nights": 2}],
            "meals_included": {"breakfast": 2},
            "transport_included": ["private_vehicle"],
            "activities_included": ["culture", "nature", "history"],
            "status": "active",
            "featured": False,
            "tags": ["culture", "nature", "highlands"],
            "rating": 4.6,
            "total_reviews": 45,
            "total_bookings": 89,
            "created_at": now,
            "updated_at": now
        }
    ]
    return packages


# ============== MAIN SEEDING FUNCTION ==============

async def seed_database():
    """Main function to seed all mock data"""
    print("🌱 Starting database seeding...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Generate all data
        print("📦 Generating operators...")
        operators = generate_operators()
        
        print("🏨 Generating hotels and rooms...")
        hotels = generate_hotels(operators)
        rooms = generate_rooms(hotels)
        
        print("🍽️ Generating restaurants...")
        restaurants = generate_restaurants(operators)
        
        print("🚌 Generating vehicles and travel routes...")
        vehicles = generate_vehicles(operators)
        travel_routes = generate_travel_routes(operators, vehicles)
        
        print("🚗 Generating car rentals...")
        car_rentals = generate_car_rentals(operators)
        
        print("🎬 Generating cinemas and films...")
        cinemas = generate_cinemas(operators)
        films = generate_films()
        showtimes = generate_showtimes(cinemas, films)
        
        print("🎉 Generating events...")
        events = generate_events(operators)
        
        print("🏛️ Generating banquet halls...")
        banquets = generate_banquets(operators)
        
        print("👔 Generating laundry services...")
        laundry_services = generate_laundry_services(operators)
        
        print("📦 Generating packages...")
        packages = generate_packages(operators)
        
        # Insert into database
        print("\n💾 Inserting data into database...")
        
        # Clear existing mock data (optional - comment out if you want to append)
        # await db.operators.delete_many({})
        # await db.hotels.delete_many({})
        # etc.
        
        # Insert operators
        if operators:
            await db.operators.insert_many(operators)
            print(f"  ✅ Inserted {len(operators)} operators")
        
        # Insert hotels
        if hotels:
            await db.hotels.insert_many(hotels)
            print(f"  ✅ Inserted {len(hotels)} hotels")
        
        # Insert rooms
        if rooms:
            await db.rooms.insert_many(rooms)
            print(f"  ✅ Inserted {len(rooms)} rooms")
        
        # Insert restaurants
        if restaurants:
            await db.restaurants.insert_many(restaurants)
            print(f"  ✅ Inserted {len(restaurants)} restaurants")
        
        # Insert vehicles
        if vehicles:
            await db.vehicles.insert_many(vehicles)
            print(f"  ✅ Inserted {len(vehicles)} vehicles")
        
        # Insert travel routes
        if travel_routes:
            await db.travel_routes.insert_many(travel_routes)
            print(f"  ✅ Inserted {len(travel_routes)} travel routes")
        
        # Insert car rentals
        if car_rentals:
            await db.car_rentals.insert_many(car_rentals)
            print(f"  ✅ Inserted {len(car_rentals)} car rentals")
        
        # Insert cinemas
        if cinemas:
            await db.cinemas.insert_many(cinemas)
            print(f"  ✅ Inserted {len(cinemas)} cinemas")
        
        # Insert films
        if films:
            await db.films.insert_many(films)
            print(f"  ✅ Inserted {len(films)} films")
        
        # Insert showtimes
        if showtimes:
            await db.showtimes.insert_many(showtimes)
            print(f"  ✅ Inserted {len(showtimes)} showtimes")
        
        # Insert events
        if events:
            await db.events.insert_many(events)
            print(f"  ✅ Inserted {len(events)} events")
        
        # Insert banquets
        if banquets:
            await db.banquets.insert_many(banquets)
            print(f"  ✅ Inserted {len(banquets)} banquet halls")
        
        # Insert laundry services
        if laundry_services:
            await db.pressing.insert_many(laundry_services)
            print(f"  ✅ Inserted {len(laundry_services)} laundry services")
        
        # Insert packages
        if packages:
            await db.packages.insert_many(packages)
            print(f"  ✅ Inserted {len(packages)} packages")
        
        print("\n🎉 Database seeding completed successfully!")
        print(f"""
📊 Summary:
   • {len(operators)} Operators
   • {len(hotels)} Hotels with {len(rooms)} Rooms
   • {len(restaurants)} Restaurants
   • {len(vehicles)} Vehicles
   • {len(travel_routes)} Travel Routes
   • {len(car_rentals)} Car Rentals
   • {len(cinemas)} Cinemas with {len(films)} Films
   • {len(showtimes)} Showtimes
   • {len(events)} Events
   • {len(banquets)} Banquet Halls
   • {len(laundry_services)} Laundry Services
   • {len(packages)} Packages
        """)
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        raise e
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())

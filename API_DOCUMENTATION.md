# Oryno API Documentation

## Base URL
Production: `https://[deployed-url]/api`

## Authentication
All endpoints except `/api/public/*` require JWT authentication.

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "customer"
  }
}
```

### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "phone": "+237600000000",
  "role": "customer"  // or "operator"
}
```

### Using Authentication
Add header to all authenticated requests:
```
Authorization: Bearer <access_token>
```

---

## Public Endpoints (No Auth Required)

### Get Available Services
```
GET /api/public/services

Response:
{
  "services": [
    {"id": "hotels", "name": "Hotels", "icon": "hotel", "description": "..."},
    ...
  ]
}
```

### Get Featured Hotels
```
GET /api/public/featured-hotels?limit=6

Response:
{
  "hotels": [
    {"id": "...", "name": "Hilton Douala", "city": "Douala", "star_rating": 5, "price_per_night": 150000},
    ...
  ]
}
```

### Get Featured Packages
```
GET /api/public/featured-packages?limit=6
```

### Get Featured Events
```
GET /api/public/featured-events?limit=6
```

### Get Popular Routes
```
GET /api/public/popular-routes?limit=8
```

### Get Platform Statistics
```
GET /api/public/stats

Response:
{
  "total_hotels": 50,
  "total_routes": 100,
  "total_vehicles": 200,
  "cities_covered": 8
}
```

### Get Cities
```
GET /api/public/cities
```

### Get Testimonials
```
GET /api/public/testimonials
```

---

## Hotels API

### Search Hotels
```
GET /api/hotels/?city=Douala&star_rating=4

Response:
{
  "hotels": [...],
  "total": 10
}
```

### Get Hotel Details
```
GET /api/hotels/{hotel_id}
```

### Get Hotel Rooms
```
GET /api/rooms/?hotel_id={hotel_id}
```

### Check Room Availability
```
GET /api/rooms/availability?room_id={id}&check_in=2025-01-15&check_out=2025-01-18
```

### Book Room
```
POST /api/rooms/bookings/reserve
Authorization: Bearer <token>

{
  "room_id": "uuid",
  "check_in": "2025-01-15",
  "check_out": "2025-01-18",
  "guests": 2,
  "special_requests": "Late check-in"
}
```

---

## Travel API

### Search Routes
```
GET /api/travel/routes?from_city=Douala&to_city=Yaounde
```

### Get Seat Availability
```
GET /api/seat-bookings/availability?route_id={id}&travel_date=2025-01-15
```

### Reserve Seats
```
POST /api/seat-bookings/reserve
Authorization: Bearer <token>

{
  "route_id": "uuid",
  "travel_date": "2025-01-15",
  "seats": ["1A", "1B"],
  "passenger_name": "John Doe",
  "passenger_phone": "+237600000000"
}
```

---

## Car Rental API

### Search Vehicles
```
GET /api/vehicles/?city=Douala&type=suv&available=true
```

### Get Vehicle Details
```
GET /api/vehicles/{vehicle_id}
```

### Book Vehicle
```
POST /api/car-rental/book
Authorization: Bearer <token>

{
  "vehicle_id": "uuid",
  "pickup_date": "2025-01-15",
  "return_date": "2025-01-18",
  "pickup_location": "Douala Airport",
  "return_location": "Douala Airport"
}
```

---

## Restaurants API

### Search Restaurants
```
GET /api/restaurants/?city=Yaounde&cuisine_type=african
```

### Get Restaurant Details
```
GET /api/restaurants/{restaurant_id}
```

### Get Menu
```
GET /api/restaurants/{restaurant_id}/menu
```

### Make Reservation
```
POST /api/restaurants/{restaurant_id}/book
Authorization: Bearer <token>

{
  "date": "2025-01-15",
  "time": "19:00",
  "guests": 4,
  "special_requests": "Window table"
}
```

---

## Events API

### Search Events
```
GET /api/events/?city=Douala&type=Festival
```

### Get Event Details
```
GET /api/events/{event_id}
```

### Book Event Tickets
```
POST /api/events/{event_id}/book?tickets=2
Authorization: Bearer <token>
```

---

## Cinema API

### Get Cinemas
```
GET /api/cinema/?city=Douala
```

### Get Films
```
GET /api/cinema/films?status=now_showing
```

### Get Showtimes
```
GET /api/cinema/{cinema_id}/showtimes?film_id={id}
```

### Book Seats
```
POST /api/cinema/showtimes/{showtime_id}/book?seats=A1,A2
Authorization: Bearer <token>
```

---

## Packages API

### Search Packages
```
GET /api/packages/?destination=Kribi&package_type=honeymoon
```

### Get Package Details
```
GET /api/packages/{package_id}
```

### Book Package
```
POST /api/packages/{package_id}/book?departure_date=2025-02-01&travelers=2
Authorization: Bearer <token>
```

---

## Orders API

### Get User Orders
```
GET /api/orders/
Authorization: Bearer <token>
```

### Get Order Details
```
GET /api/orders/{order_id}
Authorization: Bearer <token>
```

### Cancel Order
```
POST /api/orders/{order_id}/cancel
Authorization: Bearer <token>
```

---

## User Profile API

### Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

### Update Profile
```
PUT /api/auth/profile
Authorization: Bearer <token>

{
  "full_name": "John Doe",
  "phone": "+237600000000"
}
```

---

## Response Format

### Success Response
```json
{
  "data": {...},
  "message": "Success"
}
```

### Error Response
```json
{
  "detail": "Error message"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Currency Format
All prices are in **FCFA** (West African CFA Franc).
Format: Number without decimals (e.g., `150000` = 150,000 FCFA)

---

## Rate Limiting
- Public endpoints: 100 requests/minute
- Authenticated endpoints: 300 requests/minute

---

## Mobile App Integration Notes

1. **Store token securely** - Use device keychain/keystore
2. **Handle token expiry** - Tokens expire after 24 hours, implement refresh flow
3. **Offline support** - Cache frequently accessed data locally
4. **Image optimization** - Request appropriate image sizes
5. **Error handling** - Always handle network errors gracefully

---

## Support
For API issues, contact: api-support@oryno.com

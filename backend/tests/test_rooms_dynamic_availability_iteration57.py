"""
Test rooms dynamic availability feature - Iteration 57
Tests:
1. GET /api/rooms/?hotel_id=X returns rooms (backwards compatible, no date params)
2. GET /api/rooms/?hotel_id=X&check_in=Y&check_out=Z calculates available_rooms dynamically
3. available_rooms = total_rooms - active_bookings (reserved/confirmed) overlapping date range
4. Booking lifecycle affects availability correctly
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
HOTEL_ID = "bbbda704-a398-4bc2-9672-429de246feaf"  # Hilton Hotel
ROOM_ID_DELUXE = "23c64c64-b030-460f-9703-d88ba6ea053b"  # Deluxe room

@pytest.fixture(scope="module")
def customer_auth():
    """Login as customer and get token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "customer@test.com", "password": "testpassword123"}
    )
    if response.status_code != 200:
        pytest.skip(f"Customer login failed: {response.status_code}")
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


class TestRoomsEndpointBackwardsCompatibility:
    """Test GET /api/rooms/ works without check_in/check_out params"""
    
    def test_01_get_rooms_without_dates_returns_200(self):
        """Rooms endpoint works without date params (backwards compatible)"""
        response = requests.get(f"{BASE_URL}/api/rooms/", params={"hotel_id": HOTEL_ID})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "rooms" in data, "Response missing 'rooms' field"
        assert "total" in data, "Response missing 'total' field"
        print(f"PASS - GET /api/rooms/ without dates returns {data['total']} rooms")
    
    def test_02_rooms_have_required_fields(self):
        """Each room has id, available_rooms, total_rooms"""
        response = requests.get(f"{BASE_URL}/api/rooms/", params={"hotel_id": HOTEL_ID})
        
        assert response.status_code == 200
        data = response.json()
        
        for room in data["rooms"]:
            assert "id" in room, "Room missing 'id' field"
            assert "available_rooms" in room, f"Room {room.get('id')} missing 'available_rooms'"
            assert "total_rooms" in room, f"Room {room.get('id')} missing 'total_rooms'"
            assert room["available_rooms"] <= room["total_rooms"], \
                f"Room {room.get('id')}: available_rooms ({room['available_rooms']}) > total_rooms ({room['total_rooms']})"
        
        print(f"PASS - All {len(data['rooms'])} rooms have required fields with valid values")
    
    def test_03_rooms_filtering_by_room_type(self):
        """Test room_type filter works"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "room_type": "deluxe"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for room in data["rooms"]:
            assert room.get("room_type") == "deluxe", f"Expected deluxe, got {room.get('room_type')}"
        
        print(f"PASS - room_type filter returns only deluxe rooms ({len(data['rooms'])} found)")


class TestRoomsDynamicAvailability:
    """Test dynamic available_rooms calculation with date params"""
    
    def test_04_get_rooms_with_dates_returns_200(self):
        """Rooms endpoint works with check_in/check_out params"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={
                "hotel_id": HOTEL_ID,
                "check_in": "2026-02-01",
                "check_out": "2026-02-05"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "rooms" in data
        print(f"PASS - GET /api/rooms/ with dates returns {data['total']} rooms")
    
    def test_05_available_rooms_not_exceeds_total(self):
        """With dates, available_rooms <= total_rooms"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={
                "hotel_id": HOTEL_ID,
                "check_in": "2026-03-01",
                "check_out": "2026-03-10"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for room in data["rooms"]:
            available = room.get("available_rooms", 0)
            total = room.get("total_rooms", 0)
            assert available <= total, \
                f"Room {room.get('room_name')}: available ({available}) > total ({total})"
            assert available >= 0, f"available_rooms should be >= 0, got {available}"
        
        print("PASS - All rooms have valid available_rooms <= total_rooms")
    
    def test_06_future_dates_show_full_availability(self):
        """Far future dates should show more availability (fewer bookings)"""
        # Far future - should have full or nearly full availability
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_checkout = (datetime.now() + timedelta(days=370)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={
                "hotel_id": HOTEL_ID,
                "check_in": future_date,
                "check_out": future_checkout
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # At least one room should be available in far future
        has_available = any(r.get("available_rooms", 0) > 0 for r in data["rooms"])
        assert has_available, "No rooms available in far future - unexpected"
        
        print(f"PASS - Future dates ({future_date}) show availability")


class TestBookingAffectsAvailability:
    """Test that creating/canceling bookings changes availability"""
    
    def test_07_create_reservation_check_availability(self, customer_auth):
        """Create a reservation and verify it affects room count"""
        # Step 1: Get initial availability for a specific date range
        check_in = "2026-06-15"
        check_out = "2026-06-18"
        
        response_before = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in, "check_out": check_out}
        )
        assert response_before.status_code == 200
        
        rooms_before = {r["id"]: r["available_rooms"] for r in response_before.json()["rooms"]}
        
        # Find a room with availability
        available_room_id = None
        for room_id, available in rooms_before.items():
            if available > 0:
                available_room_id = room_id
                break
        
        if not available_room_id:
            pytest.skip("No available rooms to test with")
        
        initial_available = rooms_before[available_room_id]
        print(f"Initial availability for room {available_room_id}: {initial_available}")
        
        # Step 2: Create a reservation
        reservation_payload = {
            "hotel_id": HOTEL_ID,
            "room_id": available_room_id,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "guests": 2,
            "guest_name": "TEST_DynamicAvail User",
            "guest_email": "test_dynamic@test.com",
            "guest_phone": "+237699000111",
            "special_requests": "Testing dynamic availability"
        }
        
        reserve_response = requests.post(
            f"{BASE_URL}/api/rooms/bookings/reserve",
            json=reservation_payload,
            headers=customer_auth
        )
        
        if reserve_response.status_code == 400:
            # Room might be fully booked
            pytest.skip("Room not available for selected dates")
        
        assert reserve_response.status_code == 200, \
            f"Reserve failed: {reserve_response.status_code} - {reserve_response.text}"
        
        booking_data = reserve_response.json()
        booking_id = booking_data.get("booking_id")
        print(f"Created reservation: {booking_id}")
        
        # Step 3: Check availability decreased
        response_after = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in, "check_out": check_out}
        )
        assert response_after.status_code == 200
        
        rooms_after = {r["id"]: r["available_rooms"] for r in response_after.json()["rooms"]}
        new_available = rooms_after.get(available_room_id, 0)
        
        # Availability should decrease by 1
        assert new_available == initial_available - 1, \
            f"Expected available to drop from {initial_available} to {initial_available - 1}, got {new_available}"
        
        print(f"PASS - Reservation created, availability dropped: {initial_available} -> {new_available}")
        
        # Cleanup: Cancel the booking
        cancel_response = requests.post(
            f"{BASE_URL}/api/rooms/bookings/{booking_id}/cancel",
            headers=customer_auth
        )
        print(f"Cleanup: Cancel response: {cancel_response.status_code}")
    
    def test_08_cancelled_booking_restores_availability(self, customer_auth):
        """Cancelling a booking should restore availability (for reserved status)"""
        # Create a reservation
        check_in = "2026-07-20"
        check_out = "2026-07-25"
        
        # Get initial state
        response_initial = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in, "check_out": check_out}
        )
        assert response_initial.status_code == 200
        rooms_initial = {r["id"]: r["available_rooms"] for r in response_initial.json()["rooms"]}
        
        # Find available room
        available_room_id = None
        for room_id, available in rooms_initial.items():
            if available > 0:
                available_room_id = room_id
                break
        
        if not available_room_id:
            pytest.skip("No available rooms")
        
        initial_count = rooms_initial[available_room_id]
        
        # Create reservation
        reservation_payload = {
            "hotel_id": HOTEL_ID,
            "room_id": available_room_id,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "guests": 2,
            "guest_name": "TEST_CancelRestore User",
            "guest_email": "test_cancel@test.com",
            "guest_phone": "+237699000222"
        }
        
        reserve_resp = requests.post(
            f"{BASE_URL}/api/rooms/bookings/reserve",
            json=reservation_payload,
            headers=customer_auth
        )
        
        if reserve_resp.status_code != 200:
            pytest.skip(f"Could not create reservation: {reserve_resp.text}")
        
        booking_id = reserve_resp.json().get("booking_id")
        
        # Verify dropped
        response_after_reserve = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in, "check_out": check_out}
        )
        rooms_after_reserve = {r["id"]: r["available_rooms"] for r in response_after_reserve.json()["rooms"]}
        after_reserve_count = rooms_after_reserve.get(available_room_id, 0)
        
        # Cancel the booking
        cancel_resp = requests.post(
            f"{BASE_URL}/api/rooms/bookings/{booking_id}/cancel",
            headers=customer_auth
        )
        assert cancel_resp.status_code == 200, f"Cancel failed: {cancel_resp.text}"
        
        # Verify availability restored (cancelled bookings don't count in availability calc)
        response_after_cancel = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in, "check_out": check_out}
        )
        rooms_after_cancel = {r["id"]: r["available_rooms"] for r in response_after_cancel.json()["rooms"]}
        after_cancel_count = rooms_after_cancel.get(available_room_id, 0)
        
        # After cancel, availability should be back to original
        assert after_cancel_count == initial_count, \
            f"After cancel: expected {initial_count}, got {after_cancel_count}"
        
        print(f"PASS - Availability restored after cancel: {initial_count} -> {after_reserve_count} -> {after_cancel_count}")


class TestDateRangeOverlapLogic:
    """Test that booking overlap logic is correct"""
    
    def test_09_non_overlapping_dates_full_availability(self, customer_auth):
        """Booking for Jan doesn't affect Feb availability"""
        # Create booking for January
        check_in_jan = "2026-08-10"
        check_out_jan = "2026-08-15"
        
        # Check February availability
        check_in_feb = "2026-09-10"
        check_out_feb = "2026-09-15"
        
        # Get initial Feb availability
        response_feb_initial = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in_feb, "check_out": check_out_feb}
        )
        assert response_feb_initial.status_code == 200
        feb_initial = {r["id"]: r["available_rooms"] for r in response_feb_initial.json()["rooms"]}
        
        # Find available room
        available_room_id = None
        for room_id, available in feb_initial.items():
            if available > 0:
                available_room_id = room_id
                break
        
        if not available_room_id:
            pytest.skip("No available rooms")
        
        feb_initial_count = feb_initial[available_room_id]
        
        # Create booking for August (different month)
        reservation_payload = {
            "hotel_id": HOTEL_ID,
            "room_id": available_room_id,
            "check_in_date": check_in_jan,
            "check_out_date": check_out_jan,
            "guests": 1,
            "guest_name": "TEST_NonOverlap User",
            "guest_email": "test_nonoverlap@test.com",
            "guest_phone": "+237699000333"
        }
        
        reserve_resp = requests.post(
            f"{BASE_URL}/api/rooms/bookings/reserve",
            json=reservation_payload,
            headers=customer_auth
        )
        
        if reserve_resp.status_code != 200:
            pytest.skip(f"Could not create reservation: {reserve_resp.text}")
        
        booking_id = reserve_resp.json().get("booking_id")
        
        # Check September availability - should be unchanged
        response_feb_after = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "check_in": check_in_feb, "check_out": check_out_feb}
        )
        feb_after = {r["id"]: r["available_rooms"] for r in response_feb_after.json()["rooms"]}
        feb_after_count = feb_after.get(available_room_id, 0)
        
        # September availability should be same as before (booking is in August)
        assert feb_after_count == feb_initial_count, \
            f"Non-overlapping booking should not affect Sept availability: {feb_initial_count} vs {feb_after_count}"
        
        print(f"PASS - Aug booking doesn't affect Sept availability (both at {feb_initial_count})")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/rooms/bookings/{booking_id}/cancel", headers=customer_auth)


class TestPaginationAndFilters:
    """Test pagination and filters work with dynamic availability"""
    
    def test_10_pagination_works(self):
        """skip and limit params work correctly"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": HOTEL_ID, "skip": 0, "limit": 1}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["rooms"]) <= 1, "Limit=1 should return at most 1 room"
        print(f"PASS - Pagination (limit=1) returns {len(data['rooms'])} room(s)")
    
    def test_11_different_hotel_returns_different_rooms(self):
        """Different hotel_id returns different set of rooms"""
        other_hotel = "18bed247-7f12-41a7-a037-531387c80b35"  # Sawa Hotel Douala
        
        response1 = requests.get(f"{BASE_URL}/api/rooms/", params={"hotel_id": HOTEL_ID})
        response2 = requests.get(f"{BASE_URL}/api/rooms/", params={"hotel_id": other_hotel})
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        rooms1_ids = {r["id"] for r in response1.json()["rooms"]}
        rooms2_ids = {r["id"] for r in response2.json()["rooms"]}
        
        # Should have no overlap (different hotels)
        overlap = rooms1_ids & rooms2_ids
        assert len(overlap) == 0, f"Different hotels should have different rooms, found overlap: {overlap}"
        
        print(f"PASS - Different hotels return different rooms (Hotel1: {len(rooms1_ids)}, Hotel2: {len(rooms2_ids)})")


class TestErrorHandling:
    """Test error handling for rooms endpoint"""
    
    def test_12_missing_hotel_id_returns_error(self):
        """Missing hotel_id should return 422"""
        response = requests.get(f"{BASE_URL}/api/rooms/")
        # FastAPI returns 422 for missing required query params
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("PASS - Missing hotel_id returns 422 validation error")
    
    def test_13_invalid_hotel_id_returns_empty(self):
        """Invalid hotel_id returns empty list (not error)"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={"hotel_id": "invalid-uuid-12345"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0, "Invalid hotel should return 0 rooms"
        assert len(data["rooms"]) == 0
        print("PASS - Invalid hotel_id returns empty list with total=0")
    
    def test_14_invalid_date_format_handled(self):
        """Invalid date format should be handled gracefully"""
        response = requests.get(
            f"{BASE_URL}/api/rooms/",
            params={
                "hotel_id": HOTEL_ID,
                "check_in": "invalid-date",
                "check_out": "also-invalid"
            }
        )
        # Should either return 422 validation error OR return results (treating invalid dates as no filter)
        # The current implementation may pass invalid dates to MongoDB query
        assert response.status_code in [200, 422, 400], \
            f"Unexpected status {response.status_code} for invalid dates"
        print(f"PASS - Invalid dates handled with status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

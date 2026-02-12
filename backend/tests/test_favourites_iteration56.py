"""
Iteration 56 - Favourites API Backend Tests
Tests CRUD operations for the favourites system:
1. POST /api/favourites/ - Add item to favourites
2. GET /api/favourites/ - List user favourites with service_type filter
3. DELETE /api/favourites/{service_type}/{item_id} - Remove from favourites
4. GET /api/favourites/ids?service_type=X - Bulk get favourite item IDs
5. GET /api/favourites/check?service_type=X&item_id=Y - Check if item is favourited
6. Duplicate add returns 'Already in favourites'
7. User-scoped favourites (different users see different favourites)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_CREDENTIALS = {"email": "customer@test.com", "password": "testpassword123"}
SUPERADMIN_CREDENTIALS = {"email": "superadmin@oryno.com", "password": "testpassword123"}


class TestFavouritesAPI:
    """Test Favourites CRUD API"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get authentication token for customer user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER_CREDENTIALS)
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get authentication token for superadmin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Superadmin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture
    def customer_headers(self, customer_token):
        """Headers with customer auth"""
        return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}
    
    @pytest.fixture
    def superadmin_headers(self, superadmin_token):
        """Headers with superadmin auth"""
        return {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
    
    # ==================== POST /api/favourites/ Tests ====================
    
    def test_01_create_favourite_hotels(self, customer_headers):
        """POST /api/favourites/ - Create a hotel favourite"""
        test_id = f"TEST_hotel_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "hotels",
            "item_id": test_id,
            "item_name": "TEST Grand Hotel Cameroon",
            "item_image": "https://example.com/hotel.jpg",
            "item_location": "Douala, Cameroon",
            "item_price": 150.00,
            "item_rating": 4.5
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200, f"Create favourite failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["message"] == "Added to favourites"
        assert "id" in data
        # Store for cleanup
        self.__class__.test_hotel_id = test_id
        print(f"PASS: Created hotel favourite with id={test_id}")
    
    def test_02_create_favourite_travel(self, customer_headers):
        """POST /api/favourites/ - Create a travel favourite"""
        test_id = f"TEST_travel_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "travel",
            "item_id": test_id,
            "item_name": "TEST Douala to Yaoundé Express",
            "item_location": "Douala",
            "item_price": 5000.00,
            "item_rating": 4.8,
            "extra": {"to_city": "Yaoundé", "vehicle_type": "VIP Bus"}
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200, f"Create favourite failed: {response.text}"
        data = response.json()
        assert data["message"] == "Added to favourites"
        self.__class__.test_travel_id = test_id
        print(f"PASS: Created travel favourite with id={test_id}")
    
    def test_03_create_favourite_restaurants(self, customer_headers):
        """POST /api/favourites/ - Create a restaurant favourite"""
        test_id = f"TEST_restaurant_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "restaurants",
            "item_id": test_id,
            "item_name": "TEST Le Gourmet Restaurant",
            "item_location": "Yaoundé",
            "item_price": 25.00,
            "item_rating": 4.2,
            "extra": {"cuisine_type": "French"}
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200
        self.__class__.test_restaurant_id = test_id
        print(f"PASS: Created restaurant favourite with id={test_id}")
    
    def test_04_create_favourite_car_rental(self, customer_headers):
        """POST /api/favourites/ - Create a car_rental favourite"""
        test_id = f"TEST_car_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "car_rental",
            "item_id": test_id,
            "item_name": "TEST Toyota Corolla 2023",
            "item_location": "Douala Airport",
            "item_price": 75.00,
            "item_rating": 4.0
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200
        self.__class__.test_car_id = test_id
        print(f"PASS: Created car_rental favourite with id={test_id}")
    
    def test_05_create_favourite_events(self, customer_headers):
        """POST /api/favourites/ - Create an events favourite"""
        test_id = f"TEST_event_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "events",
            "item_id": test_id,
            "item_name": "TEST Music Festival 2026",
            "item_location": "Limbe Beach",
            "item_price": 10000.00,
            "item_rating": 4.9
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200
        self.__class__.test_event_id = test_id
        print(f"PASS: Created events favourite with id={test_id}")
    
    # ==================== Duplicate Add Test ====================
    
    def test_06_duplicate_add_returns_already_in_favourites(self, customer_headers):
        """POST /api/favourites/ - Adding duplicate returns 'Already in favourites'"""
        # Try to add the same hotel again
        payload = {
            "service_type": "hotels",
            "item_id": self.__class__.test_hotel_id,
            "item_name": "TEST Grand Hotel Cameroon",
            "item_location": "Douala, Cameroon",
            "item_price": 150.00,
            "item_rating": 4.5
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200, f"Duplicate add should succeed with message: {response.text}"
        data = response.json()
        assert "Already in favourites" in data["message"], f"Expected 'Already in favourites', got: {data}"
        print(f"PASS: Duplicate add returns 'Already in favourites' message")
    
    # ==================== GET /api/favourites/ Tests ====================
    
    def test_07_get_all_favourites(self, customer_headers):
        """GET /api/favourites/ - Get all user favourites"""
        response = requests.get(f"{BASE_URL}/api/favourites/", headers=customer_headers)
        assert response.status_code == 200, f"Get favourites failed: {response.text}"
        data = response.json()
        assert "favourites" in data
        assert "total" in data
        assert data["total"] >= 5, f"Expected at least 5 favourites, got {data['total']}"
        print(f"PASS: Got {data['total']} total favourites")
    
    def test_08_get_favourites_filtered_by_hotels(self, customer_headers):
        """GET /api/favourites/?service_type=hotels - Filter by hotels"""
        response = requests.get(f"{BASE_URL}/api/favourites/?service_type=hotels", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        assert "favourites" in data
        # Check all returned items are hotels
        for fav in data["favourites"]:
            assert fav["service_type"] == "hotels", f"Expected hotels, got {fav['service_type']}"
        print(f"PASS: service_type=hotels filter returns {len(data['favourites'])} hotel favourites")
    
    def test_09_get_favourites_filtered_by_travel(self, customer_headers):
        """GET /api/favourites/?service_type=travel - Filter by travel"""
        response = requests.get(f"{BASE_URL}/api/favourites/?service_type=travel", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        for fav in data["favourites"]:
            assert fav["service_type"] == "travel"
        print(f"PASS: service_type=travel filter returns {len(data['favourites'])} travel favourites")
    
    def test_10_get_favourites_pagination(self, customer_headers):
        """GET /api/favourites/?skip=0&limit=2 - Test pagination"""
        response = requests.get(f"{BASE_URL}/api/favourites/?skip=0&limit=2", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["favourites"]) <= 2, f"Expected max 2 items, got {len(data['favourites'])}"
        print(f"PASS: Pagination returns {len(data['favourites'])} items with limit=2")
    
    # ==================== GET /api/favourites/ids Tests ====================
    
    def test_11_get_favourite_ids_for_hotels(self, customer_headers):
        """GET /api/favourites/ids?service_type=hotels - Get hotel favourite IDs"""
        response = requests.get(f"{BASE_URL}/api/favourites/ids?service_type=hotels", headers=customer_headers)
        assert response.status_code == 200, f"Get favourite IDs failed: {response.text}"
        data = response.json()
        assert "ids" in data
        assert isinstance(data["ids"], list)
        assert self.__class__.test_hotel_id in data["ids"], f"Expected {self.__class__.test_hotel_id} in IDs"
        print(f"PASS: Got {len(data['ids'])} hotel favourite IDs, including test hotel")
    
    def test_12_get_favourite_ids_for_travel(self, customer_headers):
        """GET /api/favourites/ids?service_type=travel - Get travel favourite IDs"""
        response = requests.get(f"{BASE_URL}/api/favourites/ids?service_type=travel", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        assert "ids" in data
        assert self.__class__.test_travel_id in data["ids"]
        print(f"PASS: Got {len(data['ids'])} travel favourite IDs")
    
    def test_13_get_favourite_ids_for_events(self, customer_headers):
        """GET /api/favourites/ids?service_type=events - Get events favourite IDs"""
        response = requests.get(f"{BASE_URL}/api/favourites/ids?service_type=events", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        assert "ids" in data
        print(f"PASS: Got {len(data['ids'])} events favourite IDs")
    
    # ==================== GET /api/favourites/check Tests ====================
    
    def test_14_check_favourite_exists(self, customer_headers):
        """GET /api/favourites/check - Check item is in favourites (true)"""
        response = requests.get(
            f"{BASE_URL}/api/favourites/check?service_type=hotels&item_id={self.__class__.test_hotel_id}",
            headers=customer_headers
        )
        assert response.status_code == 200, f"Check favourite failed: {response.text}"
        data = response.json()
        assert "is_favourite" in data
        assert data["is_favourite"] is True, f"Expected is_favourite=True, got {data}"
        print(f"PASS: Check favourite returns is_favourite=True for existing item")
    
    def test_15_check_favourite_not_exists(self, customer_headers):
        """GET /api/favourites/check - Check item NOT in favourites (false)"""
        fake_id = "non_existent_item_12345"
        response = requests.get(
            f"{BASE_URL}/api/favourites/check?service_type=hotels&item_id={fake_id}",
            headers=customer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_favourite"] is False, f"Expected is_favourite=False, got {data}"
        print(f"PASS: Check favourite returns is_favourite=False for non-existent item")
    
    # ==================== User Scoping Tests ====================
    
    def test_16_different_user_has_different_favourites(self, superadmin_headers, customer_headers):
        """Favourites are user-scoped - different users have different favourites"""
        # Superadmin should not see customer's test hotel in their IDs
        response = requests.get(
            f"{BASE_URL}/api/favourites/ids?service_type=hotels",
            headers=superadmin_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Superadmin should NOT have the customer's test hotel in their favourites
        # (unless they also added it, which they didn't)
        assert self.__class__.test_hotel_id not in data["ids"], \
            f"Superadmin should not see customer's test hotel {self.__class__.test_hotel_id}"
        print(f"PASS: User scoping works - superadmin doesn't see customer's hotel favourite")
    
    def test_17_superadmin_can_add_own_favourites(self, superadmin_headers):
        """Superadmin can add their own favourites"""
        test_id = f"TEST_admin_hotel_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "hotels",
            "item_id": test_id,
            "item_name": "TEST Admin Favourite Hotel",
            "item_location": "Bamenda",
            "item_price": 200.00,
            "item_rating": 4.7
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=superadmin_headers)
        assert response.status_code == 200
        self.__class__.test_admin_hotel_id = test_id
        print(f"PASS: Superadmin created their own favourite: {test_id}")
    
    def test_18_superadmin_favourite_not_visible_to_customer(self, customer_headers):
        """Customer cannot see superadmin's favourites"""
        response = requests.get(
            f"{BASE_URL}/api/favourites/ids?service_type=hotels",
            headers=customer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert self.__class__.test_admin_hotel_id not in data["ids"], \
            f"Customer should not see superadmin's hotel {self.__class__.test_admin_hotel_id}"
        print(f"PASS: User scoping works - customer doesn't see superadmin's hotel favourite")
    
    # ==================== DELETE /api/favourites/{service_type}/{item_id} Tests ====================
    
    def test_19_delete_favourite(self, customer_headers):
        """DELETE /api/favourites/{service_type}/{item_id} - Remove a favourite"""
        response = requests.delete(
            f"{BASE_URL}/api/favourites/hotels/{self.__class__.test_hotel_id}",
            headers=customer_headers
        )
        assert response.status_code == 200, f"Delete favourite failed: {response.text}"
        data = response.json()
        assert "Removed from favourites" in data["message"]
        print(f"PASS: Deleted hotel favourite {self.__class__.test_hotel_id}")
    
    def test_20_deleted_favourite_not_in_ids(self, customer_headers):
        """Deleted favourite no longer appears in /ids endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/favourites/ids?service_type=hotels",
            headers=customer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert self.__class__.test_hotel_id not in data["ids"], \
            f"Deleted hotel should not appear in IDs: {data['ids']}"
        print(f"PASS: Deleted favourite no longer in /ids response")
    
    def test_21_check_deleted_favourite_returns_false(self, customer_headers):
        """Check deleted favourite returns is_favourite=false"""
        response = requests.get(
            f"{BASE_URL}/api/favourites/check?service_type=hotels&item_id={self.__class__.test_hotel_id}",
            headers=customer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_favourite"] is False
        print(f"PASS: Deleted favourite check returns is_favourite=False")
    
    def test_22_delete_non_existent_favourite_returns_404(self, customer_headers):
        """DELETE non-existent favourite returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/favourites/hotels/non_existent_item_xyz",
            headers=customer_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"PASS: Deleting non-existent favourite returns 404")
    
    # ==================== Cleanup Tests ====================
    
    def test_99_cleanup_test_data(self, customer_headers, superadmin_headers):
        """Clean up all TEST_ prefixed favourites"""
        # Clean up remaining customer favourites
        for service_type, item_id_attr in [
            ("travel", "test_travel_id"),
            ("restaurants", "test_restaurant_id"),
            ("car_rental", "test_car_id"),
            ("events", "test_event_id")
        ]:
            item_id = getattr(self.__class__, item_id_attr, None)
            if item_id:
                requests.delete(f"{BASE_URL}/api/favourites/{service_type}/{item_id}", headers=customer_headers)
        
        # Clean up superadmin favourite
        if hasattr(self.__class__, "test_admin_hotel_id"):
            requests.delete(
                f"{BASE_URL}/api/favourites/hotels/{self.__class__.test_admin_hotel_id}",
                headers=superadmin_headers
            )
        
        print(f"PASS: Cleaned up all TEST_ prefixed favourites")


# Additional standalone tests for edge cases
class TestFavouritesEdgeCases:
    """Edge case tests for Favourites API"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("access_token")
    
    @pytest.fixture
    def customer_headers(self, customer_token):
        return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}
    
    def test_favourite_with_minimal_data(self, customer_headers):
        """Create favourite with only required fields"""
        test_id = f"TEST_minimal_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "cinema",
            "item_id": test_id,
            "item_name": "TEST Minimal Movie"
            # No optional fields
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/favourites/cinema/{test_id}", headers=customer_headers)
        print(f"PASS: Favourite created with minimal data")
    
    def test_favourite_with_extra_metadata(self, customer_headers):
        """Create favourite with extra metadata in 'extra' field"""
        test_id = f"TEST_extra_{uuid.uuid4().hex[:8]}"
        payload = {
            "service_type": "packages",
            "item_id": test_id,
            "item_name": "TEST Holiday Package",
            "item_location": "Kribi Beach",
            "item_price": 500000.00,
            "item_rating": 4.6,
            "extra": {
                "duration_days": 7,
                "includes_flight": True,
                "destination": "Kribi",
                "hotel_stars": 5
            }
        }
        response = requests.post(f"{BASE_URL}/api/favourites/", json=payload, headers=customer_headers)
        assert response.status_code == 200
        
        # Verify extra data is stored
        response = requests.get(f"{BASE_URL}/api/favourites/?service_type=packages", headers=customer_headers)
        assert response.status_code == 200
        data = response.json()
        found = False
        for fav in data["favourites"]:
            if fav["item_id"] == test_id:
                assert fav["extra"]["duration_days"] == 7
                assert fav["extra"]["includes_flight"] is True
                found = True
                break
        assert found, "Created favourite not found in list"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/favourites/packages/{test_id}", headers=customer_headers)
        print(f"PASS: Favourite with extra metadata stored correctly")
    
    def test_unauthenticated_request_fails(self):
        """Unauthenticated requests to favourites should fail"""
        response = requests.get(f"{BASE_URL}/api/favourites/")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: Unauthenticated request returns {response.status_code}")
    
    def test_all_service_types_supported(self, customer_headers):
        """All service types can have favourites"""
        service_types = ["hotels", "travel", "car_rental", "restaurants", "events", "cinema", "laundry", "banquets", "packages"]
        
        for svc in service_types:
            response = requests.get(f"{BASE_URL}/api/favourites/ids?service_type={svc}", headers=customer_headers)
            assert response.status_code == 200, f"Failed for service_type={svc}: {response.text}"
            data = response.json()
            assert "ids" in data
        
        print(f"PASS: All {len(service_types)} service types supported")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

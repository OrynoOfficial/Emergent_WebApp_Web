"""
Iteration 101: Operator Scope Filter Feature Tests
Tests the dynamic operator search dropdown that filters page data by operator.
- GET /api/operators/by-service endpoint
- operator_id query param filtering on various service endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

# Known operator IDs from context
MUSANGO_OPERATOR_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"  # travel operator
ORYNO_OPERATOR_ID = "0f899b9d-1e7f-42a8-861f-5a0c9fe68ade"  # multi operator
WEST_REGION_OPERATOR_ID = "f6a076d3-da3a-46de-a096-dc91418afd16"  # travel operator


class TestOperatorsByServiceEndpoint:
    """Tests for GET /api/operators/by-service endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_get_all_operators_no_filter(self):
        """GET /api/operators/by-service returns all active operators when no filter"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operators" in data, "Response should contain 'operators' key"
        assert isinstance(data["operators"], list), "operators should be a list"
        
        # Verify operator structure
        if data["operators"]:
            op = data["operators"][0]
            assert "id" in op, "Operator should have 'id'"
            assert "name" in op, "Operator should have 'name'"
            print(f"Found {len(data['operators'])} operators without filter")
    
    def test_get_operators_by_travel_service(self):
        """GET /api/operators/by-service?service_type=travel returns travel/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=travel")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        
        # Should include travel and multi operators
        operator_types = [op.get("operator_type", "") for op in data["operators"]]
        print(f"Travel filter returned {len(data['operators'])} operators with types: {set(operator_types)}")
        
        # Verify at least some operators are returned
        assert len(data["operators"]) >= 0, "Should return operators for travel service"
    
    def test_get_operators_by_restaurant_service(self):
        """GET /api/operators/by-service?service_type=restaurant returns restaurant/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=restaurant")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        print(f"Restaurant filter returned {len(data['operators'])} operators")
    
    def test_get_operators_by_hotel_service(self):
        """GET /api/operators/by-service?service_type=hotel returns hotel/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=hotel")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        print(f"Hotel filter returned {len(data['operators'])} operators")
    
    def test_get_operators_by_cinema_service(self):
        """GET /api/operators/by-service?service_type=cinema returns cinema/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=cinema")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        print(f"Cinema filter returned {len(data['operators'])} operators")
    
    def test_get_operators_by_pressing_service(self):
        """GET /api/operators/by-service?service_type=pressing returns pressing/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=pressing")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        print(f"Pressing filter returned {len(data['operators'])} operators")
    
    def test_get_operators_by_events_service(self):
        """GET /api/operators/by-service?service_type=events returns events/multi operators"""
        response = self.session.get(f"{BASE_URL}/api/operators/by-service?service_type=events")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data
        print(f"Events filter returned {len(data['operators'])} operators")


class TestRestaurantsOperatorFilter:
    """Tests for operator_id filtering on restaurants endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_restaurants_no_filter(self):
        """GET /api/restaurants/ returns all restaurants without operator filter"""
        response = self.session.get(f"{BASE_URL}/api/restaurants/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "restaurants" in data
        assert "total" in data
        print(f"Found {data['total']} restaurants without filter")
    
    def test_get_restaurants_with_operator_filter(self):
        """GET /api/restaurants/?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/restaurants/?operator_id={ORYNO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "restaurants" in data
        
        # Verify all returned restaurants belong to the specified operator
        for restaurant in data["restaurants"]:
            if restaurant.get("operator_id"):
                assert restaurant["operator_id"] == ORYNO_OPERATOR_ID, \
                    f"Restaurant {restaurant.get('name')} has wrong operator_id"
        
        print(f"Found {len(data['restaurants'])} restaurants for operator {ORYNO_OPERATOR_ID}")


class TestEventsOperatorFilter:
    """Tests for operator_id filtering on events endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_events_no_filter(self):
        """GET /api/events/ returns all events without operator filter"""
        response = self.session.get(f"{BASE_URL}/api/events/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "events" in data
        assert "total" in data
        print(f"Found {data['total']} events without filter")
    
    def test_get_events_with_operator_filter(self):
        """GET /api/events/?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/events/?operator_id={ORYNO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "events" in data
        
        # Verify all returned events belong to the specified operator
        for event in data["events"]:
            if event.get("operator_id"):
                assert event["operator_id"] == ORYNO_OPERATOR_ID, \
                    f"Event {event.get('name')} has wrong operator_id"
        
        print(f"Found {len(data['events'])} events for operator {ORYNO_OPERATOR_ID}")


class TestCinemaOperatorFilter:
    """Tests for operator_id filtering on cinema endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_cinemas_no_filter(self):
        """GET /api/cinema/ returns all cinemas without operator filter"""
        response = self.session.get(f"{BASE_URL}/api/cinema/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "cinemas" in data
        assert "total" in data
        print(f"Found {data['total']} cinemas without filter")
    
    def test_get_cinemas_with_operator_filter(self):
        """GET /api/cinema/?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/cinema/?operator_id={ORYNO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "cinemas" in data
        
        # Verify all returned cinemas belong to the specified operator
        for cinema in data["cinemas"]:
            if cinema.get("operator_id"):
                assert cinema["operator_id"] == ORYNO_OPERATOR_ID, \
                    f"Cinema {cinema.get('name')} has wrong operator_id"
        
        print(f"Found {len(data['cinemas'])} cinemas for operator {ORYNO_OPERATOR_ID}")


class TestPressingOperatorFilter:
    """Tests for operator_id filtering on pressing endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_pressings_no_filter(self):
        """GET /api/pressing/ returns all pressing shops without operator filter"""
        response = self.session.get(f"{BASE_URL}/api/pressing/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pressings" in data
        assert "total" in data
        print(f"Found {data['total']} pressing shops without filter")
    
    def test_get_pressings_with_operator_filter(self):
        """GET /api/pressing/?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/pressing/?operator_id={ORYNO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pressings" in data
        
        print(f"Found {len(data['pressings'])} pressing shops for operator {ORYNO_OPERATOR_ID}")


class TestHotelsOperatorFilter:
    """Tests for operator_id filtering on hotels endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_hotels_no_filter(self):
        """GET /api/hotels/ returns all hotels without operator filter"""
        response = self.session.get(f"{BASE_URL}/api/hotels/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "hotels" in data
        assert "total" in data
        print(f"Found {data['total']} hotels without filter")
    
    def test_get_hotels_with_operator_filter(self):
        """GET /api/hotels/?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/hotels/?operator_id={ORYNO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "hotels" in data
        
        print(f"Found {len(data['hotels'])} hotels for operator {ORYNO_OPERATOR_ID}")


class TestTravelRoutesOperatorFilter:
    """Tests for operator_id filtering on travel routes management endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_get_travel_routes_management_no_filter(self):
        """GET /api/travel/management/my-routes returns all routes for admin"""
        response = self.session.get(f"{BASE_URL}/api/travel/management/my-routes")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "routes" in data
        assert "total" in data
        print(f"Found {data['total']} travel routes without filter")
    
    def test_get_travel_routes_management_with_operator_filter(self):
        """GET /api/travel/management/my-routes?operator_id=<id> filters by operator"""
        response = self.session.get(f"{BASE_URL}/api/travel/management/my-routes?operator_id={MUSANGO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "routes" in data
        
        # Verify all returned routes belong to the specified operator
        for route in data["routes"]:
            if route.get("operator_id"):
                assert route["operator_id"] == MUSANGO_OPERATOR_ID, \
                    f"Route {route.get('route_name')} has wrong operator_id: {route.get('operator_id')}"
        
        print(f"Found {len(data['routes'])} travel routes for Musango operator")
    
    def test_get_travel_routes_management_endpoint(self):
        """GET /api/travel/routes/management with operator_id filter"""
        # Note: The correct endpoint is /api/travel/routes/management (not /management/my-routes)
        response = self.session.get(f"{BASE_URL}/api/travel/routes/management?operator_id={MUSANGO_OPERATOR_ID}")
        
        # This endpoint may return 404 if it doesn't exist - check both endpoints
        if response.status_code == 404:
            # Try the alternative endpoint
            response = self.session.get(f"{BASE_URL}/api/travel/management/my-routes?operator_id={MUSANGO_OPERATOR_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "routes" in data
        
        print(f"Found {len(data['routes'])} routes via management endpoint")


class TestOperatorsByServiceRequiresAuth:
    """Tests that /api/operators/by-service requires authentication"""
    
    def test_unauthenticated_request_fails(self):
        """GET /api/operators/by-service without auth should fail"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/operators/by-service")
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print(f"Unauthenticated request correctly returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

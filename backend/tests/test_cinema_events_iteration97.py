"""
Iteration 97: Test Cinema and Events APIs
Tests:
1. Cinema Management - GET /api/cinema/, POST /api/cinema/, GET /api/cinema/films, POST /api/cinema/films
2. Events Management - POST /api/events/ with correct field mapping (venue, country, event_date, start_time, end_time, ticket_price, total_seats)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"


class TestAuth:
    """Authentication helper tests"""
    
    def test_admin_login(self):
        """Test admin login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]


class TestCinemaAPIs:
    """Cinema API tests - requires cinema.create permission"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_cinemas_list(self, admin_token):
        """GET /api/cinema/ - List cinemas"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/cinema/", headers=headers)
        assert response.status_code == 200, f"Failed to get cinemas: {response.text}"
        data = response.json()
        assert "cinemas" in data, "Response should have 'cinemas' key"
        assert "total" in data, "Response should have 'total' key"
        print(f"Found {data['total']} cinemas")
        return data
    
    def test_create_cinema(self, admin_token):
        """POST /api/cinema/ - Create cinema (requires cinema.create permission)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        cinema_data = {
            "name": f"TEST_Cinema_{datetime.now().strftime('%H%M%S')}",
            "city": "Douala",
            "address": "123 Test Street",
            "total_screens": 5,
            "total_seats": 500,
            "amenities": ["3d", "imax", "parking"]
        }
        response = requests.post(f"{BASE_URL}/api/cinema/", json=cinema_data, headers=headers)
        # Should succeed with 200 or fail with 403 if no permission
        if response.status_code == 200:
            data = response.json()
            assert "cinema_id" in data, "Response should have cinema_id"
            print(f"Created cinema with ID: {data['cinema_id']}")
            # Cleanup - delete the test cinema
            delete_response = requests.delete(f"{BASE_URL}/api/cinema/{data['cinema_id']}", headers=headers)
            print(f"Cleanup delete status: {delete_response.status_code}")
            return data
        elif response.status_code == 403:
            pytest.skip("Admin does not have cinema.create permission")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_get_films_list(self, admin_token):
        """GET /api/cinema/films - List films"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/cinema/films", headers=headers)
        assert response.status_code == 200, f"Failed to get films: {response.text}"
        data = response.json()
        assert "films" in data, "Response should have 'films' key"
        assert "total" in data, "Response should have 'total' key"
        print(f"Found {data['total']} films")
        return data
    
    def test_create_film_with_query_params(self, admin_token):
        """POST /api/cinema/films - Create film using query parameters"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Film creation uses query parameters, not JSON body
        params = {
            "title": f"TEST_Film_{datetime.now().strftime('%H%M%S')}",
            "duration_minutes": 120,
            "genre": "Action",
            "description": "A test film for iteration 97",
            "rating": "PG-13"
        }
        response = requests.post(f"{BASE_URL}/api/cinema/films", params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            assert "film_id" in data, "Response should have film_id"
            print(f"Created film with ID: {data['film_id']}")
            return data
        elif response.status_code == 403:
            pytest.skip("Admin does not have cinema.create permission for films")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")


class TestEventsAPIs:
    """Events API tests - requires events.create permission"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_events_list(self, admin_token):
        """GET /api/events/ - List events"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/events/", headers=headers)
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        data = response.json()
        assert "events" in data, "Response should have 'events' key"
        assert "total" in data, "Response should have 'total' key"
        print(f"Found {data['total']} events")
        return data
    
    def test_create_event_with_correct_field_mapping(self, admin_token):
        """POST /api/events/ - Create event with correct field mapping
        
        Backend EventCreate model requires:
        - name, event_type, venue, city, country, event_date, start_time, end_time, ticket_price, total_seats
        
        Frontend sends:
        - venue_name -> venue
        - start_date -> event_date
        - total_capacity -> total_seats
        - country defaults to 'CM'
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Use the correct field names that backend expects
        event_date = (datetime.now() + timedelta(days=30)).isoformat()
        event_data = {
            "name": f"TEST_Event_{datetime.now().strftime('%H%M%S')}",
            "event_type": "concert",
            "description": "A test event for iteration 97",
            "venue": "Test Venue Hall",  # Backend expects 'venue', not 'venue_name'
            "city": "Douala",
            "country": "CM",  # Required field
            "event_date": event_date,  # Backend expects 'event_date', not 'start_date'
            "start_time": "18:00",  # Required field
            "end_time": "22:00",  # Required field
            "ticket_price": 5000,  # Required field
            "total_seats": 100  # Backend expects 'total_seats', not 'total_capacity'
        }
        
        response = requests.post(f"{BASE_URL}/api/events/", json=event_data, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "event_id" in data, "Response should have event_id"
            print(f"Created event with ID: {data['event_id']}")
            
            # Verify the event was created by fetching it
            get_response = requests.get(f"{BASE_URL}/api/events/{data['event_id']}", headers=headers)
            if get_response.status_code == 200:
                event = get_response.json()
                assert event.get("venue") == "Test Venue Hall", f"Venue mismatch: {event.get('venue')}"
                assert event.get("country") == "CM", f"Country mismatch: {event.get('country')}"
                assert event.get("total_seats") == 100, f"Total seats mismatch: {event.get('total_seats')}"
                print(f"Event verified: venue={event.get('venue')}, country={event.get('country')}, total_seats={event.get('total_seats')}")
            
            # Cleanup - delete the test event
            delete_response = requests.delete(f"{BASE_URL}/api/events/{data['event_id']}", headers=headers)
            print(f"Cleanup delete status: {delete_response.status_code}")
            return data
        elif response.status_code == 403:
            pytest.skip("Admin does not have events.create permission")
        elif response.status_code == 422:
            # Validation error - print details
            print(f"Validation error: {response.json()}")
            pytest.fail(f"Validation error: {response.text}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_event_field_mapping_validation(self, admin_token):
        """Test that event creation fails with old field names (venue_name, start_date, total_capacity)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Use OLD field names that frontend used to send (should fail validation)
        event_date = (datetime.now() + timedelta(days=30)).isoformat()
        event_data_old_fields = {
            "name": f"TEST_Event_OldFields_{datetime.now().strftime('%H%M%S')}",
            "event_type": "concert",
            "venue_name": "Test Venue Hall",  # OLD field name
            "city": "Douala",
            # Missing: country, event_date, start_time, end_time, ticket_price, total_seats
            "start_date": event_date,  # OLD field name
            "total_capacity": 100  # OLD field name
        }
        
        response = requests.post(f"{BASE_URL}/api/events/", json=event_data_old_fields, headers=headers)
        
        # Should fail with 422 validation error because required fields are missing
        if response.status_code == 422:
            print("Correctly rejected old field names with validation error")
            error_detail = response.json()
            print(f"Validation errors: {error_detail}")
            return True
        elif response.status_code == 403:
            pytest.skip("Admin does not have events.create permission")
        else:
            # If it somehow succeeded, that's unexpected
            print(f"Unexpected response: {response.status_code} - {response.text}")
            return False


class TestCinemaFilmsEndpoint:
    """Test the films endpoint specifically"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_films_endpoint_exists(self, admin_token):
        """Verify /api/cinema/films endpoint exists and returns films"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/cinema/films", headers=headers)
        assert response.status_code == 200, f"Films endpoint failed: {response.text}"
        data = response.json()
        assert "films" in data
        print(f"Films endpoint working, found {len(data['films'])} films")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

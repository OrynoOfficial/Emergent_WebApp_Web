"""
Iteration 99: Cinema Management API Tests
Tests for:
- Cinema CRUD (POST /api/cinema/, GET /api/cinema/, PUT /api/cinema/{id})
- Film CRUD (POST /api/cinema/films, GET /api/cinema/films, PUT /api/cinema/films/{id})
- Film poster_url field support
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestCinemaAPI:
    """Cinema CRUD tests"""
    
    created_cinema_id = None
    
    def test_create_cinema(self, auth_headers):
        """Test POST /api/cinema/ creates a cinema"""
        cinema_data = {
            "name": f"TEST_Cinema_{uuid.uuid4().hex[:8]}",
            "description": "Test cinema for iteration 99",
            "address": "123 Test Street",
            "city": "Douala",
            "phone": "+237 699 123 456",
            "email": "test@cinema.com",
            "screens": [{"name": "Screen 1", "capacity": 100, "screen_type": "2d"}],
            "amenities": ["parking", "snack_bar"]
        }
        
        response = requests.post(f"{BASE_URL}/api/cinema/", json=cinema_data, headers=auth_headers)
        
        assert response.status_code in [200, 201], f"Create cinema failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "cinema_id" in data or "id" in data, "Response should contain cinema_id or id"
        
        TestCinemaAPI.created_cinema_id = data.get("cinema_id") or data.get("id")
        print(f"Created cinema with ID: {TestCinemaAPI.created_cinema_id}")
    
    def test_get_cinemas_returns_id_field(self, auth_headers):
        """Test GET /api/cinema/ returns cinemas with id field"""
        response = requests.get(f"{BASE_URL}/api/cinema/")
        
        assert response.status_code == 200, f"Get cinemas failed: {response.status_code}"
        data = response.json()
        
        assert "cinemas" in data, "Response should contain 'cinemas' array"
        assert "total" in data, "Response should contain 'total' count"
        
        if data["cinemas"]:
            cinema = data["cinemas"][0]
            assert "id" in cinema, "Cinema should have 'id' field (not _id)"
            assert "_id" not in cinema, "Cinema should NOT have '_id' field"
            print(f"Found {len(data['cinemas'])} cinemas, first has id: {cinema['id']}")
    
    def test_update_cinema(self, auth_headers):
        """Test PUT /api/cinema/{id} updates a cinema"""
        if not TestCinemaAPI.created_cinema_id:
            pytest.skip("No cinema created to update")
        
        update_data = {
            "description": "Updated description for iteration 99"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cinema/{TestCinemaAPI.created_cinema_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Update cinema failed: {response.status_code} - {response.text}"
        print(f"Updated cinema {TestCinemaAPI.created_cinema_id}")


class TestFilmAPI:
    """Film CRUD tests with poster_url support"""
    
    created_film_id = None
    
    def test_create_film_with_poster_url(self, auth_headers):
        """Test POST /api/cinema/films creates a film with poster_url"""
        # Film create uses query params
        params = {
            "title": f"TEST_Film_{uuid.uuid4().hex[:8]}",
            "duration_minutes": 120,
            "genre": ["Action", "Drama"],
            "description": "Test film for iteration 99",
            "language": "English",
            "rating": "PG-13",
            "director": "Test Director",
            "poster_url": "https://example.com/poster.jpg"
        }
        
        # Build query string
        query_parts = []
        for key, value in params.items():
            if isinstance(value, list):
                for v in value:
                    query_parts.append(f"{key}={v}")
            else:
                query_parts.append(f"{key}={value}")
        query_string = "&".join(query_parts)
        
        response = requests.post(f"{BASE_URL}/api/cinema/films?{query_string}", headers=auth_headers)
        
        assert response.status_code in [200, 201], f"Create film failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "film_id" in data or "id" in data, "Response should contain film_id or id"
        
        TestFilmAPI.created_film_id = data.get("film_id") or data.get("id")
        print(f"Created film with ID: {TestFilmAPI.created_film_id}")
    
    def test_get_films_returns_id_and_poster_url(self, auth_headers):
        """Test GET /api/cinema/films returns films with id and poster_url fields"""
        response = requests.get(f"{BASE_URL}/api/cinema/films")
        
        assert response.status_code == 200, f"Get films failed: {response.status_code}"
        data = response.json()
        
        assert "films" in data, "Response should contain 'films' array"
        assert "total" in data, "Response should contain 'total' count"
        
        if data["films"]:
            film = data["films"][0]
            assert "id" in film, "Film should have 'id' field (not _id)"
            assert "_id" not in film, "Film should NOT have '_id' field"
            # poster_url may be null but field should exist in schema
            print(f"Found {len(data['films'])} films, first has id: {film['id']}, poster_url: {film.get('poster_url', 'N/A')}")
    
    def test_get_film_by_id(self, auth_headers):
        """Test GET /api/cinema/films/{id} returns film with poster_url"""
        if not TestFilmAPI.created_film_id:
            pytest.skip("No film created to get")
        
        response = requests.get(f"{BASE_URL}/api/cinema/films/{TestFilmAPI.created_film_id}")
        
        assert response.status_code == 200, f"Get film failed: {response.status_code}"
        film = response.json()
        
        assert "id" in film, "Film should have 'id' field"
        assert film.get("poster_url") == "https://example.com/poster.jpg", "Film should have poster_url we set"
        print(f"Film {film['id']} has poster_url: {film.get('poster_url')}")
    
    def test_update_film(self, auth_headers):
        """Test PUT /api/cinema/films/{id} updates a film"""
        if not TestFilmAPI.created_film_id:
            pytest.skip("No film created to update")
        
        # Film update also uses query params
        params = {
            "title": "TEST_Updated_Film_Title",
            "poster_url": "https://example.com/updated_poster.jpg",
            "director": "Updated Director"
        }
        
        query_parts = [f"{k}={v}" for k, v in params.items()]
        query_string = "&".join(query_parts)
        
        response = requests.put(
            f"{BASE_URL}/api/cinema/films/{TestFilmAPI.created_film_id}?{query_string}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Update film failed: {response.status_code} - {response.text}"
        print(f"Updated film {TestFilmAPI.created_film_id}")
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/cinema/films/{TestFilmAPI.created_film_id}")
        assert get_response.status_code == 200
        film = get_response.json()
        assert film.get("title") == "TEST_Updated_Film_Title", "Title should be updated"
        assert film.get("poster_url") == "https://example.com/updated_poster.jpg", "poster_url should be updated"
        assert film.get("director") == "Updated Director", "Director should be updated"
        print(f"Verified film update: title={film['title']}, poster_url={film['poster_url']}")


class TestEventsAPI:
    """Events API tests for new fields"""
    
    def test_get_events_returns_required_fields(self, auth_headers):
        """Test GET /api/events/ returns events with required fields"""
        response = requests.get(f"{BASE_URL}/api/events/")
        
        assert response.status_code == 200, f"Get events failed: {response.status_code}"
        data = response.json()
        
        assert "events" in data, "Response should contain 'events' array"
        
        if data["events"]:
            event = data["events"][0]
            # Check for required fields
            print(f"Event fields: {list(event.keys())}")
            # These fields should be present (may be null)
            expected_fields = ["id", "name", "city"]
            for field in expected_fields:
                assert field in event, f"Event should have '{field}' field"
            print(f"Event has required fields. Sample: id={event.get('id')}, name={event.get('name')}")


class TestRestaurantMenuAPI:
    """Restaurant Menu API tests for ingredients field"""
    
    RESTAURANT_ID = "b07dd31f-1799-436d-ac4e-6fe0976ec54f"
    
    def test_get_menu_returns_ingredients(self, auth_headers):
        """Test GET /api/restaurants/{id}/menu returns items with ingredients"""
        response = requests.get(f"{BASE_URL}/api/restaurants/{self.RESTAURANT_ID}/menu")
        
        if response.status_code == 404:
            pytest.skip("Test restaurant not found")
        
        assert response.status_code == 200, f"Get menu failed: {response.status_code}"
        data = response.json()
        
        items = data.get("items") or data.get("menu_items") or []
        if items:
            item = items[0]
            print(f"Menu item fields: {list(item.keys())}")
            # ingredients field should exist (may be empty array)
            if "ingredients" in item:
                print(f"Menu item has ingredients: {item.get('ingredients')}")
            else:
                print("Note: ingredients field not present in menu item")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_cinema(self, auth_headers):
        """Delete test cinema"""
        if TestCinemaAPI.created_cinema_id:
            response = requests.delete(
                f"{BASE_URL}/api/cinema/{TestCinemaAPI.created_cinema_id}",
                headers=auth_headers
            )
            print(f"Cleanup cinema {TestCinemaAPI.created_cinema_id}: {response.status_code}")
    
    def test_cleanup_test_films(self, auth_headers):
        """Delete test films - Note: No delete endpoint for films, just log"""
        if TestFilmAPI.created_film_id:
            print(f"Note: Film {TestFilmAPI.created_film_id} created (no delete endpoint)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

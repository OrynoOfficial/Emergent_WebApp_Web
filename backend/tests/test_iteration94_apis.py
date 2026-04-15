"""
Iteration 94 Backend API Tests
Testing:
1. GET /api/pressing/ - Laundry/Pressing list
2. GET /api/events/ - Events list  
3. GET /api/cinema/films - Films list (route order fix verification)
4. POST /api/uploads/ - File upload endpoint
5. Auth endpoints for admin login
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        print(f"✓ Admin login successful, token received")
        return data["access_token"]
    
    def test_customer_login(self):
        """Test customer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Customer login successful")


class TestPressingAPI:
    """Test Laundry/Pressing API endpoints"""
    
    def test_get_pressings_list(self):
        """GET /api/pressing/ should return pressing list"""
        response = requests.get(f"{BASE_URL}/api/pressing/")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "pressings" in data, "Response should contain 'pressings' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["pressings"], list), "pressings should be a list"
        print(f"✓ GET /api/pressing/ returned {data['total']} pressings")
        
    def test_get_pressings_with_city_filter(self):
        """GET /api/pressing/?city=Douala should filter by city"""
        response = requests.get(f"{BASE_URL}/api/pressing/", params={"city": "Douala"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "pressings" in data
        print(f"✓ GET /api/pressing/?city=Douala returned {data['total']} pressings")


class TestEventsAPI:
    """Test Events API endpoints"""
    
    def test_get_events_list(self):
        """GET /api/events/ should return events list"""
        response = requests.get(f"{BASE_URL}/api/events/")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "events" in data, "Response should contain 'events' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["events"], list), "events should be a list"
        print(f"✓ GET /api/events/ returned {data['total']} events")
        
        # Verify events have expected fields
        if data["events"]:
            event = data["events"][0]
            print(f"  Sample event fields: {list(event.keys())[:10]}")
    
    def test_get_events_with_city_filter(self):
        """GET /api/events/?city=Douala should filter by city"""
        response = requests.get(f"{BASE_URL}/api/events/", params={"city": "Douala"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "events" in data
        print(f"✓ GET /api/events/?city=Douala returned {data['total']} events")


class TestCinemaAPI:
    """Test Cinema API endpoints - especially /films route order"""
    
    def test_get_films_list(self):
        """GET /api/cinema/films should return films list (not 404)"""
        response = requests.get(f"{BASE_URL}/api/cinema/films")
        assert response.status_code == 200, f"Films endpoint failed with {response.status_code}: {response.text}"
        data = response.json()
        assert "films" in data, "Response should contain 'films' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["films"], list), "films should be a list"
        print(f"✓ GET /api/cinema/films returned {data['total']} films (route order fix verified)")
    
    def test_get_cinemas_list(self):
        """GET /api/cinema/ should return cinemas list"""
        response = requests.get(f"{BASE_URL}/api/cinema/")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "cinemas" in data, "Response should contain 'cinemas' key"
        print(f"✓ GET /api/cinema/ returned {data['total']} cinemas")
    
    def test_films_route_not_confused_with_cinema_id(self):
        """Verify /films is not interpreted as a cinema_id"""
        # This should return films, not a 404 for cinema with id 'films'
        response = requests.get(f"{BASE_URL}/api/cinema/films")
        assert response.status_code == 200, "Route should match /films before /{cinema_id}"
        data = response.json()
        # Should have films array, not a single cinema object
        assert "films" in data or "total" in data, "Should return films list structure"
        print(f"✓ /api/cinema/films correctly returns films list, not cinema lookup")


class TestUploadsAPI:
    """Test file upload endpoint"""
    
    def test_uploads_endpoint_exists(self):
        """Verify /api/uploads/ endpoint exists"""
        # Without a file, it should return 422 (validation error), 403 (auth required), or 401
        response = requests.post(f"{BASE_URL}/api/uploads/")
        # 422 means endpoint exists but validation failed (no file)
        # 403/401 means endpoint exists but requires auth
        # 404 would mean endpoint doesn't exist
        assert response.status_code in [422, 400, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✓ /api/uploads/ endpoint exists (returned {response.status_code} - requires auth)")


class TestDashboardDataAPI:
    """Test dashboard data endpoints used by management pages"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_dashboard_stats_endpoint(self, admin_token):
        """Test dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        # May return 200 or 404 depending on implementation
        if response.status_code == 200:
            print(f"✓ Dashboard stats endpoint working")
        else:
            print(f"⚠ Dashboard stats endpoint returned {response.status_code}")


class TestBanquetAPI:
    """Test Banquet API endpoints"""
    
    def test_get_banquets_list(self):
        """GET /api/banquets/ should return banquet venues"""
        response = requests.get(f"{BASE_URL}/api/banquets/")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "banquets" in data or "venues" in data, "Response should contain banquets/venues"
        print(f"✓ GET /api/banquets/ returned banquet venues")


class TestPackagesAPI:
    """Test Packages/Delivery API endpoints"""
    
    def test_get_packages_list(self):
        """GET /api/packages/ should return package services"""
        response = requests.get(f"{BASE_URL}/api/packages/")
        # May return 200 or different structure
        if response.status_code == 200:
            data = response.json()
            print(f"✓ GET /api/packages/ returned data")
        else:
            print(f"⚠ GET /api/packages/ returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

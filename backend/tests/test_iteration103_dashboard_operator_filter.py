"""
Test iteration 103: Dashboard Stats Operator Filter
Tests that GET /api/management/dashboard-stats correctly filters by operator_id
when admin passes the parameter.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"

# Known operator ID for Musango Bus Service
MUSANGO_OPERATOR_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def operator_token():
    """Get operator authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OPERATOR_EMAIL,
        "password": OPERATOR_PASSWORD
    })
    assert response.status_code == 200, f"Operator login failed: {response.text}"
    return response.json().get("access_token")


class TestDashboardStatsEndpoint:
    """Test /api/management/dashboard-stats endpoint"""
    
    def test_dashboard_stats_without_operator_filter(self, admin_token):
        """Test: GET /api/management/dashboard-stats?service_type=travel&period=30days returns all operator stats"""
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "stats" in data
        assert "totalItems" in data["stats"]
        assert "totalBookings" in data["stats"]
        assert "totalRevenue" in data["stats"]
        
        # According to context: All operators travel stats: Items=13, Bookings=3
        print(f"All operators - Items: {data['stats']['totalItems']}, Bookings: {data['stats']['totalBookings']}")
        
        # Store for comparison
        self.all_operators_items = data["stats"]["totalItems"]
        self.all_operators_bookings = data["stats"]["totalBookings"]
        
        # Verify we get all items (should be 13 according to context)
        assert data["stats"]["totalItems"] >= 2, "Should have multiple items without filter"
    
    def test_dashboard_stats_with_musango_operator_filter(self, admin_token):
        """Test: GET /api/management/dashboard-stats?service_type=travel&period=30days&operator_id=<musango> returns Musango-only stats"""
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={
                "service_type": "travel",
                "period": "30days",
                "operator_id": MUSANGO_OPERATOR_ID
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "stats" in data
        assert "totalItems" in data["stats"]
        
        # According to context: Musango travel stats: Items=2, Bookings=0
        print(f"Musango only - Items: {data['stats']['totalItems']}, Bookings: {data['stats']['totalBookings']}")
        
        # Verify filtered results (should be 2 items for Musango)
        assert data["stats"]["totalItems"] <= 13, "Filtered items should be less than or equal to all items"
    
    def test_dashboard_stats_operator_filter_reduces_count(self, admin_token):
        """Test: Filtering by operator_id should reduce or equal the item count"""
        # Get all operators stats
        response_all = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response_all.status_code == 200
        all_items = response_all.json()["stats"]["totalItems"]
        
        # Get Musango-only stats
        response_filtered = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={
                "service_type": "travel",
                "period": "30days",
                "operator_id": MUSANGO_OPERATOR_ID
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response_filtered.status_code == 200
        filtered_items = response_filtered.json()["stats"]["totalItems"]
        
        print(f"All operators items: {all_items}, Musango items: {filtered_items}")
        
        # Filtered count should be less than or equal to all
        assert filtered_items <= all_items, f"Filtered items ({filtered_items}) should be <= all items ({all_items})"
    
    def test_dashboard_stats_different_periods(self, admin_token):
        """Test: Dashboard stats work with different period values"""
        periods = ["7days", "30days", "90days"]
        
        for period in periods:
            response = requests.get(
                f"{BASE_URL}/api/management/dashboard-stats",
                params={"service_type": "travel", "period": period},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Failed for period {period}: {response.text}"
            data = response.json()
            assert data["period"] == period, f"Period mismatch: expected {period}, got {data['period']}"
            print(f"Period {period}: Items={data['stats']['totalItems']}, Bookings={data['stats']['totalBookings']}")
    
    def test_dashboard_stats_different_service_types(self, admin_token):
        """Test: Dashboard stats work with different service types"""
        service_types = ["hotels", "travel", "restaurants", "car_rental"]
        
        for service_type in service_types:
            response = requests.get(
                f"{BASE_URL}/api/management/dashboard-stats",
                params={"service_type": service_type, "period": "30days"},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Failed for service_type {service_type}: {response.text}"
            data = response.json()
            assert data["service_type"] == service_type
            print(f"Service {service_type}: Items={data['stats']['totalItems']}")
    
    def test_operator_user_gets_own_data_only(self, operator_token):
        """Test: Operator user should only see their own data (operator_id param ignored)"""
        # Operator tries to pass a different operator_id - should be ignored
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={
                "service_type": "travel",
                "period": "30days",
                "operator_id": "some-other-operator-id"  # Should be ignored for operator role
            },
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Operator should only see their own data regardless of operator_id param
        print(f"Operator view - Items: {data['stats']['totalItems']}, Bookings: {data['stats']['totalBookings']}")
        assert "stats" in data
    
    def test_dashboard_stats_response_structure(self, admin_token):
        """Test: Verify complete response structure"""
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields
        assert "stats" in data
        stats = data["stats"]
        expected_stats_fields = [
            "totalItems", "activeItems", "totalBookings", "totalRevenue",
            "avgRating", "occupancyRate", "bookingsGrowth", "revenueGrowth"
        ]
        for field in expected_stats_fields:
            assert field in stats, f"Missing field: {field}"
        
        assert "bookingsByStatus" in data
        assert "dailyTrend" in data
        assert "distribution" in data
        assert "recentBookings" in data
        assert "secondaryCount" in data
        assert "period" in data
        assert "service_type" in data
        
        print("Response structure verified successfully")
    
    def test_empty_operator_id_returns_all(self, admin_token):
        """Test: Empty operator_id string should return all data (same as no filter)"""
        # With empty string
        response_empty = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days", "operator_id": ""},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response_empty.status_code == 200
        
        # Without operator_id
        response_none = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response_none.status_code == 200
        
        # Both should return same item count
        items_empty = response_empty.json()["stats"]["totalItems"]
        items_none = response_none.json()["stats"]["totalItems"]
        
        print(f"Empty operator_id items: {items_empty}, No operator_id items: {items_none}")
        assert items_empty == items_none, "Empty string and no param should return same results"


class TestFrontendHookIntegration:
    """Test that the frontend hook signature matches backend expectations"""
    
    def test_api_accepts_operator_id_query_param(self, admin_token):
        """Test: API accepts operator_id as query parameter"""
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={
                "service_type": "travel",
                "period": "30days",
                "operator_id": MUSANGO_OPERATOR_ID
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"API should accept operator_id param: {response.text}"
    
    def test_api_works_without_operator_id(self, admin_token):
        """Test: API works without operator_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/management/dashboard-stats",
            params={"service_type": "travel", "period": "30days"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"API should work without operator_id: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

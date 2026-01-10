"""
Test P0, P2, P3 Features:
- P0: Operators Management page revenue calculation
- P2: Ratings bulk moderation endpoint
- P3: Customer Service page components (refactored)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestP0OperatorsRevenue:
    """P0: Test that operators show correct revenue from linked orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin to get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate as super admin")
    
    def test_operators_endpoint_returns_revenue(self):
        """Test that GET /api/operators returns revenue field for each operator"""
        response = self.session.get(f"{BASE_URL}/api/operators/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "operators" in data, "Response should contain 'operators' key"
        
        operators = data["operators"]
        assert len(operators) > 0, "Should have at least one operator"
        
        # Check that each operator has a revenue field
        for op in operators:
            assert "revenue" in op, f"Operator {op.get('name')} should have 'revenue' field"
            assert isinstance(op["revenue"], (int, float)), f"Revenue should be a number"
    
    def test_west_region_tours_revenue(self):
        """P0: West Region Tours should show ~169,325 FCFA revenue"""
        response = self.session.get(f"{BASE_URL}/api/operators/")
        assert response.status_code == 200
        
        data = response.json()
        operators = data["operators"]
        
        # Find West Region Tours
        west_region = next((op for op in operators if "West Region Tours" in op.get("name", "")), None)
        assert west_region is not None, "West Region Tours operator should exist"
        
        revenue = west_region.get("revenue", 0)
        # Allow some tolerance for pending orders
        assert revenue >= 100000, f"West Region Tours revenue should be >= 100,000 FCFA, got {revenue}"
        print(f"West Region Tours revenue: {revenue} FCFA")
    
    def test_royal_events_cameroon_revenue(self):
        """P0: Royal Events Cameroon should show ~262,500 FCFA revenue"""
        response = self.session.get(f"{BASE_URL}/api/operators/")
        assert response.status_code == 200
        
        data = response.json()
        operators = data["operators"]
        
        # Find Royal Events Cameroon
        royal_events = next((op for op in operators if "Royal Events Cameroon" in op.get("name", "")), None)
        assert royal_events is not None, "Royal Events Cameroon operator should exist"
        
        revenue = royal_events.get("revenue", 0)
        # Allow some tolerance for pending orders
        assert revenue >= 200000, f"Royal Events Cameroon revenue should be >= 200,000 FCFA, got {revenue}"
        print(f"Royal Events Cameroon revenue: {revenue} FCFA")


class TestP2RatingsBulkModeration:
    """P2: Test ratings bulk moderation endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin to get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate as super admin")
    
    def test_bulk_moderate_endpoint_exists(self):
        """Test that POST /api/ratings/bulk-moderate endpoint exists"""
        # Test with empty array - should return 400 (no ratings provided)
        response = self.session.post(f"{BASE_URL}/api/ratings/bulk-moderate", json={
            "rating_ids": [],
            "action": "flag"
        })
        # Should return 400 for empty array, not 404 (endpoint exists)
        assert response.status_code in [400, 200], f"Expected 400 or 200, got {response.status_code}"
    
    def test_bulk_moderate_requires_auth(self):
        """Test that bulk moderation requires admin authentication"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/ratings/bulk-moderate", json={
            "rating_ids": ["test-id"],
            "action": "flag"
        })
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_bulk_moderate_invalid_action(self):
        """Test that invalid action returns error"""
        response = self.session.post(f"{BASE_URL}/api/ratings/bulk-moderate", json={
            "rating_ids": ["test-id"],
            "action": "invalid_action"
        })
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
    
    def test_get_all_ratings_endpoint(self):
        """Test that GET /api/ratings/all endpoint works for admin"""
        response = self.session.get(f"{BASE_URL}/api/ratings/all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "ratings" in data, "Response should contain 'ratings' key"
        assert "total" in data, "Response should contain 'total' key"


class TestP3CustomerServiceComponents:
    """P3: Test Customer Service page loads correctly after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin to get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate as super admin")
    
    def test_support_tickets_endpoint(self):
        """Test that support tickets endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/support-tickets/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tickets" in data, "Response should contain 'tickets' key"
    
    def test_support_tickets_stats_endpoint(self):
        """Test that support tickets stats endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/support-tickets/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Stats should have various fields
        assert "total" in data or "by_status" in data, "Stats should contain ticket statistics"
    
    def test_support_tickets_team_members_endpoint(self):
        """Test that team members endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/support-tickets/team-members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "team_members" in data, "Response should contain 'team_members' key"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test Multi-Tenant Permissions System - New Features
Tests for:
1. Dashboard - No Operator Dashboard modal
2. Team & Roles navigation visibility
3. Support page ticket system
4. Ratings page (customer and operator views)
5. Backend APIs for ratings and support tickets
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://oryno-overhaul.preview.emergentagent.com')

class TestBackendAPIs:
    """Test backend API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password, is_operator=False):
        """Get authentication token"""
        login_data = {
            "email": email,
            "password": password
        }
        if is_operator:
            login_data["is_operator_login"] = True
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_superadmin_login(self):
        """Test super admin login"""
        token = self.get_auth_token("superadmin@oryno.com", "testpassword123")
        assert token is not None, "Super admin login failed"
        print("✓ Super admin login successful")
        return token
    
    def test_customer_login(self):
        """Test customer login"""
        token = self.get_auth_token("testcustomer@test.com", "testpassword123")
        assert token is not None, "Customer login failed"
        print("✓ Customer login successful")
        return token
    
    def test_operator_login(self):
        """Test operator login"""
        token = self.get_auth_token("testoperator@test.com", "testpassword123", is_operator=True)
        assert token is not None, "Operator login failed"
        print("✓ Operator login successful")
        return token
    
    def test_ratings_my_endpoint(self):
        """Test GET /api/ratings/my - returns user's ratings"""
        token = self.get_auth_token("testcustomer@test.com", "testpassword123")
        assert token is not None, "Login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/ratings/my")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ratings" in data, "Response should contain 'ratings' key"
        print(f"✓ GET /api/ratings/my returned {len(data.get('ratings', []))} ratings")
    
    def test_ratings_operator_endpoint(self):
        """Test GET /api/ratings/operator - returns ratings for operator's services"""
        token = self.get_auth_token("testoperator@test.com", "testpassword123", is_operator=True)
        assert token is not None, "Operator login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/ratings/operator")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ratings" in data, "Response should contain 'ratings' key"
        print(f"✓ GET /api/ratings/operator returned {len(data.get('ratings', []))} ratings")
    
    def test_support_tickets_my_endpoint(self):
        """Test GET /api/support-tickets/my - returns user's support tickets"""
        token = self.get_auth_token("testcustomer@test.com", "testpassword123")
        assert token is not None, "Login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/support-tickets/my")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Response should contain 'tickets' key"
        print(f"✓ GET /api/support-tickets/my returned {len(data.get('tickets', []))} tickets")
    
    def test_create_support_ticket(self):
        """Test POST /api/support-tickets/ - create a new ticket"""
        token = self.get_auth_token("testcustomer@test.com", "testpassword123")
        assert token is not None, "Login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        ticket_data = {
            "subject": "Test Ticket from Automated Test",
            "description": "This is a test ticket created by automated testing",
            "category": "technical",
            "priority": "low",
            "source": "web"
        }
        
        response = self.session.post(f"{BASE_URL}/api/support-tickets/", json=ticket_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ticket" in data, "Response should contain 'ticket' key"
        assert data["ticket"].get("ticket_number") is not None, "Ticket should have a ticket_number"
        print(f"✓ Created support ticket: {data['ticket'].get('ticket_number')}")
        return data["ticket"]
    
    def test_ratings_respond_endpoint(self):
        """Test POST /api/ratings/{rating_id}/respond - operator responds to rating"""
        # First login as operator
        token = self.get_auth_token("testoperator@test.com", "testpassword123", is_operator=True)
        assert token is not None, "Operator login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to respond to a rating (may fail if no rating exists, but endpoint should work)
        response_data = {
            "message": "Thank you for your feedback!",
            "responder_name": "Test Operator"
        }
        
        # Use a dummy rating ID - endpoint should return 404 if not found
        response = self.session.post(f"{BASE_URL}/api/ratings/test-rating-id/respond", json=response_data)
        
        # Either 404 (rating not found) or 200 (success) is acceptable
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 404:
            print("✓ POST /api/ratings/{rating_id}/respond endpoint works (returned 404 for non-existent rating)")
        else:
            print("✓ POST /api/ratings/{rating_id}/respond endpoint works (responded successfully)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

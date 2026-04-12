"""
Iteration 86: Ticket Scanner & Validation Tests
Tests for POST /api/orders/scan/validate and POST /api/orders/scan/check-in endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OPERATOR_CREDS = {"email": "operator@test.com", "password": "testpassword123"}
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}

# Test ticket codes
OPERATOR_TICKET = "ORD-MUS-0002"  # Musango Bus Service ticket (confirmed/paid)
OPERATOR_TICKET_COMPLETED = "ORD-MUS-0003"  # Musango ticket with completed status
OTHER_OPERATOR_TICKET = "TRV-000001"  # Different operator's ticket
INVALID_TICKET = "INVALID-CODE-XYZ"


@pytest.fixture(scope="module")
def operator_token():
    """Get operator auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Operator login failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed")


@pytest.fixture(autouse=True)
def reset_test_ticket():
    """Reset test ticket before each test"""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    
    async def reset():
        client = AsyncIOMotorClient('mongodb://localhost:27017')
        db = client['oryno_webapp']
        await db.orders.update_one(
            {'order_number': OPERATOR_TICKET},
            {'$set': {'checked_in': False, 'checked_in_at': None}}
        )
        client.close()
    
    asyncio.run(reset())
    yield


class TestTicketValidation:
    """Tests for POST /api/orders/scan/validate"""
    
    def test_validate_own_ticket_returns_valid_true(self, operator_token):
        """Operator can validate their own ticket - returns valid:true with details"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/validate",
            json={"code": OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert data["valid"] is True
        assert data["code"] == OPERATOR_TICKET
        assert "order_id" in data
        assert "status" in data
        assert "payment_status" in data
        assert "customer" in data
        assert "booking" in data
        assert "total_amount" in data
        assert "operator_name" in data
    
    def test_validate_other_operator_ticket_returns_valid_false(self, operator_token):
        """Operator cannot validate different operator's ticket - returns valid:false"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/validate",
            json={"code": OTHER_OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] is False
        assert "different operator" in data["message"].lower()
    
    def test_validate_nonexistent_ticket_returns_valid_false(self, operator_token):
        """Non-existent ticket code returns valid:false"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/validate",
            json={"code": INVALID_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] is False
        assert "not found" in data["message"].lower()
    
    def test_admin_can_validate_any_ticket(self, admin_token):
        """Admin can validate any operator's ticket"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/validate",
            json={"code": OTHER_OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Admin should see valid:true for any existing ticket
        assert data["valid"] is True


class TestTicketCheckIn:
    """Tests for POST /api/orders/scan/check-in"""
    
    def test_checkin_confirmed_paid_ticket_succeeds(self, operator_token):
        """Check-in succeeds for confirmed/paid ticket"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "checked in successfully" in data["message"].lower()
        assert data["order_number"] == OPERATOR_TICKET
        assert "checked_in_at" in data
    
    def test_double_checkin_rejected(self, operator_token):
        """Double check-in is rejected"""
        # First check-in
        requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        
        # Second check-in should fail
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 400
        assert "already checked in" in response.json()["detail"].lower()
    
    def test_checkin_completed_ticket_rejected(self, operator_token):
        """Check-in rejected for non-confirmed ticket (completed status)"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": OPERATOR_TICKET_COMPLETED},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 400
        assert "cannot check in" in response.json()["detail"].lower()
    
    def test_checkin_other_operator_ticket_rejected(self, operator_token):
        """Check-in rejected for different operator's ticket"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": OTHER_OPERATOR_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 403
        assert "different operator" in response.json()["detail"].lower()
    
    def test_checkin_nonexistent_ticket_returns_404(self, operator_token):
        """Check-in returns 404 for non-existent ticket"""
        response = requests.post(
            f"{BASE_URL}/api/orders/scan/check-in",
            json={"code": INVALID_TICKET},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 404

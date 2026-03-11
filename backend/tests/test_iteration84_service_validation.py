"""
Iteration 84: Service Validation Bug Fix Tests

This test file verifies the fix for service approval/rejection in the Validation Center.
The bug was: Frontend was calling '/validation/services/{id}/approve?collection={type}' 
but backend expects '/validation/services/{type}/{id}/approve'.

Tests cover:
- POST /api/validation/services/{type}/{id}/approve - must return 200 and set status to 'active'
- POST /api/validation/services/{type}/{id}/reject - must return 200 with reason, set status to 'rejected'
- GET /api/validation/pending - must return pending services with correct structure (services.travel_routes array with 'id' field)
"""
import pytest
import requests
import uuid
import os
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def db_client():
    """MongoDB client for direct DB operations"""
    client = MongoClient("mongodb://localhost:27017")
    return client["oryno_webapp"]

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@test.com",
        "password": "testpassword123"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture
def pending_travel_route(db_client):
    """Create a pending travel route for testing"""
    route_id = f"TEST-{uuid.uuid4()}"
    route = {
        "_id": route_id,
        "id": route_id,
        "from_city": "TestCity1",
        "to_city": "TestCity2",
        "departure_time": "08:00",
        "arrival_time": "09:30",
        "price": 3000,
        "vehicle_name": "Test Vehicle",
        "vehicle_type": "bus",
        "total_seats": 45,
        "status": "pending",
        "operator_id": "test-operator-fixture",
        "operator_name": "Test Operator Fixture",
        "created_at": "2025-01-09T10:00:00Z"
    }
    db_client.travel_routes.insert_one(route)
    yield route_id
    # Cleanup
    db_client.travel_routes.delete_one({"id": route_id})


class TestServiceApproval:
    """Test service approval endpoint with new URL format: /validation/services/{type}/{id}/approve"""
    
    def test_approve_travel_route_returns_200(self, admin_token, pending_travel_route, db_client):
        """POST /api/validation/services/travel_route/{id}/approve - returns 200"""
        route_id = pending_travel_route
        
        response = requests.post(
            f"{BASE_URL}/api/validation/services/travel_route/{route_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["service_id"] == route_id
        assert "approved" in data["message"].lower()
    
    def test_approve_sets_status_active(self, admin_token, db_client):
        """Verify approval changes status to 'active'"""
        # Create a new pending route
        route_id = f"TEST-approval-active-{uuid.uuid4()}"
        route = {
            "_id": route_id,
            "id": route_id,
            "from_city": "CityA",
            "to_city": "CityB",
            "departure_time": "10:00",
            "arrival_time": "11:00",
            "price": 2000,
            "vehicle_name": "ActiveTest Bus",
            "vehicle_type": "bus",
            "total_seats": 30,
            "status": "pending",
            "operator_id": "test-op-active",
            "operator_name": "Active Test Operator",
            "created_at": "2025-01-09T12:00:00Z"
        }
        db_client.travel_routes.insert_one(route)
        
        try:
            # Approve
            response = requests.post(
                f"{BASE_URL}/api/validation/services/travel_route/{route_id}/approve",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            
            # Verify status changed to 'active'
            updated_route = db_client.travel_routes.find_one({"id": route_id})
            assert updated_route["status"] == "active", f"Expected 'active', got '{updated_route['status']}'"
            assert "approved_at" in updated_route
        finally:
            db_client.travel_routes.delete_one({"id": route_id})
    
    def test_approve_nonexistent_service_returns_404(self, admin_token):
        """POST /api/validation/services/travel_route/{id}/approve - 404 for nonexistent"""
        response = requests.post(
            f"{BASE_URL}/api/validation/services/travel_route/nonexistent-id-12345/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404


class TestServiceRejection:
    """Test service rejection endpoint with new URL format: /validation/services/{type}/{id}/reject"""
    
    def test_reject_travel_route_returns_200(self, admin_token, db_client):
        """POST /api/validation/services/travel_route/{id}/reject - returns 200 with reason"""
        # Create pending route
        route_id = f"TEST-reject-{uuid.uuid4()}"
        route = {
            "_id": route_id,
            "id": route_id,
            "from_city": "RejectCity1",
            "to_city": "RejectCity2",
            "departure_time": "15:00",
            "arrival_time": "16:00",
            "price": 4000,
            "vehicle_name": "Reject Test Bus",
            "vehicle_type": "bus",
            "total_seats": 35,
            "status": "pending",
            "operator_id": "test-op-reject",
            "operator_name": "Reject Test Operator",
            "created_at": "2025-01-09T13:00:00Z"
        }
        db_client.travel_routes.insert_one(route)
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/validation/services/travel_route/{route_id}/reject",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"reason": "Test rejection reason"}
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert "message" in data
            assert data["service_id"] == route_id
            assert "rejected" in data["message"].lower()
        finally:
            db_client.travel_routes.delete_one({"id": route_id})
    
    def test_reject_sets_status_rejected(self, admin_token, db_client):
        """Verify rejection changes status to 'rejected' with reason"""
        route_id = f"TEST-reject-status-{uuid.uuid4()}"
        route = {
            "_id": route_id,
            "id": route_id,
            "from_city": "StatusCity1",
            "to_city": "StatusCity2",
            "departure_time": "17:00",
            "arrival_time": "18:00",
            "price": 3500,
            "vehicle_name": "Status Test Bus",
            "vehicle_type": "bus",
            "total_seats": 40,
            "status": "pending",
            "operator_id": "test-op-status",
            "operator_name": "Status Test Operator",
            "created_at": "2025-01-09T14:00:00Z"
        }
        db_client.travel_routes.insert_one(route)
        
        rejection_reason = "Invalid vehicle documentation"
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/validation/services/travel_route/{route_id}/reject",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"reason": rejection_reason}
            )
            assert response.status_code == 200
            
            # Verify status changed to 'rejected'
            updated_route = db_client.travel_routes.find_one({"id": route_id})
            assert updated_route["status"] == "rejected", f"Expected 'rejected', got '{updated_route['status']}'"
            assert updated_route["rejection_reason"] == rejection_reason
            assert "rejected_at" in updated_route
        finally:
            db_client.travel_routes.delete_one({"id": route_id})


class TestPendingEndpoint:
    """Test GET /api/validation/pending returns correct structure"""
    
    def test_pending_returns_services_with_id_field(self, admin_token, db_client):
        """GET /api/validation/pending - services.travel_routes items have 'id' field"""
        # Create pending route
        route_id = f"TEST-pending-{uuid.uuid4()}"
        route = {
            "_id": route_id,
            "id": route_id,
            "from_city": "PendingCity1",
            "to_city": "PendingCity2",
            "departure_time": "09:00",
            "arrival_time": "10:00",
            "price": 2500,
            "vehicle_name": "Pending Test Bus",
            "vehicle_type": "bus",
            "total_seats": 50,
            "status": "pending",
            "operator_id": "test-op-pending",
            "operator_name": "Pending Test Operator",
            "created_at": "2025-01-09T15:00:00Z"
        }
        db_client.travel_routes.insert_one(route)
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/validation/pending",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            data = response.json()
            
            # Check structure
            assert "services" in data
            assert "travel_routes" in data["services"]
            
            # Find our test route
            travel_routes = data["services"]["travel_routes"]
            test_route = next((r for r in travel_routes if r.get("id") == route_id), None)
            
            assert test_route is not None, f"Test route {route_id} not found in pending list"
            assert "id" in test_route, "travel_route item must have 'id' field"
            assert test_route["id"] == route_id
            assert test_route["status"] == "pending"
        finally:
            db_client.travel_routes.delete_one({"id": route_id})
    
    def test_pending_counts_are_correct(self, admin_token):
        """GET /api/validation/pending - counts object is present and accurate"""
        response = requests.get(
            f"{BASE_URL}/api/validation/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "counts" in data
        assert "services" in data["counts"]
        
        # Calculate expected service count
        services = data["services"]
        expected_count = sum([
            len(services.get("travel_routes", [])),
            len(services.get("hotels", [])),
            len(services.get("car_rentals", [])),
            len(services.get("restaurants", [])),
            len(services.get("packages", [])),
            len(services.get("events", [])),
            len(services.get("cinemas", [])),
            len(services.get("pressing", [])),
            len(services.get("banquets", []))
        ])
        
        assert data["counts"]["services"] == expected_count


class TestInvalidServiceType:
    """Test error handling for invalid service types"""
    
    def test_approve_invalid_service_type_returns_400(self, admin_token):
        """POST /api/validation/services/{invalid_type}/{id}/approve - returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/validation/services/invalid_type/some-id/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400
        assert "Invalid service type" in response.json().get("detail", "")
    
    def test_reject_invalid_service_type_returns_400(self, admin_token):
        """POST /api/validation/services/{invalid_type}/{id}/reject - returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/validation/services/invalid_type/some-id/reject",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"reason": "Test reason"}
        )
        assert response.status_code == 400
        assert "Invalid service type" in response.json().get("detail", "")

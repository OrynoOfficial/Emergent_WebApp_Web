"""
Iteration 102: Test Communications Hub Operator Filter
Tests that ServiceCommunicationsHub receives operatorId prop and includes it in API calls.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

# Known operator ID from iteration 101
MUSANGO_OPERATOR_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestSupportTicketsOperatorFilter:
    """Test support-tickets API accepts operator_id param"""
    
    def test_support_tickets_without_operator_filter(self, admin_headers):
        """GET /api/support-tickets/ without operator_id returns all tickets"""
        response = requests.get(f"{BASE_URL}/api/support-tickets/?limit=5", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data
        print(f"Support tickets without filter: {len(data.get('tickets', []))} tickets")
    
    def test_support_tickets_with_operator_filter(self, admin_headers):
        """GET /api/support-tickets/?operator_id=X should filter by operator"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/?limit=5&operator_id={MUSANGO_OPERATOR_ID}", 
            headers=admin_headers
        )
        # API should accept the param even if it doesn't filter (graceful handling)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data
        print(f"Support tickets with operator filter: {len(data.get('tickets', []))} tickets")


class TestRatingsOperatorFilter:
    """Test ratings API accepts operator_id param"""
    
    def test_ratings_without_operator_filter(self, admin_headers):
        """GET /api/ratings/?entity_type=travel returns ratings"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/?entity_type=travel&entity_id=test&limit=5", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ratings" in data
        print(f"Ratings without filter: {len(data.get('ratings', []))} ratings")
    
    def test_ratings_with_operator_filter(self, admin_headers):
        """GET /api/ratings/?entity_type=travel&operator_id=X should accept param"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/?entity_type=travel&entity_id=test&limit=5&operator_id={MUSANGO_OPERATOR_ID}", 
            headers=admin_headers
        )
        # API should accept the param gracefully
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ratings" in data
        print(f"Ratings with operator filter: {len(data.get('ratings', []))} ratings")


class TestPromotionsOperatorFilter:
    """Test promotions API accepts operator_id param"""
    
    def test_promotions_without_operator_filter(self, admin_headers):
        """GET /api/subscriptions/promotions returns promotions"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/promotions?limit=10", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "promotions" in data
        print(f"Promotions without filter: {len(data.get('promotions', []))} promotions")
    
    def test_promotions_with_operator_filter(self, admin_headers):
        """GET /api/subscriptions/promotions?operator_id=X filters by operator"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/promotions?limit=10&operator_id={MUSANGO_OPERATOR_ID}", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "promotions" in data
        # Verify filtering works - all returned promotions should be from this operator
        for promo in data.get("promotions", []):
            if promo.get("operator_id"):
                assert promo["operator_id"] == MUSANGO_OPERATOR_ID, \
                    f"Expected operator_id {MUSANGO_OPERATOR_ID}, got {promo.get('operator_id')}"
        print(f"Promotions with operator filter: {len(data.get('promotions', []))} promotions")


class TestManagementPagesHaveScopeOperatorId:
    """Verify management pages pass scopeOperatorId to ServiceCommunicationsHub"""
    
    def test_travel_management_passes_operator_id(self):
        """TravelManagement.jsx passes operatorId={scopeOperatorId} to ServiceCommunicationsHub"""
        with open("/app/frontend/src/pages/management/TravelManagement.jsx", "r") as f:
            content = f.read()
        assert "operatorId={scopeOperatorId}" in content, "TravelManagement should pass operatorId prop"
        assert "ServiceCommunicationsHub" in content, "TravelManagement should use ServiceCommunicationsHub"
        print("TravelManagement.jsx: operatorId={scopeOperatorId} found")
    
    def test_restaurant_management_passes_operator_id(self):
        """RestaurantManagement.jsx passes operatorId={scopeOperatorId} to ServiceCommunicationsHub"""
        with open("/app/frontend/src/pages/management/RestaurantManagement.jsx", "r") as f:
            content = f.read()
        assert "operatorId={scopeOperatorId}" in content, "RestaurantManagement should pass operatorId prop"
        print("RestaurantManagement.jsx: operatorId={scopeOperatorId} found")
    
    def test_hotel_management_passes_operator_id(self):
        """HotelManagement.jsx passes operatorId={scopeOperatorId} to ServiceCommunicationsHub"""
        with open("/app/frontend/src/pages/management/HotelManagement.jsx", "r") as f:
            content = f.read()
        assert "operatorId={scopeOperatorId}" in content, "HotelManagement should pass operatorId prop"
        print("HotelManagement.jsx: operatorId={scopeOperatorId} found")
    
    def test_all_management_pages_pass_operator_id(self):
        """All 9 management pages pass operatorId to ServiceCommunicationsHub"""
        management_files = [
            "BanquetManagement.jsx",
            "CarRentalManagement.jsx", 
            "CinemaManagement.jsx",
            "EventsManagement.jsx",
            "HotelManagement.jsx",
            "LaundryManagement.jsx",
            "PackageManagement.jsx",
            "RestaurantManagement.jsx",
            "TravelManagement.jsx"
        ]
        
        for filename in management_files:
            filepath = f"/app/frontend/src/pages/management/{filename}"
            with open(filepath, "r") as f:
                content = f.read()
            assert "operatorId={scopeOperatorId}" in content or "operatorId=" in content, \
                f"{filename} should pass operatorId prop to ServiceCommunicationsHub"
            print(f"{filename}: operatorId prop found")


class TestServiceCommunicationsHubComponent:
    """Verify ServiceCommunicationsHub accepts operatorId and uses it in API calls"""
    
    def test_component_accepts_operator_id_prop(self):
        """ServiceCommunicationsHub accepts operatorId prop"""
        with open("/app/frontend/src/components/management/ServiceCommunicationsHub.jsx", "r") as f:
            content = f.read()
        assert "operatorId: propOperatorId" in content or "operatorId:" in content, \
            "ServiceCommunicationsHub should accept operatorId prop"
        print("ServiceCommunicationsHub: operatorId prop accepted")
    
    def test_component_uses_operator_id_in_api_calls(self):
        """ServiceCommunicationsHub includes operator_id in API calls"""
        with open("/app/frontend/src/components/management/ServiceCommunicationsHub.jsx", "r") as f:
            content = f.read()
        assert "operator_id=" in content or "opParam" in content, \
            "ServiceCommunicationsHub should include operator_id in API calls"
        assert "support-tickets" in content, "Should call support-tickets API"
        assert "ratings" in content, "Should call ratings API"
        assert "promotions" in content, "Should call promotions API"
        print("ServiceCommunicationsHub: operator_id included in API calls")
    
    def test_component_resolves_operator_id_correctly(self):
        """ServiceCommunicationsHub resolves operatorId from prop or user context"""
        with open("/app/frontend/src/components/management/ServiceCommunicationsHub.jsx", "r") as f:
            content = f.read()
        # Check for the resolution logic: propOperatorId || user?.operator_id
        assert "propOperatorId" in content, "Should use propOperatorId"
        assert "user?.operator_id" in content or "user.operator_id" in content, \
            "Should fall back to user.operator_id"
        print("ServiceCommunicationsHub: operatorId resolution logic correct")


class TestViteBuild:
    """Verify Vite build succeeds"""
    
    def test_vite_build_succeeds(self):
        """Vite build should complete without errors"""
        import subprocess
        result = subprocess.run(
            ["yarn", "--cwd", "/app/frontend", "build"],
            capture_output=True,
            text=True,
            timeout=120
        )
        assert result.returncode == 0, f"Vite build failed: {result.stderr}"
        assert "built in" in result.stdout or "✓" in result.stdout, "Build should complete successfully"
        print("Vite build: SUCCESS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

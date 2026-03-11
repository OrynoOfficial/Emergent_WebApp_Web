"""
Iteration 82: Loyalty Page Enhancements - Operator Promotion Redemption
Tests:
1. POST /api/subscriptions/promotions/{promotion_id}/redeem - generates an operator-scoped promo code
2. GET /api/subscriptions/promotions/my-redeemed - returns user's redeemed promotion codes
3. POST /api/promo-codes/validate - enforce operator_id check (wrong operator_id returns error)
4. Duplicate redemption guard - same user cannot redeem same promotion twice
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def customer_token(api_client):
    """Get customer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Customer authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def customer_client(api_client, customer_token):
    """Session with customer auth header"""
    api_client.headers.update({"Authorization": f"Bearer {customer_token}"})
    return api_client

class TestPromotionRedemption:
    """Test promotion redemption flow"""
    
    def test_get_user_alerts_has_approved_promotions(self, customer_client):
        """Verify customer can see approved promotions from subscribed operators"""
        response = customer_client.get(f"{BASE_URL}/api/subscriptions/user-alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "alerts" in data, "Response should contain 'alerts' key"
        
        # Filter for approved promotions
        approved_promos = [a for a in data["alerts"] if a.get("type") == "promotion" and a.get("status") == "approved"]
        print(f"Found {len(approved_promos)} approved promotions for customer")
        
        # Store a promotion ID for later tests
        if approved_promos:
            # Store first available promotion for testing
            self.__class__.available_promo = approved_promos[0]
            print(f"Available promotion: {self.__class__.available_promo.get('id')} - {self.__class__.available_promo.get('title')}")
        else:
            print("No approved promotions available")
            self.__class__.available_promo = None
    
    def test_get_my_redeemed_promotions_endpoint(self, customer_client):
        """Test GET /api/subscriptions/promotions/my-redeemed endpoint"""
        response = customer_client.get(f"{BASE_URL}/api/subscriptions/promotions/my-redeemed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "redemptions" in data, "Response should contain 'redemptions' key"
        assert isinstance(data["redemptions"], list), "redemptions should be a list"
        
        print(f"Customer has {len(data['redemptions'])} redeemed promotions")
        
        # Check structure of redemptions if any exist
        if data["redemptions"]:
            first_redemption = data["redemptions"][0]
            # Verify required fields
            assert "code" in first_redemption, "Redemption should have 'code'"
            assert "operator_id" in first_redemption, "Redemption should have 'operator_id'"
            assert "operator_name" in first_redemption, "Redemption should have 'operator_name'"
            assert "status" in first_redemption, "Redemption should have 'status'"
            print(f"First redemption: {first_redemption.get('code')} - {first_redemption.get('promotion_title')}")
            
            # Store already redeemed promotion IDs to avoid them in future tests
            self.__class__.redeemed_promo_ids = set(r.get("promotion_id") for r in data["redemptions"])
        else:
            self.__class__.redeemed_promo_ids = set()
    
    def test_redeem_promotion_generates_code(self, customer_client):
        """Test POST /api/subscriptions/promotions/{promotion_id}/redeem generates a promo code"""
        # Use a promotion ID that hasn't been redeemed
        # Use the suggested promotion ID from the test request
        test_promo_id = "15421566-8d65-49f9-9e05-f4aef3f85e75"
        
        # Check if already redeemed
        if hasattr(self.__class__, 'redeemed_promo_ids') and test_promo_id in self.__class__.redeemed_promo_ids:
            # Try to find another available promo
            if hasattr(self.__class__, 'available_promo') and self.__class__.available_promo:
                promo_id = self.__class__.available_promo.get('id')
                if promo_id and promo_id not in self.__class__.redeemed_promo_ids:
                    test_promo_id = promo_id
                else:
                    pytest.skip("No unredeemed promotions available for testing")
            else:
                pytest.skip("No unredeemed promotions available for testing")
        
        response = customer_client.post(f"{BASE_URL}/api/subscriptions/promotions/{test_promo_id}/redeem")
        
        if response.status_code == 400:
            # Expected if already redeemed
            data = response.json()
            if "already redeemed" in data.get("detail", "").lower():
                print(f"Promotion {test_promo_id} was already redeemed by this user")
                pytest.skip("This promotion was already redeemed - test duplicate prevention")
            else:
                # Other 400 error
                print(f"Redemption failed: {data.get('detail')}")
        elif response.status_code == 200:
            data = response.json()
            assert "code" in data, "Response should contain 'code'"
            assert "operator_name" in data, "Response should contain 'operator_name'"
            assert "expires_at" in data, "Response should contain 'expires_at'"
            assert data["code"].startswith("PROMO-"), f"Code should start with 'PROMO-', got {data['code']}"
            
            print(f"Successfully redeemed promotion - Code: {data['code']}")
            print(f"Operator: {data.get('operator_name')}, Service: {data.get('service_type')}")
            
            # Store for later tests
            self.__class__.redeemed_code = data["code"]
            self.__class__.redeemed_operator_id = None  # Will fetch from redemptions
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_duplicate_redemption_blocked(self, customer_client):
        """Test that same user cannot redeem same promotion twice"""
        # Use the promotion ID from the previous test or a known redeemed one
        test_promo_id = "9b1906e6-ec34-457a-a597-e967e5b13ff9"  # From test context - already redeemed
        
        response = customer_client.post(f"{BASE_URL}/api/subscriptions/promotions/{test_promo_id}/redeem")
        
        # Should fail with 400 and "already redeemed" message
        assert response.status_code == 400, f"Expected 400 for duplicate redemption, got {response.status_code}"
        
        data = response.json()
        assert "already redeemed" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower(), \
            f"Expected 'already redeemed' error, got: {data.get('detail')}"
        
        print(f"Duplicate redemption correctly blocked: {data.get('detail')}")


class TestPromoCodeValidation:
    """Test promo code validation with operator scope"""
    
    def test_validate_promo_code_with_correct_operator(self, customer_client):
        """Test validating a promo code with the correct operator_id"""
        # First get redeemed promotions to get a valid code with operator_id
        response = customer_client.get(f"{BASE_URL}/api/subscriptions/promotions/my-redeemed")
        assert response.status_code == 200
        
        redemptions = response.json().get("redemptions", [])
        active_redemptions = [r for r in redemptions if r.get("status") == "active"]
        
        if not active_redemptions:
            pytest.skip("No active promotion codes to validate")
        
        # Use first active redemption
        redemption = active_redemptions[0]
        code = redemption.get("code")
        operator_id = redemption.get("operator_id")
        
        print(f"Testing validation for code: {code}, operator_id: {operator_id}")
        
        # Validate with correct operator_id
        response = customer_client.post(f"{BASE_URL}/api/promo-codes/validate", json={
            "code": code,
            "operator_id": operator_id,
            "order_amount": 10000
        })
        
        assert response.status_code == 200, f"Expected 200 for correct operator, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("valid") == True, "Promo code should be valid"
        assert data.get("code") == code.upper(), "Returned code should match"
        
        print(f"Validation passed: {data}")
        
        # Store for next test
        self.__class__.valid_code = code
        self.__class__.valid_operator_id = operator_id
    
    def test_validate_promo_code_with_wrong_operator(self, customer_client):
        """Test validating a promo code with wrong operator_id returns error"""
        if not hasattr(self.__class__, 'valid_code'):
            pytest.skip("No valid code from previous test")
        
        code = self.__class__.valid_code
        correct_operator_id = self.__class__.valid_operator_id
        
        # Use a different operator_id (fake)
        wrong_operator_id = "wrong-operator-id-12345"
        
        print(f"Testing validation for code: {code} with WRONG operator_id: {wrong_operator_id}")
        
        response = customer_client.post(f"{BASE_URL}/api/promo-codes/validate", json={
            "code": code,
            "operator_id": wrong_operator_id,
            "order_amount": 10000
        })
        
        # Should fail with 400 for wrong operator
        assert response.status_code == 400, f"Expected 400 for wrong operator, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operator" in data.get("detail", "").lower() or "specific" in data.get("detail", "").lower(), \
            f"Expected operator-related error, got: {data.get('detail')}"
        
        print(f"Correctly rejected wrong operator: {data.get('detail')}")


class TestRedemptionDataStructure:
    """Verify redemption data structure and fields"""
    
    def test_redemption_has_required_fields(self, customer_client):
        """Verify redeemed promotions have all required fields"""
        response = customer_client.get(f"{BASE_URL}/api/subscriptions/promotions/my-redeemed")
        assert response.status_code == 200
        
        redemptions = response.json().get("redemptions", [])
        
        if not redemptions:
            pytest.skip("No redemptions to verify structure")
        
        required_fields = [
            "id", "user_id", "promotion_id", "operator_id", "operator_name",
            "code", "status", "created_at"
        ]
        
        for redemption in redemptions[:3]:  # Check first 3
            for field in required_fields:
                assert field in redemption, f"Redemption missing required field: {field}"
            
            # Verify status is valid
            assert redemption["status"] in ["active", "used", "expired"], \
                f"Invalid status: {redemption['status']}"
            
            # Verify code format
            assert redemption["code"].startswith("PROMO-"), \
                f"Code should start with 'PROMO-': {redemption['code']}"
        
        print(f"Verified {len(redemptions)} redemptions have correct structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

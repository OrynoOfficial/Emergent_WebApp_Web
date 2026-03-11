"""
Iteration 83: Loyalty Page Enhancements - Operator Promo Code Scope Validation
Tests for:
1. POST /api/promo-codes/validate - rejects operator-scoped code when NO operator_id provided
2. POST /api/promo-codes/validate - rejects operator-scoped code when WRONG operator_id provided
3. POST /api/promo-codes/validate - accepts operator-scoped code when CORRECT operator_id provided
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"

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
def customer_client(api_client, customer_token):
    """Session with customer auth header"""
    api_client.headers.update({"Authorization": f"Bearer {customer_token}"})
    return api_client

@pytest.fixture(scope="module")
def operator_scoped_promo_code(customer_client):
    """Get an operator-scoped promo code from customer's redeemed promotions"""
    response = customer_client.get(f"{BASE_URL}/api/subscriptions/promotions/my-redeemed")
    assert response.status_code == 200, f"Failed to get redeemed promotions: {response.text}"
    
    redemptions = response.json().get("redemptions", [])
    
    # Find an active operator-scoped promo code
    for r in redemptions:
        if r.get("status") == "active" and r.get("operator_id"):
            print(f"Found operator-scoped code: {r.get('code')} for operator: {r.get('operator_id')}")
            return {
                "code": r.get("code"),
                "operator_id": r.get("operator_id"),
                "operator_name": r.get("operator_name")
            }
    
    pytest.skip("No active operator-scoped promo code available for testing")


class TestPromoCodeOperatorScopeValidation:
    """Test promo code validation with operator scope checks"""
    
    def test_validate_rejects_code_without_operator_id(self, customer_client, operator_scoped_promo_code):
        """Test: POST /api/promo-codes/validate rejects operator-scoped code when NO operator_id provided"""
        code = operator_scoped_promo_code["code"]
        
        print(f"Testing validation for code: {code} WITHOUT operator_id")
        
        # Validate without operator_id (should fail)
        response = customer_client.post(f"{BASE_URL}/api/promo-codes/validate", json={
            "code": code,
            "order_amount": 10000
            # No operator_id provided
        })
        
        assert response.status_code == 400, \
            f"Expected 400 when no operator_id provided, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "").lower()
        
        # Should mention operator scope
        assert "operator" in detail or "specific" in detail, \
            f"Expected operator-related error message, got: {data.get('detail')}"
        
        print(f"Correctly rejected (no operator_id): {data.get('detail')}")
    
    def test_validate_rejects_code_with_wrong_operator_id(self, customer_client, operator_scoped_promo_code):
        """Test: POST /api/promo-codes/validate rejects operator-scoped code when WRONG operator_id provided"""
        code = operator_scoped_promo_code["code"]
        correct_operator_id = operator_scoped_promo_code["operator_id"]
        
        # Use a different (wrong) operator_id
        wrong_operator_id = "wrong-operator-id-99999"
        
        print(f"Testing validation for code: {code} with WRONG operator_id: {wrong_operator_id}")
        print(f"(Correct operator_id is: {correct_operator_id})")
        
        response = customer_client.post(f"{BASE_URL}/api/promo-codes/validate", json={
            "code": code,
            "operator_id": wrong_operator_id,
            "order_amount": 10000
        })
        
        assert response.status_code == 400, \
            f"Expected 400 for wrong operator_id, got {response.status_code}: {response.text}"
        
        data = response.json()
        detail = data.get("detail", "").lower()
        
        # Should mention operator scope
        assert "operator" in detail or "specific" in detail, \
            f"Expected operator-related error message, got: {data.get('detail')}"
        
        print(f"Correctly rejected (wrong operator_id): {data.get('detail')}")
    
    def test_validate_accepts_code_with_correct_operator_id(self, customer_client, operator_scoped_promo_code):
        """Test: POST /api/promo-codes/validate accepts operator-scoped code when CORRECT operator_id provided"""
        code = operator_scoped_promo_code["code"]
        correct_operator_id = operator_scoped_promo_code["operator_id"]
        
        print(f"Testing validation for code: {code} with CORRECT operator_id: {correct_operator_id}")
        
        response = customer_client.post(f"{BASE_URL}/api/promo-codes/validate", json={
            "code": code,
            "operator_id": correct_operator_id,
            "order_amount": 10000
        })
        
        assert response.status_code == 200, \
            f"Expected 200 for correct operator_id, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify successful validation response
        assert data.get("valid") == True, "Promo code should be valid"
        assert data.get("code") == code.upper(), f"Returned code should match, got {data.get('code')}"
        assert "discount_type" in data, "Response should contain discount_type"
        assert "discount_value" in data, "Response should contain discount_value"
        
        print(f"Validation passed successfully!")
        print(f"  Code: {data.get('code')}")
        print(f"  Discount: {data.get('discount_value')} ({data.get('discount_type')})")
        if data.get("discount_amount"):
            print(f"  Discount Amount: {data.get('discount_amount')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

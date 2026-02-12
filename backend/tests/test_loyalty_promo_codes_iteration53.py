"""
Iteration 53: Loyalty Promo Codes Backend Tests
================================================
Tests the full loyalty promo code flow:
1. Admin creates promo code from reward (POST /api/loyalty/admin/rewards/{id}/generate-promo)
2. Generated promo code stored in promo_codes collection with source='loyalty_reward'
3. Admin views generated codes (GET /api/loyalty/admin/promo-codes)
4. Customer validates the code (POST /api/promo-codes/validate)
5. Customer uses the code (POST /api/promo-codes/use)
6. Admin sees updated times_used
7. Promo code respects usage_limit and per_user_limit
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test data tracking for cleanup
created_reward_ids = []
created_promo_codes = []
created_promo_uses = []


class TestAuthSetup:
    """Authentication setup for testing"""
    
    admin_token = None
    customer_token = None
    admin_id = None
    customer_id = None
    
    @classmethod
    def login_admin(cls):
        """Login as super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        cls.admin_token = data["access_token"]
        cls.admin_id = data["user"]["id"]
        return cls.admin_token
    
    @classmethod
    def login_customer(cls):
        """Login as customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        cls.customer_token = data["access_token"]
        cls.customer_id = data["user"]["id"]
        return cls.customer_token


@pytest.fixture(scope="module")
def admin_headers():
    """Admin auth headers"""
    token = TestAuthSetup.login_admin()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_headers():
    """Customer auth headers"""
    token = TestAuthSetup.login_customer()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestLoyaltyPromoCodeGeneration:
    """Tests for generating promo codes from loyalty rewards"""
    
    reward_id = None
    generated_promo_code = None
    
    def test_01_create_loyalty_reward(self, admin_headers):
        """Create a test loyalty reward to generate promo from"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        reward_data = {
            "title": "TEST_PROMO_REWARD_10PCT",
            "description": "Test reward for promo code generation - 10% off",
            "points_required": 100,
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 10.0,
            "service_types": ["travel"],
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "max_redemptions": 5
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=reward_data
        )
        
        assert response.status_code == 200, f"Failed to create reward: {response.text}"
        data = response.json()
        assert "reward" in data
        TestLoyaltyPromoCodeGeneration.reward_id = data["reward"]["id"]
        created_reward_ids.append(TestLoyaltyPromoCodeGeneration.reward_id)
        print(f"PASS: Created loyalty reward with id: {TestLoyaltyPromoCodeGeneration.reward_id}")
    
    def test_02_generate_promo_from_reward(self, admin_headers):
        """Test generating a promo code from loyalty reward"""
        reward_id = TestLoyaltyPromoCodeGeneration.reward_id
        assert reward_id is not None, "Reward ID not set from previous test"
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}/generate-promo",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to generate promo: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "code" in data, "Response missing 'code'"
        assert "promo_id" in data, "Response missing 'promo_id'"
        assert "discount_type" in data, "Response missing 'discount_type'"
        assert "discount_value" in data, "Response missing 'discount_value'"
        assert "valid_from" in data, "Response missing 'valid_from'"
        assert "valid_to" in data, "Response missing 'valid_to'"
        assert "usage_limit" in data, "Response missing 'usage_limit'"
        
        # Verify values
        assert data["discount_type"] == "percentage", f"Expected percentage, got {data['discount_type']}"
        assert data["discount_value"] == 10.0, f"Expected 10.0, got {data['discount_value']}"
        assert data["usage_limit"] == 5, f"Expected usage_limit 5, got {data['usage_limit']}"
        assert data["code"].startswith("LYL-"), f"Code should start with LYL-, got {data['code']}"
        
        TestLoyaltyPromoCodeGeneration.generated_promo_code = data["code"]
        created_promo_codes.append(data["code"])
        print(f"PASS: Generated promo code: {data['code']} with discount {data['discount_value']}% and limit {data['usage_limit']}")
    
    def test_03_verify_promo_code_in_collection(self, admin_headers):
        """Verify the generated promo code is stored with correct source and reward_id"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/promo-codes",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to get promo codes: {response.text}"
        data = response.json()
        
        assert "promo_codes" in data, "Response missing 'promo_codes'"
        
        # Find our generated code
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        promo = next((p for p in data["promo_codes"] if p["code"] == code), None)
        
        assert promo is not None, f"Generated code {code} not found in admin promo codes"
        assert promo["source"] == "loyalty_reward", f"Expected source 'loyalty_reward', got {promo.get('source')}"
        assert promo["reward_id"] == TestLoyaltyPromoCodeGeneration.reward_id, "reward_id mismatch"
        assert promo["times_used"] == 0, f"Expected times_used 0, got {promo['times_used']}"
        assert promo["is_active"] == True, "Promo should be active"
        assert "valid_to" in promo, "Missing valid_to"
        
        print(f"PASS: Promo code {code} found with source='loyalty_reward', reward_id={promo['reward_id']}, times_used={promo['times_used']}")


class TestPromoCodeValidation:
    """Tests for customer promo code validation"""
    
    def test_04_customer_validates_code(self, customer_headers):
        """Customer validates the generated promo code"""
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        assert code is not None, "Promo code not set from previous test"
        
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 10000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        
        # Verify validation response
        assert data["valid"] == True, "Code should be valid"
        assert data["code"] == code, "Code mismatch"
        assert data["discount_type"] == "percentage", f"Expected percentage, got {data['discount_type']}"
        assert data["discount_value"] == 10.0, f"Expected 10.0, got {data['discount_value']}"
        
        # Verify discount_amount calculation (10% of 10000 = 1000)
        expected_discount = 10000 * 0.10
        assert data["discount_amount"] == expected_discount, f"Expected discount {expected_discount}, got {data['discount_amount']}"
        
        print(f"PASS: Validated code {code}, discount_type={data['discount_type']}, discount_value={data['discount_value']}, discount_amount={data['discount_amount']}")
    
    def test_05_customer_validates_with_different_amount(self, customer_headers):
        """Validate with different order amount - percentage calculation"""
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 25000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        
        # 10% of 25000 = 2500
        expected_discount = 25000 * 0.10
        assert data["discount_amount"] == expected_discount, f"Expected discount {expected_discount}, got {data['discount_amount']}"
        
        print(f"PASS: Validated code with order_amount=25000, discount_amount={data['discount_amount']}")


class TestPromoCodeUsage:
    """Tests for promo code usage and limits"""
    
    def test_06_customer_uses_code(self, customer_headers):
        """Customer uses the promo code after booking"""
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        test_order_id = f"TEST_ORDER_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        discount_amount = 1000.0
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/use",
            headers=customer_headers,
            params={
                "code": code,
                "order_id": test_order_id,
                "discount_amount": discount_amount
            }
        )
        
        assert response.status_code == 200, f"Use promo code failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response missing message"
        
        created_promo_uses.append({"code": code, "order_id": test_order_id})
        print(f"PASS: Used promo code {code} for order {test_order_id}")
    
    def test_07_admin_sees_updated_times_used(self, admin_headers):
        """Verify admin sees times_used incremented"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/promo-codes",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to get promo codes: {response.text}"
        data = response.json()
        
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        promo = next((p for p in data["promo_codes"] if p["code"] == code), None)
        
        assert promo is not None, f"Promo code {code} not found"
        assert promo["times_used"] == 1, f"Expected times_used=1, got {promo['times_used']}"
        
        print(f"PASS: Admin sees times_used=1 for code {code}")
    
    def test_08_per_user_limit_rejection(self, customer_headers):
        """Customer cannot use same code again (per_user_limit=1)"""
        code = TestLoyaltyPromoCodeGeneration.generated_promo_code
        
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 10000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 400, f"Expected 400 for per_user_limit, got {response.status_code}"
        data = response.json()
        assert "already used" in data.get("detail", "").lower(), f"Expected per-user limit message, got: {data}"
        
        print(f"PASS: per_user_limit enforced - customer cannot validate same code again")


class TestFixedAmountPromoCode:
    """Tests for fixed amount promo codes from rewards"""
    
    fixed_reward_id = None
    fixed_promo_code = None
    
    def test_09_create_fixed_discount_reward(self, admin_headers):
        """Create a reward with fixed discount type"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        reward_data = {
            "title": "TEST_FIXED_DISCOUNT_REWARD",
            "description": "Test reward for fixed discount - 500 XAF off",
            "points_required": 50,
            "min_tier": "bronze",
            "type": "fixed_discount",  # Fixed type
            "discount_value": 500.0,
            "service_types": [],
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "total_available": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=reward_data
        )
        
        assert response.status_code == 200, f"Failed to create fixed reward: {response.text}"
        data = response.json()
        TestFixedAmountPromoCode.fixed_reward_id = data["reward"]["id"]
        created_reward_ids.append(TestFixedAmountPromoCode.fixed_reward_id)
        print(f"PASS: Created fixed discount reward with id: {TestFixedAmountPromoCode.fixed_reward_id}")
    
    def test_10_generate_fixed_promo_code(self, admin_headers):
        """Generate promo code from fixed discount reward"""
        reward_id = TestFixedAmountPromoCode.fixed_reward_id
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}/generate-promo",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to generate fixed promo: {response.text}"
        data = response.json()
        
        # Fixed discount reward type maps to 'fixed' promo discount_type
        assert data["discount_type"] == "fixed", f"Expected 'fixed', got {data['discount_type']}"
        assert data["discount_value"] == 500.0, f"Expected 500.0, got {data['discount_value']}"
        assert data["usage_limit"] == 10, f"Expected usage_limit 10, got {data['usage_limit']}"
        
        TestFixedAmountPromoCode.fixed_promo_code = data["code"]
        created_promo_codes.append(data["code"])
        print(f"PASS: Generated fixed promo code: {data['code']} with discount_type='fixed', value=500.0")
    
    def test_11_validate_fixed_discount_calculation(self, customer_headers):
        """Validate fixed discount applies correctly"""
        code = TestFixedAmountPromoCode.fixed_promo_code
        
        # Create a new customer for this test (use admin or different flow)
        # Since customer already used percentage code, we use admin to test fixed validation
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 10000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        
        # Fixed discount = 500 regardless of order amount
        assert data["discount_amount"] == 500.0, f"Expected fixed discount 500.0, got {data['discount_amount']}"
        assert data["discount_type"] == "fixed"
        
        print(f"PASS: Fixed discount validation correct - discount_amount=500.0 for any order amount")


class TestUsageLimitEnforcement:
    """Tests for usage_limit enforcement"""
    
    limited_reward_id = None
    limited_promo_code = None
    
    def test_12_create_reward_with_usage_limit_1(self, admin_headers):
        """Create a reward with usage_limit=1"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        reward_data = {
            "title": "TEST_SINGLE_USE_REWARD",
            "description": "Single use test reward",
            "points_required": 25,
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 5.0,
            "service_types": [],
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "max_redemptions": 1  # Only 1 total use allowed
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=reward_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        TestUsageLimitEnforcement.limited_reward_id = data["reward"]["id"]
        created_reward_ids.append(TestUsageLimitEnforcement.limited_reward_id)
        print(f"PASS: Created single-use reward")
    
    def test_13_generate_limited_promo(self, admin_headers):
        """Generate promo from single-use reward"""
        reward_id = TestUsageLimitEnforcement.limited_reward_id
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}/generate-promo",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["usage_limit"] == 1, f"Expected usage_limit=1, got {data['usage_limit']}"
        
        TestUsageLimitEnforcement.limited_promo_code = data["code"]
        created_promo_codes.append(data["code"])
        print(f"PASS: Generated limited promo code: {data['code']} with usage_limit=1")
    
    def test_14_first_use_succeeds(self, customer_headers):
        """First use of limited code succeeds"""
        code = TestUsageLimitEnforcement.limited_promo_code
        test_order_id = f"TEST_LIM_ORDER_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # First validate
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 5000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"First validation should succeed: {response.text}"
        
        # Then use
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/use",
            headers=customer_headers,
            params={
                "code": code,
                "order_id": test_order_id,
                "discount_amount": 250.0
            }
        )
        
        assert response.status_code == 200, f"First use should succeed: {response.text}"
        created_promo_uses.append({"code": code, "order_id": test_order_id})
        print(f"PASS: First use of limited promo code succeeded")
    
    def test_15_usage_limit_reached_rejection(self, admin_headers):
        """After usage_limit reached, code is rejected"""
        code = TestUsageLimitEnforcement.limited_promo_code
        
        # Try to validate as admin (different user)
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 5000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=admin_headers,
            json=validation_data
        )
        
        # Should be rejected due to usage_limit reached
        assert response.status_code == 400, f"Expected 400 for usage_limit reached, got {response.status_code}"
        data = response.json()
        assert "limit" in data.get("detail", "").lower(), f"Expected usage limit message, got: {data}"
        
        print(f"PASS: usage_limit enforced - code rejected after exhausted")


class TestCleanup:
    """Cleanup test data"""
    
    def test_99_cleanup_test_data(self, admin_headers):
        """Clean up all test rewards and promo codes"""
        cleanup_summary = {"rewards_deleted": 0, "promo_codes_deleted": 0}
        
        # Delete test rewards
        for reward_id in created_reward_ids:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}",
                    headers=admin_headers
                )
                if response.status_code == 200:
                    cleanup_summary["rewards_deleted"] += 1
            except Exception as e:
                print(f"Warning: Failed to delete reward {reward_id}: {e}")
        
        # Delete test promo codes from promo_codes collection
        for code in created_promo_codes:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/promo-codes/{code}",
                    headers=admin_headers
                )
                if response.status_code in [200, 404]:
                    cleanup_summary["promo_codes_deleted"] += 1
            except Exception as e:
                print(f"Warning: Failed to delete promo code {code}: {e}")
        
        print(f"PASS: Cleanup complete - {cleanup_summary}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

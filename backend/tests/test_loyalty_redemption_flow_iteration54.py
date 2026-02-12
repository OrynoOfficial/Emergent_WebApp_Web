"""
Iteration 54: Loyalty Redemption & Promo Codes Coexistence Tests
================================================================
Tests the E2E flow of customer loyalty redemption and promo code coexistence:
1. Customer redeems reward (POST /api/loyalty/redeem/{id}) → gets redemption_code → code exists in promo_codes collection with source='loyalty_redemption'
2. Redemption code validates via POST /api/promo-codes/validate (returns discount_type, discount_value, discount_amount)
3. After using code via POST /api/promo-codes/use → loyalty_redemptions.status='used' and promo_codes.is_active=false
4. Used code fails validation (already used / per_user_limit reached)
5. Admin GET /api/loyalty/admin/promo-codes returns both source='loyalty_reward' AND source='loyalty_redemption' entries
6. Admin-generated promos (POST /api/loyalty/admin/rewards/{id}/generate-promo) still work independently
7. Customer redemptions GET /api/loyalty/redemptions shows status='used' with used_in_order after code is used
8. Backwards: Existing promo codes created directly (POST /api/promo-codes/) still validate and work
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test data tracking for cleanup
created_reward_ids = []
created_promo_codes = []
test_redemption_codes = []
directly_created_promo_codes = []


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


class TestCustomerLoyaltySetup:
    """Setup: Check customer has enough points, create test reward if needed"""
    
    test_reward_id = None
    customer_available_points = 0
    
    def test_01_check_customer_loyalty_program(self, customer_headers):
        """Get customer loyalty program and available points"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/program",
            headers=customer_headers
        )
        
        assert response.status_code == 200, f"Failed to get loyalty program: {response.text}"
        data = response.json()
        
        TestCustomerLoyaltySetup.customer_available_points = data.get("available_points", 0)
        print(f"INFO: Customer has {TestCustomerLoyaltySetup.customer_available_points} available points, tier={data.get('tier')}")
    
    def test_02_create_low_points_test_reward(self, admin_headers):
        """Create a test reward with low points requirement for testing"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        # Create reward with very low points requirement
        reward_data = {
            "title": "TEST_ITER54_REWARD_10PCT",
            "description": "Test reward for iteration 54 - 10% off - low points",
            "points_required": 10,  # Very low for testing
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 10.0,
            "service_types": ["travel"],
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "max_redemptions": 100
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=reward_data
        )
        
        assert response.status_code == 200, f"Failed to create reward: {response.text}"
        data = response.json()
        TestCustomerLoyaltySetup.test_reward_id = data["reward"]["id"]
        created_reward_ids.append(TestCustomerLoyaltySetup.test_reward_id)
        print(f"PASS: Created test reward with id: {TestCustomerLoyaltySetup.test_reward_id}, points_required=10")
    
    def test_03_ensure_customer_has_points(self, customer_headers):
        """Ensure customer has at least 50 points via earn endpoint"""
        if TestCustomerLoyaltySetup.customer_available_points >= 50:
            print(f"INFO: Customer already has {TestCustomerLoyaltySetup.customer_available_points} points, skipping earn")
            return
        
        # Earn some points for testing
        response = requests.post(
            f"{BASE_URL}/api/loyalty/earn",
            headers=customer_headers,
            params={
                "amount": 5000,  # Should give about 500 points
                "order_id": f"TEST_EARN_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                "service_type": "travel",
                "description": "Test points for iteration 54"
            }
        )
        
        # Check if earn worked
        if response.status_code == 200:
            data = response.json()
            print(f"INFO: Earned {data.get('points_earned', 0)} points for testing")
        else:
            print(f"WARNING: Could not earn points: {response.status_code} - {response.text}")
        
        # Re-check points
        response = requests.get(
            f"{BASE_URL}/api/loyalty/program",
            headers=customer_headers
        )
        if response.status_code == 200:
            TestCustomerLoyaltySetup.customer_available_points = response.json().get("available_points", 0)
            print(f"INFO: Customer now has {TestCustomerLoyaltySetup.customer_available_points} available points")


class TestCustomerRedemptionFlow:
    """E2E: Customer redeems reward → generates code → code exists in promo_codes with source='loyalty_redemption'"""
    
    redemption_code = None
    
    def test_04_customer_redeems_reward(self, customer_headers):
        """Customer redeems reward and gets redemption_code"""
        reward_id = TestCustomerLoyaltySetup.test_reward_id
        assert reward_id is not None, "Reward ID not set from setup"
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/redeem/{reward_id}",
            headers=customer_headers
        )
        
        assert response.status_code == 200, f"Redemption failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "redemption_code" in data, f"Response missing 'redemption_code': {data}"
        assert "expires_at" in data, "Response missing 'expires_at'"
        assert "points_used" in data, "Response missing 'points_used'"
        
        TestCustomerRedemptionFlow.redemption_code = data["redemption_code"]
        test_redemption_codes.append(TestCustomerRedemptionFlow.redemption_code)
        
        print(f"PASS: Customer redeemed reward, got code: {TestCustomerRedemptionFlow.redemption_code}, points_used={data['points_used']}")
    
    def test_05_verify_code_in_promo_codes_collection(self, admin_headers):
        """Verify redemption code exists in promo_codes with source='loyalty_redemption'"""
        code = TestCustomerRedemptionFlow.redemption_code
        assert code is not None, "Redemption code not set"
        
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/promo-codes",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to get promo codes: {response.text}"
        data = response.json()
        
        # Find the redemption code
        promo = next((p for p in data["promo_codes"] if p["code"] == code), None)
        
        assert promo is not None, f"Redemption code {code} not found in admin promo codes"
        assert promo["source"] == "loyalty_redemption", f"Expected source 'loyalty_redemption', got {promo.get('source')}"
        assert promo.get("redemption_id") is not None, "Missing redemption_id link"
        assert promo.get("redeemed_by") is not None, "Missing redeemed_by"
        assert promo.get("is_active") == True, "Code should be active"
        assert promo.get("times_used") == 0, f"Expected times_used=0, got {promo.get('times_used')}"
        
        print(f"PASS: Code {code} found in promo_codes with source='loyalty_redemption', redemption_id={promo.get('redemption_id')}")


class TestRedemptionCodeValidation:
    """E2E: Redemption code validates via POST /api/promo-codes/validate"""
    
    def test_06_validate_redemption_code(self, customer_headers):
        """Validate the redemption code returns discount info"""
        code = TestCustomerRedemptionFlow.redemption_code
        assert code is not None, "Redemption code not set"
        
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
        
        # Verify validation response structure
        assert data.get("valid") == True, "Code should be valid"
        assert "discount_type" in data, "Response missing 'discount_type'"
        assert "discount_value" in data, "Response missing 'discount_value'"
        assert "discount_amount" in data, "Response missing 'discount_amount'"
        
        # The test reward has 10% discount
        assert data["discount_type"] == "percentage", f"Expected percentage, got {data['discount_type']}"
        assert data["discount_value"] == 10.0, f"Expected 10.0, got {data['discount_value']}"
        
        # 10% of 10000 = 1000
        expected_discount = 10000 * 0.10
        assert data["discount_amount"] == expected_discount, f"Expected {expected_discount}, got {data['discount_amount']}"
        
        print(f"PASS: Redemption code validated - discount_type={data['discount_type']}, discount_value={data['discount_value']}, discount_amount={data['discount_amount']}")


class TestUseCodeAndStatusUpdate:
    """E2E: After using code → loyalty_redemptions.status='used' and promo_codes.is_active=false"""
    
    test_order_id = None
    
    def test_07_use_redemption_code(self, customer_headers):
        """Customer uses the redemption code"""
        code = TestCustomerRedemptionFlow.redemption_code
        assert code is not None, "Redemption code not set"
        
        TestUseCodeAndStatusUpdate.test_order_id = f"TEST_ITER54_ORDER_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        discount_amount = 1000.0
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/use",
            headers=customer_headers,
            params={
                "code": code,
                "order_id": TestUseCodeAndStatusUpdate.test_order_id,
                "discount_amount": discount_amount
            }
        )
        
        assert response.status_code == 200, f"Use code failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response missing message"
        
        print(f"PASS: Used redemption code {code} for order {TestUseCodeAndStatusUpdate.test_order_id}")
    
    def test_08_verify_loyalty_redemption_status_updated(self, customer_headers):
        """Verify loyalty_redemptions.status='used' with used_in_order"""
        code = TestCustomerRedemptionFlow.redemption_code
        
        response = requests.get(
            f"{BASE_URL}/api/loyalty/redemptions",
            headers=customer_headers
        )
        
        assert response.status_code == 200, f"Failed to get redemptions: {response.text}"
        data = response.json()
        
        # Find our redemption by code
        redemption = next((r for r in data.get("redemptions", []) if r.get("code") == code), None)
        
        assert redemption is not None, f"Redemption with code {code} not found in customer redemptions"
        assert redemption.get("status") == "used", f"Expected status='used', got {redemption.get('status')}"
        assert redemption.get("used_in_order") == TestUseCodeAndStatusUpdate.test_order_id, f"Expected used_in_order={TestUseCodeAndStatusUpdate.test_order_id}, got {redemption.get('used_in_order')}"
        
        print(f"PASS: Redemption status='used', used_in_order={redemption.get('used_in_order')}")
    
    def test_09_verify_promo_code_deactivated(self, admin_headers):
        """Verify promo_codes.is_active=false after single use (usage_limit=1)"""
        code = TestCustomerRedemptionFlow.redemption_code
        
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/promo-codes",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed to get promo codes: {response.text}"
        data = response.json()
        
        promo = next((p for p in data["promo_codes"] if p["code"] == code), None)
        assert promo is not None, f"Promo code {code} not found"
        
        # Since usage_limit=1 for loyalty redemption codes, it should be deactivated
        assert promo.get("is_active") == False, f"Expected is_active=False after usage, got {promo.get('is_active')}"
        assert promo.get("times_used") == 1, f"Expected times_used=1, got {promo.get('times_used')}"
        
        print(f"PASS: Promo code is_active=False, times_used=1 after single use")


class TestUsedCodeRejection:
    """E2E: Used code fails validation"""
    
    def test_10_used_code_validation_fails(self, customer_headers):
        """Validate used code fails (per_user_limit reached)"""
        code = TestCustomerRedemptionFlow.redemption_code
        
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
        
        # Should fail - either due to per_user_limit or usage_limit reached
        assert response.status_code == 400, f"Expected 400 for used code, got {response.status_code}"
        data = response.json()
        error_detail = data.get("detail", "").lower()
        
        # Should mention either "already used" or "limit"
        assert "already used" in error_detail or "limit" in error_detail, f"Expected usage/limit error, got: {data}"
        
        print(f"PASS: Used redemption code rejected with message: {data.get('detail')}")


class TestAdminSeesAllSources:
    """E2E: Admin GET /api/loyalty/admin/promo-codes returns both source='loyalty_reward' AND source='loyalty_redemption'"""
    
    admin_generated_code = None
    admin_reward_id = None
    
    def test_11_create_admin_reward_for_promo_generation(self, admin_headers):
        """Create reward to generate admin promo code"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        reward_data = {
            "title": "TEST_ITER54_ADMIN_PROMO_REWARD",
            "description": "Admin-generated promo test for iteration 54",
            "points_required": 500,
            "min_tier": "silver",
            "type": "discount",
            "discount_value": 15.0,
            "service_types": [],
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "max_redemptions": 20
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=reward_data
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        TestAdminSeesAllSources.admin_reward_id = data["reward"]["id"]
        created_reward_ids.append(TestAdminSeesAllSources.admin_reward_id)
        print(f"PASS: Created admin reward for promo generation")
    
    def test_12_generate_admin_promo_code(self, admin_headers):
        """Admin generates promo code from reward (source='loyalty_reward')"""
        reward_id = TestAdminSeesAllSources.admin_reward_id
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}/generate-promo",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        TestAdminSeesAllSources.admin_generated_code = data["code"]
        created_promo_codes.append(data["code"])
        
        assert data["code"].startswith("LYL-"), f"Admin code should start with LYL-, got {data['code']}"
        print(f"PASS: Generated admin promo code: {data['code']}")
    
    def test_13_admin_sees_both_sources(self, admin_headers):
        """Admin promo-codes endpoint shows both loyalty_reward and loyalty_redemption sources"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/promo-codes",
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        promo_codes = data.get("promo_codes", [])
        
        # Find codes by source
        loyalty_reward_codes = [p for p in promo_codes if p.get("source") == "loyalty_reward"]
        loyalty_redemption_codes = [p for p in promo_codes if p.get("source") == "loyalty_redemption"]
        
        # Should have at least one of each (our test created ones)
        admin_code_found = any(p["code"] == TestAdminSeesAllSources.admin_generated_code for p in loyalty_reward_codes)
        redemption_code_found = any(p["code"] == TestCustomerRedemptionFlow.redemption_code for p in loyalty_redemption_codes)
        
        assert admin_code_found, f"Admin-generated code {TestAdminSeesAllSources.admin_generated_code} not found in loyalty_reward source"
        assert redemption_code_found, f"Redemption code {TestCustomerRedemptionFlow.redemption_code} not found in loyalty_redemption source"
        
        print(f"PASS: Admin sees both sources - loyalty_reward count: {len(loyalty_reward_codes)}, loyalty_redemption count: {len(loyalty_redemption_codes)}")
    
    def test_14_admin_generated_promo_works_independently(self, admin_headers):
        """Admin-generated promos still work independently"""
        code = TestAdminSeesAllSources.admin_generated_code
        
        # Validate the admin-generated code
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 20000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=admin_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"Admin promo validation failed: {response.text}"
        data = response.json()
        
        assert data.get("valid") == True, "Admin-generated code should be valid"
        assert data.get("discount_type") == "percentage", f"Expected percentage, got {data.get('discount_type')}"
        assert data.get("discount_value") == 15.0, f"Expected 15.0, got {data.get('discount_value')}"
        
        # 15% of 20000 = 3000
        expected_discount = 20000 * 0.15
        assert data.get("discount_amount") == expected_discount, f"Expected {expected_discount}, got {data.get('discount_amount')}"
        
        print(f"PASS: Admin-generated promo works independently - discount_amount={data.get('discount_amount')}")


class TestBackwardsCompatibility:
    """Backwards: Existing promo codes created directly (POST /api/promo-codes/) still validate and work"""
    
    direct_promo_code = None
    
    def test_15_create_direct_promo_code(self, admin_headers):
        """Create promo code directly via POST /api/promo-codes/"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        
        promo_data = {
            "code": f"TEST_DIRECT_{datetime.utcnow().strftime('%H%M%S')}",
            "name": "Direct Test Promo",
            "description": "Direct promo code for backwards compatibility test",
            "discount_type": "fixed",
            "discount_value": 250.0,
            "min_order_amount": 1000,
            "max_discount_amount": 500,
            "service_types": [],
            "usage_limit": 10,
            "per_user_limit": 2,
            "valid_from": datetime.utcnow().isoformat(),
            "valid_to": future_date,
            "first_order_only": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/",
            headers=admin_headers,
            json=promo_data
        )
        
        assert response.status_code == 200, f"Failed to create direct promo: {response.text}"
        data = response.json()
        
        TestBackwardsCompatibility.direct_promo_code = data.get("code", promo_data["code"])
        directly_created_promo_codes.append(TestBackwardsCompatibility.direct_promo_code)
        
        print(f"PASS: Created direct promo code: {TestBackwardsCompatibility.direct_promo_code}")
    
    def test_16_validate_direct_promo_code(self, customer_headers):
        """Validate directly created promo code works"""
        code = TestBackwardsCompatibility.direct_promo_code
        
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
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        
        assert data.get("valid") == True, "Direct promo code should be valid"
        assert data.get("discount_type") == "fixed", f"Expected fixed, got {data.get('discount_type')}"
        assert data.get("discount_value") == 250.0, f"Expected 250.0, got {data.get('discount_value')}"
        assert data.get("discount_amount") == 250.0, f"Fixed discount should be 250.0, got {data.get('discount_amount')}"
        
        print(f"PASS: Direct promo code validates correctly - discount_amount={data.get('discount_amount')}")
    
    def test_17_use_direct_promo_code(self, customer_headers):
        """Use directly created promo code"""
        code = TestBackwardsCompatibility.direct_promo_code
        test_order_id = f"TEST_DIRECT_ORDER_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/use",
            headers=customer_headers,
            params={
                "code": code,
                "order_id": test_order_id,
                "discount_amount": 250.0
            }
        )
        
        assert response.status_code == 200, f"Use direct promo failed: {response.text}"
        print(f"PASS: Direct promo code used successfully for order {test_order_id}")


class TestRedemptionCodeCannotBeReused:
    """E2E: Redemption code cannot be reused - second redemption and use fails"""
    
    second_redemption_code = None
    
    def test_18_customer_redeems_another_reward(self, customer_headers):
        """Customer redeems another reward for reuse test"""
        reward_id = TestCustomerLoyaltySetup.test_reward_id
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/redeem/{reward_id}",
            headers=customer_headers
        )
        
        # May fail if customer doesn't have enough points
        if response.status_code != 200:
            pytest.skip(f"Cannot redeem - possibly insufficient points: {response.text}")
        
        data = response.json()
        TestRedemptionCodeCannotBeReused.second_redemption_code = data["redemption_code"]
        test_redemption_codes.append(TestRedemptionCodeCannotBeReused.second_redemption_code)
        print(f"PASS: Got second redemption code: {TestRedemptionCodeCannotBeReused.second_redemption_code}")
    
    def test_19_use_second_redemption_code(self, customer_headers):
        """Use the second redemption code"""
        code = TestRedemptionCodeCannotBeReused.second_redemption_code
        if code is None:
            pytest.skip("No second redemption code available")
        
        # First validate
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 8000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        
        # Then use
        test_order_id = f"TEST_REUSE_ORDER_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/use",
            headers=customer_headers,
            params={
                "code": code,
                "order_id": test_order_id,
                "discount_amount": 800.0
            }
        )
        
        assert response.status_code == 200, f"Use failed: {response.text}"
        print(f"PASS: Used second redemption code")
    
    def test_20_second_use_of_same_code_fails(self, customer_headers):
        """Attempting to use the same code again fails"""
        code = TestRedemptionCodeCannotBeReused.second_redemption_code
        if code is None:
            pytest.skip("No second redemption code available")
        
        validation_data = {
            "code": code,
            "service_type": "travel",
            "order_amount": 8000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/promo-codes/validate",
            headers=customer_headers,
            json=validation_data
        )
        
        # Should fail due to per_user_limit or usage_limit
        assert response.status_code == 400, f"Expected 400 for reused code, got {response.status_code}"
        data = response.json()
        error_detail = data.get("detail", "").lower()
        assert "already used" in error_detail or "limit" in error_detail, f"Expected limit/already used error, got: {data}"
        
        print(f"PASS: Second use attempt rejected - code cannot be reused")


class TestCleanup:
    """Cleanup test data"""
    
    def test_99_cleanup_test_data(self, admin_headers):
        """Clean up all test rewards and promo codes"""
        cleanup_summary = {"rewards_deleted": 0, "promo_codes_deleted": 0, "direct_promos_deleted": 0}
        
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
        
        # Delete admin-generated promo codes
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
        
        # Delete directly created promo codes
        for code in directly_created_promo_codes:
            try:
                response = requests.delete(
                    f"{BASE_URL}/api/promo-codes/{code}",
                    headers=admin_headers
                )
                if response.status_code in [200, 404]:
                    cleanup_summary["direct_promos_deleted"] += 1
            except Exception as e:
                print(f"Warning: Failed to delete direct promo code {code}: {e}")
        
        # Note: Redemption codes in promo_codes collection would be deleted when deleting their linked redemption
        # but we don't have a direct endpoint for that - they'll remain but are marked inactive
        
        print(f"PASS: Cleanup complete - {cleanup_summary}")
        print(f"INFO: Test redemption codes {test_redemption_codes} left in DB (marked inactive/used)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

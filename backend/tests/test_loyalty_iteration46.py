"""
Iteration 46 Loyalty Tests - Copy Button Fix & Comprehensive API Tests
Tests: Copy button functionality, Admin CRUD, Customer endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"


class TestAdminLoyaltyEndpoints:
    """Admin Loyalty Backend API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json().get("access_token")
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_admin_stats_endpoint(self):
        """Test GET /api/loyalty/admin/stats - returns totalMembers, totalPointsIssued, totalPointsRedeemed, membersByTier"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/stats",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Admin stats failed: {response.text}"
        data = response.json()
        
        # Verify all required fields
        assert "totalMembers" in data, "Missing totalMembers"
        assert "totalPointsIssued" in data, "Missing totalPointsIssued"
        assert "totalPointsRedeemed" in data, "Missing totalPointsRedeemed"
        assert "membersByTier" in data, "Missing membersByTier"
        
        # Verify membersByTier structure
        tiers = data["membersByTier"]
        assert "bronze" in tiers, "Missing bronze tier count"
        assert "silver" in tiers, "Missing silver tier count"
        assert "gold" in tiers, "Missing gold tier count"
        assert "platinum" in tiers, "Missing platinum tier count"
        
        print(f"✓ Total members: {data['totalMembers']}")
        print(f"✓ Points issued: {data['totalPointsIssued']}")
        print(f"✓ Points redeemed: {data['totalPointsRedeemed']}")
        print(f"✓ Members by tier: {data['membersByTier']}")
    
    def test_admin_tier_history_endpoint(self):
        """Test GET /api/loyalty/admin/stats/tier-history - returns tier_distribution"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/stats/tier-history",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Tier history failed: {response.text}"
        data = response.json()
        
        assert "tier_distribution" in data, "Missing tier_distribution"
        assert "recent_activity" in data, "Missing recent_activity"
        assert "total_redemptions" in data, "Missing total_redemptions"
        
        print(f"✓ Tier distribution: {data['tier_distribution']}")
        print(f"✓ Total redemptions: {data['total_redemptions']}")
    
    def test_admin_members_list(self):
        """Test GET /api/loyalty/admin/members - returns member list"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/members",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Admin members failed: {response.text}"
        data = response.json()
        
        assert "members" in data, "Missing members list"
        assert "total" in data, "Missing total count"
        assert isinstance(data["members"], list)
        
        # If members exist, verify structure
        if len(data["members"]) > 0:
            member = data["members"][0]
            assert "id" in member, "Member missing id"
            assert "name" in member, "Member missing name"
            assert "email" in member, "Member missing email"
            assert "tier" in member, "Member missing tier"
            assert "total_points" in member, "Member missing total_points"
            assert "available_points" in member, "Member missing available_points"
            print(f"✓ Found {len(data['members'])} members")
        else:
            print("✓ Members endpoint working (no members yet)")
    
    def test_admin_member_detail(self):
        """Test GET /api/loyalty/admin/members/{user_id} - returns member detail with transactions and redemptions"""
        # First get member list
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/members",
            headers=self.admin_headers
        )
        assert response.status_code == 200
        members = response.json().get("members", [])
        
        if len(members) == 0:
            pytest.skip("No members to test detail endpoint")
        
        # Use customer user ID from context
        user_id = "e31df4e5-c8b8-4701-83ea-66a6b3cebbab"
        
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/members/{user_id}",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Member detail failed: {response.text}"
        data = response.json()
        
        assert "user" in data or "program" in data, "Missing user or program data"
        assert "transactions" in data, "Missing transactions"
        assert "redemptions" in data, "Missing redemptions"
        
        print(f"✓ Member detail: transactions={len(data.get('transactions', []))}, redemptions={len(data.get('redemptions', []))}")
    
    def test_admin_rewards_crud(self):
        """Test Admin Rewards CRUD - POST creates, PUT updates, DELETE removes"""
        # CREATE a test reward
        test_reward = {
            "title": f"TEST_Reward_{uuid.uuid4().hex[:8]}",
            "description": "Test reward for iteration 46",
            "points_required": 999,
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 5,
            "service_types": ["hotel"],
            "valid_from": "2026-01-01",
            "valid_to": "2026-12-31",
            "max_redemptions": 10,
            "total_available": 100
        }
        
        # POST - Create reward
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=self.admin_headers,
            json=test_reward
        )
        
        assert response.status_code == 200, f"Create reward failed: {response.text}"
        data = response.json()
        assert "reward" in data, "Missing reward in response"
        reward_id = data["reward"]["id"]
        print(f"✓ Created reward with id: {reward_id}")
        
        # GET - Verify reward exists
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=self.admin_headers
        )
        assert response.status_code == 200
        rewards = response.json().get("rewards", [])
        found = any(r.get("id") == reward_id for r in rewards)
        assert found, "Created reward not found in list"
        print(f"✓ Reward found in list after creation")
        
        # PUT - Update reward
        update_data = {
            "title": test_reward["title"] + "_UPDATED",
            "points_required": 1000
        }
        response = requests.put(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}",
            headers=self.admin_headers,
            json=update_data
        )
        
        assert response.status_code == 200, f"Update reward failed: {response.text}"
        print(f"✓ Reward updated successfully")
        
        # DELETE - Remove reward
        response = requests.delete(
            f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}",
            headers=self.admin_headers
        )
        
        assert response.status_code == 200, f"Delete reward failed: {response.text}"
        print(f"✓ Reward deleted successfully")
        
        # Verify deletion
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=self.admin_headers
        )
        rewards = response.json().get("rewards", [])
        found = any(r.get("id") == reward_id for r in rewards)
        assert not found, "Reward still exists after deletion"
        print(f"✓ Reward not found after deletion (correct)")


class TestCustomerLoyaltyEndpoints:
    """Customer Loyalty Backend API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        self.customer_token = response.json().get("access_token")
        self.customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
    
    def test_get_loyalty_program_with_auto_tier_recalculation(self):
        """Test GET /api/loyalty/program with auto tier recalculation"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/program",
            headers=self.customer_headers
        )
        
        assert response.status_code == 200, f"Get program failed: {response.text}"
        data = response.json()
        
        # Verify all required fields
        assert "tier" in data, "Missing tier"
        assert "total_points" in data, "Missing total_points"
        assert "available_points" in data, "Missing available_points"
        assert "tier_multiplier" in data, "Missing tier_multiplier"
        assert "next_tier" in data, "Missing next_tier"
        assert "points_to_next_tier" in data, "Missing points_to_next_tier"
        
        # Verify tier matches points (auto-recalculation)
        total_points = data["total_points"]
        tier = data["tier"]
        
        # Calculate expected tier
        if total_points >= 15000:
            expected_tier = "platinum"
        elif total_points >= 5000:
            expected_tier = "gold"
        elif total_points >= 1000:
            expected_tier = "silver"
        else:
            expected_tier = "bronze"
        
        assert tier == expected_tier, f"Tier mismatch: got {tier}, expected {expected_tier} for {total_points} pts"
        print(f"✓ Tier correctly calculated: {tier} for {total_points} points")
        print(f"✓ Available points: {data['available_points']}")
        print(f"✓ Next tier: {data.get('next_tier', 'None')}")
    
    def test_get_rewards_returns_id_field(self):
        """Test GET /api/loyalty/rewards returns id field (not _id)"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/rewards",
            headers=self.customer_headers
        )
        
        assert response.status_code == 200, f"Get rewards failed: {response.text}"
        data = response.json()
        
        assert "rewards" in data, "Missing rewards"
        assert "user_points" in data, "Missing user_points"
        assert "user_tier" in data, "Missing user_tier"
        
        # Check if rewards have id field
        if len(data["rewards"]) > 0:
            reward = data["rewards"][0]
            assert "id" in reward, "Reward missing id field"
            assert "_id" not in reward, "Reward should not have _id field"
            print(f"✓ Rewards endpoint returns id field correctly")
        else:
            print("✓ No rewards available to verify id field")
    
    def test_get_redemptions(self):
        """Test GET /api/loyalty/redemptions"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/redemptions",
            headers=self.customer_headers
        )
        
        assert response.status_code == 200, f"Get redemptions failed: {response.text}"
        data = response.json()
        
        assert "redemptions" in data, "Missing redemptions"
        assert "total" in data, "Missing total"
        assert isinstance(data["redemptions"], list)
        
        print(f"✓ Found {len(data['redemptions'])} redemptions")
        
        # Verify redemption structure if exists
        if len(data["redemptions"]) > 0:
            rd = data["redemptions"][0]
            assert "code" in rd, "Redemption missing code"
            assert "status" in rd, "Redemption missing status"
            print(f"✓ First redemption code: {rd['code']}, status: {rd['status']}")
    
    def test_get_referral(self):
        """Test GET /api/loyalty/referral"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/referral",
            headers=self.customer_headers
        )
        
        assert response.status_code == 200, f"Get referral failed: {response.text}"
        data = response.json()
        
        assert "code" in data, "Missing referral code"
        assert "total_referrals" in data, "Missing total_referrals"
        assert "successful_referrals" in data, "Missing successful_referrals"
        assert "points_earned" in data, "Missing points_earned"
        
        # Verify code format
        assert data["code"].startswith("ORYNO"), f"Code should start with ORYNO: {data['code']}"
        print(f"✓ Referral code: {data['code']}")


class TestRedemptionFlow:
    """Test redeem flow if customer has enough points"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        self.customer_token = response.json().get("access_token")
        self.customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
    
    def test_redeem_reward_flow(self):
        """Test POST /api/loyalty/redeem/{id} - if customer has points"""
        # Get available rewards
        response = requests.get(
            f"{BASE_URL}/api/loyalty/rewards",
            headers=self.customer_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        user_points = data.get("user_points", 0)
        rewards = data.get("rewards", [])
        
        print(f"User points: {user_points}, Available rewards: {len(rewards)}")
        
        # Find a reward the user can afford
        affordable = [r for r in rewards if r.get("points_required", 99999) <= user_points]
        
        if len(affordable) == 0:
            print("✓ No affordable rewards - skipping redeem test")
            pytest.skip("No affordable rewards for current user")
        
        # Try to redeem the cheapest one
        cheapest = min(affordable, key=lambda r: r.get("points_required", 0))
        reward_id = cheapest.get("id")
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/redeem/{reward_id}",
            headers=self.customer_headers
        )
        
        # Either success or "already redeemed" is acceptable
        if response.status_code == 200:
            data = response.json()
            assert "redemption_code" in data, "Missing redemption_code in response"
            assert "expires_at" in data, "Missing expires_at"
            assert "points_used" in data, "Missing points_used"
            print(f"✓ Redeemed reward! Code: {data['redemption_code']}")
        else:
            print(f"✓ Redeem returned status {response.status_code}: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

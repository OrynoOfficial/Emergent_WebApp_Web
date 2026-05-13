"""
Test Loyalty Program Phase 2 Features
- Admin stats endpoint
- Member detail endpoint with transactions
- Reward CRUD with new fields
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cinema-management-p0.preview.emergentagent.com')

class TestLoyaltyPhase2:
    """Tests for Phase 2 Loyalty features"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin to get auth token"""
        if TestLoyaltyPhase2.auth_token is None:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "superadmin@oryno.com",
                "password": "testpassword123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestLoyaltyPhase2.auth_token = response.json().get("access_token")
        
        self.headers = {"Authorization": f"Bearer {TestLoyaltyPhase2.auth_token}"}
    
    def test_admin_stats_endpoint(self):
        """Test GET /api/loyalty/admin/stats returns tier distribution"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/stats", headers=self.headers)
        
        assert response.status_code == 200, f"Stats endpoint failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "totalMembers" in data, "Missing totalMembers"
        assert "totalPointsIssued" in data, "Missing totalPointsIssued"
        assert "totalPointsRedeemed" in data, "Missing totalPointsRedeemed"
        assert "membersByTier" in data, "Missing membersByTier"
        
        # Verify tier breakdown
        tiers = data["membersByTier"]
        assert "bronze" in tiers, "Missing bronze tier count"
        assert "silver" in tiers, "Missing silver tier count"
        assert "gold" in tiers, "Missing gold tier count"
        assert "platinum" in tiers, "Missing platinum tier count"
        
        print(f"Stats: {data}")
        
    def test_admin_members_endpoint(self):
        """Test GET /api/loyalty/admin/members returns members list"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/members", headers=self.headers)
        
        assert response.status_code == 200, f"Members endpoint failed: {response.text}"
        data = response.json()
        
        assert "members" in data, "Missing members array"
        assert len(data["members"]) > 0, "No members returned"
        
        # Check member structure
        member = data["members"][0]
        assert "id" in member, "Member missing id"
        assert "name" in member, "Member missing name"
        assert "email" in member, "Member missing email"
        assert "tier" in member, "Member missing tier"
        assert "total_points" in member, "Member missing total_points"
        
        print(f"Found {len(data['members'])} members")
        
    def test_member_detail_endpoint(self):
        """Test GET /api/loyalty/admin/members/{user_id} returns detail with transactions"""
        # First get members list
        members_response = requests.get(f"{BASE_URL}/api/loyalty/admin/members", headers=self.headers)
        members = members_response.json()["members"]
        
        # Find customer user (has transactions)
        customer_user_id = "e31df4e5-c8b8-4701-83ea-66a6b3cebbab"  # Known customer ID
        
        # Get member detail
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/members/{customer_user_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Member detail failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "program" in data, "Missing program info"
        assert "transactions" in data, "Missing transactions"
        assert "redemptions" in data, "Missing redemptions"
        
        print(f"Member detail - Program: {data['program']}")
        print(f"Member detail - Transactions count: {len(data['transactions'])}")
        print(f"Member detail - Redemptions count: {len(data['redemptions'])}")
        
    def test_admin_rewards_list(self):
        """Test GET /api/loyalty/admin/rewards returns rewards"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/rewards", headers=self.headers)
        
        assert response.status_code == 200, f"Rewards list failed: {response.text}"
        data = response.json()
        
        assert "rewards" in data, "Missing rewards array"
        print(f"Found {len(data['rewards'])} rewards")
        
        if len(data["rewards"]) > 0:
            reward = data["rewards"][0]
            print(f"Sample reward: {reward}")
    
    def test_create_reward_with_new_fields(self):
        """Test POST /api/loyalty/admin/rewards with new fields (valid_from, valid_to, max_redemptions, total_available)"""
        valid_from = datetime.now().strftime("%Y-%m-%d")
        valid_to = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        reward_data = {
            "title": "TEST_10% Off Booking",
            "description": "Get 10% off your next booking",
            "points_required": 1000,
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 10,
            "service_types": ["hotel", "travel"],
            "valid_from": valid_from,
            "valid_to": valid_to,
            "max_redemptions": 5,
            "total_available": 100
        }
        
        response = requests.post(f"{BASE_URL}/api/loyalty/admin/rewards", headers=self.headers, json=reward_data)
        
        assert response.status_code == 200, f"Create reward failed: {response.text}"
        data = response.json()
        
        assert "reward" in data, "Missing reward in response"
        assert data["reward"]["title"] == reward_data["title"], "Title mismatch"
        assert data["reward"]["valid_from"] == valid_from, "valid_from mismatch"
        assert data["reward"]["valid_to"] == valid_to, "valid_to mismatch"
        assert data["reward"]["max_redemptions"] == 5, "max_redemptions mismatch"
        assert data["reward"]["total_available"] == 100, "total_available mismatch"
        
        print(f"Created reward: {data['reward']}")
        
        # Store reward ID for cleanup
        self.__class__.test_reward_id = data["reward"]["id"]
        
    def test_update_reward_with_new_fields(self):
        """Test PUT /api/loyalty/admin/rewards/{id} with new fields"""
        # Skip if no test reward was created
        if not hasattr(self.__class__, 'test_reward_id'):
            pytest.skip("No test reward to update")
            
        reward_id = self.__class__.test_reward_id
        
        update_data = {
            "title": "TEST_Updated 10% Off",
            "max_redemptions": 10,
            "total_available": 200
        }
        
        response = requests.put(f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}", headers=self.headers, json=update_data)
        
        assert response.status_code == 200, f"Update reward failed: {response.text}"
        print(f"Updated reward successfully")
        
    def test_delete_test_reward(self):
        """Cleanup: Delete test reward"""
        if not hasattr(self.__class__, 'test_reward_id'):
            pytest.skip("No test reward to delete")
            
        reward_id = self.__class__.test_reward_id
        
        response = requests.delete(f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Delete reward failed: {response.text}"
        print(f"Deleted test reward")
        
    def test_tier_history_stats(self):
        """Test GET /api/loyalty/admin/stats/tier-history"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/stats/tier-history", headers=self.headers)
        
        assert response.status_code == 200, f"Tier history failed: {response.text}"
        data = response.json()
        
        assert "tier_distribution" in data, "Missing tier_distribution"
        assert "recent_activity" in data, "Missing recent_activity"
        assert "total_redemptions" in data, "Missing total_redemptions"
        
        print(f"Tier history: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

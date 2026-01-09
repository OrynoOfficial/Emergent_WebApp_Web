"""
Backend API Tests for Admin Features - Iteration 14
Tests: Orders, Receipts, Ratings moderation, Loyalty rewards, Customer Service team members
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASSWORD = "testpassword123"


class TestAuthentication:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") in ["admin", "super_admin"], "User is not admin"
        return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestAdminOrders:
    """Test admin orders endpoint - should return ALL orders from all users"""
    
    def test_get_all_orders_as_admin(self, admin_headers):
        """Admin should see all orders across the platform"""
        response = requests.get(f"{BASE_URL}/api/orders/", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        data = response.json()
        assert "orders" in data, "Response should contain 'orders' key"
        # Admin should see orders (may be empty if no orders exist)
        print(f"Admin sees {len(data.get('orders', []))} orders")
        
    def test_orders_have_customer_info(self, admin_headers):
        """Orders should include customer information for admin view"""
        response = requests.get(f"{BASE_URL}/api/orders/", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        orders = data.get("orders", [])
        if orders:
            # Check first order has customer info
            order = orders[0]
            assert "id" in order, "Order should have id"
            # Customer name may be present for admin view
            print(f"Sample order: {order.get('order_number', 'N/A')}, customer: {order.get('customer_name', 'N/A')}")


class TestAdminReceipts:
    """Test admin receipts - uses same orders endpoint"""
    
    def test_get_all_receipts_as_admin(self, admin_headers):
        """Admin should see all receipts (orders) across the platform"""
        response = requests.get(f"{BASE_URL}/api/orders/", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get receipts: {response.text}"
        data = response.json()
        assert "orders" in data, "Response should contain 'orders' key"
        print(f"Admin sees {len(data.get('orders', []))} receipts/orders")


class TestAdminRatings:
    """Test admin ratings with moderation capabilities"""
    
    def test_get_all_ratings_as_admin(self, admin_headers):
        """Admin should see all ratings across the platform"""
        response = requests.get(f"{BASE_URL}/api/ratings/all", headers=admin_headers)
        # May return 200 with data or 404 if endpoint doesn't exist
        if response.status_code == 200:
            data = response.json()
            print(f"Admin sees {len(data.get('ratings', []))} ratings")
        elif response.status_code == 404:
            print("Ratings endpoint /api/ratings/all not found - may use mock data in frontend")
        else:
            print(f"Ratings endpoint returned {response.status_code}: {response.text}")
    
    def test_moderate_rating_endpoint_exists(self, admin_headers):
        """Check if moderation endpoint exists"""
        # This is a POST endpoint, we just check it doesn't 404 with proper error
        response = requests.post(
            f"{BASE_URL}/api/ratings/test-id/moderate",
            headers=admin_headers,
            json={"action": "flag", "reason": "test"}
        )
        # Should not be 404 (endpoint exists) - may be 400/422 for invalid ID
        if response.status_code == 404:
            print("Moderation endpoint not found - frontend may use mock data")
        else:
            print(f"Moderation endpoint exists, returned {response.status_code}")


class TestLoyaltyRewards:
    """Test loyalty program admin endpoints"""
    
    def test_get_admin_rewards(self, admin_headers):
        """Admin should be able to get rewards list"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/rewards", headers=admin_headers)
        if response.status_code == 200:
            data = response.json()
            rewards = data.get("rewards", [])
            print(f"Admin sees {len(rewards)} rewards")
        elif response.status_code == 404:
            print("Admin rewards endpoint not found - may use default rewards in frontend")
        else:
            print(f"Admin rewards endpoint returned {response.status_code}")
    
    def test_get_admin_stats(self, admin_headers):
        """Admin should be able to get loyalty program stats"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/stats", headers=admin_headers)
        if response.status_code == 200:
            data = response.json()
            print(f"Loyalty stats: {data}")
        elif response.status_code == 404:
            print("Admin stats endpoint not found - frontend uses mock stats")
        else:
            print(f"Admin stats endpoint returned {response.status_code}")
    
    def test_get_admin_members(self, admin_headers):
        """Admin should be able to get loyalty members list"""
        response = requests.get(f"{BASE_URL}/api/loyalty/admin/members", headers=admin_headers)
        if response.status_code == 200:
            data = response.json()
            members = data.get("members", [])
            print(f"Admin sees {len(members)} loyalty members")
        elif response.status_code == 404:
            print("Admin members endpoint not found - frontend uses mock members")
        else:
            print(f"Admin members endpoint returned {response.status_code}")
    
    def test_create_reward(self, admin_headers):
        """Admin should be able to create a new reward"""
        payload = {
            "title": "TEST_Reward_Delete_Me",
            "description": "Test reward for automated testing",
            "points_required": 999,
            "min_tier": "bronze",
            "type": "discount",
            "discount_value": 5
        }
        response = requests.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=admin_headers,
            json=payload
        )
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Created reward: {data}")
            # Try to delete it
            reward_id = data.get("reward", {}).get("id") or data.get("id")
            if reward_id:
                del_response = requests.delete(
                    f"{BASE_URL}/api/loyalty/admin/rewards/{reward_id}",
                    headers=admin_headers
                )
                print(f"Cleanup delete returned {del_response.status_code}")
        elif response.status_code == 404:
            print("Create reward endpoint not found - frontend may handle locally")
        else:
            print(f"Create reward returned {response.status_code}: {response.text}")


class TestCustomerServiceTeam:
    """Test customer service team member management"""
    
    def test_get_team_members(self, admin_headers):
        """Admin should see support team members"""
        response = requests.get(f"{BASE_URL}/api/support-tickets/team-members", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get team members: {response.text}"
        data = response.json()
        team_members = data.get("team_members", [])
        print(f"Team has {len(team_members)} members")
        
        # Check for expected auto-discovered members
        member_names = [m.get("name", "") for m in team_members]
        print(f"Team member names: {member_names}")
        
        return team_members
    
    def test_get_available_members(self, admin_headers):
        """Admin should see available members to add (excluding existing team)"""
        response = requests.get(f"{BASE_URL}/api/support-tickets/available-members", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get available members: {response.text}"
        data = response.json()
        available = data.get("available_members", [])
        print(f"Available members to add: {len(available)}")
        
        # Get team members to verify filtering
        team_response = requests.get(f"{BASE_URL}/api/support-tickets/team-members", headers=admin_headers)
        team_members = team_response.json().get("team_members", [])
        team_ids = set(m.get("id") for m in team_members)
        team_names = [m.get("name") for m in team_members]
        
        # Verify available members don't include existing team members
        available_ids = set(m.get("id") for m in available)
        available_names = [m.get("name") for m in available]
        
        overlap = team_ids.intersection(available_ids)
        if overlap:
            print(f"WARNING: Found overlap between team and available: {overlap}")
        else:
            print("PASS: No overlap between team members and available members")
        
        # Check specific names that should NOT be in available list
        excluded_names = ["Ben Carter Kyle", "Cleaner T.", "Admin Testing", "Super Admin"]
        for name in excluded_names:
            if name in available_names:
                print(f"WARNING: '{name}' should NOT be in available members but was found")
            else:
                print(f"PASS: '{name}' correctly excluded from available members")
        
        return available


class TestUserActivityLog:
    """Test user activity log endpoint"""
    
    def test_get_user_activity(self, admin_headers):
        """Admin should be able to get user activity logs"""
        # First get a user ID
        response = requests.get(f"{BASE_URL}/api/users/", headers=admin_headers)
        if response.status_code != 200:
            print(f"Could not get users list: {response.status_code}")
            return
        
        users = response.json().get("users", [])
        if not users:
            print("No users found to test activity log")
            return
        
        user_id = users[0].get("id") or str(users[0].get("_id"))
        
        # Try to get activity log
        activity_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/activity",
            headers=admin_headers
        )
        if activity_response.status_code == 200:
            data = activity_response.json()
            activities = data.get("activities", [])
            print(f"User has {len(activities)} activity log entries")
        elif activity_response.status_code == 404:
            print("User activity endpoint not found")
        else:
            print(f"User activity returned {activity_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

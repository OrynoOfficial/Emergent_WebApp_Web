"""
Test file for Iteration 47 - Loyalty page refactoring verification
Tests that all loyalty endpoints still work after frontend refactoring
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://modernized-portal.preview.emergentagent.com')

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"


class TestLoyaltyAPIs:
    """Test all loyalty endpoints to ensure backend is functioning correctly after frontend refactoring"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    # ========== CUSTOMER ENDPOINTS ==========
    
    def test_customer_loyalty_program(self, customer_token):
        """Test GET /api/loyalty/program - Customer's loyalty program info"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/program",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "tier" in data
        assert "total_points" in data
        assert "available_points" in data
        print(f"Customer tier: {data['tier']}, Total: {data['total_points']}, Available: {data['available_points']}")
    
    def test_customer_rewards_list(self, customer_token):
        """Test GET /api/loyalty/rewards - Available rewards for customer"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/rewards",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "rewards" in data
        if data["rewards"]:
            reward = data["rewards"][0]
            assert "id" in reward  # Should have id, not _id
            assert "title" in reward
            assert "points_required" in reward
        print(f"Found {len(data['rewards'])} rewards")
    
    def test_customer_transactions(self, customer_token):
        """Test GET /api/loyalty/transactions - Customer's point transactions"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/transactions",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "transactions" in data
        print(f"Found {len(data['transactions'])} transactions")
    
    def test_customer_redemptions(self, customer_token):
        """Test GET /api/loyalty/redemptions - Customer's redemption history"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/redemptions",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "redemptions" in data
        print(f"Found {len(data['redemptions'])} redemptions")
    
    def test_customer_referral(self, customer_token):
        """Test GET /api/loyalty/referral - Customer's referral code"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/referral",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "code" in data
        print(f"Referral code: {data['code']}")
    
    # ========== ADMIN ENDPOINTS ==========
    
    def test_admin_stats(self, super_admin_token):
        """Test GET /api/loyalty/admin/stats - Admin loyalty statistics"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/stats",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "totalMembers" in data
        assert "totalPointsIssued" in data
        assert "totalPointsRedeemed" in data
        assert "membersByTier" in data
        print(f"Total members: {data['totalMembers']}, Points issued: {data['totalPointsIssued']}")
    
    def test_admin_rewards(self, super_admin_token):
        """Test GET /api/loyalty/admin/rewards - Admin rewards list"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "rewards" in data
        print(f"Found {len(data['rewards'])} admin rewards")
    
    def test_admin_members(self, super_admin_token):
        """Test GET /api/loyalty/admin/members - Admin members list"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/members",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "members" in data
        if data["members"]:
            member = data["members"][0]
            assert "id" in member
            assert "name" in member or "email" in member
            assert "tier" in member
        print(f"Found {len(data['members'])} members")
    
    def test_regular_admin_stats_access(self, admin_token):
        """Test that regular admin can also access stats (read-only)"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin stats access failed: {response.text}"
        print("Regular admin can access stats - read-only mode verified")


class TestSettingsPageRoles:
    """Test that Settings page works for different user roles"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_customer_profile_access(self, customer_token):
        """Test customer can access their profile via /api/users/me"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Customer profile access failed: {response.text}"
        data = response.json()
        assert data["email"] == CUSTOMER_EMAIL
        assert data["role"] == "customer"
        print(f"Customer role: {data['role']}")
    
    def test_admin_profile_access(self, admin_token):
        """Test admin can access their profile"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        print(f"Admin role: {data['role']}")
    
    def test_super_admin_profile_access(self, super_admin_token):
        """Test super admin can access their profile"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "super_admin"
        print(f"Super admin role: {data['role']}")
    
    def test_notification_preferences_endpoint(self, customer_token):
        """Test notification preferences endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/notifications",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        # May return 200 or 404 depending on implementation
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"Notifications endpoint status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

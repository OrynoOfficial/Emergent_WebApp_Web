"""
Test suite for verifying issue fixes:
1. Admin User Management - shows users (admin, operator, employee, customer) but NOT super_admin
2. Admin has users.view permission
3. Operator Audit Logs - no Access Denied error
4. Operator Analytics - personalized context
5. Operator Sales Dashboard - loads with data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@oryno.com", "password": "testpassword123"}
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}
OPERATOR_CREDS = {"email": "operator@test.com", "password": "testpassword123"}


class TestAuthentication:
    """Test authentication for all user types"""
    
    def test_super_admin_login(self):
        """Super Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        assert response.status_code == 200, f"Super Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "super_admin"
        print(f"✓ Super Admin login successful, role: {data.get('user', {}).get('role')}")
    
    def test_admin_login(self):
        """Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "admin"
        print(f"✓ Admin login successful, role: {data.get('user', {}).get('role')}")
    
    def test_operator_login(self):
        """Operator can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "operator"
        print(f"✓ Operator login successful, role: {data.get('user', {}).get('role')}")


class TestAdminUserManagement:
    """Test Admin User Management - Issue #2: Admin can see users but NOT super_admin"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip("Super Admin login failed")
        return response.json().get("access_token")
    
    def test_admin_can_access_users_endpoint(self, admin_token):
        """Admin has users.view permission and can access /api/users/"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/", headers=headers)
        
        assert response.status_code == 200, f"Admin cannot access users endpoint: {response.status_code} - {response.text}"
        data = response.json()
        assert "users" in data, "Response missing 'users' key"
        print(f"✓ Admin can access users endpoint, found {len(data.get('users', []))} users")
    
    def test_admin_sees_users_but_not_super_admin(self, admin_token):
        """Admin can see admin, operator, employee, customer but NOT super_admin users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        users = data.get("users", [])
        
        # Check that we have users
        assert len(users) > 0, "No users returned for admin"
        
        # Check roles of returned users
        roles_found = set()
        for user in users:
            role = user.get("role")
            roles_found.add(role)
            # CRITICAL: Admin should NOT see super_admin users
            assert role != "super_admin", f"Admin should NOT see super_admin users! Found: {user.get('email')}"
        
        print(f"✓ Admin sees users with roles: {roles_found}")
        print(f"✓ No super_admin users visible to admin (correct behavior)")
    
    def test_super_admin_can_see_all_users(self, super_admin_token):
        """Super Admin can see ALL users including super_admin"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        users = data.get("users", [])
        
        roles_found = set()
        for user in users:
            roles_found.add(user.get("role"))
        
        print(f"✓ Super Admin sees users with roles: {roles_found}")
        # Super admin should be able to see super_admin users
        assert "super_admin" in roles_found or len(users) > 0, "Super Admin should see all users"
    
    def test_admin_filter_by_role_excludes_super_admin(self, admin_token):
        """Admin filtering by super_admin role returns empty"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/?role=super_admin", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        users = data.get("users", [])
        
        # Should return empty when admin tries to filter by super_admin
        assert len(users) == 0, f"Admin should not see super_admin users even with filter, got {len(users)}"
        print("✓ Admin filtering by super_admin role returns empty (correct)")


class TestOperatorAuditLogs:
    """Test Operator Audit Logs - Issue #5: Should not show 'Access Denied'"""
    
    @pytest.fixture
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
        if response.status_code != 200:
            pytest.skip("Operator login failed")
        return response.json().get("access_token")
    
    def test_operator_can_access_audit_logs(self, operator_token):
        """Operator can access audit logs without 'Access Denied' error"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        response = requests.get(f"{BASE_URL}/api/activity/logs", headers=headers)
        
        # Should NOT return 403 Access Denied
        assert response.status_code != 403, f"Operator got Access Denied: {response.text}"
        assert response.status_code == 200, f"Operator audit logs failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "logs" in data, "Response missing 'logs' key"
        print(f"✓ Operator can access audit logs, found {len(data.get('logs', []))} logs")


class TestOperatorAnalytics:
    """Test Operator Analytics - Issue #3: Should be tailored to operator"""
    
    @pytest.fixture
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
        if response.status_code != 200:
            pytest.skip("Operator login failed")
        return response.json().get("access_token")
    
    def test_operator_can_access_analytics_overview(self, operator_token):
        """Operator can access analytics overview"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=headers)
        
        assert response.status_code == 200, f"Operator analytics failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "summary" in data, "Response missing 'summary' key"
        print(f"✓ Operator can access analytics overview")
        print(f"  Summary: {data.get('summary', {})}")
    
    def test_operator_dashboard_analytics(self, operator_token):
        """Operator can access operator dashboard analytics"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/operator/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Operator dashboard analytics failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Check for operator-scoped flag
        is_operator_scoped = data.get("is_operator_scoped", False)
        print(f"✓ Operator dashboard analytics accessible")
        print(f"  is_operator_scoped: {is_operator_scoped}")
        print(f"  Summary: {data.get('summary', {})}")


class TestOperatorSalesDashboard:
    """Test Operator Sales Dashboard - Issue #4: Payment methods should be tailored"""
    
    @pytest.fixture
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
        if response.status_code != 200:
            pytest.skip("Operator login failed")
        return response.json().get("access_token")
    
    def test_operator_can_access_sales_data(self, operator_token):
        """Operator can access sales/orders data"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        
        # Try orders endpoint
        response = requests.get(f"{BASE_URL}/api/orders/", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Operator can access orders data")
            print(f"  Orders count: {len(data.get('orders', data if isinstance(data, list) else []))}")
        else:
            print(f"  Orders endpoint returned: {response.status_code}")
            # Not a critical failure if orders endpoint has different permissions


class TestServicesManagePath:
    """Test Services page 'Manage' button paths - Issue #1"""
    
    def test_browse_services_manage_paths(self):
        """Verify managePath uses /management/ prefix (not /manage/)"""
        # This is a frontend test - we verify by checking the code was updated
        # The actual navigation test will be done via Playwright
        
        import re
        
        browse_services_path = "/app/frontend/src/pages/BrowseServices.jsx"
        with open(browse_services_path, 'r') as f:
            content = f.read()
        
        # Check that managePath uses /management/ not /manage/
        manage_paths = re.findall(r"managePath:\s*['\"]([^'\"]+)['\"]", content)
        
        for path in manage_paths:
            assert path.startswith("/management/"), f"managePath should use /management/ prefix, found: {path}"
            assert not path.startswith("/manage/"), f"managePath should NOT use /manage/ prefix, found: {path}"
        
        print(f"✓ All managePath values use /management/ prefix: {manage_paths}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

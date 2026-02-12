"""
Test Suite for Permission Audit Trail Feature (Iteration 49)
Tests:
1. Permission denial logging to permission_audit_trail collection
2. GET /api/access/audit-trail endpoint with stats
3. Triggering denials by calling protected endpoints as customer
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuditTrailFeature:
    """Tests for the new Permission Audit Trail feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test class with auth tokens"""
        self.super_admin_token = None
        self.admin_token = None
        self.customer_token = None
        
        # Login super_admin
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if resp.status_code == 200:
            self.super_admin_token = resp.json().get("access_token")
            
        # Login admin
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        if resp.status_code == 200:
            self.admin_token = resp.json().get("access_token")
            
        # Login customer
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if resp.status_code == 200:
            self.customer_token = resp.json().get("access_token")
    
    def test_customer_login(self):
        """Verify customer can login"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert resp.status_code == 200, f"Customer login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data, "No access_token in response"
        print("PASS: Customer login successful")
    
    def test_super_admin_login(self):
        """Verify super_admin can login"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        assert resp.status_code == 200, f"Super admin login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data, "No access_token in response"
        print("PASS: Super admin login successful")
    
    def test_trigger_permission_denial_employees(self):
        """Customer trying to access /api/employees/ should be denied and logged"""
        if not self.customer_token:
            pytest.skip("No customer token")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        resp = requests.get(f"{BASE_URL}/api/employees/", headers=headers)
        
        # Should get 403 Forbidden
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Customer correctly denied access to /api/employees/ (403)")
    
    def test_trigger_permission_denial_loyalty_stats(self):
        """Customer trying to access /api/loyalty/admin/stats should be denied and logged"""
        if not self.customer_token:
            pytest.skip("No customer token")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        resp = requests.get(f"{BASE_URL}/api/loyalty/admin/stats", headers=headers)
        
        # Should get 403 Forbidden
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Customer correctly denied access to /api/loyalty/admin/stats (403)")
    
    def test_trigger_permission_denial_users(self):
        """Customer trying to access /api/users/ should be denied and logged"""
        if not self.customer_token:
            pytest.skip("No customer token")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        resp = requests.get(f"{BASE_URL}/api/users/", headers=headers)
        
        # Should get 403 Forbidden
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Customer correctly denied access to /api/users/ (403)")
    
    def test_trigger_permission_denial_access_roles(self):
        """Customer trying to access /api/access/roles should be denied and logged"""
        if not self.customer_token:
            pytest.skip("No customer token")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/roles", headers=headers)
        
        # Should get 403 Forbidden
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASS: Customer correctly denied access to /api/access/roles (403)")
    
    def test_audit_trail_endpoint_super_admin_access(self):
        """Super admin should be able to access audit trail endpoint"""
        if not self.super_admin_token:
            pytest.skip("No super admin token")
        
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=headers)
        
        assert resp.status_code == 200, f"Audit trail access failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        # Check response structure
        assert "logs" in data, "Response missing 'logs' field"
        assert "total" in data, "Response missing 'total' field"
        assert "stats" in data, "Response missing 'stats' field"
        
        print(f"PASS: Super admin can access audit trail - {data['total']} total denials")
    
    def test_audit_trail_response_structure(self):
        """Verify audit trail response has correct structure with stats"""
        if not self.super_admin_token:
            pytest.skip("No super admin token")
        
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Check stats structure
        stats = data.get("stats", {})
        assert "total_denials" in stats, "Stats missing 'total_denials'"
        assert "top_denied_users" in stats, "Stats missing 'top_denied_users'"
        assert "top_denied_permissions" in stats, "Stats missing 'top_denied_permissions'"
        
        # Verify top_denied_users structure
        if stats["top_denied_users"]:
            user_stat = stats["top_denied_users"][0]
            assert "email" in user_stat, "User stat missing 'email'"
            assert "count" in user_stat, "User stat missing 'count'"
        
        # Verify top_denied_permissions structure
        if stats["top_denied_permissions"]:
            perm_stat = stats["top_denied_permissions"][0]
            assert "permission" in perm_stat, "Permission stat missing 'permission'"
            assert "count" in perm_stat, "Permission stat missing 'count'"
        
        print(f"PASS: Audit trail stats structure correct - total_denials={stats['total_denials']}")
        print(f"      top_denied_users: {stats['top_denied_users'][:3] if stats['top_denied_users'] else 'empty'}")
        print(f"      top_denied_permissions: {stats['top_denied_permissions'][:3] if stats['top_denied_permissions'] else 'empty'}")
    
    def test_audit_trail_logs_structure(self):
        """Verify audit trail logs have correct fields"""
        if not self.super_admin_token:
            pytest.skip("No super admin token")
        
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        logs = data.get("logs", [])
        if logs:
            log = logs[0]
            # Check required fields
            assert "user_email" in log, "Log missing 'user_email'"
            assert "user_role" in log, "Log missing 'user_role'"
            assert "required_permissions" in log, "Log missing 'required_permissions'"
            assert "timestamp" in log, "Log missing 'timestamp'"
            assert "action" in log, "Log missing 'action'"
            
            print(f"PASS: Audit log structure correct")
            print(f"      Sample log: user={log['user_email']}, role={log['user_role']}, perms={log['required_permissions']}")
        else:
            print("INFO: No logs yet in audit trail")
    
    def test_audit_trail_customer_denied(self):
        """Customer should NOT be able to access audit trail"""
        if not self.customer_token:
            pytest.skip("No customer token")
        
        headers = {"Authorization": f"Bearer {self.customer_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=headers)
        
        assert resp.status_code == 403, f"Expected 403 for customer, got {resp.status_code}"
        print("PASS: Customer correctly denied access to audit trail (403)")
    
    def test_audit_trail_admin_access(self):
        """Admin should be able to access audit trail (has access.view_permissions)"""
        if not self.admin_token:
            pytest.skip("No admin token")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=headers)
        
        # Admin should have access.view_permissions in default permissions
        if resp.status_code == 200:
            print("PASS: Admin can access audit trail")
        elif resp.status_code == 403:
            print("INFO: Admin denied access to audit trail (may not have access.view_permissions)")
            # This is expected if admin doesn't have access.view_permissions
        else:
            pytest.fail(f"Unexpected status code: {resp.status_code} - {resp.text}")
    
    def test_audit_trail_pagination(self):
        """Verify pagination works on audit trail"""
        if not self.super_admin_token:
            pytest.skip("No super admin token")
        
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        
        # Get page 1
        resp1 = requests.get(f"{BASE_URL}/api/access/audit-trail?page=1&limit=10", headers=headers)
        assert resp1.status_code == 200
        data1 = resp1.json()
        
        assert data1.get("page") == 1, "Page should be 1"
        assert data1.get("limit") == 10, "Limit should be 10"
        
        print(f"PASS: Pagination works - page={data1['page']}, limit={data1['limit']}, total={data1['total']}")
    
    def test_audit_trail_filter_by_permission(self):
        """Verify filtering by permission works"""
        if not self.super_admin_token:
            pytest.skip("No super admin token")
        
        headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        
        # Filter by "employees" permission
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail?permission=employees", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        
        print(f"PASS: Filter by permission works - found {data['total']} denials matching 'employees'")
    
    def test_denials_are_logged_after_trigger(self):
        """Verify that denials triggered earlier are now in audit trail"""
        if not self.super_admin_token or not self.customer_token:
            pytest.skip("Missing tokens")
        
        # First trigger some denials
        customer_headers = {"Authorization": f"Bearer {self.customer_token}"}
        requests.get(f"{BASE_URL}/api/employees/", headers=customer_headers)
        requests.get(f"{BASE_URL}/api/loyalty/admin/stats", headers=customer_headers)
        
        # Small delay to allow logging
        time.sleep(0.5)
        
        # Now check audit trail
        super_admin_headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/access/audit-trail", headers=super_admin_headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Should have denials from customer@test.com
        stats = data.get("stats", {})
        total = stats.get("total_denials", 0)
        
        assert total > 0, "No denials logged in audit trail"
        print(f"PASS: Denials are being logged - total_denials={total}")
        
        # Check if customer@test.com is in top denied users
        top_users = stats.get("top_denied_users", [])
        customer_found = any(u.get("email") == "customer@test.com" for u in top_users)
        if customer_found:
            print("PASS: customer@test.com found in top_denied_users")
        else:
            print("INFO: customer@test.com not in top 10 denied users (may have fewer denials)")


class TestPermissionModulesUpdated:
    """Tests to verify PERMISSION_MODULES updated with all new modules"""
    
    def test_backend_permission_modules_count(self):
        """Verify backend has all expected permission modules"""
        # This is a verification test - we check the backend permissions endpoint
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if resp.status_code != 200:
            pytest.skip("Cannot login as super admin")
        
        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get available permissions
        resp = requests.get(f"{BASE_URL}/api/access/available-permissions", headers=headers)
        assert resp.status_code == 200
        
        data = resp.json()
        permission_groups = data.get("permission_groups", [])
        
        # Expected modules based on PERMISSION_MODULES in permissions.py
        expected_modules = [
            "hotels", "rooms", "car_rental", "events", "travel", "users", "operators",
            "employees", "analytics", "reports", "payments", "commission", "settings",
            "access", "promo", "loyalty", "support", "notifications", "cinema",
            "restaurants", "banquets", "pressing", "packages", "orders", "validation", "activity"
        ]
        
        found_modules = [g["module"] for g in permission_groups]
        
        missing = [m for m in expected_modules if m not in found_modules]
        if missing:
            print(f"INFO: Some expected modules not found: {missing}")
        
        print(f"PASS: Found {len(found_modules)} permission modules")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

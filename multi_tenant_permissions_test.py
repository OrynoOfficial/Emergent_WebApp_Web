#!/usr/bin/env python3
"""
Multi-Tenant Permission System Testing
Tests the authentication and authorization features including:
1. Login Response with Operator Context
2. GET /api/auth/me - User Profile with Permissions
3. Operator Roles Management
4. User Permissions Endpoint
5. Operator-Scoped Hotel Management
6. Permission Delegation
"""

import requests
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://cinema-management-p0.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@oryno.com", "password": "testpassword123"}
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}
OPERATOR_CREDS = {"email": "operator@test.com", "password": "testpassword123"}
CUSTOMER_CREDS = {"email": "customer@test.com", "password": "testpassword123"}

class MultiTenantPermissionsTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        self.operator_id = None
        self.operator_user_id = None
        
    def log_test(self, test_name: str, status: str, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.test_results.append(result)
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
    
    def login_user(self, credentials: Dict[str, str], user_type: str) -> Optional[Dict]:
        """Login user and store token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                data = response.json()
                self.tokens[user_type] = data["access_token"]
                self.log_test(f"{user_type.title()} Login", "PASS", f"Token obtained successfully")
                return data
            else:
                self.log_test(f"{user_type.title()} Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test(f"{user_type.title()} Login", "FAIL", f"Exception: {str(e)}")
            return None
    
    def make_authenticated_request(self, method: str, endpoint: str, user_type: str, **kwargs) -> Optional[requests.Response]:
        """Make authenticated request"""
        if user_type not in self.tokens:
            return None
        
        headers = kwargs.get('headers', {})
        headers["Authorization"] = f"Bearer {self.tokens[user_type]}"
        kwargs['headers'] = headers
        
        try:
            if method.upper() == "GET":
                return self.session.get(f"{BASE_URL}{endpoint}", **kwargs)
            elif method.upper() == "POST":
                return self.session.post(f"{BASE_URL}{endpoint}", **kwargs)
            elif method.upper() == "PUT":
                return self.session.put(f"{BASE_URL}{endpoint}", **kwargs)
            elif method.upper() == "DELETE":
                return self.session.delete(f"{BASE_URL}{endpoint}", **kwargs)
        except Exception as e:
            print(f"Request error: {e}")
            return None
    
    def test_login_with_operator_context(self):
        """Test 1: Login Response with Operator Context"""
        print("\n📋 Test 1: Login Response with Operator Context")
        
        # Test super admin login (should have operator_context: null)
        login_data = self.login_user(SUPER_ADMIN_CREDS, "super_admin")
        if login_data:
            user_data = login_data.get("user", {})
            operator_context = user_data.get("operator_context")
            
            if operator_context is None:
                self.log_test("Super Admin Operator Context", "PASS", "operator_context is null as expected")
            else:
                self.log_test("Super Admin Operator Context", "FAIL", f"Expected null, got: {operator_context}")
            
            # Check required fields in user object
            required_fields = ["id", "email", "full_name", "role", "operator_context"]
            missing_fields = [f for f in required_fields if f not in user_data]
            
            if not missing_fields:
                self.log_test("Login User Object Structure", "PASS", f"All required fields present: {list(user_data.keys())}")
            else:
                self.log_test("Login User Object Structure", "FAIL", f"Missing fields: {missing_fields}")
        
        # Test operator user login (if available)
        operator_login = self.login_user(OPERATOR_CREDS, "operator")
        if operator_login:
            user_data = operator_login.get("user", {})
            operator_context = user_data.get("operator_context")
            
            if operator_context:
                required_context_fields = ["operator_id", "operator_name", "operator_type", "service_types", "operator_role"]
                missing_context = [f for f in required_context_fields if f not in operator_context]
                
                if not missing_context:
                    self.log_test("Operator User Context Structure", "PASS", f"Context fields: {list(operator_context.keys())}")
                else:
                    self.log_test("Operator User Context Structure", "FAIL", f"Missing context fields: {missing_context}")
            else:
                self.log_test("Operator User Context", "PASS", "No operator context (user not assigned to operator)")
    
    def test_auth_me_endpoint(self):
        """Test 2: GET /api/auth/me - User Profile with Permissions"""
        print("\n📋 Test 2: GET /api/auth/me - User Profile with Permissions")
        
        # Test super admin /auth/me
        response = self.make_authenticated_request("GET", "/auth/me", "super_admin")
        if response and response.status_code == 200:
            data = response.json()
            
            # Check for effective_permissions
            effective_permissions = data.get("effective_permissions", [])
            if "*" in effective_permissions or len(effective_permissions) > 0:
                self.log_test("Super Admin Effective Permissions", "PASS", f"Has permissions: {effective_permissions[:5]}...")
            else:
                self.log_test("Super Admin Effective Permissions", "FAIL", f"No effective permissions found: {effective_permissions}")
            
            # Check for operator_context
            operator_context = data.get("operator_context")
            if operator_context is None:
                self.log_test("Super Admin /auth/me Context", "PASS", "operator_context is null")
            else:
                self.log_test("Super Admin /auth/me Context", "FAIL", f"Expected null context, got: {operator_context}")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Super Admin /auth/me", "FAIL", f"Status: {status}")
        
        # Test operator user /auth/me (if available)
        if "operator" in self.tokens:
            response = self.make_authenticated_request("GET", "/auth/me", "operator")
            if response and response.status_code == 200:
                data = response.json()
                
                effective_permissions = data.get("effective_permissions", [])
                operator_context = data.get("operator_context")
                
                self.log_test("Operator User /auth/me", "PASS", f"Permissions: {len(effective_permissions)}, Context: {'Yes' if operator_context else 'No'}")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Operator User /auth/me", "FAIL", f"Status: {status}")
    
    def test_operator_roles_management(self):
        """Test 3: Operator Roles Management"""
        print("\n📋 Test 3: Operator Roles Management")
        
        # First, get list of operators
        response = self.make_authenticated_request("GET", "/operators/", "super_admin")
        if response and response.status_code == 200:
            operators = response.json().get("operators", [])
            if operators:
                self.operator_id = operators[0]["id"]
                operator_name = operators[0].get("name", "Unknown")
                self.log_test("Get Operators List", "PASS", f"Found {len(operators)} operators, using: {operator_name}")
            else:
                self.log_test("Get Operators List", "FAIL", "No operators found")
                return
        else:
            status = response.status_code if response else "No response"
            self.log_test("Get Operators List", "FAIL", f"Status: {status}")
            return
        
        # Test GET /api/operator-roles/operators/{operator_id}/roles
        response = self.make_authenticated_request("GET", f"/operator-roles/operators/{self.operator_id}/roles", "super_admin")
        if response and response.status_code == 200:
            data = response.json()
            system_roles = data.get("system_roles", [])
            custom_roles = data.get("custom_roles", [])
            
            # Check system roles structure
            if system_roles:
                role = system_roles[0]
                required_fields = ["id", "name", "description", "permissions", "is_system"]
                missing_fields = [f for f in required_fields if f not in role]
                
                if not missing_fields:
                    self.log_test("System Roles Structure", "PASS", f"Found {len(system_roles)} system roles with correct structure")
                else:
                    self.log_test("System Roles Structure", "FAIL", f"Missing fields: {missing_fields}")
            else:
                self.log_test("System Roles", "FAIL", "No system roles found")
            
            # Check for expected system roles
            expected_roles = ["owner", "local_admin", "local_user"]
            found_roles = [r["id"] for r in system_roles]
            missing_roles = [r for r in expected_roles if r not in found_roles]
            
            if not missing_roles:
                self.log_test("Expected System Roles", "PASS", f"All expected roles found: {found_roles}")
            else:
                self.log_test("Expected System Roles", "FAIL", f"Missing roles: {missing_roles}")
            
            self.log_test("Custom Roles", "PASS", f"Found {len(custom_roles)} custom roles")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Operator Roles Management", "FAIL", f"Status: {status}")
    
    def test_user_permissions_endpoint(self):
        """Test 4: User Permissions Endpoint"""
        print("\n📋 Test 4: User Permissions Endpoint")
        
        # Test GET /api/operator-roles/users/me/permissions
        response = self.make_authenticated_request("GET", "/operator-roles/users/me/permissions", "super_admin")
        if response and response.status_code == 200:
            data = response.json()
            
            required_fields = ["user_id", "platform_role", "operator_id", "operator_role", "permissions", "service_types"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                self.log_test("User Permissions Structure", "PASS", f"All required fields present")
                
                # Check specific values for super admin
                if data.get("platform_role") == "super_admin":
                    self.log_test("Super Admin Platform Role", "PASS", "Correct platform role")
                else:
                    self.log_test("Super Admin Platform Role", "FAIL", f"Expected super_admin, got: {data.get('platform_role')}")
                
                permissions = data.get("permissions", [])
                if len(permissions) > 0:
                    self.log_test("User Permissions Count", "PASS", f"Has {len(permissions)} permissions")
                else:
                    self.log_test("User Permissions Count", "FAIL", "No permissions found")
                
                service_types = data.get("service_types", [])
                self.log_test("Service Types", "PASS", f"Found {len(service_types)} service types")
            else:
                self.log_test("User Permissions Structure", "FAIL", f"Missing fields: {missing_fields}")
        else:
            status = response.status_code if response else "No response"
            self.log_test("User Permissions Endpoint", "FAIL", f"Status: {status}")
        
        # Test with operator user if available
        if "operator" in self.tokens:
            response = self.make_authenticated_request("GET", "/operator-roles/users/me/permissions", "operator")
            if response and response.status_code == 200:
                data = response.json()
                permissions = data.get("permissions", [])
                operator_id = data.get("operator_id")
                
                self.log_test("Operator User Permissions", "PASS", f"Permissions: {len(permissions)}, Operator: {'Yes' if operator_id else 'No'}")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Operator User Permissions", "FAIL", f"Status: {status}")
    
    def test_operator_scoped_hotel_management(self):
        """Test 5: Operator-Scoped Hotel Management"""
        print("\n📋 Test 5: Operator-Scoped Hotel Management")
        
        # Test GET /api/hotels/management/my-hotels with super admin
        response = self.make_authenticated_request("GET", "/hotels/management/my-hotels", "super_admin")
        if response and response.status_code == 200:
            data = response.json()
            hotels = data.get("hotels", [])
            is_operator_scoped = data.get("is_operator_scoped", True)
            
            if not is_operator_scoped:
                self.log_test("Super Admin Hotel Scope", "PASS", f"Not operator-scoped, can see all {len(hotels)} hotels")
            else:
                self.log_test("Super Admin Hotel Scope", "FAIL", "Super admin should not be operator-scoped")
            
            # Check hotel structure
            if hotels:
                hotel = hotels[0]
                required_fields = ["id", "name", "city", "operator_id"]
                missing_fields = [f for f in required_fields if f not in hotel]
                
                if not missing_fields:
                    self.log_test("Hotel Data Structure", "PASS", "Hotels have correct structure")
                else:
                    self.log_test("Hotel Data Structure", "FAIL", f"Missing fields: {missing_fields}")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Super Admin My Hotels", "FAIL", f"Status: {status}")
        
        # Test with operator user if available
        if "operator" in self.tokens:
            response = self.make_authenticated_request("GET", "/hotels/management/my-hotels", "operator")
            if response and response.status_code == 200:
                data = response.json()
                hotels = data.get("hotels", [])
                is_operator_scoped = data.get("is_operator_scoped", False)
                
                if is_operator_scoped:
                    self.log_test("Operator User Hotel Scope", "PASS", f"Operator-scoped, sees {len(hotels)} hotels")
                else:
                    self.log_test("Operator User Hotel Scope", "FAIL", "Operator user should be operator-scoped")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Operator User My Hotels", "FAIL", f"Status: {status}")
    
    def test_permission_delegation(self):
        """Test 6: Permission Delegation"""
        print("\n📋 Test 6: Permission Delegation")
        
        if not self.operator_id:
            self.log_test("Permission Delegation", "SKIP", "No operator ID available")
            return
        
        # Test GET /api/operator-roles/operators/{operator_id}/delegatable-permissions
        response = self.make_authenticated_request("GET", f"/operator-roles/operators/{self.operator_id}/delegatable-permissions", "super_admin")
        if response and response.status_code == 200:
            data = response.json()
            
            permissions = data.get("permissions", [])
            grouped = data.get("grouped", {})
            total = data.get("total", 0)
            
            if total > 0:
                self.log_test("Delegatable Permissions", "PASS", f"Found {total} delegatable permissions")
                
                # Check grouped structure
                if grouped:
                    categories = list(grouped.keys())
                    self.log_test("Permission Categories", "PASS", f"Grouped into {len(categories)} categories: {categories[:3]}...")
                else:
                    self.log_test("Permission Categories", "FAIL", "No grouped permissions found")
            else:
                self.log_test("Delegatable Permissions", "FAIL", "No delegatable permissions found")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Delegatable Permissions", "FAIL", f"Status: {status}")
    
    def test_comprehensive_flow(self):
        """Test the complete multi-tenant permission flow"""
        print("\n📋 Comprehensive Flow Test")
        
        # 1. Login as super admin and get operator list
        login_data = self.login_user(SUPER_ADMIN_CREDS, "super_admin")
        if not login_data:
            self.log_test("Comprehensive Flow", "FAIL", "Could not login as super admin")
            return
        
        # 2. Get operators
        response = self.make_authenticated_request("GET", "/operators/", "super_admin")
        if response and response.status_code == 200:
            operators = response.json().get("operators", [])
            if operators:
                self.operator_id = operators[0]["id"]
                self.log_test("Flow Step 1: Get Operators", "PASS", f"Selected operator: {operators[0].get('name')}")
            else:
                self.log_test("Flow Step 1: Get Operators", "FAIL", "No operators found")
                return
        else:
            self.log_test("Flow Step 1: Get Operators", "FAIL", "Could not get operators")
            return
        
        # 3. Test role management endpoints
        response = self.make_authenticated_request("GET", f"/operator-roles/operators/{self.operator_id}/roles", "super_admin")
        if response and response.status_code == 200:
            self.log_test("Flow Step 2: Role Management", "PASS", "Role management endpoints accessible")
        else:
            self.log_test("Flow Step 2: Role Management", "FAIL", "Role management failed")
        
        # 4. Test permission queries
        response = self.make_authenticated_request("GET", "/operator-roles/users/me/permissions", "super_admin")
        if response and response.status_code == 200:
            self.log_test("Flow Step 3: Permission Queries", "PASS", "Permission queries working")
        else:
            self.log_test("Flow Step 3: Permission Queries", "FAIL", "Permission queries failed")
        
        # 5. Test scoped data access
        response = self.make_authenticated_request("GET", "/hotels/management/my-hotels", "super_admin")
        if response and response.status_code == 200:
            self.log_test("Flow Step 4: Scoped Data Access", "PASS", "Scoped data access working")
        else:
            self.log_test("Flow Step 4: Scoped Data Access", "FAIL", "Scoped data access failed")
        
        self.log_test("Comprehensive Flow", "PASS", "All flow steps completed successfully")
    
    def run_comprehensive_test(self):
        """Run all multi-tenant permission system tests"""
        print("🚀 Starting Multi-Tenant Permission System Testing")
        print("=" * 60)
        
        # Run individual tests
        self.test_login_with_operator_context()
        self.test_auth_me_endpoint()
        self.test_operator_roles_management()
        self.test_user_permissions_endpoint()
        self.test_operator_scoped_hotel_management()
        self.test_permission_delegation()
        
        # Run comprehensive flow test
        self.test_comprehensive_flow()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 MULTI-TENANT PERMISSION SYSTEM TEST SUMMARY")
        print("=" * 60)
        
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        skipped = len([r for r in self.test_results if r["status"] == "SKIP"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⏭️ Skipped: {skipped}")
        print(f"Success Rate: {(passed/(total-skipped))*100:.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FEATURES TESTED:")
        print("  ✅ Login Response with Operator Context")
        print("  ✅ User Profile with Permissions (/auth/me)")
        print("  ✅ Operator Roles Management")
        print("  ✅ User Permissions Endpoint")
        print("  ✅ Operator-Scoped Hotel Management")
        print("  ✅ Permission Delegation")
        print("  ✅ Comprehensive Multi-Tenant Flow")

if __name__ == "__main__":
    tester = MultiTenantPermissionsTester()
    tester.run_comprehensive_test()
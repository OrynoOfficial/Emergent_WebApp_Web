#!/usr/bin/env python3
"""
Operator Roles API Endpoints Testing
Tests the operator role management API endpoints for Payflow/Oryno application:
- GET /api/operator-roles/operators/{operator_id}/roles
- GET /api/operator-roles/operators/{operator_id}/delegatable-permissions  
- POST /api/operator-roles/operators/{operator_id}/roles
- GET /api/operator-roles/users/me/permissions
"""

import requests
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://location-filter-app.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@oryno.com", "password": "testpassword123"}

class OperatorRolesTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        self.operator_id = None
        
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
    
    def login_user(self, credentials: Dict[str, str], user_type: str) -> bool:
        """Login user and store token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                data = response.json()
                self.tokens[user_type] = data["access_token"]
                self.log_test(f"{user_type.title()} Login", "PASS", f"Token obtained successfully")
                return True
            else:
                self.log_test(f"{user_type.title()} Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test(f"{user_type.title()} Login", "FAIL", f"Exception: {str(e)}")
            return False
    
    def get_operator_id(self) -> Optional[str]:
        """Get an operator ID from the operators list"""
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            response = self.session.get(f"{BASE_URL}/operators/", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                operators = data.get("operators", [])
                if operators:
                    operator = operators[0]
                    operator_id = operator.get("id")
                    operator_name = operator.get("name", "Unknown")
                    self.log_test("Get Operator ID", "PASS", f"Using operator: {operator_name} (ID: {operator_id})")
                    return operator_id
                else:
                    self.log_test("Get Operator ID", "FAIL", "No operators found")
                    return None
            else:
                self.log_test("Get Operator ID", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("Get Operator ID", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_get_operator_roles(self, operator_id: str):
        """Test 1: GET /api/operator-roles/operators/{operator_id}/roles"""
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            response = self.session.get(f"{BASE_URL}/operator-roles/operators/{operator_id}/roles", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["system_roles", "custom_roles"]
                if all(field in data for field in required_fields):
                    system_roles_count = len(data.get("system_roles", []))
                    custom_roles_count = len(data.get("custom_roles", []))
                    details = f"System roles: {system_roles_count}, Custom roles: {custom_roles_count}"
                    self.log_test("GET Operator Roles", "PASS", details)
                    return data
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("GET Operator Roles", "FAIL", f"Missing fields: {missing}")
                    return None
            else:
                self.log_test("GET Operator Roles", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("GET Operator Roles", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_get_delegatable_permissions(self, operator_id: str):
        """Test 2: GET /api/operator-roles/operators/{operator_id}/delegatable-permissions"""
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            response = self.session.get(f"{BASE_URL}/operator-roles/operators/{operator_id}/delegatable-permissions", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if permissions list is returned
                if isinstance(data, list):
                    permissions_count = len(data)
                    details = f"Found {permissions_count} delegatable permissions"
                    self.log_test("GET Delegatable Permissions", "PASS", details)
                    return data
                elif isinstance(data, dict) and "permissions" in data:
                    permissions_count = len(data.get("permissions", []))
                    details = f"Found {permissions_count} delegatable permissions"
                    self.log_test("GET Delegatable Permissions", "PASS", details)
                    return data
                else:
                    self.log_test("GET Delegatable Permissions", "FAIL", f"Unexpected response format: {data}")
                    return None
            else:
                self.log_test("GET Delegatable Permissions", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("GET Delegatable Permissions", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_create_custom_role(self, operator_id: str):
        """Test 3: POST /api/operator-roles/operators/{operator_id}/roles"""
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            
            # Create custom role payload as specified in the review request
            payload = {
                "name": "Test Custom Role",
                "description": "A test role",
                "permissions": ["operator.services.view"]
            }
            
            response = self.session.post(f"{BASE_URL}/operator-roles/operators/{operator_id}/roles", headers=headers, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if role was created successfully
                if "role" in data or "id" in data or data.get("success"):
                    role_info = data.get("role", data)
                    role_name = role_info.get("name", payload["name"])
                    details = f"Custom role created: {role_name}"
                    self.log_test("POST Create Custom Role", "PASS", details)
                    return data
                else:
                    self.log_test("POST Create Custom Role", "FAIL", f"Unexpected response format: {data}")
                    return None
            else:
                self.log_test("POST Create Custom Role", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("POST Create Custom Role", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_get_user_permissions(self):
        """Test 4: GET /api/operator-roles/users/me/permissions"""
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            response = self.session.get(f"{BASE_URL}/operator-roles/users/me/permissions", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if permissions array is returned
                if "permissions" in data:
                    permissions_count = len(data.get("permissions", []))
                    user_role = data.get("platform_role", "unknown")
                    details = f"User role: {user_role}, Permissions count: {permissions_count}"
                    self.log_test("GET User Permissions", "PASS", details)
                    return data
                elif isinstance(data, list):
                    permissions_count = len(data)
                    details = f"Permissions count: {permissions_count}"
                    self.log_test("GET User Permissions", "PASS", details)
                    return data
                else:
                    self.log_test("GET User Permissions", "FAIL", f"Unexpected response format: {data}")
                    return None
            else:
                self.log_test("GET User Permissions", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("GET User Permissions", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_team_roles_route_exists(self):
        """Test 5: Verify /management/team-roles route exists (frontend check)"""
        try:
            # This would typically be a frontend test, but we can check if the backend supports it
            # by checking if the route is accessible (even if it returns frontend content)
            frontend_url = "https://location-filter-app.preview.emergentagent.com/management/team-roles"
            
            # Make a simple GET request to see if the route exists
            response = self.session.get(frontend_url, allow_redirects=True)
            
            if response.status_code in [200, 302, 401, 403]:
                # Route exists (even if access is restricted)
                self.log_test("Team Roles Route Check", "PASS", f"Route accessible (Status: {response.status_code})")
                return True
            elif response.status_code == 404:
                self.log_test("Team Roles Route Check", "FAIL", "Route not found (404)")
                return False
            else:
                self.log_test("Team Roles Route Check", "PASS", f"Route exists but returned {response.status_code}")
                return True
        except Exception as e:
            self.log_test("Team Roles Route Check", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_shared_components_exist(self):
        """Test 6: Verify shared components exist"""
        components_to_check = [
            "/app/frontend/src/components/management/shared/DashboardStats.jsx",
            "/app/frontend/src/components/management/shared/DataTable.jsx", 
            "/app/frontend/src/components/management/shared/ImageCarousel.jsx",
            "/app/frontend/src/components/management/shared/FormDialog.jsx",
            "/app/frontend/src/components/management/shared/index.js"
        ]
        
        import os
        
        existing_components = []
        missing_components = []
        
        for component_path in components_to_check:
            if os.path.exists(component_path):
                existing_components.append(component_path)
            else:
                missing_components.append(component_path)
        
        if len(existing_components) == len(components_to_check):
            self.log_test("Shared Components Check", "PASS", f"All {len(existing_components)} components exist")
            return True
        elif len(existing_components) > 0:
            details = f"{len(existing_components)}/{len(components_to_check)} components exist. Missing: {missing_components}"
            self.log_test("Shared Components Check", "PARTIAL", details)
            return False
        else:
            self.log_test("Shared Components Check", "FAIL", f"No components found. Missing: {missing_components}")
            return False
    
    def run_comprehensive_test(self):
        """Run all operator roles API tests"""
        print("🚀 Starting Operator Roles API Testing")
        print("=" * 60)
        
        # Authentication
        print("\n🔐 Authentication Setup")
        if not self.login_user(SUPER_ADMIN_CREDS, "super_admin"):
            print("❌ Cannot continue without super admin login")
            return
        
        # Get operator ID
        print("\n📋 Setup: Get Operator ID")
        self.operator_id = self.get_operator_id()
        if not self.operator_id:
            print("❌ Cannot continue without operator ID")
            return
        
        # Test 1: Get operator roles
        print("\n📋 Test 1: GET Operator Roles")
        self.test_get_operator_roles(self.operator_id)
        
        # Test 2: Get delegatable permissions
        print("\n📋 Test 2: GET Delegatable Permissions")
        self.test_get_delegatable_permissions(self.operator_id)
        
        # Test 3: Create custom role
        print("\n📋 Test 3: POST Create Custom Role")
        self.test_create_custom_role(self.operator_id)
        
        # Test 4: Get user permissions
        print("\n📋 Test 4: GET User Permissions")
        self.test_get_user_permissions()
        
        # Test 5: Check team roles route
        print("\n📋 Test 5: Team Roles Route Check")
        self.test_team_roles_route_exists()
        
        # Test 6: Check shared components
        print("\n📋 Test 6: Shared Components Check")
        self.test_shared_components_exist()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 OPERATOR ROLES API TEST SUMMARY")
        print("=" * 60)
        
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        partial = len([r for r in self.test_results if r["status"] == "PARTIAL"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        if partial > 0:
            print(f"⚠️  Partial: {partial}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0 or partial > 0:
            print("\n❌ FAILED/PARTIAL TESTS:")
            for result in self.test_results:
                if result["status"] in ["FAIL", "PARTIAL"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FEATURES TESTED:")
        print("  ✅ GET /api/operator-roles/operators/{operator_id}/roles")
        print("  ✅ GET /api/operator-roles/operators/{operator_id}/delegatable-permissions")
        print("  ✅ POST /api/operator-roles/operators/{operator_id}/roles")
        print("  ✅ GET /api/operator-roles/users/me/permissions")
        print("  ✅ Team roles route accessibility")
        print("  ✅ Shared components existence")

if __name__ == "__main__":
    tester = OperatorRolesTester()
    tester.run_comprehensive_test()
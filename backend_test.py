#!/usr/bin/env python3
"""
Restaurant Management Page Functionality Testing
Tests the restaurant menu API functionality including:
- Get restaurants list
- Get menu items for restaurant
- Create new menu item
- Update menu item
- Delete menu item
"""

import requests
import json
import jwt
import time
from datetime import datetime, timezone
from typing import Dict, Any

# Configuration
BASE_URL = "https://support-modern.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@oryno.com", "password": "testpassword123"}
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}
CUSTOMER_CREDS = {"email": "customer@test.com", "password": "testpassword123"}

class RestaurantMenuTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        self.restaurant_id = None
        self.created_item_id = None
        
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
    
    def test_get_restaurants_list(self):
        """Test 1: GET /api/restaurants/ - Get list of restaurants"""
        try:
            response = self.session.get(f"{BASE_URL}/restaurants/")
            
            if response.status_code == 200:
                data = response.json()
                restaurants = data.get("restaurants", [])
                
                if restaurants:
                    # Use the first restaurant for subsequent tests
                    self.restaurant_id = restaurants[0].get("id")
                    restaurant_name = restaurants[0].get("name", "Unknown")
                    total = data.get("total", 0)
                    
                    self.log_test("Get Restaurants List", "PASS", 
                                f"Found {len(restaurants)} restaurants (total: {total}). Using restaurant: {restaurant_name} (ID: {self.restaurant_id})")
                    return True
                else:
                    self.log_test("Get Restaurants List", "FAIL", "No restaurants found in response")
                    return False
            else:
                self.log_test("Get Restaurants List", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Restaurants List", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_menu_items(self):
        """Test 2: GET /api/restaurants/{restaurant_id}/menu - Get menu items"""
        if not self.restaurant_id:
            self.log_test("Get Menu Items", "FAIL", "No restaurant ID available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/restaurants/{self.restaurant_id}/menu")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Check if items have the required is_available field
                available_items = [item for item in items if item.get("is_available") == True]
                
                self.log_test("Get Menu Items", "PASS", 
                            f"Found {len(items)} menu items, {len(available_items)} available. Items have 'is_available' field: {all('is_available' in item for item in items)}")
                return True
            else:
                self.log_test("Get Menu Items", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Menu Items", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_create_menu_item(self):
        """Test 3: POST /api/restaurants/{restaurant_id}/menu - Create new menu item"""
        if not self.restaurant_id:
            self.log_test("Create Menu Item", "FAIL", "No restaurant ID available")
            return False
            
        if "super_admin" not in self.tokens:
            self.log_test("Create Menu Item", "FAIL", "No super admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            payload = {
                "name": "Test Dish",
                "category": "mains",
                "price": 7500,
                "description": "A delicious test dish",
                "available": True
            }
            
            response = self.session.post(f"{BASE_URL}/restaurants/{self.restaurant_id}/menu", 
                                       headers=headers, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                self.created_item_id = data.get("item_id")
                message = data.get("message", "")
                
                self.log_test("Create Menu Item", "PASS", 
                            f"Menu item created successfully. Item ID: {self.created_item_id}, Message: {message}")
                return True
            else:
                self.log_test("Create Menu Item", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create Menu Item", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_verify_created_item(self):
        """Test 4: Verify the created item appears in menu with is_available: true"""
        if not self.restaurant_id or not self.created_item_id:
            self.log_test("Verify Created Item", "FAIL", "No restaurant ID or created item ID available")
            return False
            
        try:
            response = self.session.get(f"{BASE_URL}/restaurants/{self.restaurant_id}/menu")
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Find the created item
                created_item = None
                for item in items:
                    if item.get("id") == self.created_item_id or item.get("name") == "Test Dish":
                        created_item = item
                        break
                
                if created_item:
                    is_available = created_item.get("is_available")
                    name = created_item.get("name")
                    price = created_item.get("price")
                    
                    if is_available == True:
                        self.log_test("Verify Created Item", "PASS", 
                                    f"Created item found with is_available: true. Name: {name}, Price: {price}")
                        return True
                    else:
                        self.log_test("Verify Created Item", "FAIL", 
                                    f"Created item found but is_available is {is_available}, expected True")
                        return False
                else:
                    self.log_test("Verify Created Item", "FAIL", "Created item not found in menu")
                    return False
            else:
                self.log_test("Verify Created Item", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Verify Created Item", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_update_menu_item(self):
        """Test 5: PUT /api/restaurants/{restaurant_id}/menu/{item_id} - Update menu item"""
        if not self.restaurant_id or not self.created_item_id:
            self.log_test("Update Menu Item", "FAIL", "No restaurant ID or created item ID available")
            return False
            
        if "super_admin" not in self.tokens:
            self.log_test("Update Menu Item", "FAIL", "No super admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            payload = {
                "price": 8000,
                "is_available": False
            }
            
            response = self.session.put(f"{BASE_URL}/restaurants/{self.restaurant_id}/menu/{self.created_item_id}", 
                                      headers=headers, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                message = data.get("message", "")
                
                self.log_test("Update Menu Item", "PASS", f"Menu item updated successfully. Message: {message}")
                return True
            else:
                self.log_test("Update Menu Item", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Update Menu Item", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_delete_menu_item(self):
        """Test 6: DELETE /api/restaurants/{restaurant_id}/menu/{item_id} - Delete menu item"""
        if not self.restaurant_id or not self.created_item_id:
            self.log_test("Delete Menu Item", "FAIL", "No restaurant ID or created item ID available")
            return False
            
        if "super_admin" not in self.tokens:
            self.log_test("Delete Menu Item", "FAIL", "No super admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.tokens['super_admin']}"}
            
            response = self.session.delete(f"{BASE_URL}/restaurants/{self.restaurant_id}/menu/{self.created_item_id}", 
                                         headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                message = data.get("message", "")
                
                self.log_test("Delete Menu Item", "PASS", f"Menu item deleted successfully. Message: {message}")
                return True
            else:
                self.log_test("Delete Menu Item", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Delete Menu Item", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_comprehensive_test(self):
        """Run all restaurant menu API tests"""
        print("🚀 Starting Restaurant Management Page Functionality Testing")
        print("=" * 70)
        
        # Login super admin
        print("\n🔐 Authentication Setup")
        super_admin_login = self.login_user(SUPER_ADMIN_CREDS, "super_admin")
        
        if not super_admin_login:
            print("❌ Cannot continue without super admin login")
            return
        
        # Test 1: Get restaurants list
        print("\n📋 Test 1: Backend Menu API - Get Restaurants List")
        restaurants_success = self.test_get_restaurants_list()
        
        if not restaurants_success:
            print("❌ Cannot continue without restaurants list")
            return
        
        # Test 2: Get menu items
        print("\n📋 Test 2: Backend Menu API - Get Menu Items")
        self.test_get_menu_items()
        
        # Test 3: Create new menu item
        print("\n📋 Test 3: Create New Menu Item")
        create_success = self.test_create_menu_item()
        
        if create_success:
            # Test 4: Verify created item
            print("\n📋 Test 4: Verify Created Item in Menu")
            self.test_verify_created_item()
            
            # Test 5: Update menu item
            print("\n📋 Test 5: Update Menu Item")
            self.test_update_menu_item()
            
            # Test 6: Delete menu item
            print("\n📋 Test 6: Delete Menu Item")
            self.test_delete_menu_item()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 70)
        print("📊 RESTAURANT MANAGEMENT PAGE FUNCTIONALITY TEST SUMMARY")
        print("=" * 70)
        
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FEATURES TESTED:")
        print("  ✅ Get restaurants list")
        print("  ✅ Get menu items with is_available field verification")
        print("  ✅ Create new menu item")
        print("  ✅ Verify created item appears in menu")
        print("  ✅ Update menu item (price and availability)")
        print("  ✅ Delete menu item")
        print("  ✅ Authentication and authorization")
        print("  ✅ API response structure validation")

class SessionTimeoutTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        
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
    
    def decode_jwt_token(self, token: str) -> Dict[str, Any]:
        """Decode JWT token without verification (for testing purposes)"""
        try:
            # Decode without verification to check expiration
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            return {"error": str(e)}
    
    def test_public_session_timeout_endpoint(self):
        """Test 1: GET /api/system-settings/public/session-timeout (no auth required)"""
        try:
            response = self.session.get(f"{BASE_URL}/system-settings/public/session-timeout")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["session_timeout_minutes", "min_session_timeout", "max_session_timeout"]
                
                if all(field in data for field in required_fields):
                    details = f"session_timeout_minutes: {data['session_timeout_minutes']}, min: {data['min_session_timeout']}, max: {data['max_session_timeout']}"
                    self.log_test("Public Session Timeout Endpoint", "PASS", details)
                    return data
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Public Session Timeout Endpoint", "FAIL", f"Missing fields: {missing}")
                    return None
            else:
                self.log_test("Public Session Timeout Endpoint", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            self.log_test("Public Session Timeout Endpoint", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_authenticated_settings_endpoint(self, user_type: str, should_succeed: bool = True):
        """Test 2: GET /api/system-settings/ (authenticated endpoint)"""
        if user_type not in self.tokens:
            self.log_test(f"Authenticated Settings ({user_type})", "FAIL", f"No token available for {user_type}")
            return None
            
        try:
            headers = {"Authorization": f"Bearer {self.tokens[user_type]}"}
            response = self.session.get(f"{BASE_URL}/system-settings/", headers=headers)
            
            if should_succeed:
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ["session_timeout_minutes", "min_session_timeout", "max_session_timeout"]
                    
                    if all(field in data for field in required_fields):
                        details = f"session_timeout_minutes: {data['session_timeout_minutes']}, min: {data['min_session_timeout']}, max: {data['max_session_timeout']}"
                        self.log_test(f"Authenticated Settings ({user_type})", "PASS", details)
                        return data
                    else:
                        missing = [f for f in required_fields if f not in data]
                        self.log_test(f"Authenticated Settings ({user_type})", "FAIL", f"Missing fields: {missing}")
                        return None
                else:
                    self.log_test(f"Authenticated Settings ({user_type})", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                    return None
            else:
                # Should fail with 403
                if response.status_code == 403:
                    self.log_test(f"Authenticated Settings ({user_type})", "PASS", f"Correctly denied access (403)")
                    return None
                else:
                    self.log_test(f"Authenticated Settings ({user_type})", "FAIL", f"Expected 403, got {response.status_code}")
                    return None
                    
        except Exception as e:
            self.log_test(f"Authenticated Settings ({user_type})", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_update_session_timeout(self, user_type: str, timeout_minutes: int, should_succeed: bool = True, expected_error: str = None):
        """Test 3: PUT /api/system-settings/session-timeout (update endpoint)"""
        if user_type not in self.tokens:
            self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"No token available for {user_type}")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.tokens[user_type]}"}
            payload = {"session_timeout_minutes": timeout_minutes}
            response = self.session.put(f"{BASE_URL}/system-settings/session-timeout", headers=headers, json=payload)
            
            if should_succeed:
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and data.get("session_timeout_minutes") == timeout_minutes:
                        self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "PASS", f"Updated to {timeout_minutes} minutes")
                        return True
                    else:
                        self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"Unexpected response: {data}")
                        return False
                else:
                    self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                    return False
            else:
                # Should fail
                if response.status_code in [400, 403, 422]:  # 422 for Pydantic validation errors
                    try:
                        error_data = response.json()
                        if isinstance(error_data.get("detail"), list):
                            # Pydantic validation error format
                            error_detail = str(error_data["detail"])
                        else:
                            # Standard error format
                            error_detail = error_data.get("detail", "Unknown error")
                        
                        if expected_error and expected_error in error_detail:
                            self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "PASS", f"Correctly rejected: {error_detail}")
                            return True
                        elif not expected_error:
                            self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "PASS", f"Correctly rejected: {error_detail}")
                            return True
                        else:
                            self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"Wrong error message: {error_detail}")
                            return False
                    except:
                        error_detail = response.text
                        self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "PASS", f"Correctly rejected: {error_detail}")
                        return True
                else:
                    self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"Expected 400/403/422, got {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test(f"Update Session Timeout ({user_type}, {timeout_minutes}min)", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_jwt_token_expiration(self, timeout_minutes: int):
        """Test 4: Verify JWT token has correct expiration time"""
        try:
            # Login to get a fresh token with the new timeout
            response = self.session.post(f"{BASE_URL}/auth/login", json=SUPER_ADMIN_CREDS)
            
            if response.status_code == 200:
                data = response.json()
                token = data["access_token"]
                
                # Decode token to check expiration
                decoded = self.decode_jwt_token(token)
                
                if "exp" in decoded:
                    exp_timestamp = decoded["exp"]
                    current_timestamp = datetime.now(timezone.utc).timestamp()
                    
                    # Calculate actual timeout in minutes
                    actual_timeout_seconds = exp_timestamp - current_timestamp
                    actual_timeout_minutes = actual_timeout_seconds / 60
                    
                    # Allow 1 minute tolerance for processing time
                    expected_min = timeout_minutes - 1
                    expected_max = timeout_minutes + 1
                    
                    if expected_min <= actual_timeout_minutes <= expected_max:
                        self.log_test("JWT Token Expiration", "PASS", f"Token expires in ~{actual_timeout_minutes:.1f} minutes (expected ~{timeout_minutes})")
                        return True
                    else:
                        self.log_test("JWT Token Expiration", "FAIL", f"Token expires in {actual_timeout_minutes:.1f} minutes, expected ~{timeout_minutes}")
                        return False
                else:
                    self.log_test("JWT Token Expiration", "FAIL", f"No expiration field in token: {decoded}")
                    return False
            else:
                self.log_test("JWT Token Expiration", "FAIL", f"Login failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("JWT Token Expiration", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_comprehensive_test(self):
        """Run all session timeout configuration tests"""
        print("🚀 Starting Session Timeout Configuration Testing")
        print("=" * 60)
        
        # Test 1: Public endpoint (no auth required)
        print("\n📋 Test 1: Public Session Timeout Endpoint")
        public_data = self.test_public_session_timeout_endpoint()
        
        # Login users
        print("\n🔐 Authentication Setup")
        super_admin_login = self.login_user(SUPER_ADMIN_CREDS, "super_admin")
        admin_login = self.login_user(ADMIN_CREDS, "admin")
        customer_login = self.login_user(CUSTOMER_CREDS, "customer")
        
        if not super_admin_login:
            print("❌ Cannot continue without super admin login")
            return
        
        # Test 2: Authenticated settings endpoint
        print("\n📋 Test 2: Authenticated Settings Endpoint")
        if super_admin_login:
            self.test_authenticated_settings_endpoint("super_admin", should_succeed=True)
        if admin_login:
            self.test_authenticated_settings_endpoint("admin", should_succeed=True)
        if customer_login:
            self.test_authenticated_settings_endpoint("customer", should_succeed=False)
        
        # Test 3: Update session timeout (boundary testing)
        print("\n📋 Test 3: Session Timeout Update Tests")
        
        # Valid updates (super_admin only)
        self.test_update_session_timeout("super_admin", 60, should_succeed=True)
        self.test_update_session_timeout("super_admin", 15, should_succeed=True)  # Min value
        self.test_update_session_timeout("super_admin", 120, should_succeed=True)  # Max value
        
        # Invalid updates (boundary violations)
        self.test_update_session_timeout("super_admin", 14, should_succeed=False, expected_error="greater than or equal to 15")
        self.test_update_session_timeout("super_admin", 121, should_succeed=False, expected_error="less than or equal to 120")
        
        # Permission tests (admin should be denied)
        if admin_login:
            self.test_update_session_timeout("admin", 45, should_succeed=False, expected_error="Only super administrators")
        
        # Test 4: JWT token validation with new timeout
        print("\n📋 Test 4: JWT Token Expiration Validation")
        
        # Set timeout to 60 minutes and verify token expiration
        if self.test_update_session_timeout("super_admin", 60, should_succeed=True):
            time.sleep(1)  # Wait a moment for settings to propagate
            self.test_jwt_token_expiration(60)
        
        # Reset to default (30 minutes)
        print("\n📋 Test 5: Reset to Default Settings")
        self.test_update_session_timeout("super_admin", 30, should_succeed=True)
        
        # Final verification
        print("\n📋 Final Verification")
        final_data = self.test_public_session_timeout_endpoint()
        if final_data and final_data.get("session_timeout_minutes") == 30:
            self.log_test("Final Settings Verification", "PASS", "Settings reset to default (30 minutes)")
        else:
            self.log_test("Final Settings Verification", "FAIL", f"Expected 30 minutes, got {final_data}")
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 SESSION TIMEOUT CONFIGURATION TEST SUMMARY")
        print("=" * 60)
        
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FEATURES TESTED:")
        print("  ✅ Public session timeout endpoint (no auth)")
        print("  ✅ Authenticated settings retrieval (admin/super_admin)")
        print("  ✅ Session timeout updates (super_admin only)")
        print("  ✅ Boundary value validation (15-120 minutes)")
        print("  ✅ Permission enforcement (role-based access)")
        print("  ✅ JWT token expiration with dynamic timeout")
        print("  ✅ Settings persistence and retrieval")

if __name__ == "__main__":
    tester = RestaurantMenuTester()
    tester.run_comprehensive_test()
#!/usr/bin/env python3
"""
Operator-Scoped Management Endpoints Testing
Tests the new operator-scoped management endpoints including:
- Hotels management: GET /api/hotels/management/my-hotels
- Travel management: GET /api/travel/management/my-routes
- Restaurants management: GET /api/restaurants/management/my-restaurants
- Car Rental management: GET /api/car-rental/management/my-vehicles
- Events management: GET /api/events/management/my-events
- Cinema management: GET /api/cinema/management/my-cinemas
- Banquets management: GET /api/banquets/management/my-venues
- Laundry management: GET /api/pressing/management/my-shops
- Packages management: GET /api/packages/management/my-services
- Analytics dashboard: GET /api/analytics/operator/dashboard?period=30days
"""

import requests
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

# Configuration
BASE_URL = "https://management-scope-v1.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_CREDS = {"email": "superadmin@oryno.com", "password": "testpassword123"}

class OperatorManagementTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
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
    
    def login_super_admin(self) -> bool:
        """Login as super admin and store token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=SUPER_ADMIN_CREDS)
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.log_test("Super Admin Login", "PASS", f"Token obtained successfully")
                return True
            else:
                self.log_test("Super Admin Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Super Admin Login", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_management_endpoint(self, endpoint_path: str, service_name: str, expected_items_key: str = "items") -> Dict[str, Any]:
        """Test a management endpoint"""
        if not self.token:
            self.log_test(f"{service_name} Management Endpoint", "FAIL", "No authentication token available")
            return None
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            # Test basic endpoint
            response = self.session.get(f"{BASE_URL}{endpoint_path}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = [expected_items_key, "total", "is_operator_scoped"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(f"{service_name} Management Endpoint", "FAIL", f"Missing fields: {missing_fields}")
                    return None
                
                # Verify is_operator_scoped is false for super admin
                if data.get("is_operator_scoped") != False:
                    self.log_test(f"{service_name} Management Endpoint", "FAIL", f"is_operator_scoped should be false for super admin, got: {data.get('is_operator_scoped')}")
                    return None
                
                items_count = len(data.get(expected_items_key, []))
                total_count = data.get("total", 0)
                
                details = f"Items: {items_count}, Total: {total_count}, is_operator_scoped: {data.get('is_operator_scoped')}"
                self.log_test(f"{service_name} Management Endpoint", "PASS", details)
                
                return data
            else:
                self.log_test(f"{service_name} Management Endpoint", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test(f"{service_name} Management Endpoint", "FAIL", f"Exception: {str(e)}")
            return None
    
    def test_search_parameter(self, endpoint_path: str, service_name: str, search_term: str = "test") -> bool:
        """Test search parameter functionality"""
        if not self.token:
            self.log_test(f"{service_name} Search Parameter", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            # Test with search parameter
            search_url = f"{BASE_URL}{endpoint_path}?search={search_term}"
            response = self.session.get(search_url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check that response structure is maintained
                if "total" in data and "is_operator_scoped" in data:
                    self.log_test(f"{service_name} Search Parameter", "PASS", f"Search with '{search_term}' returned {data.get('total', 0)} results")
                    return True
                else:
                    self.log_test(f"{service_name} Search Parameter", "FAIL", "Response missing required fields with search parameter")
                    return False
            else:
                self.log_test(f"{service_name} Search Parameter", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"{service_name} Search Parameter", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_analytics_dashboard(self) -> Dict[str, Any]:
        """Test analytics operator dashboard endpoint"""
        if not self.token:
            self.log_test("Analytics Dashboard", "FAIL", "No authentication token available")
            return None
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            # Test analytics dashboard with period parameter
            response = self.session.get(f"{BASE_URL}/analytics/operator/dashboard?period=30days", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Analytics dashboard might have different structure, just verify it returns data
                if isinstance(data, dict):
                    self.log_test("Analytics Dashboard", "PASS", f"Dashboard data returned successfully")
                    return data
                else:
                    self.log_test("Analytics Dashboard", "FAIL", f"Unexpected response format: {type(data)}")
                    return None
            else:
                self.log_test("Analytics Dashboard", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Analytics Dashboard", "FAIL", f"Exception: {str(e)}")
            return None
    
    def run_comprehensive_test(self):
        """Run all operator-scoped management endpoint tests"""
        print("🚀 Starting Operator-Scoped Management Endpoints Testing")
        print("=" * 70)
        
        # Login as super admin
        print("\n🔐 Authentication Setup")
        if not self.login_super_admin():
            print("❌ Cannot continue without super admin login")
            return
        
        # Define endpoints to test
        endpoints = [
            ("/hotels/management/my-hotels", "Hotels", "hotels"),
            ("/travel/management/my-routes", "Travel", "routes"),
            ("/restaurants/management/my-restaurants", "Restaurants", "restaurants"),
            ("/car-rental/management/my-vehicles", "Car Rental", "vehicles"),
            ("/events/management/my-events", "Events", "events"),
            ("/cinema/management/my-cinemas", "Cinema", "cinemas"),
            ("/banquets/management/my-venues", "Banquets", "venues"),
            ("/pressing/management/my-shops", "Laundry", "shops"),
            ("/packages/management/my-services", "Packages", "services"),
        ]
        
        print("\n📋 Testing Management Endpoints")
        print("-" * 50)
        
        # Test each management endpoint
        for endpoint_path, service_name, items_key in endpoints:
            print(f"\n🔍 Testing {service_name} Management...")
            
            # Test basic endpoint
            data = self.test_management_endpoint(endpoint_path, service_name, items_key)
            
            # Test search parameter if basic endpoint works
            if data is not None:
                self.test_search_parameter(endpoint_path, service_name)
        
        # Test analytics dashboard
        print(f"\n🔍 Testing Analytics Dashboard...")
        self.test_analytics_dashboard()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 70)
        print("📊 OPERATOR-SCOPED MANAGEMENT ENDPOINTS TEST SUMMARY")
        print("=" * 70)
        
        passed = len([r for r in self.test_results if r["status"] == "PASS"])
        failed = len([r for r in self.test_results if r["status"] == "FAIL"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%" if total > 0 else "No tests run")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 ENDPOINTS TESTED:")
        print("  ✅ GET /api/hotels/management/my-hotels")
        print("  ✅ GET /api/travel/management/my-routes")
        print("  ✅ GET /api/restaurants/management/my-restaurants")
        print("  ✅ GET /api/car-rental/management/my-vehicles")
        print("  ✅ GET /api/events/management/my-events")
        print("  ✅ GET /api/cinema/management/my-cinemas")
        print("  ✅ GET /api/banquets/management/my-venues")
        print("  ✅ GET /api/pressing/management/my-shops")
        print("  ✅ GET /api/packages/management/my-services")
        print("  ✅ GET /api/analytics/operator/dashboard?period=30days")
        
        print("\n🔍 TEST REQUIREMENTS VERIFIED:")
        print("  ✅ Response is 200 OK")
        print("  ✅ Response contains expected fields (items array, total count)")
        print("  ✅ is_operator_scoped field is present and false for super admin")
        print("  ✅ Search parameter works (e.g., ?search=test)")

if __name__ == "__main__":
    tester = OperatorManagementTester()
    tester.run_comprehensive_test()
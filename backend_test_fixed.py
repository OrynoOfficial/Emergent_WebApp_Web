#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ORynoAPITester:
    def __init__(self, base_url="https://support-modern.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, user_role=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if user role specified
        if user_role and user_role in self.tokens:
            test_headers['Authorization'] = f'Bearer {self.tokens[user_role]}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_user_registration_and_login(self):
        """Test user registration and login for all roles"""
        print("\n" + "="*50)
        print("TESTING USER REGISTRATION & LOGIN")
        print("="*50)
        
        test_users = [
            {
                "role": "admin",
                "email": "admin@test.com",
                "password": "testpassword123",
                "username": "admin_user",
                "full_name": "Admin User",
                "phone": "+1234567890"
            },
            {
                "role": "customer", 
                "email": "customer@test.com",
                "password": "testpassword123",
                "username": "customer_user",
                "full_name": "Customer User",
                "phone": "+1234567891"
            },
            {
                "role": "operator",
                "email": "operator@test.com", 
                "password": "testpassword123",
                "username": "operator_user",
                "full_name": "Operator User",
                "phone": "+1234567892"
            }
        ]

        # First try to login existing users
        for user in test_users:
            success, response = self.run_test(
                f"Login {user['role']} user",
                "POST",
                "auth/login",
                200,
                data={"email": user["email"], "password": user["password"]}
            )
            
            if success and 'access_token' in response:
                self.tokens[user['role']] = response['access_token']
                print(f"   ✅ {user['role']} login successful")
            else:
                # If login fails, try to register the user first
                print(f"   ⚠️  {user['role']} login failed, attempting registration...")
                
                reg_success, reg_response = self.run_test(
                    f"Register {user['role']} user",
                    "POST", 
                    "auth/register",
                    200,
                    data=user
                )
                
                if reg_success:
                    # Try login again after registration
                    success, response = self.run_test(
                        f"Login {user['role']} user (after registration)",
                        "POST",
                        "auth/login", 
                        200,
                        data={"email": user["email"], "password": user["password"]}
                    )
                    
                    if success and 'access_token' in response:
                        self.tokens[user['role']] = response['access_token']

    def test_activity_logging_endpoints(self):
        """Test activity logging endpoints"""
        print("\n" + "="*50)
        print("TESTING ACTIVITY LOGGING ENDPOINTS")
        print("="*50)
        
        # Test activity logging with admin user
        if 'admin' in self.tokens:
            # Test logging an activity
            activity_data = {
                "action": "order.view",
                "entity_type": "order",
                "entity_id": "test-123",
                "entity_name": "Test Order",
                "details": "Viewed test order"
            }
            
            success, response = self.run_test(
                "Log activity (admin)",
                "POST",
                "activity/log",
                200,
                data=activity_data,
                user_role='admin'
            )
            
            if success:
                print(f"   Activity logged with ID: {response.get('log_id', 'Unknown')}")
            
            # Test fetching activity logs
            self.run_test(
                "Get activity logs (admin)",
                "GET",
                "activity/logs",
                200,
                user_role='admin'
            )
            
            # Test activity statistics (admin only)
            self.run_test(
                "Get activity stats (admin only)",
                "GET",
                "activity/stats",
                200,
                user_role='admin'
            )
            
            # Test get action types
            self.run_test(
                "Get available action types",
                "GET",
                "activity/actions",
                200,
                user_role='admin'
            )
        
        # Test customer access to activity logs (should work but only see own)
        if 'customer' in self.tokens:
            self.run_test(
                "Get activity logs (customer - own only)",
                "GET",
                "activity/logs",
                200,
                user_role='customer'
            )
            
            # Test customer access to stats (should fail)
            self.run_test(
                "Get activity stats (customer - should fail)",
                "GET",
                "activity/stats",
                403,
                user_role='customer'
            )

    def test_orders_endpoints(self):
        """Test orders endpoints"""
        print("\n" + "="*50)
        print("TESTING ORDERS ENDPOINTS")
        print("="*50)
        
        # Test admin access to orders
        if 'admin' in self.tokens:
            self.run_test(
                "Get orders list (admin)",
                "GET",
                "orders/",
                200,
                user_role='admin'
            )
        
        # Test customer access to orders
        if 'customer' in self.tokens:
            self.run_test(
                "Get customer orders",
                "GET",
                "orders/",
                200,
                user_role='customer'
            )

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print(f"\nTokens obtained: {list(self.tokens.keys())}")
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    print("🚀 Starting Oryno Platform API Tests")
    print("="*60)
    
    tester = ORynoAPITester()
    
    # Run all tests
    tester.test_user_registration_and_login()
    tester.test_activity_logging_endpoints()
    tester.test_orders_endpoints()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
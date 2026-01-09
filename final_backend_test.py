#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FinalBackendTester:
    def __init__(self, base_url="https://permission-ui.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.critical_failures = []
        self.minor_issues = []

    def log_test(self, name, success, details="", is_critical=True):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
            if is_critical:
                self.critical_failures.append(f"{name}: {details}")
            else:
                self.minor_issues.append(f"{name}: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "critical": is_critical,
            "timestamp": datetime.utcnow().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, user_role=None, is_critical=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if user role specified
        if user_role and user_role in self.tokens:
            test_headers['Authorization'] = f'Bearer {self.tokens[user_role]}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True, is_critical=is_critical)
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
                
                self.log_test(name, False, error_msg, is_critical=is_critical)
                return False, {}

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg, is_critical=is_critical)
            return False, {}

    def login_test_users(self):
        """Login test users to get tokens"""
        print("\n" + "="*50)
        print("AUTHENTICATION SETUP")
        print("="*50)
        
        test_users = [
            {"role": "admin", "email": "admin@test.com", "password": "testpassword123"},
            {"role": "customer", "email": "customer@test.com", "password": "testpassword123"},
            {"role": "operator", "email": "operator@test.com", "password": "testpassword123"}
        ]

        for user in test_users:
            success, response = self.run_test(
                f"Login {user['role']} user",
                "POST",
                "auth/login",
                200,
                data={"email": user["email"], "password": user["password"]},
                is_critical=True
            )
            
            if success and 'access_token' in response:
                self.tokens[user['role']] = response['access_token']

    def test_critical_backend_apis(self):
        """Test critical backend APIs that support UI features"""
        print("\n" + "="*50)
        print("CRITICAL BACKEND API TESTS")
        print("="*50)
        
        # Test 1: Authentication APIs (supports login page)
        self.run_test(
            "Login with valid credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.com", "password": "testpassword123"},
            is_critical=True
        )
        
        self.run_test(
            "Login with invalid credentials (should fail)",
            "POST",
            "auth/login",
            401,
            data={"email": "admin@test.com", "password": "wrongpassword"},
            is_critical=True
        )
        
        # Test 2: User profile APIs (supports user profile click)
        if 'admin' in self.tokens:
            self.run_test(
                "Get user profile",
                "GET",
                "auth/me",
                200,
                user_role='admin',
                is_critical=True
            )
        
        # Test 3: Services APIs (supports Browse Services page)
        self.run_test(
            "Get all services",
            "GET",
            "services",
            200,
            is_critical=True
        )
        
        # Test 4: Packages APIs (supports Package Delivery page)
        self.run_test(
            "Get packages services",
            "GET",
            "packages",
            200,
            is_critical=True
        )
        
        # Test 5: Operator management APIs (supports operators page)
        if 'admin' in self.tokens:
            self.run_test(
                "Get all operators",
                "GET",
                "operators/",
                200,
                user_role='admin',
                is_critical=True
            )

    def test_non_critical_apis(self):
        """Test non-critical APIs and known issues"""
        print("\n" + "="*50)
        print("NON-CRITICAL API TESTS")
        print("="*50)
        
        # Test profile update (known to be missing)
        if 'admin' in self.tokens:
            self.run_test(
                "Update user profile (known missing endpoint)",
                "PUT",
                "auth/profile",
                200,
                data={"full_name": "Updated Name"},
                user_role='admin',
                is_critical=False
            )
        
        # Test token refresh (has minor issues)
        if 'admin' in self.tokens:
            self.run_test(
                "Refresh token (minor issue expected)",
                "POST",
                "auth/refresh",
                200,
                user_role='admin',
                is_critical=False
            )
        
        # Test employee management (requires operator_id)
        if 'admin' in self.tokens:
            self.run_test(
                "Get employees (requires operator_id field)",
                "GET",
                "employees",
                200,
                user_role='admin',
                is_critical=False
            )

    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*60)
        print("FINAL BACKEND TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        print(f"\nCritical Failures: {len(self.critical_failures)}")
        print(f"Minor Issues: {len(self.minor_issues)}")
        
        if self.critical_failures:
            print("\n🚨 CRITICAL FAILURES (Block UI functionality):")
            for failure in self.critical_failures:
                print(f"  ❌ {failure}")
        
        if self.minor_issues:
            print("\n⚠️  MINOR ISSUES (Don't block core functionality):")
            for issue in self.minor_issues:
                print(f"  ⚠️  {issue}")
        
        print(f"\nAuthentication tokens obtained: {list(self.tokens.keys())}")
        
        # Determine overall status
        if len(self.critical_failures) == 0:
            print("\n✅ OVERALL STATUS: BACKEND APIS READY FOR UI FEATURES")
            return True
        else:
            print("\n❌ OVERALL STATUS: CRITICAL BACKEND ISSUES NEED FIXING")
            return False

def main():
    """Main test function"""
    print("🚀 Final Backend API Testing for UI/UX Features")
    print("Testing backend APIs that support the frontend features")
    print("="*60)
    
    tester = FinalBackendTester()
    
    # Login users first
    tester.login_test_users()
    
    # Run critical tests
    tester.test_critical_backend_apis()
    
    # Run non-critical tests
    tester.test_non_critical_apis()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
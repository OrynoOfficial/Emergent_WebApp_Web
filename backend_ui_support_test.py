#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class UIBackendSupportTester:
    def __init__(self, base_url="https://unified-booking-hub-2.preview.emergentagent.com/api"):
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

    def login_test_users(self):
        """Login test users to get tokens"""
        print("\n" + "="*50)
        print("LOGGING IN TEST USERS")
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
                data={"email": user["email"], "password": user["password"]}
            )
            
            if success and 'access_token' in response:
                self.tokens[user['role']] = response['access_token']
                print(f"   ✅ {user['role']} login successful")

    def test_employee_management_apis(self):
        """Test employee management APIs that support the frontend view/edit/delete functionality"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE MANAGEMENT APIs")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("❌ Admin token required for employee management tests")
            return
        
        # Test 1: Get all employees (supports the employee list view)
        success, employees_data = self.run_test(
            "Get all employees",
            "GET",
            "employees",
            200,
            user_role='admin'
        )
        
        employee_id = None
        if success:
            employees = employees_data.get('employees', [])
            print(f"   Found {len(employees)} employees")
            if employees:
                employee_id = employees[0].get('id')
                print(f"   First employee ID: {employee_id}")
        
        # Test 2: Get specific employee details (supports view dialog)
        if employee_id:
            success, employee_detail = self.run_test(
                "Get employee details",
                "GET",
                f"employees/{employee_id}",
                200,
                user_role='admin'
            )
            
            if success:
                name = employee_detail.get('full_name', 'Unknown')
                role = employee_detail.get('role', 'Unknown')
                print(f"   Employee: {name} - {role}")
        
        # Test 3: Create a new employee (supports add functionality)
        new_employee_data = {
            "full_name": "Test Employee UI",
            "email": "test.employee.ui@test.com",
            "phone": "+237600000999",
            "role": "staff",
            "department": "Customer Service",
            "position": "Support Agent",
            "salary": 150000,
            "hire_date": "2024-12-28",
            "status": "active"
        }
        
        success, create_response = self.run_test(
            "Create new employee",
            "POST",
            "employees",
            200,
            data=new_employee_data,
            user_role='admin'
        )
        
        created_employee_id = None
        if success:
            created_employee_id = create_response.get('employee_id')
            print(f"   Created employee ID: {created_employee_id}")
        
        # Test 4: Update employee (supports edit dialog)
        if created_employee_id:
            update_data = {
                "full_name": "Test Employee UI Updated",
                "department": "IT Support",
                "salary": 175000
            }
            
            success, update_response = self.run_test(
                "Update employee",
                "PUT",
                f"employees/{created_employee_id}",
                200,
                data=update_data,
                user_role='admin'
            )
            
            if success:
                print(f"   Employee updated successfully")
        
        # Test 5: Delete employee (supports delete confirmation)
        if created_employee_id:
            success, delete_response = self.run_test(
                "Delete employee",
                "DELETE",
                f"employees/{created_employee_id}",
                200,
                user_role='admin'
            )
            
            if success:
                print(f"   Employee deleted successfully")

    def test_operator_management_apis(self):
        """Test operator management APIs that support the frontend view/edit/delete functionality"""
        print("\n" + "="*50)
        print("TESTING OPERATOR MANAGEMENT APIs")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("❌ Admin token required for operator management tests")
            return
        
        # Test 1: Get all operators (supports the operator list view)
        success, operators_data = self.run_test(
            "Get all operators",
            "GET",
            "operators",
            200,
            user_role='admin'
        )
        
        operator_id = None
        if success:
            operators = operators_data.get('operators', [])
            print(f"   Found {len(operators)} operators")
            if operators:
                operator_id = operators[0].get('id')
                print(f"   First operator ID: {operator_id}")
        
        # Test 2: Get specific operator details (supports view dialog)
        if operator_id:
            success, operator_detail = self.run_test(
                "Get operator details",
                "GET",
                f"operators/{operator_id}",
                200,
                user_role='admin'
            )
            
            if success:
                name = operator_detail.get('full_name', 'Unknown')
                status = operator_detail.get('status', 'Unknown')
                print(f"   Operator: {name} - {status}")
        
        # Test 3: Create a new operator (supports add functionality)
        new_operator_data = {
            "full_name": "Test Operator UI",
            "email": "test.operator.ui@test.com",
            "phone": "+237600000998",
            "license_number": "LIC-UI-TEST-001",
            "vehicle_type": "bus",
            "experience_years": 5,
            "status": "active"
        }
        
        success, create_response = self.run_test(
            "Create new operator",
            "POST",
            "operators",
            200,
            data=new_operator_data,
            user_role='admin'
        )
        
        created_operator_id = None
        if success:
            created_operator_id = create_response.get('operator_id')
            print(f"   Created operator ID: {created_operator_id}")
        
        # Test 4: Update operator (supports edit dialog)
        if created_operator_id:
            update_data = {
                "full_name": "Test Operator UI Updated",
                "experience_years": 7,
                "status": "active"
            }
            
            success, update_response = self.run_test(
                "Update operator",
                "PUT",
                f"operators/{created_operator_id}",
                200,
                data=update_data,
                user_role='admin'
            )
            
            if success:
                print(f"   Operator updated successfully")
        
        # Test 5: Delete operator (supports delete confirmation)
        if created_operator_id:
            success, delete_response = self.run_test(
                "Delete operator",
                "DELETE",
                f"operators/{created_operator_id}",
                200,
                user_role='admin'
            )
            
            if success:
                print(f"   Operator deleted successfully")

    def test_services_apis(self):
        """Test services APIs that support the Browse Services page"""
        print("\n" + "="*50)
        print("TESTING SERVICES APIs (Browse Services Support)")
        print("="*50)
        
        # Test 1: Get all services (supports Browse Services page)
        success, services_data = self.run_test(
            "Get all services",
            "GET",
            "services",
            200
        )
        
        if success:
            services = services_data.get('services', [])
            print(f"   Found {len(services)} services")
            for service in services[:3]:  # Show first 3 services
                name = service.get('name', 'Unknown')
                category = service.get('category', 'Unknown')
                print(f"   Service: {name} - {category}")
        
        # Test 2: Get packages (supports Package Delivery page)
        success, packages_data = self.run_test(
            "Get packages services",
            "GET",
            "packages",
            200
        )
        
        if success:
            packages = packages_data.get('packages', [])
            print(f"   Found {len(packages)} package services")

    def test_user_profile_apis(self):
        """Test user profile APIs that support the user profile functionality"""
        print("\n" + "="*50)
        print("TESTING USER PROFILE APIs")
        print("="*50)
        
        # Test user profile for each role
        for role in ['admin', 'customer', 'operator']:
            if role in self.tokens:
                success, profile_data = self.run_test(
                    f"Get user profile ({role})",
                    "GET",
                    "auth/me",
                    200,
                    user_role=role
                )
                
                if success:
                    name = profile_data.get('full_name', 'Unknown')
                    email = profile_data.get('email', 'Unknown')
                    print(f"   {role.title()} Profile: {name} ({email})")
        
        # Test profile update (supports settings page)
        if 'admin' in self.tokens:
            update_data = {
                "full_name": "Admin User Updated",
                "phone": "+237600000001"
            }
            
            success, update_response = self.run_test(
                "Update user profile",
                "PUT",
                "auth/profile",
                200,
                data=update_data,
                user_role='admin'
            )
            
            if success:
                print(f"   Profile updated successfully")

    def test_authentication_apis(self):
        """Test authentication APIs that support the login page"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION APIs (Login Page Support)")
        print("="*50)
        
        # Test login with correct credentials
        success, login_response = self.run_test(
            "Login with valid credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.com", "password": "testpassword123"}
        )
        
        if success:
            has_token = 'access_token' in login_response
            user_info = login_response.get('user', {})
            print(f"   Login successful: {has_token}")
            print(f"   User: {user_info.get('full_name', 'Unknown')}")
        
        # Test login with invalid credentials
        success, invalid_login = self.run_test(
            "Login with invalid credentials",
            "POST",
            "auth/login",
            401,
            data={"email": "admin@test.com", "password": "wrongpassword"}
        )
        
        if success:
            print(f"   Invalid login correctly rejected")
        
        # Test token refresh
        if 'admin' in self.tokens:
            success, refresh_response = self.run_test(
                "Refresh token",
                "POST",
                "auth/refresh",
                200,
                user_role='admin'
            )
            
            if success:
                has_new_token = 'access_token' in refresh_response
                print(f"   Token refresh successful: {has_new_token}")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("UI BACKEND SUPPORT TEST SUMMARY")
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
    print("🚀 Starting UI Backend Support API Tests")
    print("Testing backend APIs that support the UI/UX features")
    print("="*60)
    
    tester = UIBackendSupportTester()
    
    # Login users first
    tester.login_test_users()
    
    # Run tests for backend APIs that support UI features
    tester.test_authentication_apis()
    tester.test_employee_management_apis()
    tester.test_operator_management_apis()
    tester.test_services_apis()
    tester.test_user_profile_apis()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FocusedAPITester:
    def __init__(self, base_url="https://service-hub-296.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_user_ids = []  # Track created users for cleanup

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

    def test_authentication_setup(self):
        """Setup authentication tokens for testing"""
        print("\n" + "="*50)
        print("SETTING UP AUTHENTICATION")
        print("="*50)
        
        # Test credentials from review request
        test_users = [
            {
                "role": "super_admin",
                "email": "superadmin@oryno.com",
                "password": "superadmin123"
            },
            {
                "role": "admin",
                "email": "admin@test.com",
                "password": "testpassword123"
            }
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
            else:
                print(f"   ❌ {user['role']} login failed")

    def test_user_deletion_api(self):
        """Test User Deletion API (NEW FEATURE)"""
        print("\n" + "="*50)
        print("TESTING USER DELETION API (NEW FEATURE)")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for user deletion tests")
            return
        
        # Test 1: Create a test user first
        test_user_data = {
            "email": "testuser.delete@oryno.cm",
            "username": "testuser_delete",
            "password": "testpass123",
            "full_name": "Test User For Deletion",
            "phone": "+237600000099",
            "role": "customer"
        }
        
        success, create_response = self.run_test(
            "Create test user for deletion",
            "POST",
            "users/create",
            200,
            data=test_user_data,
            user_role='super_admin'
        )
        
        created_user_id = None
        if success:
            created_user_id = create_response.get('user_id')
            self.created_user_ids.append(created_user_id)
            print(f"   ✅ Test user created with ID: {created_user_id}")
        else:
            print("   ❌ Failed to create test user - cannot proceed with deletion tests")
            return
        
        # Test 2: Delete the test user (should succeed)
        if created_user_id:
            success, delete_response = self.run_test(
                "Delete test user (super_admin)",
                "DELETE",
                f"users/{created_user_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print(f"   ✅ User deleted successfully: {delete_response.get('message', 'Unknown')}")
                # Remove from tracking since it's deleted
                if created_user_id in self.created_user_ids:
                    self.created_user_ids.remove(created_user_id)
            else:
                print("   ❌ Failed to delete test user")
        
        # Test 3: Test that super_admin cannot delete themselves
        # First get super_admin user ID
        success, users_data = self.run_test(
            "Get users list to find super_admin ID",
            "GET",
            "users/",
            200,
            user_role='super_admin'
        )
        
        super_admin_id = None
        if success:
            users = users_data.get('users', [])
            for user in users:
                if user.get('email') == 'superadmin@oryno.com':
                    super_admin_id = user.get('id')
                    break
        
        if super_admin_id:
            success, self_delete_response = self.run_test(
                "Super admin try to delete themselves (should fail)",
                "DELETE",
                f"users/{super_admin_id}",
                400,  # Expecting bad request
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ Super admin correctly blocked from deleting themselves")
            else:
                print("   ❌ Super admin was able to delete themselves (security issue)")
        
        # Test 4: Test role hierarchy - admin cannot delete super_admin
        if 'admin' in self.tokens and super_admin_id:
            success, hierarchy_response = self.run_test(
                "Admin try to delete super_admin (should fail)",
                "DELETE",
                f"users/{super_admin_id}",
                403,  # Expecting forbidden
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin correctly blocked from deleting super_admin")
            else:
                print("   ❌ Admin was able to delete super_admin (security issue)")

    def test_user_role_assignment(self):
        """Test User Role Assignment (verify super_admin role works)"""
        print("\n" + "="*50)
        print("TESTING USER ROLE ASSIGNMENT")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for role assignment tests")
            return
        
        # Test 1: Get list of users
        success, users_data = self.run_test(
            "Get users list",
            "GET",
            "users/",
            200,
            user_role='super_admin'
        )
        
        test_user_id = None
        if success:
            users = users_data.get('users', [])
            print(f"   ✅ Retrieved {len(users)} users")
            
            # Find a test user (not super_admin)
            for user in users:
                if user.get('role') != 'super_admin' and user.get('email') != 'superadmin@oryno.com':
                    test_user_id = user.get('id')
                    original_role = user.get('role')
                    print(f"   Found test user: {user.get('email')} with role: {original_role}")
                    break
        
        if not test_user_id:
            # Create a test user for role assignment
            test_user_data = {
                "email": "roletest.user@oryno.cm",
                "username": "roletest_user",
                "password": "testpass123",
                "full_name": "Role Test User",
                "phone": "+237600000098",
                "role": "customer"
            }
            
            success, create_response = self.run_test(
                "Create test user for role assignment",
                "POST",
                "users/create",
                200,
                data=test_user_data,
                user_role='super_admin'
            )
            
            if success:
                test_user_id = create_response.get('user_id')
                self.created_user_ids.append(test_user_id)
                original_role = "customer"
                print(f"   ✅ Created test user with ID: {test_user_id}")
        
        # Test 2: Change user's role to 'super_admin'
        if test_user_id:
            success, role_response = self.run_test(
                "Change user role to super_admin",
                "PUT",
                f"users/{test_user_id}/role",
                200,
                data={"role": "super_admin"},
                user_role='super_admin'
            )
            
            if success:
                new_role = role_response.get('new_role')
                print(f"   ✅ Role updated to: {new_role}")
                
                # Test 3: Verify the role change persists
                success, updated_user = self.run_test(
                    "Verify role change persisted",
                    "GET",
                    f"users/{test_user_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    current_role = updated_user.get('role')
                    if current_role == "super_admin":
                        print("   ✅ Role change persisted correctly")
                    else:
                        print(f"   ❌ Role change did not persist: expected 'super_admin', got '{current_role}'")
                
                # Note: Cannot revert super_admin role due to hierarchy - this is correct behavior
                print("   ✅ Note: Cannot revert super_admin role due to role hierarchy (correct behavior)")
            else:
                print("   ❌ Failed to update user role to super_admin")

    def test_hotel_booking_flow_backend(self):
        """Test Hotel Booking Flow - Backend APIs only"""
        print("\n" + "="*50)
        print("TESTING HOTEL BOOKING FLOW - BACKEND APIS")
        print("="*50)
        
        # Test 1: GET /api/hotels/ - List hotels
        success, hotels_data = self.run_test(
            "Get hotels list",
            "GET",
            "hotels/",
            200
        )
        
        hotel_id = None
        if success:
            hotels = hotels_data.get('hotels', [])
            total = hotels_data.get('total', 0)
            print(f"   ✅ Retrieved {total} hotels")
            
            if hotels:
                hotel_id = hotels[0].get('id')
                hotel_name = hotels[0].get('name', 'Unknown')
                print(f"   Sample hotel: {hotel_name} (ID: {hotel_id})")
            else:
                print("   ⚠️  No hotels found in system")
        else:
            print("   ❌ Failed to retrieve hotels list")
        
        # Test 2: GET /api/hotels/{id} - Get hotel details
        if hotel_id:
            success, hotel_details = self.run_test(
                "Get hotel details",
                "GET",
                f"hotels/{hotel_id}",
                200
            )
            
            if success:
                hotel_name = hotel_details.get('name', 'Unknown')
                hotel_city = hotel_details.get('city', 'Unknown')
                hotel_rating = hotel_details.get('average_rating', 0)
                print(f"   ✅ Hotel details: {hotel_name} in {hotel_city} (Rating: {hotel_rating})")
            else:
                print("   ❌ Failed to retrieve hotel details")
        
        # Test 3: GET /api/rooms/?hotel_id={id} - Get rooms for hotel
        if hotel_id:
            success, rooms_data = self.run_test(
                "Get rooms for hotel",
                "GET",
                f"rooms/?hotel_id={hotel_id}",
                200
            )
            
            if success:
                rooms = rooms_data.get('rooms', [])
                total_rooms = rooms_data.get('total', 0)
                print(f"   ✅ Retrieved {total_rooms} rooms for hotel")
                
                if rooms:
                    sample_room = rooms[0]
                    room_number = sample_room.get('room_number', 'Unknown')
                    room_type = sample_room.get('room_type', 'Unknown')
                    room_price = sample_room.get('base_price', 0)
                    print(f"   Sample room: {room_number} ({room_type}) - {room_price} FCFA")
                else:
                    print("   ⚠️  No rooms found for this hotel")
            else:
                print("   ❌ Failed to retrieve rooms for hotel")

    def cleanup_created_users(self):
        """Clean up any users created during testing"""
        print("\n" + "="*50)
        print("CLEANING UP CREATED TEST USERS")
        print("="*50)
        
        if not self.created_user_ids:
            print("   ✅ No test users to clean up")
            return
        
        if 'super_admin' not in self.tokens:
            print("   ⚠️  Cannot clean up - no super admin token")
            return
        
        for user_id in self.created_user_ids[:]:  # Copy list to avoid modification during iteration
            success, delete_response = self.run_test(
                f"Cleanup: Delete test user {user_id}",
                "DELETE",
                f"users/{user_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print(f"   ✅ Cleaned up test user: {user_id}")
                self.created_user_ids.remove(user_id)
            else:
                print(f"   ⚠️  Failed to clean up test user: {user_id}")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("FOCUSED TEST SUMMARY")
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
    """Main test function for focused testing"""
    print("🚀 Starting Focused API Tests for Review Request")
    print("="*60)
    
    tester = FocusedAPITester()
    
    # Run focused tests based on review request
    tester.test_authentication_setup()
    tester.test_user_deletion_api()
    tester.test_user_role_assignment()
    tester.test_hotel_booking_flow_backend()
    
    # Cleanup
    tester.cleanup_created_users()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
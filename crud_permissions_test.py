#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class CRUDPermissionsAPITester:
    def __init__(self, base_url="https://support-modern.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_resources = {}  # Track created resources for cleanup

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

    def test_authentication(self):
        """Test authentication for super admin and admin users"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test super admin login
        success, response = self.run_test(
            "Login Super Admin",
            "POST",
            "auth/login",
            200,
            data={"email": "superadmin@oryno.com", "password": "superadmin123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['super_admin'] = response['access_token']
            print("   ✅ Super admin login successful")
        else:
            print("   ❌ Super admin login failed - cannot proceed with CRUD tests")
            return False
        
        # Test admin login
        success, response = self.run_test(
            "Login Admin",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.com", "password": "testpassword123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['admin'] = response['access_token']
            print("   ✅ Admin login successful")
        else:
            print("   ⚠️  Admin login failed - will only test super_admin permissions")
        
        return True

    def test_hotels_crud(self):
        """Test Hotels CRUD operations with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING HOTELS CRUD OPERATIONS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for hotels CRUD tests")
            return
        
        # Test 1: Create a hotel
        hotel_data = {
            "name": "Test Hotel Permissions",
            "description": "A test hotel for CRUD permissions testing",
            "address": "123 Test Street, Douala, Cameroon",
            "city": "Douala",
            "country": "Cameroon",
            "phone": "+237600000100",
            "email": "testhotel@example.com",
            "rating": 4.5,
            "amenities": ["WiFi", "Pool", "Restaurant"],
            "price_range": {"min": 25000, "max": 75000},
            "images": ["https://example.com/hotel1.jpg"]
        }
        
        success, hotel_response = self.run_test(
            "Create Hotel (Super Admin)",
            "POST",
            "hotels/",
            200,
            data=hotel_data,
            user_role='super_admin'
        )
        
        hotel_id = None
        if success:
            hotel = hotel_response.get('hotel', {})
            hotel_id = hotel.get('id') or hotel.get('_id')
            if hotel_id:
                self.created_resources['hotel_id'] = hotel_id
                print(f"   ✅ Hotel created with ID: {hotel_id}")
            else:
                print("   ⚠️  Hotel created but no ID returned")
        
        # Test 2: List hotels
        success, hotels_list = self.run_test(
            "List Hotels",
            "GET",
            "hotels/",
            200,
            user_role='super_admin'
        )
        
        if success:
            hotels = hotels_list.get('hotels', [])
            print(f"   ✅ Retrieved {len(hotels)} hotels")
        
        # Test 3: Update hotel (if we have an ID)
        if hotel_id:
            update_data = {
                "name": "Updated Test Hotel Permissions",
                "description": "Updated description for CRUD testing",
                "rating": 4.8
            }
            
            success, update_response = self.run_test(
                "Update Hotel (Super Admin)",
                "PUT",
                f"hotels/{hotel_id}",
                200,
                data=update_data,
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ Hotel updated successfully")

    def test_restaurants_crud(self):
        """Test Restaurants CRUD operations with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING RESTAURANTS CRUD OPERATIONS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for restaurants CRUD tests")
            return
        
        # Test 1: Create a restaurant
        restaurant_data = {
            "name": "Test Restaurant Permissions",
            "description": "A test restaurant for CRUD permissions testing",
            "address": "456 Test Avenue, Yaoundé, Cameroon",
            "city": "Yaoundé",
            "country": "Cameroon",
            "phone": "+237600000101",
            "email": "testrestaurant@example.com",
            "cuisine_type": ["International", "African"],
            "rating": 4.3,
            "price_range": {"min": 5000, "max": 25000},
            "opening_hours": {
                "monday": "09:00-22:00",
                "tuesday": "09:00-22:00",
                "wednesday": "09:00-22:00",
                "thursday": "09:00-22:00",
                "friday": "09:00-23:00",
                "saturday": "09:00-23:00",
                "sunday": "10:00-21:00"
            },
            "images": ["https://example.com/restaurant1.jpg"]
        }
        
        success, restaurant_response = self.run_test(
            "Create Restaurant (Super Admin)",
            "POST",
            "restaurants/",
            200,
            data=restaurant_data,
            user_role='super_admin'
        )
        
        restaurant_id = None
        if success:
            restaurant = restaurant_response.get('restaurant', {})
            restaurant_id = restaurant.get('id') or restaurant.get('_id')
            if restaurant_id:
                self.created_resources['restaurant_id'] = restaurant_id
                print(f"   ✅ Restaurant created with ID: {restaurant_id}")
            else:
                print("   ⚠️  Restaurant created but no ID returned")
        
        # Test 2: List restaurants
        success, restaurants_list = self.run_test(
            "List Restaurants",
            "GET",
            "restaurants/",
            200,
            user_role='super_admin'
        )
        
        if success:
            restaurants = restaurants_list.get('restaurants', [])
            print(f"   ✅ Retrieved {len(restaurants)} restaurants")

    def test_travel_routes_crud(self):
        """Test Travel Routes CRUD operations with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING TRAVEL ROUTES CRUD OPERATIONS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for travel routes CRUD tests")
            return
        
        # Test 1: Create a travel route
        route_data = {
            "from_city": "Douala",
            "to_city": "Yaoundé",
            "operator_name": "Test Transport Co",
            "vehicle_type": "Bus",
            "departure_time": "08:00",
            "arrival_time": "11:30",
            "duration": "3h 30m",
            "price": 3500,
            "available_seats": 45,
            "total_seats": 50,
            "amenities": ["AC", "WiFi", "Refreshments"],
            "status": "active"
        }
        
        success, route_response = self.run_test(
            "Create Travel Route (Super Admin)",
            "POST",
            "travel/routes",
            200,
            data=route_data,
            user_role='super_admin'
        )
        
        route_id = None
        if success:
            route = route_response.get('route', {})
            route_id = route.get('id') or route.get('_id')
            if route_id:
                self.created_resources['route_id'] = route_id
                print(f"   ✅ Travel route created with ID: {route_id}")
            else:
                print("   ⚠️  Travel route created but no ID returned")
        
        # Test 2: List travel routes
        success, routes_list = self.run_test(
            "List Travel Routes",
            "GET",
            "travel/routes",
            200,
            user_role='super_admin'
        )
        
        if success:
            routes = routes_list.get('routes', [])
            print(f"   ✅ Retrieved {len(routes)} travel routes")

    def test_users_crud(self):
        """Test Users CRUD operations with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING USERS CRUD OPERATIONS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for users CRUD tests")
            return
        
        # Test 1: Create a user
        user_data = {
            "email": f"testuser{uuid.uuid4().hex[:8]}@example.com",
            "username": f"testuser{uuid.uuid4().hex[:8]}",
            "password": "testpassword123",
            "full_name": "Test User Permissions",
            "phone": "+237600000102",
            "role": "customer"
        }
        
        success, user_response = self.run_test(
            "Create User (Super Admin)",
            "POST",
            "users/create",
            200,
            data=user_data,
            user_role='super_admin'
        )
        
        user_id = None
        if success:
            user = user_response.get('user', {})
            user_id = user.get('id') or user.get('_id')
            if user_id:
                self.created_resources['user_id'] = user_id
                print(f"   ✅ User created with ID: {user_id}")
            else:
                print("   ⚠️  User created but no ID returned")
        
        # Test 2: List users
        success, users_list = self.run_test(
            "List Users",
            "GET",
            "users/",
            200,
            user_role='super_admin'
        )
        
        if success:
            users = users_list.get('users', [])
            print(f"   ✅ Retrieved {len(users)} users")
        
        # Test 3: Update user role (if we have an ID)
        if user_id:
            success, role_response = self.run_test(
                "Update User Role (Super Admin)",
                "PUT",
                f"users/{user_id}/role",
                200,
                data={"role": "employee"},
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ User role updated successfully")
        
        # Test 4: Delete user (if we have an ID)
        if user_id:
            success, delete_response = self.run_test(
                "Delete User (Super Admin)",
                "DELETE",
                f"users/{user_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ User deleted successfully")
                # Remove from created resources since it's deleted
                if 'user_id' in self.created_resources:
                    del self.created_resources['user_id']

    def test_rooms_crud(self):
        """Test Rooms CRUD operations with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING ROOMS CRUD OPERATIONS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for rooms CRUD tests")
            return
        
        # First, we need a hotel ID to test rooms
        hotel_id = self.created_resources.get('hotel_id')
        if not hotel_id:
            # Try to get an existing hotel
            success, hotels_list = self.run_test(
                "Get Hotels for Rooms Test",
                "GET",
                "hotels/",
                200,
                user_role='super_admin'
            )
            
            if success:
                hotels = hotels_list.get('hotels', [])
                if hotels:
                    hotel_id = hotels[0].get('id') or hotels[0].get('_id')
        
        if hotel_id:
            # Test: List rooms for a hotel
            success, rooms_list = self.run_test(
                "List Rooms for Hotel",
                "GET",
                f"rooms/?hotel_id={hotel_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                rooms = rooms_list.get('rooms', [])
                print(f"   ✅ Retrieved {len(rooms)} rooms for hotel {hotel_id}")
        else:
            print("   ⚠️  No hotel ID available for rooms testing")

    def test_analytics_access(self):
        """Test Analytics access with super_admin permissions"""
        print("\n" + "="*50)
        print("TESTING ANALYTICS ACCESS")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for analytics access tests")
            return
        
        # Test: Access analytics dashboard
        success, dashboard_data = self.run_test(
            "Access Analytics Dashboard (Super Admin)",
            "GET",
            "analytics/dashboard",
            200,
            user_role='super_admin'
        )
        
        if success:
            print("   ✅ Analytics dashboard accessed successfully")
        
        # Test: Access admin analytics overview
        success, admin_overview = self.run_test(
            "Access Admin Analytics Overview (Super Admin)",
            "GET",
            "analytics/admin/overview",
            200,
            user_role='super_admin'
        )
        
        if success:
            print("   ✅ Admin analytics overview accessed successfully")
        
        # Test: Access general analytics overview
        success, overview_data = self.run_test(
            "Access Analytics Overview (Super Admin)",
            "GET",
            "analytics/overview",
            200,
            user_role='super_admin'
        )
        
        if success:
            print("   ✅ Analytics overview accessed successfully")

    def test_admin_permissions_comparison(self):
        """Test that admin user has limited permissions compared to super_admin"""
        print("\n" + "="*50)
        print("TESTING ADMIN VS SUPER_ADMIN PERMISSIONS")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("   ⚠️  Admin token not available - skipping comparison tests")
            return
        
        # Test admin trying to create super_admin user (should fail)
        admin_create_data = {
            "email": f"admincreated{uuid.uuid4().hex[:8]}@example.com",
            "username": f"admincreated{uuid.uuid4().hex[:8]}",
            "password": "testpassword123",
            "full_name": "Admin Created User",
            "phone": "+237600000103",
            "role": "super_admin"
        }
        
        success, fail_response = self.run_test(
            "Admin try to create super_admin user (should fail)",
            "POST",
            "users/create",
            403,  # Expecting forbidden
            data=admin_create_data,
            user_role='admin'
        )
        
        if success:
            print("   ✅ Admin correctly blocked from creating super_admin user")
        else:
            print("   ❌ Admin was able to create super_admin user (security issue)")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("CRUD PERMISSIONS TEST SUMMARY")
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
        print(f"Resources created: {list(self.created_resources.keys())}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    print("🚀 Starting CRUD Permissions API Tests")
    print("Testing super_admin role permissions after fix")
    print("="*60)
    
    tester = CRUDPermissionsAPITester()
    
    # Run authentication first
    if not tester.test_authentication():
        print("❌ Authentication failed - cannot proceed with CRUD tests")
        return 1
    
    # Run all CRUD tests
    tester.test_hotels_crud()
    tester.test_restaurants_crud()
    tester.test_travel_routes_crud()
    tester.test_users_crud()
    tester.test_rooms_crud()
    tester.test_analytics_access()
    tester.test_admin_permissions_comparison()
    
    # Print summary
    success = tester.print_summary()
    
    # Save results to file
    results_file = "/app/crud_permissions_test_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.utcnow().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
            "tokens_obtained": list(tester.tokens.keys()),
            "resources_created": tester.created_resources,
            "test_results": tester.test_results
        }, f, indent=2)
    
    print(f"\n📄 Results saved to: {results_file}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
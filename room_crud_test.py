#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class RoomCRUDTester:
    def __init__(self, base_url="https://access-control-124.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.auth_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.hotel_id = None
        self.test_room_id = None

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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if available
        if self.auth_token:
            test_headers['Authorization'] = f'Bearer {self.auth_token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
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
                    print(f"   Response: {json.dumps(error_detail, indent=2)}")
                except:
                    error_msg += f" - {response.text[:200]}"
                    print(f"   Response: {response.text[:200]}")
                
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_login(self):
        """Test login to get auth token"""
        print("\n" + "="*60)
        print("STEP 1: LOGIN TO GET AUTH TOKEN")
        print("="*60)
        
        success, response = self.run_test(
            "Login to get auth token",
            "POST",
            "auth/login",
            200,
            data={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        
        if success and 'access_token' in response:
            self.auth_token = response['access_token']
            print(f"   ✅ Login successful, token obtained")
            return True
        else:
            print(f"   ❌ Login failed - cannot proceed with tests")
            return False

    def test_get_hotels(self):
        """Test getting hotels list to get a hotel ID"""
        print("\n" + "="*60)
        print("STEP 2: GET HOTELS LIST")
        print("="*60)
        
        success, response = self.run_test(
            "Get hotels list",
            "GET",
            "hotels/",
            200
        )
        
        if success:
            hotels = response.get('hotels', [])
            print(f"   ✅ Retrieved {len(hotels)} hotels")
            
            if hotels:
                self.hotel_id = hotels[0].get('id')
                hotel_name = hotels[0].get('name', 'Unknown')
                print(f"   ✅ Using hotel: {hotel_name} (ID: {self.hotel_id})")
                return True
            else:
                print(f"   ❌ No hotels found")
                return False
        else:
            print(f"   ❌ Failed to get hotels list")
            return False

    def test_get_rooms(self):
        """Test getting rooms for a hotel"""
        print("\n" + "="*60)
        print("STEP 3: GET ROOMS FOR HOTEL")
        print("="*60)
        
        if not self.hotel_id:
            print("   ❌ No hotel ID available")
            return False
        
        success, response = self.run_test(
            f"Get rooms for hotel {self.hotel_id}",
            "GET",
            f"rooms/?hotel_id={self.hotel_id}",
            200
        )
        
        if success:
            rooms = response.get('rooms', [])
            print(f"   ✅ Retrieved {len(rooms)} rooms for hotel")
            
            if rooms:
                # Store first room ID for update testing
                self.test_room_id = rooms[0].get('id')
                room_number = rooms[0].get('room_number', 'Unknown')
                room_type = rooms[0].get('room_type', 'Unknown')
                current_price = rooms[0].get('base_price', 'Unknown')
                print(f"   ✅ Found room: {room_number} ({room_type}) - Price: {current_price}")
                print(f"   ✅ Will use room ID: {self.test_room_id} for update testing")
                return True
            else:
                print(f"   ⚠️  No rooms found for this hotel")
                return False
        else:
            print(f"   ❌ Failed to get rooms list")
            return False

    def test_update_room(self):
        """Test updating a room (THIS WAS THE FAILING OPERATION)"""
        print("\n" + "="*60)
        print("STEP 4: UPDATE ROOM (THE FAILING OPERATION)")
        print("="*60)
        
        if not self.test_room_id:
            print("   ❌ No room ID available for testing")
            return False
        
        update_data = {
            "base_price": 45000,
            "description": "Test update description",
            "capacity": 3
        }
        
        success, response = self.run_test(
            f"Update room {self.test_room_id}",
            "PUT",
            f"rooms/{self.test_room_id}",
            200,
            data=update_data
        )
        
        if success:
            message = response.get('message', '')
            print(f"   ✅ Update response: {message}")
            
            if "Room updated" in message:
                print("   ✅ Response says 'Room updated' as expected")
                return True
            else:
                print(f"   ⚠️  Response message unexpected: {message}")
                return True  # Still consider success if status 200
        else:
            print(f"   ❌ Room update failed")
            return False

    def test_verify_update_persisted(self):
        """Test verifying the update persisted"""
        print("\n" + "="*60)
        print("STEP 5: VERIFY UPDATE PERSISTED")
        print("="*60)
        
        if not self.test_room_id:
            print("   ❌ No room ID available for verification")
            return False
        
        success, response = self.run_test(
            f"Get room {self.test_room_id} to verify update",
            "GET",
            f"rooms/{self.test_room_id}",
            200
        )
        
        if success:
            room = response.get('room', response)  # Handle both response formats
            
            base_price = room.get('base_price')
            description = room.get('description', '')
            capacity = room.get('capacity')
            
            print(f"   Current values:")
            print(f"   - Base Price: {base_price}")
            print(f"   - Description: {description}")
            print(f"   - Capacity: {capacity}")
            
            # Check if values match what we updated
            success_checks = []
            
            if base_price == 45000:
                print("   ✅ Base price updated correctly (45000)")
                success_checks.append(True)
            else:
                print(f"   ❌ Base price not updated: expected 45000, got {base_price}")
                success_checks.append(False)
            
            if "Test update description" in description:
                print("   ✅ Description updated correctly")
                success_checks.append(True)
            else:
                print(f"   ❌ Description not updated: expected 'Test update description', got '{description}'")
                success_checks.append(False)
            
            if capacity == 3:
                print("   ✅ Capacity updated correctly (3)")
                success_checks.append(True)
            else:
                print(f"   ❌ Capacity not updated: expected 3, got {capacity}")
                success_checks.append(False)
            
            return all(success_checks)
        else:
            print(f"   ❌ Failed to get room details for verification")
            return False

    def test_create_room(self):
        """Test creating a new room"""
        print("\n" + "="*60)
        print("STEP 6: CREATE NEW ROOM")
        print("="*60)
        
        if not self.hotel_id:
            print("   ❌ No hotel ID available for room creation")
            return False
        
        new_room_data = {
            "hotel_id": self.hotel_id,
            "room_number": "TEST-999",
            "room_type": "deluxe",
            "base_price": 75000,
            "capacity": 4,
            "bed_type": "king",
            "description": "Test room created via API"
        }
        
        success, response = self.run_test(
            "Create new room",
            "POST",
            "rooms/",
            200,
            data=new_room_data
        )
        
        if success:
            new_room_id = response.get('room_id') or response.get('id')
            message = response.get('message', '')
            print(f"   ✅ Room creation response: {message}")
            
            if new_room_id:
                print(f"   ✅ New room created with ID: {new_room_id}")
                self.new_room_id = new_room_id
                return True
            else:
                print(f"   ⚠️  Room created but no ID returned")
                return True  # Still consider success if status 200
        else:
            print(f"   ❌ Room creation failed")
            return False

    def test_delete_room(self):
        """Test deleting the test room"""
        print("\n" + "="*60)
        print("STEP 7: DELETE TEST ROOM")
        print("="*60)
        
        if not hasattr(self, 'new_room_id') or not self.new_room_id:
            print("   ❌ No new room ID available for deletion")
            return False
        
        success, response = self.run_test(
            f"Delete room {self.new_room_id}",
            "DELETE",
            f"rooms/{self.new_room_id}",
            200
        )
        
        if success:
            message = response.get('message', '')
            print(f"   ✅ Delete response: {message}")
            return True
        else:
            print(f"   ❌ Room deletion failed")
            return False

    def run_all_tests(self):
        """Run all Room CRUD tests"""
        print("\n" + "="*80)
        print("ROOM CRUD OPERATIONS TESTING")
        print("API Base URL:", self.base_url)
        print("="*80)
        
        # Step 1: Login
        if not self.test_login():
            return False
        
        # Step 2: Get Hotels
        if not self.test_get_hotels():
            return False
        
        # Step 3: Get Rooms
        if not self.test_get_rooms():
            return False
        
        # Step 4: Update Room (THE FAILING OPERATION)
        update_success = self.test_update_room()
        
        # Step 5: Verify Update Persisted
        verify_success = self.test_verify_update_persisted()
        
        # Step 6: Create Room
        create_success = self.test_create_room()
        
        # Step 7: Delete Room
        delete_success = self.test_delete_room()
        
        # Print Summary
        print("\n" + "="*80)
        print("ROOM CRUD TEST SUMMARY")
        print("="*80)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print()
        
        # Critical Operations Status
        print("CRITICAL OPERATIONS STATUS:")
        print(f"✅ Login: WORKING" if self.auth_token else "❌ Login: FAILED")
        print(f"✅ Get Hotels: WORKING" if self.hotel_id else "❌ Get Hotels: FAILED")
        print(f"✅ Get Rooms: WORKING" if self.test_room_id else "❌ Get Rooms: FAILED")
        print(f"✅ Update Room: WORKING" if update_success else "❌ Update Room: FAILED")
        print(f"✅ Verify Update: WORKING" if verify_success else "❌ Verify Update: FAILED")
        print(f"✅ Create Room: WORKING" if create_success else "❌ Create Room: FAILED")
        print(f"✅ Delete Room: WORKING" if delete_success else "❌ Delete Room: FAILED")
        
        print("\n" + "="*80)
        
        # Return overall success
        critical_operations = [
            self.auth_token is not None,  # Login
            self.hotel_id is not None,    # Get Hotels
            self.test_room_id is not None, # Get Rooms
            update_success,               # Update Room
            verify_success,               # Verify Update
            create_success,               # Create Room
            delete_success                # Delete Room
        ]
        
        return all(critical_operations)

if __name__ == "__main__":
    tester = RoomCRUDTester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 ALL ROOM CRUD OPERATIONS WORKING!")
        sys.exit(0)
    else:
        print("💥 SOME ROOM CRUD OPERATIONS FAILED!")
        sys.exit(1)
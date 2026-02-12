"""
Car Rental API Tests - Iteration 58
Tests for:
1. POST /api/car-rental/ accepts images array with up to 6 URLs
2. GET /api/car-rental/ returns vehicles with images array
3. GET /api/car-rental/{id} returns single vehicle with images
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"

# Test image URLs for car rental vehicles
TEST_IMAGES = [
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
    "https://images.unsplash.com/photo-1568844293986-8c8f5c01b3bc?w=800",
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800",
    "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800",
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800",
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800"
]


class TestCarRentalImages:
    """Test car rental API with images support"""
    
    @pytest.fixture(autouse=True)
    def setup(self, request):
        """Setup: login as super admin and track created vehicles for cleanup"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_vehicle_ids = []
        
        # Login as super admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.auth_token = token
            else:
                pytest.skip("No token received from login")
        else:
            pytest.skip(f"Login failed with status {login_response.status_code}: {login_response.text}")
        
        yield
        
        # Cleanup: delete all test vehicles created
        for vehicle_id in self.created_vehicle_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/car-rental/{vehicle_id}")
            except Exception:
                pass
    
    def test_01_create_vehicle_with_images_array(self):
        """Test POST /api/car-rental/ accepts images array"""
        vehicle_data = {
            "make": "TEST_Toyota",
            "model": "TEST_Corolla",
            "year": 2024,
            "vehicle_type": "sedan",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 35000.0,
            "price_per_hour": 5000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth", "gps"],
            "images": TEST_IMAGES[:3]  # Using first 3 images
        }
        
        response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "car_id" in data, "Response should contain car_id"
        
        # Track for cleanup
        self.created_vehicle_ids.append(data["car_id"])
        print(f"PASS - Created vehicle with 3 images, ID: {data['car_id']}")
    
    def test_02_create_vehicle_with_6_images(self):
        """Test POST /api/car-rental/ accepts up to 6 images"""
        vehicle_data = {
            "make": "TEST_Honda",
            "model": "TEST_Civic",
            "year": 2024,
            "vehicle_type": "compact",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 30000.0,
            "city": "Douala",
            "features": ["ac", "bluetooth"],
            "images": TEST_IMAGES  # All 6 images
        }
        
        response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "car_id" in data, "Response should contain car_id"
        
        self.created_vehicle_ids.append(data["car_id"])
        print(f"PASS - Created vehicle with 6 images, ID: {data['car_id']}")
    
    def test_03_create_vehicle_with_empty_images(self):
        """Test POST /api/car-rental/ accepts empty images array"""
        vehicle_data = {
            "make": "TEST_Suzuki",
            "model": "TEST_Swift",
            "year": 2023,
            "vehicle_type": "economy",
            "seats": 5,
            "doors": 4,
            "transmission": "manual",
            "fuel_type": "petrol",
            "price_per_day": 20000.0,
            "city": "Yaoundé",
            "features": ["ac"],
            "images": []  # Empty images
        }
        
        response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "car_id" in data, "Response should contain car_id"
        
        self.created_vehicle_ids.append(data["car_id"])
        print(f"PASS - Created vehicle with empty images array, ID: {data['car_id']}")
    
    def test_04_create_vehicle_without_images_field(self):
        """Test POST /api/car-rental/ works without images field (optional)"""
        vehicle_data = {
            "make": "TEST_BMW",
            "model": "TEST_X5",
            "year": 2024,
            "vehicle_type": "suv",
            "seats": 7,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "diesel",
            "price_per_day": 80000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth", "gps", "leather"]
            # No images field - should default to empty array
        }
        
        response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "car_id" in data, "Response should contain car_id"
        
        self.created_vehicle_ids.append(data["car_id"])
        print(f"PASS - Created vehicle without images field, ID: {data['car_id']}")
    
    def test_05_get_vehicles_list_returns_images(self):
        """Test GET /api/car-rental/ returns vehicles with images array"""
        # First create a vehicle with images
        vehicle_data = {
            "make": "TEST_Mercedes",
            "model": "TEST_CClass",
            "year": 2024,
            "vehicle_type": "luxury",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 95000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth", "gps", "leather", "sunroof"],
            "images": TEST_IMAGES[:4]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200, f"Failed to create vehicle: {create_response.text}"
        created_id = create_response.json()["car_id"]
        self.created_vehicle_ids.append(created_id)
        
        # Now fetch the list
        list_response = self.session.get(f"{BASE_URL}/api/car-rental/")
        assert list_response.status_code == 200, f"Expected 200, got {list_response.status_code}"
        
        data = list_response.json()
        assert "cars" in data, "Response should contain 'cars' array"
        assert "total" in data, "Response should contain 'total' count"
        
        # Find our created vehicle
        our_vehicle = None
        for car in data["cars"]:
            car_id = car.get("_id") or car.get("id")
            if car_id == created_id:
                our_vehicle = car
                break
        
        assert our_vehicle is not None, f"Created vehicle {created_id} not found in list"
        assert "images" in our_vehicle, "Vehicle should have 'images' field"
        assert isinstance(our_vehicle["images"], list), "Images should be a list"
        assert len(our_vehicle["images"]) == 4, f"Expected 4 images, got {len(our_vehicle['images'])}"
        
        print(f"PASS - GET /api/car-rental/ returns vehicles with images array (found {len(our_vehicle['images'])} images)")
    
    def test_06_get_single_vehicle_returns_images(self):
        """Test GET /api/car-rental/{id} returns single vehicle with images"""
        # Create a vehicle with specific images
        vehicle_data = {
            "make": "TEST_Audi",
            "model": "TEST_A4",
            "year": 2024,
            "vehicle_type": "luxury",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 85000.0,
            "city": "Douala",
            "features": ["ac", "bluetooth", "gps", "leather"],
            "images": TEST_IMAGES[:5]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200, f"Failed to create vehicle: {create_response.text}"
        created_id = create_response.json()["car_id"]
        self.created_vehicle_ids.append(created_id)
        
        # Fetch single vehicle by ID
        get_response = self.session.get(f"{BASE_URL}/api/car-rental/{created_id}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}: {get_response.text}"
        
        vehicle = get_response.json()
        
        # Validate structure
        assert "id" in vehicle, "Response should contain 'id'"
        assert vehicle["id"] == created_id, "Returned ID should match"
        assert "images" in vehicle, "Vehicle should have 'images' field"
        assert isinstance(vehicle["images"], list), "Images should be a list"
        assert len(vehicle["images"]) == 5, f"Expected 5 images, got {len(vehicle['images'])}"
        
        # Verify the images content matches
        for i, img_url in enumerate(TEST_IMAGES[:5]):
            assert vehicle["images"][i] == img_url, f"Image {i} URL mismatch"
        
        print(f"PASS - GET /api/car-rental/{created_id} returns vehicle with {len(vehicle['images'])} images")
    
    def test_07_update_vehicle_images(self):
        """Test PUT /api/car-rental/{id} can update images"""
        # Create a vehicle without images
        vehicle_data = {
            "make": "TEST_Nissan",
            "model": "TEST_Altima",
            "year": 2023,
            "vehicle_type": "sedan",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 40000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth"],
            "images": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200, f"Failed to create vehicle: {create_response.text}"
        created_id = create_response.json()["car_id"]
        self.created_vehicle_ids.append(created_id)
        
        # Update with images
        update_response = self.session.put(
            f"{BASE_URL}/api/car-rental/{created_id}",
            json={"images": TEST_IMAGES[:2]}
        )
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/car-rental/{created_id}")
        assert get_response.status_code == 200
        vehicle = get_response.json()
        
        assert "images" in vehicle, "Vehicle should have images"
        assert len(vehicle["images"]) == 2, f"Expected 2 images after update, got {len(vehicle['images'])}"
        
        print(f"PASS - Successfully updated vehicle images, now has {len(vehicle['images'])} images")
    
    def test_08_vehicle_data_persistence(self):
        """Test vehicle with images is properly stored and retrieved"""
        vehicle_data = {
            "make": "TEST_Lexus",
            "model": "TEST_ES350",
            "year": 2024,
            "vehicle_type": "luxury",
            "seats": 5,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "petrol",
            "price_per_day": 100000.0,
            "price_per_hour": 15000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth", "gps", "leather", "sunroof"],
            "images": TEST_IMAGES
        }
        
        # Create
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200
        created_id = create_response.json()["car_id"]
        self.created_vehicle_ids.append(created_id)
        
        # Retrieve and verify all fields
        get_response = self.session.get(f"{BASE_URL}/api/car-rental/{created_id}")
        assert get_response.status_code == 200
        vehicle = get_response.json()
        
        # Verify core fields
        assert vehicle.get("make") == "TEST_Lexus", "Make should match"
        assert vehicle.get("model") == "TEST_ES350", "Model should match"
        assert vehicle.get("year") == 2024, "Year should match"
        assert vehicle.get("vehicle_type") == "luxury", "Vehicle type should match"
        assert vehicle.get("seats") == 5, "Seats should match"
        assert vehicle.get("transmission") == "automatic", "Transmission should match"
        assert vehicle.get("fuel_type") == "petrol", "Fuel type should match"
        assert vehicle.get("price_per_day") == 100000.0, "Price per day should match"
        assert vehicle.get("city") == "Yaoundé", "City should match"
        
        # Verify features
        features = vehicle.get("features", [])
        assert "ac" in features, "Features should include ac"
        assert "bluetooth" in features, "Features should include bluetooth"
        
        # Verify images
        assert "images" in vehicle, "Should have images"
        assert len(vehicle["images"]) == 6, "Should have 6 images"
        
        print("PASS - Vehicle with all fields including images is properly persisted")
    
    def test_09_vehicle_filter_by_type_with_images(self):
        """Test GET /api/car-rental/?vehicle_type=X returns filtered vehicles with images"""
        # Create an SUV with images
        vehicle_data = {
            "make": "TEST_Range",
            "model": "TEST_Rover",
            "year": 2024,
            "vehicle_type": "suv",
            "seats": 7,
            "doors": 4,
            "transmission": "automatic",
            "fuel_type": "diesel",
            "price_per_day": 120000.0,
            "city": "Yaoundé",
            "features": ["ac", "bluetooth", "gps", "4wd"],
            "images": TEST_IMAGES[:3]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200
        created_id = create_response.json()["car_id"]
        self.created_vehicle_ids.append(created_id)
        
        # Filter by SUV type
        filter_response = self.session.get(f"{BASE_URL}/api/car-rental/?vehicle_type=suv")
        assert filter_response.status_code == 200
        
        data = filter_response.json()
        assert "cars" in data, "Response should have cars"
        
        # All returned vehicles should be SUVs
        for car in data["cars"]:
            assert car.get("vehicle_type") == "suv", "All filtered cars should be SUVs"
            # Verify images field exists
            assert "images" in car, "Filtered vehicles should have images field"
        
        print(f"PASS - Filter by vehicle_type works, returned {len(data['cars'])} SUVs with images")
    
    def test_10_cleanup_test_vehicles(self):
        """Test DELETE /api/car-rental/{id} works correctly"""
        # Create a test vehicle
        vehicle_data = {
            "make": "TEST_Delete",
            "model": "TEST_Me",
            "year": 2024,
            "vehicle_type": "economy",
            "seats": 4,
            "doors": 4,
            "transmission": "manual",
            "fuel_type": "petrol",
            "price_per_day": 15000.0,
            "city": "Yaoundé",
            "features": ["ac"],
            "images": TEST_IMAGES[:1]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/car-rental/", json=vehicle_data)
        assert create_response.status_code == 200
        created_id = create_response.json()["car_id"]
        
        # Delete the vehicle
        delete_response = self.session.delete(f"{BASE_URL}/api/car-rental/{created_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify it's deleted
        get_response = self.session.get(f"{BASE_URL}/api/car-rental/{created_id}")
        assert get_response.status_code == 404, "Deleted vehicle should return 404"
        
        print("PASS - Vehicle deletion works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

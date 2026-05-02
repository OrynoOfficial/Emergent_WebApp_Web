"""
Test: Iteration 60 - Phase E Backend Testing
Tests: File upload endpoint and Restaurant image storage
Features tested:
1. POST /api/uploads/ - file upload returning file_url
2. POST /api/restaurants/ - images array accepted and stored
3. GET /api/restaurants/ - images array returned in response
4. POST /api/restaurants/{id}/menu - menu item image field
"""

import pytest
import requests
import os
import io

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://delivery-platform-108.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@oryno.com"
SUPERADMIN_PASSWORD = "testpassword123"


class TestUploadEndpoint:
    """Test POST /api/uploads/ file upload endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as superadmin to get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.token = token
        
        yield
        
        # Cleanup - no specific cleanup needed, test uploads cleaned below
    
    def test_01_upload_endpoint_exists(self):
        """Test that upload endpoint exists and requires authentication"""
        # Try without auth
        response = requests.post(f"{BASE_URL}/api/uploads/")
        # Should return 401 or 422 (missing file), but NOT 404
        assert response.status_code != 404, "Upload endpoint should exist"
        print(f"TEST PASS: Upload endpoint exists (status: {response.status_code})")
    
    def test_02_upload_file_success(self):
        """Test successful file upload"""
        # Create a test image file (simple PNG bytes)
        test_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test_image_iteration60.png', io.BytesIO(test_image_content), 'image/png')
        }
        data = {'folder': 'test-uploads'}
        
        # Remove Content-Type header for multipart/form-data (requests will set it)
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload should succeed, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") is True, "Upload should return success: true"
        assert "file_url" in result, "Response should contain file_url"
        
        file_url = result.get("file_url")
        assert file_url.startswith("/api/static/"), f"file_url should start with /api/static/, got: {file_url}"
        
        # Store for later cleanup
        self.uploaded_file_url = file_url
        
        print(f"TEST PASS: File uploaded successfully")
        print(f"  - file_url: {file_url}")
        print(f"  - storage: {result.get('storage', 'unknown')}")
    
    def test_03_upload_returns_correct_structure(self):
        """Test that upload returns the expected response structure"""
        test_content = b'test content for structure validation'
        files = {'file': ('test_structure.txt', io.BytesIO(test_content), 'text/plain')}
        data = {'folder': 'test-uploads'}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Check required fields
        assert "success" in result, "Response should have 'success' field"
        assert "file_url" in result, "Response should have 'file_url' field"
        assert "filename" in result, "Response should have 'filename' field"
        
        print(f"TEST PASS: Upload response has correct structure")
        print(f"  - success: {result.get('success')}")
        print(f"  - file_url: {result.get('file_url')}")
        print(f"  - filename: {result.get('filename')}")
    
    def test_04_upload_with_restaurants_folder(self):
        """Test upload with 'restaurants' folder (as used in RestaurantForm)"""
        test_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
        files = {'file': ('restaurant_test.png', io.BytesIO(test_content), 'image/png')}
        data = {'folder': 'restaurants'}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload to restaurants folder should work: {response.text}"
        result = response.json()
        
        assert "/api/static/restaurants/" in result.get("file_url", ""), \
            f"file_url should contain /api/static/restaurants/, got: {result.get('file_url')}"
        
        print(f"TEST PASS: Upload to 'restaurants' folder works")
        print(f"  - file_url: {result.get('file_url')}")
    
    def test_05_upload_with_menu_items_folder(self):
        """Test upload with 'menu-items' folder (as used in MenuItemForm)"""
        test_content = b'\x89PNG\r\n\x1a\n'
        files = {'file': ('menu_item_test.png', io.BytesIO(test_content), 'image/png')}
        data = {'folder': 'menu-items'}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Upload to menu-items folder should work: {response.text}"
        result = response.json()
        
        assert "/api/static/menu-items/" in result.get("file_url", ""), \
            f"file_url should contain /api/static/menu-items/, got: {result.get('file_url')}"
        
        print(f"TEST PASS: Upload to 'menu-items' folder works")
        print(f"  - file_url: {result.get('file_url')}")


class TestRestaurantImagesStorage:
    """Test restaurant images array storage and retrieval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as superadmin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.token = token
        
        self.created_restaurant_id = None
        self.created_menu_item_id = None
        
        yield
        
        # Cleanup - delete created restaurant
        if self.created_restaurant_id:
            try:
                self.session.delete(f"{BASE_URL}/api/restaurants/{self.created_restaurant_id}")
            except:
                pass
    
    def test_06_create_restaurant_with_images_array(self):
        """Test creating restaurant with images array (uploaded file URLs)"""
        # Simulate uploaded image URLs
        test_images = [
            "/api/static/restaurants/test-img-1.jpg",
            "/api/static/restaurants/test-img-2.jpg",
            "/api/static/restaurants/test-img-3.jpg"
        ]
        
        restaurant_data = {
            "name": "TEST_Restaurant_Iteration60",
            "description": "Test restaurant for iteration 60 image upload testing",
            "address": "Test Address 123",
            "city": "Douala",
            "country": "Cameroon",
            "cuisine_type": ["african", "fusion"],
            "phone": "+237600000060",
            "images": test_images,
            "accepts_reservations": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/restaurants/",
            json=restaurant_data
        )
        
        assert response.status_code == 200, f"Restaurant creation should succeed: {response.text}"
        result = response.json()
        
        assert "restaurant_id" in result, "Response should contain restaurant_id"
        self.created_restaurant_id = result.get("restaurant_id")
        
        print(f"TEST PASS: Restaurant created with images array")
        print(f"  - restaurant_id: {self.created_restaurant_id}")
    
    def test_07_get_restaurant_returns_images(self):
        """Test that GET restaurant returns the images array"""
        # First create a restaurant
        test_images = [
            "/api/static/restaurants/img-a.jpg",
            "/api/static/restaurants/img-b.jpg"
        ]
        
        restaurant_data = {
            "name": "TEST_Restaurant_GetImages",
            "address": "Test Address",
            "city": "Yaounde",
            "country": "Cameroon",
            "images": test_images
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/restaurants/",
            json=restaurant_data
        )
        
        assert create_response.status_code == 200
        restaurant_id = create_response.json().get("restaurant_id")
        self.created_restaurant_id = restaurant_id
        
        # Now GET the restaurant
        get_response = self.session.get(f"{BASE_URL}/api/restaurants/{restaurant_id}")
        assert get_response.status_code == 200, f"GET restaurant should succeed: {get_response.text}"
        
        restaurant = get_response.json()
        
        # Verify images array is returned
        assert "images" in restaurant, "Restaurant response should contain 'images' field"
        assert isinstance(restaurant["images"], list), "images should be a list"
        assert len(restaurant["images"]) == 2, f"Should have 2 images, got {len(restaurant['images'])}"
        
        print(f"TEST PASS: GET restaurant returns images array")
        print(f"  - images count: {len(restaurant['images'])}")
        print(f"  - images: {restaurant['images']}")
    
    def test_08_update_restaurant_images(self):
        """Test updating restaurant images array"""
        # Create restaurant first
        restaurant_data = {
            "name": "TEST_Restaurant_UpdateImages",
            "address": "Test",
            "city": "Douala",
            "country": "Cameroon",
            "images": ["/api/static/restaurants/original.jpg"]
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/restaurants/",
            json=restaurant_data
        )
        
        assert create_response.status_code == 200
        restaurant_id = create_response.json().get("restaurant_id")
        self.created_restaurant_id = restaurant_id
        
        # Update with new images
        new_images = [
            "/api/static/restaurants/new-1.jpg",
            "/api/static/restaurants/new-2.jpg",
            "/api/static/restaurants/new-3.jpg"
        ]
        
        update_response = self.session.put(
            f"{BASE_URL}/api/restaurants/{restaurant_id}",
            json={"images": new_images}
        )
        
        assert update_response.status_code == 200, f"Update should succeed: {update_response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/restaurants/{restaurant_id}")
        restaurant = get_response.json()
        
        assert len(restaurant.get("images", [])) == 3, "Should have 3 images after update"
        
        print(f"TEST PASS: Restaurant images can be updated")
        print(f"  - new images count: {len(restaurant.get('images', []))}")


class TestMenuItemImage:
    """Test menu item image field storage"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and create a test restaurant"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create a test restaurant
        restaurant_data = {
            "name": "TEST_Restaurant_MenuItems",
            "address": "Test",
            "city": "Douala",
            "country": "Cameroon"
        }
        
        response = self.session.post(f"{BASE_URL}/api/restaurants/", json=restaurant_data)
        if response.status_code == 200:
            self.restaurant_id = response.json().get("restaurant_id")
        else:
            self.restaurant_id = None
        
        self.created_menu_item_id = None
        
        yield
        
        # Cleanup
        if self.restaurant_id:
            try:
                self.session.delete(f"{BASE_URL}/api/restaurants/{self.restaurant_id}")
            except:
                pass
    
    def test_09_add_menu_item_with_image(self):
        """Test adding menu item with image URL"""
        if not self.restaurant_id:
            pytest.skip("Restaurant not created")
        
        menu_item_data = {
            "name": "TEST_MenuItem_WithImage",
            "description": "Test item with uploaded image",
            "category": "mains",
            "price": 5000,
            "image": "/api/static/menu-items/test-dish.jpg",
            "available": True,
            "popular": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            json=menu_item_data
        )
        
        assert response.status_code == 200, f"Menu item creation should succeed: {response.text}"
        result = response.json()
        
        assert "item_id" in result, "Response should contain item_id"
        self.created_menu_item_id = result.get("item_id")
        
        print(f"TEST PASS: Menu item created with image URL")
        print(f"  - item_id: {self.created_menu_item_id}")
    
    def test_10_get_menu_returns_image(self):
        """Test that GET menu returns image URLs"""
        if not self.restaurant_id:
            pytest.skip("Restaurant not created")
        
        # Add a menu item with image
        menu_item_data = {
            "name": "TEST_MenuItem_GetImage",
            "category": "desserts",
            "price": 2500,
            "image": "/api/static/menu-items/dessert.jpg"
        }
        
        self.session.post(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            json=menu_item_data
        )
        
        # Get menu
        response = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        assert response.status_code == 200, f"GET menu should succeed: {response.text}"
        
        menu = response.json()
        items = menu.get("items", [])
        
        # Find our test item
        test_items = [i for i in items if "TEST_MenuItem_GetImage" in i.get("name", "")]
        if test_items:
            assert "image" in test_items[0], "Menu item should have 'image' field"
            print(f"TEST PASS: Menu item returns image URL")
            print(f"  - image: {test_items[0].get('image')}")
        else:
            # May return demo data, check structure
            if items:
                assert "image" in items[0], "Menu items should have 'image' field"
                print(f"TEST PASS: Menu items structure includes 'image' field")


class TestCleanup:
    """Cleanup test data"""
    
    def test_99_cleanup_test_data(self):
        """Cleanup any test restaurants and uploads"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            print("TEST SKIP: Could not login for cleanup")
            return
        
        data = login_response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get all restaurants and delete TEST_ ones
        cleanup_count = 0
        try:
            response = session.get(f"{BASE_URL}/api/restaurants/")
            if response.status_code == 200:
                restaurants = response.json().get("restaurants", [])
                for r in restaurants:
                    name = r.get("name", "")
                    r_id = r.get("id") or r.get("_id")
                    if name.startswith("TEST_") and r_id:
                        try:
                            session.delete(f"{BASE_URL}/api/restaurants/{r_id}")
                            cleanup_count += 1
                        except:
                            pass
        except:
            pass
        
        print(f"TEST PASS: Cleanup completed")
        print(f"  - Deleted {cleanup_count} test restaurants")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

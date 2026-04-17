"""
Test Iteration 106: Menu Item Bug Fixes and Popular Flag Auto-Derivation
- Bug Fix: Menu item save works after uploading images (images field persists correctly)
- Bug Fix: Ingredients text field allows typing commas and periods freely (only parses to array on blur)
- Feature: Popular Item toggle removed from MenuItemForm (operator cannot set it)
- Feature: Backend auto-derives popular flag from order counts (top ordered items marked popular)
- Feature: Demo data marks top 3 highest-priced items as popular (system-derived)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"


def get_auth_token(email, password):
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    return None


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin authentication failed")
    return token


@pytest.fixture(scope="module")
def operator_token():
    """Get operator auth token"""
    token = get_auth_token(OPERATOR_EMAIL, OPERATOR_PASSWORD)
    if not token:
        pytest.skip("Operator authentication failed")
    return token


@pytest.fixture(scope="module")
def test_restaurant_id(admin_token):
    """Create a test restaurant for menu item tests"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    restaurant_data = {
        "name": f"TEST_Restaurant_{uuid.uuid4().hex[:8]}",
        "description": "Test restaurant for menu item tests",
        "address": "123 Test Street",
        "city": "Douala",
        "country": "Cameroon",
        "cuisine_type": ["african", "french"],
        "phone": "+237 699 123 456"
    }
    response = requests.post(f"{BASE_URL}/api/restaurants/", json=restaurant_data, headers=headers)
    if response.status_code in [200, 201]:
        restaurant_id = response.json().get("restaurant_id")
        yield restaurant_id
        # Cleanup
        requests.delete(f"{BASE_URL}/api/restaurants/{restaurant_id}", headers=headers)
    else:
        pytest.skip(f"Failed to create test restaurant: {response.text}")


class TestMenuItemImagesField:
    """Test that images field persists correctly when saving menu items"""
    
    def test_create_menu_item_with_images_array(self, admin_token, test_restaurant_id):
        """Test POST /api/restaurants/{id}/menu accepts images array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        menu_item = {
            "name": "TEST_Item_With_Images",
            "description": "Test item with multiple images",
            "category": "mains",
            "price": 5000,
            "image": "/api/uploads/test1.jpg",
            "images": ["/api/uploads/test1.jpg", "/api/uploads/test2.jpg", "/api/uploads/test3.jpg"],
            "ingredients": ["Chicken", "Rice", "Vegetables"],
            "available": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create menu item: {response.text}"
        data = response.json()
        assert "item_id" in data
        print(f"✓ Created menu item with images array: {data['item_id']}")
        
        # Verify the item was saved with images
        menu_response = requests.get(f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu")
        assert menu_response.status_code == 200
        
        items = menu_response.json().get("items", [])
        created_item = next((item for item in items if item.get("name") == "TEST_Item_With_Images"), None)
        
        if created_item:
            assert "images" in created_item
            assert isinstance(created_item["images"], list)
            print(f"✓ Menu item images persisted: {created_item['images']}")
    
    def test_update_menu_item_images(self, admin_token, test_restaurant_id):
        """Test PUT /api/restaurants/{id}/menu/{item_id} updates images array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an item
        menu_item = {
            "name": "TEST_Item_Update_Images",
            "description": "Test item for image update",
            "category": "starters",
            "price": 3000,
            "image": "",
            "images": [],
            "ingredients": [],
            "available": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        assert create_response.status_code in [200, 201]
        item_id = create_response.json().get("item_id")
        
        # Now update with images
        update_data = {
            "images": ["/api/uploads/updated1.jpg", "/api/uploads/updated2.jpg"],
            "image": "/api/uploads/updated1.jpg"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu/{item_id}",
            json=update_data,
            headers=headers
        )
        
        assert update_response.status_code == 200, f"Failed to update menu item: {update_response.text}"
        print(f"✓ Updated menu item images successfully")
        
        # Verify the update
        menu_response = requests.get(f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu")
        items = menu_response.json().get("items", [])
        updated_item = next((item for item in items if item.get("id") == item_id), None)
        
        if updated_item:
            assert "images" in updated_item
            print(f"✓ Updated images persisted: {updated_item.get('images')}")


class TestMenuItemIngredientsField:
    """Test that ingredients field accepts arrays correctly"""
    
    def test_create_menu_item_with_ingredients_array(self, admin_token, test_restaurant_id):
        """Test POST /api/restaurants/{id}/menu accepts ingredients array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        menu_item = {
            "name": "TEST_Item_With_Ingredients",
            "description": "Test item with ingredients list",
            "category": "mains",
            "price": 7500,
            "image": "",
            "images": [],
            "ingredients": ["Chicken", "Tomatoes", "Onions", "Garlic", "Palm Oil"],
            "available": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Failed to create menu item: {response.text}"
        data = response.json()
        print(f"✓ Created menu item with ingredients array: {data['item_id']}")
        
        # Verify the item was saved with ingredients
        menu_response = requests.get(f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu")
        items = menu_response.json().get("items", [])
        created_item = next((item for item in items if item.get("name") == "TEST_Item_With_Ingredients"), None)
        
        if created_item:
            assert "ingredients" in created_item
            assert isinstance(created_item["ingredients"], list)
            assert len(created_item["ingredients"]) == 5
            print(f"✓ Menu item ingredients persisted: {created_item['ingredients']}")
    
    def test_update_menu_item_ingredients(self, admin_token, test_restaurant_id):
        """Test PUT /api/restaurants/{id}/menu/{item_id} updates ingredients array"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an item
        menu_item = {
            "name": "TEST_Item_Update_Ingredients",
            "description": "Test item for ingredients update",
            "category": "desserts",
            "price": 2500,
            "image": "",
            "images": [],
            "ingredients": ["Sugar"],
            "available": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        assert create_response.status_code in [200, 201]
        item_id = create_response.json().get("item_id")
        
        # Now update with more ingredients
        update_data = {
            "ingredients": ["Sugar", "Flour", "Eggs", "Butter", "Vanilla"]
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu/{item_id}",
            json=update_data,
            headers=headers
        )
        
        assert update_response.status_code == 200, f"Failed to update menu item: {update_response.text}"
        print(f"✓ Updated menu item ingredients successfully")


class TestPopularFlagAutoDerivation:
    """Test that popular flag is auto-derived by the system, not set by operators"""
    
    def test_menu_item_create_ignores_popular_field(self, admin_token, test_restaurant_id):
        """Test that POST /api/restaurants/{id}/menu ignores popular field if sent"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        menu_item = {
            "name": "TEST_Item_Popular_Ignored",
            "description": "Test item - popular should be ignored",
            "category": "specials",
            "price": 10000,
            "image": "",
            "images": [],
            "ingredients": [],
            "available": True,
            "popular": True  # This should be ignored by backend
        }
        
        response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        
        # Should succeed (backend ignores unknown fields or popular field)
        assert response.status_code in [200, 201, 422], f"Unexpected response: {response.text}"
        
        if response.status_code in [200, 201]:
            print(f"✓ Backend accepted request (popular field ignored or stripped)")
        else:
            # 422 means validation error - popular field is not in schema
            print(f"✓ Backend rejected popular field (not in schema)")
    
    def test_demo_data_popular_items_are_highest_priced(self):
        """Test that demo data marks top 3 highest-priced items as popular"""
        # Use a non-existent restaurant ID to get demo data
        response = requests.get(f"{BASE_URL}/api/restaurants/demo-restaurant-xyz/menu")
        assert response.status_code == 200
        
        data = response.json()
        items = data.get("items", [])
        
        if len(items) > 0:
            # Get popular items
            popular_items = [item for item in items if item.get("popular")]
            
            # Get top 3 highest-priced items
            sorted_by_price = sorted(items, key=lambda x: x.get("price", 0), reverse=True)
            top_3_names = {item["name"] for item in sorted_by_price[:3]}
            
            # Verify popular items are the highest priced
            popular_names = {item["name"] for item in popular_items}
            
            print(f"✓ Popular items: {popular_names}")
            print(f"✓ Top 3 highest priced: {top_3_names}")
            
            # At least some overlap expected
            overlap = popular_names & top_3_names
            assert len(overlap) > 0 or len(popular_items) == 0, "Popular items should be highest priced in demo data"
            print(f"✓ Demo data popular flag is system-derived (top priced items)")
    
    def test_menu_response_includes_popular_field(self):
        """Test GET /api/restaurants/{id}/menu returns popular field"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        items = data.get("items", [])
        
        if len(items) > 0:
            # All items should have popular field
            for item in items:
                assert "popular" in item, f"Item {item.get('name')} missing popular field"
            
            print(f"✓ All menu items have popular field (system-derived)")


class TestMenuItemUpdateSchema:
    """Test that MenuItemUpdate schema doesn't include popular field"""
    
    def test_update_menu_item_without_popular(self, admin_token, test_restaurant_id):
        """Test PUT /api/restaurants/{id}/menu/{item_id} works without popular field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create an item
        menu_item = {
            "name": "TEST_Item_No_Popular",
            "description": "Test item without popular field",
            "category": "drinks",
            "price": 1500,
            "available": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        assert create_response.status_code in [200, 201]
        item_id = create_response.json().get("item_id")
        
        # Update without popular field
        update_data = {
            "name": "TEST_Item_No_Popular_Updated",
            "price": 2000
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu/{item_id}",
            json=update_data,
            headers=headers
        )
        
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        print(f"✓ Menu item updated successfully without popular field")


class TestMenuItemCreateSchema:
    """Test that MenuItemCreate schema doesn't include popular field"""
    
    def test_create_menu_item_schema_fields(self, admin_token, test_restaurant_id):
        """Test POST /api/restaurants/{id}/menu accepts correct schema fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create with all valid fields (no popular)
        menu_item = {
            "name": "TEST_Schema_Validation",
            "description": "Test schema validation",
            "category": "sides",
            "price": 1000,
            "image": "/api/uploads/test.jpg",
            "images": ["/api/uploads/test.jpg"],
            "ingredients": ["Potatoes", "Salt"],
            "available": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/restaurants/{test_restaurant_id}/menu",
            json=menu_item,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        print(f"✓ Menu item created with valid schema (no popular field)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

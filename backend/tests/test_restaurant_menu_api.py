"""
Test Restaurant Menu API - Premium Revamp Features
Tests for /api/restaurants/{id}/menu endpoint with images and ingredients support
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRestaurantMenuAPI:
    """Tests for restaurant menu API endpoints"""
    
    def test_get_restaurant_details(self):
        """Test GET /api/restaurants/{id} returns restaurant details"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data or "name" in data
        assert "name" in data
        assert "city" in data
        print(f"✓ Restaurant details: {data.get('name')}, {data.get('city')}")
    
    def test_get_restaurant_menu_returns_items(self):
        """Test GET /api/restaurants/{id}/menu returns menu items"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0
        print(f"✓ Menu has {len(data['items'])} items")
    
    def test_menu_item_has_required_fields(self):
        """Test menu items have all required fields"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        item = data["items"][0]
        
        # Required fields
        assert "id" in item
        assert "name" in item
        assert "category" in item
        assert "price" in item
        assert "description" in item
        assert "is_available" in item or "available" in item
        print(f"✓ Item has required fields: {item['name']}")
    
    def test_menu_item_has_images_array(self):
        """Test menu items have images array for carousel feature"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        item = data["items"][0]
        
        # Images array should exist (can be empty)
        assert "images" in item
        assert isinstance(item["images"], list)
        print(f"✓ Item has images array: {item['images']}")
    
    def test_menu_item_has_ingredients_array(self):
        """Test menu items have ingredients array for View Ingredients feature"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        item = data["items"][0]  # Ndolé with Plantains
        
        # Ingredients array should exist
        assert "ingredients" in item
        assert isinstance(item["ingredients"], list)
        assert len(item["ingredients"]) > 0  # Demo data should have ingredients
        print(f"✓ Item has ingredients: {item['ingredients']}")
    
    def test_menu_item_popular_flag(self):
        """Test menu items have popular flag"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find a popular item
        popular_items = [item for item in data["items"] if item.get("popular")]
        assert len(popular_items) > 0
        print(f"✓ Found {len(popular_items)} popular items")
    
    def test_menu_categories(self):
        """Test menu items have valid categories"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        valid_categories = ['starters', 'mains', 'desserts', 'drinks', 'specials', 'sides']
        
        for item in data["items"]:
            assert item["category"] in valid_categories, f"Invalid category: {item['category']}"
        
        # Check we have items in multiple categories
        categories = set(item["category"] for item in data["items"])
        assert len(categories) >= 3
        print(f"✓ Menu has items in categories: {categories}")
    
    def test_menu_item_price_format(self):
        """Test menu item prices are valid numbers"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        
        for item in data["items"]:
            assert isinstance(item["price"], (int, float))
            assert item["price"] > 0
        
        print(f"✓ All prices are valid positive numbers")
    
    def test_item_without_ingredients(self):
        """Test items without ingredients have empty array"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1/menu")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find Fresh Juice (id 9) which has no ingredients
        juice_item = next((item for item in data["items"] if item["id"] == "9"), None)
        if juice_item:
            assert "ingredients" in juice_item
            assert juice_item["ingredients"] == []
            print(f"✓ Item without ingredients has empty array: {juice_item['name']}")
        else:
            print("⚠ Fresh Juice item not found in demo data")


class TestRestaurantDetails:
    """Tests for restaurant details endpoint"""
    
    def test_restaurant_has_rating(self):
        """Test restaurant has rating field"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "rating" in data or "average_rating" in data
        print(f"✓ Restaurant rating: {data.get('rating') or data.get('average_rating')}")
    
    def test_restaurant_has_location(self):
        """Test restaurant has location fields"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "city" in data
        assert "address" in data
        print(f"✓ Restaurant location: {data.get('address')}, {data.get('city')}")
    
    def test_restaurant_has_hours(self):
        """Test restaurant has opening hours"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "opening_hours" in data
        print(f"✓ Restaurant hours: {data.get('opening_hours')}")
    
    def test_restaurant_has_cuisine_type(self):
        """Test restaurant has cuisine type"""
        response = requests.get(f"{BASE_URL}/api/restaurants/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "cuisine_type" in data
        assert isinstance(data["cuisine_type"], list)
        print(f"✓ Restaurant cuisine: {data.get('cuisine_type')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

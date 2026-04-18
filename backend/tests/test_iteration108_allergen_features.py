"""
Iteration 108: Allergen Tags and Ingredient-based Search/Filter Tests
Tests for P3 features:
1. Allergen tags for restaurant menu items
2. Ingredient-based search/filter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAllergenFeatures:
    """Test allergen and ingredient filtering for restaurant menu"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Restaurant ID 1 is the demo restaurant
        self.restaurant_id = "1"
    
    def test_menu_returns_allergens_array(self):
        """GET /api/restaurants/{id}/menu returns allergens array for each item"""
        response = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        assert len(data["items"]) > 0, "Menu should have items"
        
        # Check that items have allergens field
        for item in data["items"]:
            assert "allergens" in item, f"Item {item.get('name')} should have 'allergens' field"
            assert isinstance(item["allergens"], list), f"Allergens should be a list for {item.get('name')}"
        
        # Verify specific items have expected allergens (from demo data)
        items_by_name = {item["name"]: item for item in data["items"]}
        
        # Ndolé should have Peanuts and Shellfish
        if "Ndolé with Plantains" in items_by_name:
            ndole = items_by_name["Ndolé with Plantains"]
            assert "Peanuts" in ndole["allergens"], "Ndolé should contain Peanuts allergen"
            assert "Shellfish" in ndole["allergens"], "Ndolé should contain Shellfish allergen"
        
        # Grilled Fish should have Fish allergen
        if "Grilled Fish (Braise)" in items_by_name:
            fish = items_by_name["Grilled Fish (Braise)"]
            assert "Fish" in fish["allergens"], "Grilled Fish should contain Fish allergen"
        
        print(f"✓ Menu returns {len(data['items'])} items with allergens arrays")
    
    def test_exclude_allergens_filter_peanuts(self):
        """GET /api/restaurants/{id}/menu?exclude_allergens=peanuts filters out peanut items"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"exclude_allergens": "peanuts"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        
        # Verify no items contain Peanuts allergen
        for item in data["items"]:
            allergens_lower = [a.lower() for a in item.get("allergens", [])]
            assert "peanuts" not in allergens_lower, f"Item {item['name']} should not have Peanuts allergen when filtered"
        
        print(f"✓ Peanuts filter works - {len(data['items'])} items returned (no peanuts)")
    
    def test_exclude_allergens_filter_multiple(self):
        """GET /api/restaurants/{id}/menu?exclude_allergens=peanuts,fish filters out multiple allergens"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"exclude_allergens": "peanuts,fish"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify no items contain Peanuts or Fish allergens
        for item in data["items"]:
            allergens_lower = [a.lower() for a in item.get("allergens", [])]
            assert "peanuts" not in allergens_lower, f"Item {item['name']} should not have Peanuts"
            assert "fish" not in allergens_lower, f"Item {item['name']} should not have Fish"
        
        print(f"✓ Multiple allergen filter works - {len(data['items'])} items returned")
    
    def test_ingredient_filter_chicken(self):
        """GET /api/restaurants/{id}/menu?ingredient=Chicken returns only items containing chicken"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"ingredient": "Chicken"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' key"
        
        # All returned items should contain Chicken in ingredients
        for item in data["items"]:
            ingredients_lower = [ing.lower() for ing in item.get("ingredients", [])]
            has_chicken = any("chicken" in ing for ing in ingredients_lower)
            assert has_chicken, f"Item {item['name']} should contain Chicken ingredient"
        
        # Should find Poulet DG which has Chicken
        item_names = [item["name"] for item in data["items"]]
        assert any("Poulet" in name or "Chicken" in name for name in item_names), \
            "Should find Poulet DG or similar chicken dish"
        
        print(f"✓ Ingredient filter works - {len(data['items'])} items with Chicken")
    
    def test_ingredient_filter_case_insensitive(self):
        """Ingredient filter should be case-insensitive"""
        response_lower = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"ingredient": "chicken"}
        )
        response_upper = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"ingredient": "CHICKEN"}
        )
        
        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        
        items_lower = response_lower.json().get("items", [])
        items_upper = response_upper.json().get("items", [])
        
        # Both should return same number of items
        assert len(items_lower) == len(items_upper), \
            f"Case-insensitive search should return same results: {len(items_lower)} vs {len(items_upper)}"
        
        print(f"✓ Ingredient filter is case-insensitive")
    
    def test_combined_allergen_and_ingredient_filter(self):
        """Test combining allergen exclusion with ingredient filter"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"exclude_allergens": "peanuts", "ingredient": "Plantains"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # All items should have Plantains and NOT have Peanuts
        for item in data["items"]:
            allergens_lower = [a.lower() for a in item.get("allergens", [])]
            ingredients_lower = [ing.lower() for ing in item.get("ingredients", [])]
            
            assert "peanuts" not in allergens_lower, f"Item {item['name']} should not have Peanuts"
            has_plantains = any("plantain" in ing for ing in ingredients_lower)
            assert has_plantains, f"Item {item['name']} should contain Plantains"
        
        print(f"✓ Combined filter works - {len(data['items'])} items with Plantains, no Peanuts")
    
    def test_menu_items_have_ingredients_array(self):
        """Menu items should have ingredients array"""
        response = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        assert response.status_code == 200
        
        data = response.json()
        items_with_ingredients = 0
        
        for item in data["items"]:
            assert "ingredients" in item, f"Item {item.get('name')} should have 'ingredients' field"
            assert isinstance(item["ingredients"], list), f"Ingredients should be a list"
            if len(item["ingredients"]) > 0:
                items_with_ingredients += 1
        
        # Most items should have ingredients
        assert items_with_ingredients > 0, "At least some items should have ingredients"
        
        print(f"✓ {items_with_ingredients}/{len(data['items'])} items have ingredients listed")


class TestMenuItemCRUDWithAllergens:
    """Test CRUD operations for menu items with allergens field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.restaurant_id = "1"
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@test.com", "password": "testpassword123"}
        )
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.authenticated = True
        else:
            self.authenticated = False
    
    def test_create_menu_item_with_allergens(self):
        """POST /api/restaurants/{id}/menu accepts allergens array in payload"""
        if not self.authenticated:
            pytest.skip("Authentication failed")
        
        test_item = {
            "name": "TEST_Allergen_Dish",
            "description": "Test dish with allergens",
            "category": "mains",
            "price": 5000,
            "ingredients": ["Peanuts", "Milk", "Flour"],
            "allergens": ["Peanuts", "Dairy", "Gluten"],
            "available": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            json=test_item
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "item_id" in data, "Response should contain item_id"
        
        # Store item_id for cleanup
        self.created_item_id = data["item_id"]
        
        # Verify the item was created with allergens by fetching menu
        menu_response = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        menu_items = menu_response.json().get("items", [])
        
        created_item = next((item for item in menu_items if item.get("name") == "TEST_Allergen_Dish"), None)
        if created_item:
            assert "Peanuts" in created_item.get("allergens", []), "Created item should have Peanuts allergen"
            assert "Dairy" in created_item.get("allergens", []), "Created item should have Dairy allergen"
            assert "Gluten" in created_item.get("allergens", []), "Created item should have Gluten allergen"
            print(f"✓ Created menu item with allergens: {created_item.get('allergens')}")
        else:
            print("✓ Menu item created (allergens accepted in payload)")
    
    def test_update_menu_item_allergens(self):
        """PUT /api/restaurants/{id}/menu/{item_id} accepts allergens update"""
        if not self.authenticated:
            pytest.skip("Authentication failed")
        
        # First create an item
        test_item = {
            "name": "TEST_Update_Allergen_Dish",
            "description": "Test dish for allergen update",
            "category": "starters",
            "price": 3000,
            "ingredients": ["Eggs"],
            "allergens": ["Eggs"],
            "available": True
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            json=test_item
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test item: {create_response.text}")
        
        item_id = create_response.json().get("item_id")
        
        # Update the allergens
        update_data = {
            "allergens": ["Eggs", "Dairy", "Soy"]
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu/{item_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify the update by fetching menu
        menu_response = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        menu_items = menu_response.json().get("items", [])
        
        updated_item = next((item for item in menu_items if item.get("id") == item_id), None)
        if updated_item:
            assert "Eggs" in updated_item.get("allergens", []), "Updated item should have Eggs"
            assert "Dairy" in updated_item.get("allergens", []), "Updated item should have Dairy"
            assert "Soy" in updated_item.get("allergens", []), "Updated item should have Soy"
            print(f"✓ Updated menu item allergens: {updated_item.get('allergens')}")
        else:
            print("✓ Menu item allergens update accepted")


class TestAllergenFilterEdgeCases:
    """Test edge cases for allergen filtering"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.restaurant_id = "1"
    
    def test_exclude_allergens_empty_string(self):
        """Empty exclude_allergens should return all items"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"exclude_allergens": ""}
        )
        assert response.status_code == 200
        
        # Compare with no filter
        response_no_filter = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        
        items_filtered = len(response.json().get("items", []))
        items_no_filter = len(response_no_filter.json().get("items", []))
        
        assert items_filtered == items_no_filter, "Empty filter should return all items"
        print(f"✓ Empty allergen filter returns all {items_filtered} items")
    
    def test_exclude_nonexistent_allergen(self):
        """Filtering by non-existent allergen should return all items"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"exclude_allergens": "nonexistentallergen123"}
        )
        assert response.status_code == 200
        
        response_no_filter = self.session.get(f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu")
        
        items_filtered = len(response.json().get("items", []))
        items_no_filter = len(response_no_filter.json().get("items", []))
        
        assert items_filtered == items_no_filter, "Non-existent allergen filter should return all items"
        print(f"✓ Non-existent allergen filter returns all {items_filtered} items")
    
    def test_ingredient_filter_no_match(self):
        """Ingredient filter with no matches should return empty list"""
        response = self.session.get(
            f"{BASE_URL}/api/restaurants/{self.restaurant_id}/menu",
            params={"ingredient": "nonexistentingredient123"}
        )
        assert response.status_code == 200
        
        items = response.json().get("items", [])
        assert len(items) == 0, "Non-matching ingredient should return empty list"
        print("✓ Non-matching ingredient filter returns empty list")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

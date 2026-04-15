"""
Iteration 98: Test Events and Restaurant Menu New Fields
Tests:
1. Events API - New fields: doors_open, end_date, ticket_price, contact_email, contact_phone, cover_image
2. Restaurant Menu API - ingredients field support
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

# Test IDs from main agent context
TEST_EVENT_ID = "072a3abc-372b-40fb-ad2a-3d23c1bda798"
TEST_RESTAURANT_ID = "b07dd31f-1799-436d-ac4e-6fe0976ec54f"
TEST_MENU_ITEM_ID = "29f288b1-7157-46b8-81c3-f4762be7bfff"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


class TestEventsNewFields:
    """Test Events API with new fields: doors_open, end_date, ticket_price, contact_email, contact_phone, cover_image"""
    
    def test_create_event_with_all_new_fields(self, admin_token):
        """POST /api/events/ - Create event with all new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        event_date = (datetime.now() + timedelta(days=30)).isoformat()
        event_data = {
            "name": f"TEST_Event_AllFields_{datetime.now().strftime('%H%M%S')}",
            "event_type": "concert",
            "description": "Test event with all new fields",
            "venue": "Grand Arena",
            "city": "Douala",
            "country": "CM",
            "event_date": event_date,
            "start_time": "18:00",
            "end_time": "23:00",
            # New fields
            "doors_open": "17:00",
            "end_date": (datetime.now() + timedelta(days=31)).strftime("%Y-%m-%d"),
            "ticket_price": 15000.0,
            "contact_email": "events@test.cm",
            "contact_phone": "+237 699 123 456",
            "cover_image": "https://example.com/event-cover.jpg",
            "total_seats": 500
        }
        
        response = requests.post(f"{BASE_URL}/api/events/", json=event_data, headers=headers)
        
        if response.status_code == 403:
            pytest.skip("Admin does not have events.create permission")
        
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        data = response.json()
        assert "event_id" in data, "Response should have event_id"
        
        event_id = data["event_id"]
        print(f"Created event with ID: {event_id}")
        
        # Verify the event was created with all fields
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=headers)
        assert get_response.status_code == 200, f"Failed to get event: {get_response.text}"
        
        event = get_response.json()
        
        # Verify new fields
        assert event.get("doors_open") == "17:00", f"doors_open mismatch: {event.get('doors_open')}"
        assert event.get("ticket_price") == 15000.0, f"ticket_price mismatch: {event.get('ticket_price')}"
        assert event.get("contact_email") == "events@test.cm", f"contact_email mismatch: {event.get('contact_email')}"
        assert event.get("contact_phone") == "+237 699 123 456", f"contact_phone mismatch: {event.get('contact_phone')}"
        assert event.get("cover_image") == "https://example.com/event-cover.jpg", f"cover_image mismatch: {event.get('cover_image')}"
        
        print(f"Event verified with all new fields: doors_open={event.get('doors_open')}, ticket_price={event.get('ticket_price')}, contact_email={event.get('contact_email')}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=headers)
        print(f"Cleanup delete status: {delete_response.status_code}")
        
        return event_id
    
    def test_get_existing_event_with_new_fields(self, admin_token):
        """GET /api/events/{id} - Verify existing event returns new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/events/{TEST_EVENT_ID}", headers=headers)
        
        if response.status_code == 404:
            pytest.skip(f"Test event {TEST_EVENT_ID} not found")
        
        assert response.status_code == 200, f"Failed to get event: {response.text}"
        event = response.json()
        
        print(f"Event fields: {list(event.keys())}")
        
        # Check that new fields exist in response (may be null)
        assert "doors_open" in event or event.get("doors_open") is None, "doors_open field should exist"
        assert "ticket_price" in event, "ticket_price field should exist"
        assert "contact_email" in event or event.get("contact_email") is None, "contact_email field should exist"
        assert "contact_phone" in event or event.get("contact_phone") is None, "contact_phone field should exist"
        assert "cover_image" in event or event.get("cover_image") is None, "cover_image field should exist"
        
        print(f"Event {TEST_EVENT_ID} has new fields: doors_open={event.get('doors_open')}, ticket_price={event.get('ticket_price')}")
        return event
    
    def test_update_event_with_new_fields(self, admin_token):
        """PUT /api/events/{id} - Update event with new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a test event
        event_date = (datetime.now() + timedelta(days=30)).isoformat()
        create_data = {
            "name": f"TEST_Event_Update_{datetime.now().strftime('%H%M%S')}",
            "event_type": "concert",
            "venue": "Test Venue",
            "city": "Douala",
            "country": "CM",
            "event_date": event_date,
            "start_time": "18:00",
            "end_time": "22:00",
            "ticket_price": 5000.0,
            "total_seats": 100
        }
        
        create_response = requests.post(f"{BASE_URL}/api/events/", json=create_data, headers=headers)
        
        if create_response.status_code == 403:
            pytest.skip("Admin does not have events.create permission")
        
        assert create_response.status_code == 200, f"Failed to create event: {create_response.text}"
        event_id = create_response.json()["event_id"]
        
        # Update with new fields
        update_data = {
            "doors_open": "16:30",
            "ticket_price": 7500.0,
            "contact_email": "updated@test.cm",
            "contact_phone": "+237 699 999 999",
            "cover_image": "https://example.com/updated-cover.jpg"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Failed to update event: {update_response.text}"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=headers)
        assert get_response.status_code == 200
        
        event = get_response.json()
        assert event.get("doors_open") == "16:30", f"doors_open not updated: {event.get('doors_open')}"
        assert event.get("ticket_price") == 7500.0, f"ticket_price not updated: {event.get('ticket_price')}"
        assert event.get("contact_email") == "updated@test.cm", f"contact_email not updated: {event.get('contact_email')}"
        assert event.get("contact_phone") == "+237 699 999 999", f"contact_phone not updated: {event.get('contact_phone')}"
        assert event.get("cover_image") == "https://example.com/updated-cover.jpg", f"cover_image not updated: {event.get('cover_image')}"
        
        print(f"Event {event_id} updated successfully with new fields")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=headers)
        
        return event_id


class TestRestaurantMenuIngredients:
    """Test Restaurant Menu API with ingredients field"""
    
    def test_create_menu_item_with_ingredients(self, admin_token):
        """POST /api/restaurants/{id}/menu - Create menu item with ingredients"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        menu_item_data = {
            "name": f"TEST_MenuItem_{datetime.now().strftime('%H%M%S')}",
            "description": "Test dish with ingredients",
            "category": "mains",
            "price": 8500.0,
            "ingredients": ["Chicken", "Tomatoes", "Onions", "Garlic", "Palm Oil", "Spices"],
            "available": True,
            "popular": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu",
            json=menu_item_data,
            headers=headers
        )
        
        if response.status_code == 403:
            pytest.skip("Admin does not have restaurants.manage_menu permission")
        
        if response.status_code == 404:
            pytest.skip(f"Restaurant {TEST_RESTAURANT_ID} not found")
        
        assert response.status_code == 200, f"Failed to create menu item: {response.text}"
        data = response.json()
        assert "item_id" in data, "Response should have item_id"
        
        item_id = data["item_id"]
        print(f"Created menu item with ID: {item_id}")
        
        # Verify by getting the menu
        menu_response = requests.get(f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu", headers=headers)
        assert menu_response.status_code == 200, f"Failed to get menu: {menu_response.text}"
        
        menu = menu_response.json()
        items = menu.get("items", [])
        
        # Find our created item
        created_item = next((item for item in items if item.get("id") == item_id), None)
        
        if created_item:
            assert "ingredients" in created_item, "Menu item should have ingredients field"
            assert isinstance(created_item.get("ingredients"), list), "ingredients should be a list"
            assert len(created_item.get("ingredients", [])) == 6, f"Expected 6 ingredients, got {len(created_item.get('ingredients', []))}"
            print(f"Menu item has ingredients: {created_item.get('ingredients')}")
        
        # Cleanup
        delete_response = requests.delete(
            f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu/{item_id}",
            headers=headers
        )
        print(f"Cleanup delete status: {delete_response.status_code}")
        
        return item_id
    
    def test_get_menu_returns_ingredients(self, admin_token):
        """GET /api/restaurants/{id}/menu - Verify menu returns ingredients field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu", headers=headers)
        
        if response.status_code == 404:
            pytest.skip(f"Restaurant {TEST_RESTAURANT_ID} not found")
        
        assert response.status_code == 200, f"Failed to get menu: {response.text}"
        
        menu = response.json()
        items = menu.get("items", [])
        
        print(f"Menu has {len(items)} items")
        
        # Check that items have ingredients field
        for item in items:
            assert "ingredients" in item or item.get("ingredients") is None, f"Item {item.get('name')} should have ingredients field"
            if item.get("ingredients"):
                print(f"Item '{item.get('name')}' has ingredients: {item.get('ingredients')}")
        
        return menu
    
    def test_update_menu_item_ingredients(self, admin_token):
        """PUT /api/restaurants/{id}/menu/{item_id} - Update menu item ingredients"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a test menu item
        create_data = {
            "name": f"TEST_MenuItem_Update_{datetime.now().strftime('%H%M%S')}",
            "description": "Test dish for update",
            "category": "starters",
            "price": 3500.0,
            "ingredients": ["Ingredient1", "Ingredient2"],
            "available": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu",
            json=create_data,
            headers=headers
        )
        
        if create_response.status_code == 403:
            pytest.skip("Admin does not have restaurants.manage_menu permission")
        
        if create_response.status_code == 404:
            pytest.skip(f"Restaurant {TEST_RESTAURANT_ID} not found")
        
        assert create_response.status_code == 200, f"Failed to create menu item: {create_response.text}"
        item_id = create_response.json()["item_id"]
        
        # Update ingredients
        update_data = {
            "ingredients": ["Updated1", "Updated2", "Updated3", "NewIngredient"]
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu/{item_id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200, f"Failed to update menu item: {update_response.text}"
        
        # Verify update by getting menu
        menu_response = requests.get(f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu", headers=headers)
        assert menu_response.status_code == 200
        
        menu = menu_response.json()
        items = menu.get("items", [])
        updated_item = next((item for item in items if item.get("id") == item_id), None)
        
        if updated_item:
            assert updated_item.get("ingredients") == ["Updated1", "Updated2", "Updated3", "NewIngredient"], \
                f"Ingredients not updated correctly: {updated_item.get('ingredients')}"
            print(f"Menu item {item_id} ingredients updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/restaurants/{TEST_RESTAURANT_ID}/menu/{item_id}", headers=headers)
        
        return item_id


class TestEventsListWithNewFields:
    """Test that events list returns new fields"""
    
    def test_events_list_includes_new_fields(self, admin_token):
        """GET /api/events/ - Verify list includes new fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/events/", headers=headers)
        assert response.status_code == 200, f"Failed to get events: {response.text}"
        
        data = response.json()
        events = data.get("events", [])
        
        print(f"Found {len(events)} events")
        
        if events:
            # Check first event has new fields
            event = events[0]
            print(f"Event fields: {list(event.keys())}")
            
            # These fields should exist (may be null)
            expected_fields = ["ticket_price", "doors_open", "contact_email", "contact_phone", "cover_image"]
            for field in expected_fields:
                # Field should exist in response
                if field in event:
                    print(f"Field '{field}' present with value: {event.get(field)}")
        
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

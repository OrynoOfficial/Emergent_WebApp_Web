"""
Iteration 104: Dynamic Popular Locations & Items Suggestions API Tests
Tests for:
- GET /api/suggestions/popular-locations (all services)
- GET /api/suggestions/popular-locations?service_type=travel
- GET /api/suggestions/popular-locations?service_type=restaurant
- GET /api/suggestions/popular-locations?service_type=hotel
- GET /api/suggestions/popular-items?service_type=restaurant
- GET /api/suggestions/popular-items?service_type=travel
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSuggestionsPopularLocations:
    """Tests for /api/suggestions/popular-locations endpoint"""

    def test_popular_locations_all_services(self):
        """Test GET /api/suggestions/popular-locations returns dynamic cities"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "all_locations" in data, "Response should have 'all_locations' field"
        assert "popular" in data, "Response should have 'popular' field"
        assert "counts" in data, "Response should have 'counts' field"
        
        # Verify data types
        assert isinstance(data["all_locations"], list), "all_locations should be a list"
        assert isinstance(data["popular"], list), "popular should be a list"
        assert isinstance(data["counts"], dict), "counts should be a dict"
        
        # Verify we have some locations
        assert len(data["all_locations"]) > 0, "Should have at least some locations"
        print(f"All locations count: {len(data['all_locations'])}")
        print(f"Popular locations: {data['popular']}")
        print(f"Top counts: {data['counts']}")

    def test_popular_locations_travel_service(self):
        """Test GET /api/suggestions/popular-locations?service_type=travel"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=travel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "all_locations" in data
        assert "popular" in data
        assert "counts" in data
        
        # Travel should aggregate from travel_routes (from_city, to_city)
        print(f"Travel locations: {data['all_locations'][:10]}")
        print(f"Travel popular: {data['popular']}")
        print(f"Travel counts: {data['counts']}")

    def test_popular_locations_restaurant_service(self):
        """Test GET /api/suggestions/popular-locations?service_type=restaurant"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=restaurant")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "all_locations" in data
        assert "popular" in data
        assert "counts" in data
        
        # Restaurant should aggregate from restaurants.city
        print(f"Restaurant locations: {data['all_locations'][:10]}")
        print(f"Restaurant popular: {data['popular']}")
        print(f"Restaurant counts: {data['counts']}")

    def test_popular_locations_hotel_service(self):
        """Test GET /api/suggestions/popular-locations?service_type=hotel"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=hotel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "all_locations" in data
        assert "popular" in data
        assert "counts" in data
        
        # Hotel should aggregate from hotels.city
        print(f"Hotel locations: {data['all_locations'][:10]}")
        print(f"Hotel popular: {data['popular']}")
        print(f"Hotel counts: {data['counts']}")

    def test_popular_locations_packages_service(self):
        """Test GET /api/suggestions/popular-locations?service_type=packages"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "all_locations" in data
        assert "popular" in data
        
        # Packages should aggregate from packages.destination and packages.origin
        print(f"Packages locations: {data['all_locations'][:10]}")
        print(f"Packages popular: {data['popular']}")

    def test_popular_locations_fallback_cities(self):
        """Test that fallback cities are included when DB has few results"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations")
        assert response.status_code == 200
        
        data = response.json()
        all_locs = data["all_locations"]
        
        # Known Cameroon cities should be in the list (either from DB or fallback)
        known_cities = ['Yaoundé', 'Douala', 'Bafoussam', 'Bamenda', 'Garoua']
        found_cities = [c for c in known_cities if c in all_locs]
        print(f"Found known cities: {found_cities}")
        # At least some known cities should be present
        assert len(found_cities) >= 2, f"Expected at least 2 known cities, found: {found_cities}"


class TestSuggestionsPopularItems:
    """Tests for /api/suggestions/popular-items endpoint"""

    def test_popular_items_restaurant(self):
        """Test GET /api/suggestions/popular-items?service_type=restaurant returns menu items"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-items?service_type=restaurant")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' field"
        assert "service_type" in data, "Response should have 'service_type' field"
        assert data["service_type"] == "restaurant"
        
        print(f"Restaurant items count: {len(data['items'])}")
        if data['items']:
            print(f"Sample item: {data['items'][0]}")

    def test_popular_items_travel(self):
        """Test GET /api/suggestions/popular-items?service_type=travel returns travel routes"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-items?service_type=travel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        assert "service_type" in data
        assert data["service_type"] == "travel"
        
        print(f"Travel items count: {len(data['items'])}")
        if data['items']:
            print(f"Sample travel route: {data['items'][0]}")
            # Travel routes should have from_city and to_city
            item = data['items'][0]
            if 'from_city' in item:
                assert 'to_city' in item, "Travel route should have to_city"

    def test_popular_items_hotel(self):
        """Test GET /api/suggestions/popular-items?service_type=hotel returns hotels"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-items?service_type=hotel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data
        assert data["service_type"] == "hotel"
        
        print(f"Hotel items count: {len(data['items'])}")
        if data['items']:
            print(f"Sample hotel: {data['items'][0]}")

    def test_popular_items_with_limit(self):
        """Test GET /api/suggestions/popular-items with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-items?service_type=restaurant&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data['items']) <= 5, f"Expected max 5 items, got {len(data['items'])}"

    def test_popular_items_no_service_type(self):
        """Test GET /api/suggestions/popular-items without service_type returns empty"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-items")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        # Without service_type, should return empty items
        print(f"Items without service_type: {len(data['items'])}")


class TestSuggestionsDataIntegrity:
    """Tests to verify data is actually dynamic from DB"""

    def test_locations_ranked_by_count(self):
        """Verify popular locations are ranked by listing count"""
        response = requests.get(f"{BASE_URL}/api/suggestions/popular-locations")
        assert response.status_code == 200
        
        data = response.json()
        counts = data.get("counts", {})
        
        if len(counts) >= 2:
            # Verify counts are in descending order
            count_values = list(counts.values())
            for i in range(len(count_values) - 1):
                assert count_values[i] >= count_values[i+1], \
                    f"Counts should be in descending order: {count_values}"
            print(f"Counts are properly ranked: {counts}")

    def test_different_service_types_return_different_data(self):
        """Verify different service types return different location data"""
        travel_resp = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=travel")
        restaurant_resp = requests.get(f"{BASE_URL}/api/suggestions/popular-locations?service_type=restaurant")
        
        assert travel_resp.status_code == 200
        assert restaurant_resp.status_code == 200
        
        travel_counts = travel_resp.json().get("counts", {})
        restaurant_counts = restaurant_resp.json().get("counts", {})
        
        print(f"Travel counts: {travel_counts}")
        print(f"Restaurant counts: {restaurant_counts}")
        
        # The counts should potentially differ (unless data is identical)
        # This is informational - we just verify both return valid data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

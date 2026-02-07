"""
Location-Based Filtering Tests for Oryno Platform
Tests the country filtering feature across all service endpoints.

Test Coverage:
1. Hotels, Events, Restaurants (direct country field)
2. Car Rental, Travel, Cinema, Pressing, Banquets, Packages (operator-based lookup)
3. African country filtering (CM = Cameroon)
4. Non-African country filtering (US = global view)
5. No filter (returns all)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLocationFilteringBackend:
    """Test location-based filtering across all service endpoints"""

    # ====== Hotels Tests ======
    def test_hotels_with_cameroon_filter(self):
        """Hotels with country=CM should return Cameroon hotels only"""
        response = requests.get(f"{BASE_URL}/api/hotels/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "hotels" in data
        assert "total" in data
        assert data["total"] > 0, "Expected Cameroon hotels in database"
        print(f"Hotels with CM filter: {data['total']}")

    def test_hotels_with_us_filter_returns_all(self):
        """Hotels with country=US (non-African) should return ALL hotels (global view)"""
        # Get total without filter
        response_all = requests.get(f"{BASE_URL}/api/hotels/")
        total_all = response_all.json()["total"]
        
        # Get with US filter
        response_us = requests.get(f"{BASE_URL}/api/hotels/", params={"country": "US"})
        assert response_us.status_code == 200
        data = response_us.json()
        
        assert data["total"] == total_all, f"US filter should return all hotels: {data['total']} vs {total_all}"
        print(f"Hotels with US filter (global): {data['total']}")

    def test_hotels_without_filter_returns_all(self):
        """Hotels without country filter should return all hotels"""
        response = requests.get(f"{BASE_URL}/api/hotels/")
        assert response.status_code == 200
        data = response.json()
        assert "hotels" in data
        assert data["total"] > 0
        print(f"Hotels without filter: {data['total']}")

    # ====== Events Tests ======
    def test_events_with_cameroon_filter(self):
        """Events with country=CM should return Cameroon events"""
        response = requests.get(f"{BASE_URL}/api/events/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert data["total"] > 0, "Expected Cameroon events in database"
        print(f"Events with CM filter: {data['total']}")

    def test_events_with_us_filter_returns_all(self):
        """Events with country=US (non-African) should return ALL events"""
        response_all = requests.get(f"{BASE_URL}/api/events/")
        total_all = response_all.json()["total"]
        
        response_us = requests.get(f"{BASE_URL}/api/events/", params={"country": "US"})
        assert response_us.status_code == 200
        data = response_us.json()
        
        assert data["total"] == total_all, f"US filter should return all events"
        print(f"Events with US filter (global): {data['total']}")

    # ====== Restaurants Tests ======
    def test_restaurants_with_cameroon_filter(self):
        """Restaurants with country=CM should return Cameroon restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurants/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "restaurants" in data
        assert data["total"] > 0, "Expected Cameroon restaurants in database"
        print(f"Restaurants with CM filter: {data['total']}")

    # ====== Car Rental Tests (operator-based filtering) ======
    def test_car_rental_with_cameroon_filter(self):
        """Car rentals with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/car-rental/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "cars" in data
        # May return 0 if no operators in Cameroon have car rentals
        print(f"Car rentals with CM filter: {data['total']}")

    # ====== Travel Routes Tests (operator-based filtering) ======
    def test_travel_routes_with_cameroon_filter(self):
        """Travel routes with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/travel/routes", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "routes" in data
        print(f"Travel routes with CM filter: {data['total']}")

    # ====== Cinema Tests (operator-based filtering) ======
    def test_cinema_with_cameroon_filter(self):
        """Cinemas with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/cinema/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "cinemas" in data
        print(f"Cinemas with CM filter: {data['total']}")

    # ====== Pressing Tests (operator-based filtering) ======
    def test_pressing_with_cameroon_filter(self):
        """Pressing services with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/pressing/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "services" in data or "total" in data
        print(f"Pressing with CM filter: {data.get('total', len(data.get('services', [])))}")

    # ====== Banquets Tests (operator-based filtering) ======
    def test_banquets_with_cameroon_filter(self):
        """Banquets with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/banquets/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "banquets" in data or "total" in data
        print(f"Banquets with CM filter: {data.get('total', 0)}")

    # ====== Packages Tests (operator-based filtering) ======
    def test_packages_with_cameroon_filter(self):
        """Packages with country=CM should filter via operator lookup"""
        response = requests.get(f"{BASE_URL}/api/packages/", params={"country": "CM"})
        assert response.status_code == 200
        data = response.json()
        assert "packages" in data or "total" in data
        print(f"Packages with CM filter: {data.get('total', 0)}")

    # ====== Geography API Tests ======
    def test_geography_countries_api(self):
        """Geography countries API should return African countries for dropdown"""
        response = requests.get(f"{BASE_URL}/api/geography/countries")
        assert response.status_code == 200
        data = response.json()
        assert "countries" in data
        assert len(data["countries"]) > 0
        
        # Verify some African countries are present
        country_codes = [c.get("code") for c in data["countries"]]
        assert "CM" in country_codes, "Cameroon should be in countries list"
        print(f"Geography countries: {len(data['countries'])}")

    def test_ip_info_endpoint(self):
        """IP info endpoint should work for location detection"""
        response = requests.get(f"{BASE_URL}/api/customer-location/ip-info")
        assert response.status_code == 200
        data = response.json()
        assert "ip" in data
        print(f"IP info endpoint working: {data.get('ip')}")


class TestLocationFilteringComparison:
    """Compare filtered vs global results"""

    def test_african_vs_global_hotels(self):
        """Verify African filter returns subset of global"""
        # Get all hotels (no filter)
        all_response = requests.get(f"{BASE_URL}/api/hotels/")
        all_total = all_response.json()["total"]
        
        # Get CM filtered hotels
        cm_response = requests.get(f"{BASE_URL}/api/hotels/", params={"country": "CM"})
        cm_total = cm_response.json()["total"]
        
        # CM should be <= all (or equal if all hotels are in Cameroon)
        assert cm_total <= all_total, f"CM filter ({cm_total}) should not exceed total ({all_total})"
        print(f"Hotels: CM={cm_total}, ALL={all_total}")

    def test_african_vs_global_events(self):
        """Verify African filter returns subset of global for events"""
        all_response = requests.get(f"{BASE_URL}/api/events/")
        all_total = all_response.json()["total"]
        
        cm_response = requests.get(f"{BASE_URL}/api/events/", params={"country": "CM"})
        cm_total = cm_response.json()["total"]
        
        assert cm_total <= all_total
        print(f"Events: CM={cm_total}, ALL={all_total}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

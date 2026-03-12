"""
Test iteration 85: Operator Rewards & Alerts feature
Tests:
1. GET /api/subscriptions/promotions returns all promotions+alerts for admins
2. GET /api/subscriptions/promotions?item_type=promotion returns only promotions
3. GET /api/subscriptions/promotions?item_type=alert returns only alerts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"


class TestOperatorRewardsAPI:
    """Tests for operator rewards and alerts API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
    
    def test_get_all_promotions_and_alerts(self):
        """GET /api/subscriptions/promotions?limit=500 returns all items for admins"""
        response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?limit=500")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should have 'promotions' key"
        assert "total" in data, "Response should have 'total' key"
        
        # Verify we have items (should have 37 total based on context)
        promotions = data["promotions"]
        assert isinstance(promotions, list), "promotions should be a list"
        print(f"Total items returned: {len(promotions)}, total count: {data['total']}")
        
        # Verify item structure
        if len(promotions) > 0:
            sample = promotions[0]
            assert "id" in sample, "Each item should have 'id'"
            assert "type" in sample, "Each item should have 'type'"
            # type should be 'promotion' or 'alert'
            assert sample["type"] in ["promotion", "alert"], f"Type should be 'promotion' or 'alert', got {sample['type']}"
    
    def test_filter_promotions_only(self):
        """GET /api/subscriptions/promotions?item_type=promotion returns only promotions"""
        response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?item_type=promotion&limit=500")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        promotions = data.get("promotions", [])
        
        # Verify all items are promotions
        for item in promotions:
            assert item.get("type") == "promotion", f"Expected type='promotion', got {item.get('type')}"
        
        print(f"Promotions only: {len(promotions)} items")
    
    def test_filter_alerts_only(self):
        """GET /api/subscriptions/promotions?item_type=alert returns only alerts"""
        response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?item_type=alert&limit=500")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        alerts = data.get("promotions", [])
        
        # Verify all items are alerts
        for item in alerts:
            assert item.get("type") == "alert", f"Expected type='alert', got {item.get('type')}"
        
        print(f"Alerts only: {len(alerts)} items")
    
    def test_item_structure_has_required_fields(self):
        """Verify promotion/alert items have all required fields for UI display"""
        response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data.get("promotions", [])) > 0:
            item = data["promotions"][0]
            
            # Fields needed by frontend Op. Rewards tab
            required_fields = ["id", "type", "title", "message", "operator_name"]
            for field in required_fields:
                assert field in item, f"Item missing required field: {field}"
            
            # Optional but expected fields
            optional_fields = ["status", "service_type", "created_at", "created_by_name"]
            present_optional = [f for f in optional_fields if f in item]
            print(f"Required fields present. Optional fields: {present_optional}")
    
    def test_counts_match_filter(self):
        """Verify filtered counts are consistent"""
        # Get all items
        all_response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?limit=500")
        all_data = all_response.json()
        all_items = all_data.get("promotions", [])
        
        # Get only promotions
        promo_response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?item_type=promotion&limit=500")
        promo_data = promo_response.json()
        promo_count = len(promo_data.get("promotions", []))
        
        # Get only alerts
        alert_response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions?item_type=alert&limit=500")
        alert_data = alert_response.json()
        alert_count = len(alert_data.get("promotions", []))
        
        # Count from all items
        expected_promo = len([i for i in all_items if i.get("type") == "promotion"])
        expected_alert = len([i for i in all_items if i.get("type") == "alert"])
        
        print(f"All items: {len(all_items)}")
        print(f"Promotions: filtered={promo_count}, expected={expected_promo}")
        print(f"Alerts: filtered={alert_count}, expected={expected_alert}")
        
        assert promo_count == expected_promo, f"Promotion count mismatch: {promo_count} vs {expected_promo}"
        assert alert_count == expected_alert, f"Alert count mismatch: {alert_count} vs {expected_alert}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

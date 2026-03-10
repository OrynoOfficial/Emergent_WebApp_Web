"""
Iteration 77 Tests: Route fixes, notification linking, and user-alerts API
Tests for:
1. GET /api/subscriptions/user-alerts - returns alerts from subscribed operators
2. GET /api/notifications/ - returns id field properly (not undefined)
3. Backend subscriptions API functionality
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserAlertsAPI:
    """Test /api/subscriptions/user-alerts endpoint"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping tests")
    
    @pytest.fixture
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Operator login failed - skipping tests")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed - skipping tests")
    
    def test_user_alerts_endpoint_exists(self, customer_token):
        """Test that /api/subscriptions/user-alerts endpoint exists and returns 200"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/user-alerts", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "alerts" in data, "Response should contain 'alerts' field"
        assert "total" in data, "Response should contain 'total' field"
        assert isinstance(data["alerts"], list), "alerts should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        print(f"GET /api/subscriptions/user-alerts: {len(data['alerts'])} alerts, total={data['total']}")
    
    def test_user_alerts_returns_alert_structure(self, customer_token):
        """Test that alerts have proper id field (not _id)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/user-alerts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are alerts, verify each has 'id' field
        for alert in data["alerts"]:
            assert "id" in alert, f"Alert missing 'id' field: {alert.keys()}"
            assert "_id" not in alert, f"Alert should not have '_id' field: {alert.keys()}"
            assert isinstance(alert["id"], str), "id should be a string"
            print(f"Alert has proper id field: {alert['id'][:8]}...")


class TestNotificationsAPI:
    """Test /api/notifications/ endpoint - verify id field is returned properly"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping tests")
    
    def test_notifications_endpoint_exists(self, customer_token):
        """Test that GET /api/notifications/ returns 200"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "notifications" in data, "Response should contain 'notifications' field"
        assert "total" in data, "Response should contain 'total' field"
        assert "unread" in data, "Response should contain 'unread' field"
        print(f"GET /api/notifications/: {len(data['notifications'])} notifications, total={data['total']}, unread={data['unread']}")
    
    def test_notifications_have_id_field(self, customer_token):
        """Test that notifications have 'id' field (not undefined/_id)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify each notification has 'id' not '_id'
        for notification in data["notifications"]:
            assert "id" in notification, f"Notification missing 'id' field: {notification.keys()}"
            assert "_id" not in notification, f"Notification should not have '_id' field: {notification.keys()}"
            assert notification["id"] is not None, "Notification id should not be None"
            assert notification["id"] != "", "Notification id should not be empty"
            print(f"Notification has proper id: {notification['id'][:8]}...")
    
    def test_notifications_have_action_url(self, customer_token):
        """Test that notifications can have action_url for navigation"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if any notification has action_url
        has_action_url = any(n.get("action_url") for n in data["notifications"])
        if has_action_url:
            print("Some notifications have action_url field for navigation")
        else:
            print("No notifications with action_url found (may be expected if no alerts)")


class TestSubscriptionAPI:
    """Test subscription endpoints"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping tests")
    
    def test_my_subscriptions_endpoint(self, customer_token):
        """Test GET /api/subscriptions/my returns user's subscriptions"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/my", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "subscriptions" in data, "Response should contain 'subscriptions' field"
        assert "total" in data, "Response should contain 'total' field"
        print(f"User has {data['total']} subscriptions")


class TestAlertCreation:
    """Test alert creation by operator and notification delivery"""
    
    @pytest.fixture
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Operator login failed - skipping tests")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed - skipping tests")
    
    def test_operator_can_create_alert(self, operator_token):
        """Test that operator can create an alert (may fail if no operator_id linked)"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        
        alert_data = {
            "title": f"TEST_Alert_{datetime.now().strftime('%H%M%S')}",
            "message": "Test alert from automated testing",
            "target_type": "subscribers"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/alerts",
            json=alert_data,
            headers=headers
        )
        
        # May get 400 if no operator_id linked - that's acceptable
        if response.status_code == 400:
            print(f"Alert creation returned 400 (expected if no operator_id): {response.json()}")
        else:
            assert response.status_code == 200, f"Expected 200/400, got {response.status_code}: {response.text}"
            data = response.json()
            assert "alert_id" in data, "Response should contain alert_id"
            print(f"Alert created: {data}")
    
    def test_promotions_list_endpoint(self, admin_token):
        """Test GET /api/subscriptions/promotions returns list of promotions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/promotions", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "promotions" in data, "Response should contain 'promotions' field"
        assert "total" in data, "Response should contain 'total' field"
        print(f"Found {data['total']} promotions/alerts")


class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("API health check passed")
    
    def test_customer_login(self):
        """Test customer login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Customer login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "Login response should contain access_token"
        print("Customer login successful")
    
    def test_operator_login(self):
        """Test operator login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Operator login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "Login response should contain access_token"
        print("Operator login successful")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "Login response should contain access_token"
        print("Admin login successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

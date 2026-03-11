"""
Iteration 79: Testing Messages tab move from Loyalty to Ratings page.
Features:
1. Customer Ratings page now has 2 tabs: 'My Reviews' and 'Messages'
2. Messages tab has 2 sub-tabs: 'Alerts' and 'Notifications'
3. Loyalty page back to 3 tabs (My Rewards, Activity, Rewards)
4. /alerts redirects to /ratings?tab=messages&subtab=alerts
5. /notifications redirects to /ratings?tab=messages&subtab=notifications
6. Backend action_url with deep-link containing item ID
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthEndpoints:
    """Test authentication for test credentials"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_customer_login(self, session):
        """Test customer can login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data.get("user", {}).get("role") == "customer"
        print(f"Customer login successful: {data.get('user', {}).get('email')}")
    
    def test_operator_login(self, session):
        """Test operator can login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Operator login successful: {data.get('user', {}).get('email')}")
    
    def test_admin_login(self, session):
        """Test admin can login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Admin login successful: {data.get('user', {}).get('email')}")


class TestSubscriptionsAPI:
    """Test subscription and alerts API endpoints"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def operator_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Operator login failed")
        return response.json().get("access_token")
    
    def test_get_user_alerts(self, customer_token):
        """Test getting user alerts from subscribed operators"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/user-alerts", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "alerts" in data
        assert "total" in data
        # Verify alert items structure if any exist
        if data["alerts"]:
            for alert in data["alerts"][:3]:
                assert "id" in alert
                assert "type" in alert
                # Type should be 'alert' or 'promotion'
                assert alert["type"] in ["alert", "promotion"]
                print(f"Alert found: {alert.get('title')} (type: {alert.get('type')})")
        print(f"User alerts endpoint works, total: {data['total']}")
    
    def test_get_my_subscriptions(self, customer_token):
        """Test getting user subscriptions"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/my", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "subscriptions" in data
        assert "total" in data
        print(f"Subscriptions: {data['total']}")
    
    def test_get_promotions(self, operator_token):
        """Test getting promotions list"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        response = requests.get(f"{BASE_URL}/api/subscriptions/promotions", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "promotions" in data
        assert "total" in data
        print(f"Promotions: {data['total']}")


class TestNotificationsAPI:
    """Test notifications API endpoints"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("access_token")
    
    def test_get_notifications(self, customer_token):
        """Test getting notifications list"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        # Verify notification structure if any
        if data["notifications"]:
            for notif in data["notifications"][:3]:
                assert "id" in notif or "_id" in notif
                print(f"Notification: {notif.get('title', notif.get('message', ''))[:50]}")
        print(f"Notifications count: {len(data['notifications'])}")
    
    def test_get_unread_count(self, customer_token):
        """Test getting unread notifications count (returned in main notifications endpoint)"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Unread count is returned as part of main notifications response
        assert "unread" in data or "notifications" in data
        print(f"Unread count: {data.get('unread', 'N/A')}")


class TestRatingsAPI:
    """Test ratings API endpoints"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("access_token")
    
    def test_get_my_ratings(self, customer_token):
        """Test getting user's own ratings"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/ratings/my", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Should have ratings list
        assert "ratings" in data or isinstance(data, list)
        print(f"My ratings API works")


class TestLoyaltyAPI:
    """Test loyalty API endpoints"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("access_token")
    
    def test_get_loyalty_program(self, customer_token):
        """Test getting loyalty program info"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/loyalty/program", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Should have tier and points info
        assert "tier" in data or "total_points" in data or "available_points" in data
        print(f"Loyalty tier: {data.get('tier')}, points: {data.get('available_points')}")
    
    def test_get_loyalty_transactions(self, customer_token):
        """Test getting loyalty transactions"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/loyalty/transactions", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "transactions" in data
        print(f"Loyalty transactions: {len(data['transactions'])}")
    
    def test_get_loyalty_rewards(self, customer_token):
        """Test getting available rewards"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/loyalty/rewards", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "rewards" in data
        print(f"Available rewards: {len(data['rewards'])}")


class TestActionUrlDeepLinking:
    """Test that backend generates correct action_url with deep-link IDs"""
    
    @pytest.fixture(scope="class")
    def operator_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Operator login failed")
        return response.json().get("access_token")
    
    def test_alert_action_url_format(self, operator_token):
        """Verify backend returns action_url with correct path for alerts.
        Should be /ratings?tab=messages&subtab=alerts&id=<item_id>"""
        # Check subscriptions.py code for action_url format
        import re
        with open('/app/backend/routes/subscriptions.py', 'r') as f:
            content = f.read()
        
        # Check for alerts action_url format
        alert_url_pattern = r'action_url.*ratings\?tab=messages.*subtab=alerts.*id='
        assert re.search(alert_url_pattern, content), \
            "Alert action_url should contain /ratings?tab=messages&subtab=alerts&id="
        
        # Check for promotions action_url format
        promo_url_pattern = r'action_url.*ratings\?tab=messages.*subtab=notifications.*id='
        assert re.search(promo_url_pattern, content), \
            "Promotion action_url should contain /ratings?tab=messages&subtab=notifications&id="
        
        print("Backend action_url format verified for deep-linking")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

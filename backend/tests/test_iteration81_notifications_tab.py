"""
Iteration 81: Testing Notifications tab for Admin, Operator, and Customer
- Admin Ratings page should have 5 tabs: All Ratings, Queue, Audit Log, Reports, Notifications
- Operator Ratings page should have 2 tabs: Customer Reviews, Notifications
- Customer Ratings page should have 2 tabs: My Reviews, Messages
- GET /api/notifications/ endpoint works for all user roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test Credentials
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}
OPERATOR_CREDS = {"email": "operator@test.com", "password": "testpassword123"}
CUSTOMER_CREDS = {"email": "customer@test.com", "password": "testpassword123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} {response.text}")


@pytest.fixture(scope="module")
def operator_token():
    """Get operator authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=OPERATOR_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Operator login failed: {response.status_code} {response.text}")


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER_CREDS)
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Customer login failed: {response.status_code} {response.text}")


class TestNotificationsAPI:
    """Test GET /api/notifications/ for all user roles"""
    
    def test_admin_get_notifications(self, admin_token):
        """Admin should be able to get notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread" in data
        assert isinstance(data["notifications"], list)
        print(f"Admin has {data['total']} notifications, {data['unread']} unread")
    
    def test_operator_get_notifications(self, operator_token):
        """Operator should be able to get notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Operator notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread" in data
        assert isinstance(data["notifications"], list)
        print(f"Operator has {data['total']} notifications, {data['unread']} unread")
    
    def test_customer_get_notifications(self, customer_token):
        """Customer should be able to get notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Customer notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread" in data
        assert isinstance(data["notifications"], list)
        print(f"Customer has {data['total']} notifications, {data['unread']} unread")


class TestAdminUserInfo:
    """Verify admin user role"""
    
    def test_admin_role_is_admin(self, admin_token):
        """Admin user should have admin role"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") in ["admin", "super_admin"], f"Expected admin role, got {data.get('role')}"
        print(f"Admin email: {data.get('email')}, role: {data.get('role')}")


class TestOperatorUserInfo:
    """Verify operator user role"""
    
    def test_operator_role_is_operator(self, operator_token):
        """Operator user should have operator role"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") == "operator", f"Expected operator role, got {data.get('role')}"
        print(f"Operator email: {data.get('email')}, role: {data.get('role')}")


class TestCustomerUserInfo:
    """Verify customer user role"""
    
    def test_customer_role_is_customer(self, customer_token):
        """Customer user should have customer role"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") == "customer", f"Expected customer role, got {data.get('role')}"
        print(f"Customer email: {data.get('email')}, role: {data.get('role')}")


class TestNotificationFiltering:
    """Test notification filtering parameters"""
    
    def test_filter_unread_notifications(self, admin_token):
        """Should be able to filter unread notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/?is_read=false",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # All returned notifications should be unread
        for notif in data["notifications"]:
            assert notif.get("is_read") == False, "Expected only unread notifications"
    
    def test_filter_read_notifications(self, admin_token):
        """Should be able to filter read notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/?is_read=true",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # All returned notifications should be read
        for notif in data["notifications"]:
            assert notif.get("is_read") == True, "Expected only read notifications"


class TestNotificationPagination:
    """Test notification pagination"""
    
    def test_pagination_limit(self, admin_token):
        """Should respect pagination limit"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/?limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) <= 5
    
    def test_pagination_skip(self, admin_token):
        """Should respect pagination skip"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/?skip=0&limit=3",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

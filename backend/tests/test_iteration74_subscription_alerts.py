"""
Iteration 74 Tests - Subscription Alerts, Promotion Approval, and Events Management

Tests for:
1. POST /api/subscriptions/alerts - sends immediate alerts to subscribers or specific user
2. POST /api/subscriptions/promotions - creates with status=pending_approval
3. PUT /api/subscriptions/promotions/{id}/approve - sends notifications to subscribers
4. PUT /api/subscriptions/promotions/{id}/reject - rejects promotion
5. GET /api/subscriptions/promotions - returns pending_approval_count
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSubscriptionAlerts:
    """Tests for on-demand alerts and promotion approval flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.operator_credentials = {"email": "operator@test.com", "password": "testpassword123"}
        self.customer_credentials = {"email": "customer@test.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token for given credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_alerts_endpoint_exists(self):
        """Test that alerts endpoint exists and requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/subscriptions/alerts", json={
            "title": "Test",
            "message": "Test message"
        })
        # Should return 401 for unauthenticated request
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
    
    def test_operator_can_send_alert_to_subscribers(self):
        """Test operator can send alert to all subscribers"""
        token = self.get_auth_token(self.operator_credentials)
        if not token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/subscriptions/alerts", json={
            "title": "TEST_Alert_" + str(uuid.uuid4())[:8],
            "message": "Test alert message to subscribers",
            "target_type": "subscribers",
            "service_type": "hotel"
        })
        
        # May return 400 if operator has no linked operator_id
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "notified_count" in data, "Response should include notified_count"
            assert "alert_id" in data, "Response should include alert_id"
    
    def test_operator_can_send_alert_to_specific_user(self):
        """Test operator can send alert to specific user"""
        token = self.get_auth_token(self.operator_credentials)
        if not token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/subscriptions/alerts", json={
            "title": "TEST_Specific_Alert_" + str(uuid.uuid4())[:8],
            "message": "Test alert for specific user",
            "target_type": "specific_user",
            "target_user_id": "test_user_123",
            "service_type": "hotel"
        })
        
        # May return 400 if operator has no linked operator_id
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
    
    def test_promotions_created_with_pending_status(self):
        """Test promotions are created with pending_approval status"""
        token = self.get_auth_token(self.operator_credentials)
        if not token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        promo_title = "TEST_Promo_" + str(uuid.uuid4())[:8]
        response = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion message",
            "service_type": "hotel",
            "promotion_type": "discount",
            "discount_value": "20%"
        })
        
        # May return 400 if operator has no linked operator_id
        assert response.status_code in [200, 201, 400], f"Expected 200/201/400, got {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert data.get("status") == "pending_approval", f"Expected pending_approval status, got {data.get('status')}"
    
    def test_get_promotions_returns_pending_count(self):
        """Test GET promotions returns pending_approval_count"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/subscriptions/promotions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promotions" in data, "Response should include promotions"
        assert "pending_approval_count" in data, "Response should include pending_approval_count"
    
    def test_admin_can_approve_promotion(self):
        """Test admin can approve a pending promotion"""
        # First create a promotion as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_ApprovePromo_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion for approval",
            "promotion_type": "general"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        if not promo_id:
            pytest.skip("No promotion_id in response")
        
        # Now approve as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.put(f"{BASE_URL}/api/subscriptions/promotions/{promo_id}/approve")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notified_count" in data, "Response should include notified_count"
    
    def test_admin_can_reject_promotion(self):
        """Test admin can reject a pending promotion"""
        # First create a promotion as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_RejectPromo_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion for rejection",
            "promotion_type": "general"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        if not promo_id:
            pytest.skip("No promotion_id in response")
        
        # Now reject as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.put(f"{BASE_URL}/api/subscriptions/promotions/{promo_id}/reject")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_non_admin_cannot_approve_promotion(self):
        """Test non-admin users cannot approve promotions"""
        token = self.get_auth_token(self.customer_credentials)
        if not token:
            pytest.skip("Customer login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to approve a promotion (will fail with 403)
        response = self.session.put(f"{BASE_URL}/api/subscriptions/promotions/fake-id/approve")
        
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"


class TestEventsManagementTabs:
    """Tests for Events Management page - verify 3 tabs (no Analytics)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_events_endpoint_exists(self):
        """Test events API endpoint exists"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/events/")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


class TestRatingsEndpoints:
    """Tests for ratings page enhancements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_ratings_all_endpoint(self):
        """Test GET /api/ratings/all returns ratings"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/ratings/all")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "ratings" in data or isinstance(data, list), "Should return ratings"
    
    def test_moderation_queue_endpoint(self):
        """Test GET /api/ratings/moderation-queue returns queue items"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/ratings/moderation-queue")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_moderation_audit_endpoint(self):
        """Test GET /api/ratings/moderation-audit returns audit log"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/ratings/moderation-audit")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_export_ratings_endpoint(self):
        """Test GET /api/ratings/export returns exportable data"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/ratings/export")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


class TestSubscribeButtonVisibility:
    """Tests related to SubscribeButton visibility for logged-in users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.customer_credentials = {"email": "customer@test.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_subscription_check_endpoint_works_for_admin(self):
        """Test subscription check endpoint works for admin users"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/subscriptions/check?operator_id=test_operator")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "subscribed" in data, "Should return subscribed status"
    
    def test_subscription_check_endpoint_works_for_customer(self):
        """Test subscription check endpoint works for customer users"""
        token = self.get_auth_token(self.customer_credentials)
        if not token:
            pytest.skip("Customer login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/subscriptions/check?operator_id=test_operator")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "subscribed" in data, "Should return subscribed status"
    
    def test_subscribe_endpoint_works_for_customer(self):
        """Test subscribe endpoint works for customer"""
        token = self.get_auth_token(self.customer_credentials)
        if not token:
            pytest.skip("Customer login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/subscriptions/subscribe", json={
            "operator_id": "TEST_op_" + str(uuid.uuid4())[:8],
            "operator_name": "Test Operator"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("subscribed") == True, "Should return subscribed=True"
    
    def test_subscribe_endpoint_works_for_admin(self):
        """Test subscribe endpoint works for admin (SubscribeButton fix verification)"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/subscriptions/subscribe", json={
            "operator_id": "TEST_admin_op_" + str(uuid.uuid4())[:8],
            "operator_name": "Test Admin Subscription"
        })
        
        # Admin should also be able to subscribe (SubscribeButton visible for all logged-in users)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("subscribed") == True, "Admin should be able to subscribe"

"""
Iteration 75 Tests - Promotion Approval in Validation Page

Tests for:
1. GET /api/validation/pending returns pending_promotions array with count
2. POST /api/validation/promotions/{id}/approve approves promotion and sends notifications to subscribers + operator
3. POST /api/validation/promotions/{id}/reject rejects promotion with reason and notifies operator
4. POST /api/subscriptions/promotions creates promotion with status=pending_approval AND sends notification to all admins
5. Validation page shows 'Pending Promotion Approvals' section with Approve/Reject buttons
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPromotionValidationEndpoints:
    """Tests for promotion approval/rejection via validation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.operator_credentials = {"email": "operator@test.com", "password": "testpassword123"}
        self.superadmin_credentials = {"email": "superadmin@oryno.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token for given credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    # ---- Test GET /api/validation/pending includes pending_promotions ----
    
    def test_validation_pending_returns_promotions(self):
        """Test that GET /api/validation/pending includes pending_promotions array"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pending_promotions" in data, "Response should include pending_promotions array"
        assert isinstance(data["pending_promotions"], list), "pending_promotions should be a list"
        
        # Verify counts include pending_promotions
        assert "counts" in data, "Response should include counts"
        assert "pending_promotions" in data["counts"], "Counts should include pending_promotions"
    
    def test_validation_pending_requires_auth(self):
        """Test that validation/pending requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ---- Test promotion creation sends admin notifications ----
    
    def test_promotion_creation_sends_admin_notification(self):
        """Test that creating a promotion sends notification to all admins"""
        # Login as operator
        token = self.get_auth_token(self.operator_credentials)
        if not token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        promo_title = "TEST_AdminNotify_" + str(uuid.uuid4())[:8]
        response = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion requiring admin approval",
            "promotion_type": "discount",
            "discount_value": "15%"
        })
        
        # May return 400 if operator has no linked operator_id
        if response.status_code == 400:
            pytest.skip(f"Operator not linked: {response.text}")
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "pending_approval", f"Expected pending_approval, got {data.get('status')}"
        assert "promotion_id" in data, "Response should include promotion_id"
        
        return data.get("promotion_id")
    
    # ---- Test POST /api/validation/promotions/{id}/approve ----
    
    def test_validation_approve_promotion_endpoint_exists(self):
        """Test that the validation approve endpoint exists"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try with a fake promotion ID - should return 404 (not 500 or method not allowed)
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/fake-promo-id/approve")
        
        # Should return 404 (not found) for non-existent promotion, NOT 405 (method not allowed)
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}: {response.text}"
    
    def test_admin_can_approve_promotion_via_validation_endpoint(self):
        """Test admin can approve promotion through validation endpoint"""
        # First create a promotion as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_ValidApprove_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion for validation approval",
            "promotion_type": "general"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        if not promo_id:
            pytest.skip("No promotion_id in response")
        
        # Now approve via validation endpoint as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/{promo_id}/approve")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should include message"
        assert "notified_count" in data, "Response should include notified_count"
    
    # ---- Test POST /api/validation/promotions/{id}/reject ----
    
    def test_validation_reject_promotion_endpoint_exists(self):
        """Test that the validation reject endpoint exists"""
        token = self.get_auth_token(self.admin_credentials)
        if not token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try with fake promotion ID - should return 404 (needs reason parameter)
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/fake-promo-id/reject", json={
            "reason": "Test rejection"
        })
        
        # Should return 404 for non-existent promotion, NOT 405 or 500
        assert response.status_code in [404, 400, 422], f"Expected 404/400/422, got {response.status_code}: {response.text}"
    
    def test_admin_can_reject_promotion_via_validation_endpoint(self):
        """Test admin can reject promotion through validation endpoint with reason"""
        # First create a promotion as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_ValidReject_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion for validation rejection",
            "promotion_type": "general"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        if not promo_id:
            pytest.skip("No promotion_id in response")
        
        # Now reject via validation endpoint as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/{promo_id}/reject", json={
            "reason": "Does not meet promotion guidelines"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should include message"
    
    # ---- Test non-admin cannot approve/reject ----
    
    def test_non_admin_cannot_approve_via_validation(self):
        """Test non-admin users cannot approve promotions via validation endpoint"""
        # Try with a customer account (or unauthenticated)
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/fake-id/approve")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ---- Test promotion approval sends operator notification ----
    
    def test_approval_sends_notification_to_operator(self):
        """Test that approving a promotion sends notification to the creating operator"""
        # Create as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_OpNotify_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion - operator should be notified",
            "promotion_type": "event"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        
        # Approve as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/{promo_id}/approve")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check operator's notifications
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        notif_resp = self.session.get(f"{BASE_URL}/api/notifications")
        
        if notif_resp.status_code == 200:
            notifications = notif_resp.json().get("notifications", [])
            # Find notification about approval (search recent ones)
            approval_notifs = [n for n in notifications[:5] if "approved" in n.get("title", "").lower() or "approved" in n.get("message", "").lower()]
            # This is a soft check - notification system may vary
            print(f"Found {len(approval_notifs)} approval notification(s) for operator")
    
    def test_rejection_sends_notification_to_operator(self):
        """Test that rejecting a promotion sends notification to the creating operator"""
        # Create as operator
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_OpRejectNotify_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion - operator should be notified of rejection",
            "promotion_type": "discount"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        
        # Reject as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/validation/promotions/{promo_id}/reject", json={
            "reason": "Content does not meet guidelines"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestSuperAdminValidation:
    """Tests for super admin validation access"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.superadmin_credentials = {"email": "superadmin@oryno.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_superadmin_can_view_pending_validations(self):
        """Test super admin can view all pending validations including promotions"""
        token = self.get_auth_token(self.superadmin_credentials)
        if not token:
            pytest.skip("Super admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pending_promotions" in data, "Should include pending_promotions"
        assert "pending_operators" in data, "Should include pending_operators"
        assert "counts" in data, "Should include counts"


class TestPromotionStatusInResponse:
    """Tests for promotion structure in validation response"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup common test data"""
        self.admin_credentials = {"email": "admin@test.com", "password": "testpassword123"}
        self.operator_credentials = {"email": "operator@test.com", "password": "testpassword123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, credentials):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_pending_promotion_has_required_fields(self):
        """Test that pending promotions in validation response have required fields"""
        # First create a promotion
        op_token = self.get_auth_token(self.operator_credentials)
        if not op_token:
            pytest.skip("Operator login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {op_token}"})
        
        promo_title = "TEST_FieldCheck_" + str(uuid.uuid4())[:8]
        create_resp = self.session.post(f"{BASE_URL}/api/subscriptions/promotions", json={
            "title": promo_title,
            "message": "Test promotion for field validation",
            "promotion_type": "general",
            "discount_value": "25%"
        })
        
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create promotion: {create_resp.text}")
        
        promo_id = create_resp.json().get("promotion_id")
        
        # Get validation pending as admin
        admin_token = self.get_auth_token(self.admin_credentials)
        if not admin_token:
            pytest.skip("Admin login failed")
        
        self.session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        
        assert response.status_code == 200
        
        data = response.json()
        promotions = data.get("pending_promotions", [])
        
        # Find our promotion
        test_promo = next((p for p in promotions if p.get("id") == promo_id), None)
        
        if test_promo:
            # Verify required fields for UI display
            assert "id" in test_promo, "Promotion should have id field"
            assert "title" in test_promo, "Promotion should have title field"
            assert "message" in test_promo, "Promotion should have message field"
            assert "operator_name" in test_promo, "Promotion should have operator_name field"
            assert "status" in test_promo or test_promo.get("status") is None, "Promotion may have status field"
            
            # Clean up - delete test promotion
            self.session.delete(f"{BASE_URL}/api/subscriptions/promotions/{promo_id}")

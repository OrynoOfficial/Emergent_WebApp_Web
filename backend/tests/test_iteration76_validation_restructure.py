"""
Test iteration 76: Validation Management Restructure
- Tests Pending/Validated tabs structure
- Tests validation history API with type_counts
- Tests reject dialog functionality
- Tests audit logging of validation actions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"


class TestValidationAPIs:
    """Tests for validation management restructure APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.admin_token = None
        
    def get_admin_token(self):
        """Authenticate as admin and get token"""
        if self.admin_token:
            return self.admin_token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.admin_token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
            return self.admin_token
        return None

    # ============ GET /api/validation/pending Tests ============
    
    def test_validation_pending_requires_auth(self):
        """Test that GET /api/validation/pending requires authentication"""
        response = requests.get(f"{BASE_URL}/api/validation/pending")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: /api/validation/pending requires authentication")
    
    def test_validation_pending_returns_all_categories(self):
        """Test that pending validations returns all expected categories"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify main arrays exist
        assert "general_tickets" in data, "Missing general_tickets array"
        assert "cancellation_tickets" in data, "Missing cancellation_tickets array"
        assert "pending_payments" in data, "Missing pending_payments array"
        assert "pending_operators" in data, "Missing pending_operators array"
        assert "pending_promotions" in data, "Missing pending_promotions array"
        
        # Verify services object exists with all sub-collections
        assert "services" in data, "Missing services object"
        services = data["services"]
        expected_service_types = ["travel_routes", "hotels", "car_rentals", "restaurants", 
                                   "packages", "events", "cinemas", "pressing", "banquets"]
        for stype in expected_service_types:
            assert stype in services, f"Missing service type: {stype}"
            
        # Verify counts object
        assert "counts" in data, "Missing counts object"
        counts = data["counts"]
        expected_count_keys = ["general_tickets", "cancellation_tickets", "pending_payments",
                               "pending_operators", "pending_promotions", "services"]
        for key in expected_count_keys:
            assert key in counts, f"Missing count for: {key}"
            
        print(f"PASS: Pending validations returns all categories. Counts: {counts}")
    
    def test_pending_payments_have_id_field(self):
        """Test that pending payments have id field (not just _id)"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        assert response.status_code == 200
        
        data = response.json()
        payments = data.get("pending_payments", [])
        
        if len(payments) > 0:
            first_payment = payments[0]
            assert "id" in first_payment, "Payment missing 'id' field"
            assert "_id" not in first_payment, "Payment should not have '_id' field exposed"
            print(f"PASS: Pending payments have proper id field. Found {len(payments)} pending payments")
        else:
            print("SKIP: No pending payments to test (count: 0)")
    
    # ============ GET /api/validation/history Tests ============
    
    def test_validation_history_endpoint_exists(self):
        """Test that GET /api/validation/history endpoint exists"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/validation/history endpoint accessible")
    
    def test_validation_history_returns_type_counts(self):
        """Test that history returns type_counts for Validated tab badges"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/history?limit=200")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "entries" in data, "Missing entries array"
        assert "total" in data, "Missing total count"
        assert "type_counts" in data, "Missing type_counts for Validated tab badges"
        
        type_counts = data["type_counts"]
        expected_types = ["payment", "ticket", "service", "promotion", "operator"]
        for t in expected_types:
            assert t in type_counts, f"Missing type_count for: {t}"
            
        print(f"PASS: History returns type_counts. Counts: {type_counts}")
    
    def test_validation_history_entries_have_required_fields(self):
        """Test that history entries have all required fields for display"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/history?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) > 0:
            first_entry = entries[0]
            required_fields = ["action", "item_type", "item_id", "item_name", 
                               "performed_by_name", "created_at"]
            for field in required_fields:
                assert field in first_entry, f"History entry missing required field: {field}"
            
            # Verify action is one of expected values
            valid_actions = ["approved", "rejected", "verified", "refunded"]
            assert first_entry["action"] in valid_actions, f"Invalid action: {first_entry['action']}"
            
            print(f"PASS: History entries have all required fields. First entry: action={first_entry['action']}, type={first_entry['item_type']}")
        else:
            print("INFO: No history entries yet (this is expected for fresh install)")
    
    def test_validation_history_filter_by_type(self):
        """Test filtering history by item_type"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        # Test filter by payment type
        response = self.session.get(f"{BASE_URL}/api/validation/history?item_type=payment")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        entries = data.get("entries", [])
        
        # All returned entries should be payment type
        for entry in entries:
            assert entry.get("item_type") == "payment", f"Filter returned non-payment entry: {entry.get('item_type')}"
        
        print(f"PASS: History filter by type works. Found {len(entries)} payment entries")
    
    def test_validation_history_filter_by_action(self):
        """Test filtering history by action"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        # Test filter by approved action
        response = self.session.get(f"{BASE_URL}/api/validation/history?action=approved")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        entries = data.get("entries", [])
        
        # All returned entries should be approved
        for entry in entries:
            assert entry.get("action") == "approved", f"Filter returned non-approved entry: {entry.get('action')}"
        
        print(f"PASS: History filter by action works. Found {len(entries)} approved entries")
    
    # ============ Approve/Reject with Logging Tests ============
    
    def test_payment_verify_logs_to_history(self):
        """Test that payment verification is logged to history"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        # Get initial history count
        history_before = self.session.get(f"{BASE_URL}/api/validation/history")
        count_before = history_before.json().get("total", 0)
        
        # Get a pending payment
        pending = self.session.get(f"{BASE_URL}/api/validation/pending")
        payments = pending.json().get("pending_payments", [])
        
        if len(payments) == 0:
            print("SKIP: No pending payments to test verification logging")
            return
        
        payment = payments[0]
        payment_id = payment.get("id")
        
        # Verify the payment
        verify_response = self.session.post(f"{BASE_URL}/api/validation/payments/{payment_id}/verify?verified=true")
        assert verify_response.status_code == 200, f"Payment verify failed: {verify_response.status_code} - {verify_response.text}"
        
        # Check history count increased
        history_after = self.session.get(f"{BASE_URL}/api/validation/history")
        count_after = history_after.json().get("total", 0)
        
        assert count_after > count_before, f"History count did not increase after verification. Before: {count_before}, After: {count_after}"
        
        print(f"PASS: Payment verification logged to history. Count increased from {count_before} to {count_after}")
    
    def test_ticket_approval_requires_reason_optional(self):
        """Test that ticket approval works without reason (reason is optional)"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        # Get a pending ticket
        pending = self.session.get(f"{BASE_URL}/api/validation/pending")
        tickets = pending.json().get("general_tickets", [])
        
        if len(tickets) == 0:
            print("SKIP: No pending tickets to test approval")
            return
        
        ticket = tickets[0]
        ticket_id = ticket.get("id")
        
        # Approve without reason
        approve_response = self.session.post(f"{BASE_URL}/api/validation/tickets/{ticket_id}/approve", json={})
        assert approve_response.status_code == 200, f"Ticket approve failed: {approve_response.status_code} - {approve_response.text}"
        
        print(f"PASS: Ticket approval works without reason. Approved ticket {ticket_id}")
    
    def test_ticket_rejection_requires_reason(self):
        """Test that ticket rejection requires a reason"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        # Get a pending ticket
        pending = self.session.get(f"{BASE_URL}/api/validation/pending")
        tickets = pending.json().get("general_tickets", [])
        
        if len(tickets) == 0:
            print("SKIP: No pending tickets to test rejection")
            return
        
        ticket = tickets[0]
        ticket_id = ticket.get("id")
        
        # Try reject without reason - should fail (422 validation error)
        reject_response = self.session.post(f"{BASE_URL}/api/validation/tickets/{ticket_id}/reject", json={})
        assert reject_response.status_code == 422, f"Expected 422 for missing reason, got {reject_response.status_code}"
        
        # Try reject with reason - should succeed
        reject_with_reason = self.session.post(f"{BASE_URL}/api/validation/tickets/{ticket_id}/reject", 
                                                json={"reason": "TEST_REJECTION: Invalid booking details"})
        assert reject_with_reason.status_code == 200, f"Ticket reject with reason failed: {reject_with_reason.status_code}"
        
        print(f"PASS: Ticket rejection requires reason. Validation works correctly")
    
    # ============ Counts Verification Tests ============
    
    def test_pending_counts_match_array_lengths(self):
        """Test that counts match actual array lengths"""
        token = self.get_admin_token()
        assert token, "Failed to authenticate as admin"
        
        response = self.session.get(f"{BASE_URL}/api/validation/pending")
        assert response.status_code == 200
        
        data = response.json()
        counts = data.get("counts", {})
        
        # Verify counts match array lengths
        assert counts["general_tickets"] == len(data["general_tickets"]), \
            f"general_tickets count mismatch: {counts['general_tickets']} vs {len(data['general_tickets'])}"
        assert counts["cancellation_tickets"] == len(data["cancellation_tickets"]), \
            f"cancellation_tickets count mismatch"
        assert counts["pending_payments"] == len(data["pending_payments"]), \
            f"pending_payments count mismatch"
        assert counts["pending_operators"] == len(data["pending_operators"]), \
            f"pending_operators count mismatch"
        assert counts["pending_promotions"] == len(data["pending_promotions"]), \
            f"pending_promotions count mismatch"
        
        # Calculate services total
        services = data["services"]
        services_total = sum(len(services[k]) for k in services)
        assert counts["services"] == services_total, \
            f"services count mismatch: {counts['services']} vs {services_total}"
        
        print(f"PASS: All counts match array lengths correctly")
        print(f"  - Pending payments: {counts['pending_payments']}")
        print(f"  - General tickets: {counts['general_tickets']}")
        print(f"  - Cancellation tickets: {counts['cancellation_tickets']}")
        print(f"  - Services: {counts['services']}")
        print(f"  - Promotions: {counts['pending_promotions']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

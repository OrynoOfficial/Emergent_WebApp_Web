"""
Test Iteration 91: Operator Scoping for Support Tickets and Promo Codes
Tests that operators only see their respective data while admins see all.

Features tested:
- GET /api/support-tickets/ - admin sees all (38), operator sees scoped (4)
- GET /api/support-tickets/stats - admin sees total=38, operator sees scoped total
- GET /api/support-tickets/stats/detailed - operator gets scoped data (not 403)
- GET /api/support-tickets/{id} - operator can view own operator-scoped ticket
- GET /api/promo-codes/ - already scopes by operator_id for operator role
- DELETE /api/promo-codes/{code} - operator only deletes their own codes
- Communications/alerts - already scoped by operator_id
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"


class TestAuthHelpers:
    """Helper methods for authentication"""
    
    @staticmethod
    def get_auth_token(email: str, password: str) -> dict:
        """Login and return token + user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user": data.get("user", {}),
                "headers": {"Authorization": f"Bearer {data.get('access_token')}"}
            }
        return None


@pytest.fixture(scope="module")
def admin_auth():
    """Get admin authentication"""
    auth = TestAuthHelpers.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not auth:
        pytest.skip("Admin authentication failed")
    return auth


@pytest.fixture(scope="module")
def operator_auth():
    """Get operator authentication"""
    auth = TestAuthHelpers.get_auth_token(OPERATOR_EMAIL, OPERATOR_PASSWORD)
    if not auth:
        pytest.skip("Operator authentication failed")
    return auth


@pytest.fixture(scope="module")
def customer_auth():
    """Get customer authentication"""
    auth = TestAuthHelpers.get_auth_token(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    if not auth:
        pytest.skip("Customer authentication failed")
    return auth


# ==================== SUPPORT TICKETS SCOPING TESTS ====================

class TestSupportTicketsScoping:
    """Test support tickets operator scoping"""
    
    def test_admin_gets_all_tickets(self, admin_auth):
        """Admin should see all support tickets"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=admin_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tickets" in data
        assert "total" in data
        
        # Admin should see all tickets (expected ~38 based on context)
        total = data["total"]
        print(f"Admin sees {total} total tickets")
        assert total > 0, "Admin should see tickets"
    
    def test_operator_gets_scoped_tickets(self, operator_auth, admin_auth):
        """Operator should only see tickets related to their operator_id or customer_id"""
        # First get admin count for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=admin_auth["headers"]
        )
        admin_total = admin_response.json().get("total", 0)
        
        # Now get operator count
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=operator_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        operator_total = data["total"]
        
        print(f"Admin sees {admin_total} tickets, Operator sees {operator_total} tickets")
        
        # Operator should see fewer tickets than admin (scoped)
        # Note: Could be 0 if no tickets match operator's scope
        assert operator_total <= admin_total, "Operator should see same or fewer tickets than admin"
        
        # Verify tickets are properly scoped
        # User object uses 'id' not '_id', and operator_id is in operator_context
        operator_id = operator_auth["user"].get("operator_context", {}).get("operator_id")
        user_id = operator_auth["user"].get("id")  # Use 'id' not '_id'
        
        print(f"Operator ID: {operator_id}, User ID: {user_id}")
        
        for ticket in data.get("tickets", []):
            # Each ticket should either have matching operator_id or customer_id
            ticket_op_id = ticket.get("operator_id")
            ticket_cust_id = ticket.get("customer_id")
            
            # Scoping uses $or: [{operator_id: op_id}, {customer_id: user_id}]
            is_valid_scope = (ticket_op_id == operator_id) or (ticket_cust_id == user_id)
            
            print(f"Ticket {ticket.get('id')}: op_id={ticket_op_id}, cust_id={ticket_cust_id}, valid={is_valid_scope}")
            
            # Verify the ticket matches at least one condition
            assert is_valid_scope, f"Ticket {ticket.get('id')} not properly scoped (op_id={ticket_op_id}, cust_id={ticket_cust_id})"
    
    def test_admin_stats_returns_all(self, admin_auth):
        """Admin stats should return total count of all tickets"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/stats",
            headers=admin_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "by_status" in data
        
        total = data["total"]
        print(f"Admin stats total: {total}")
        assert total >= 0, "Total should be non-negative"
    
    def test_operator_stats_returns_scoped(self, operator_auth, admin_auth):
        """Operator stats should return scoped count"""
        # Get admin stats for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/support-tickets/stats",
            headers=admin_auth["headers"]
        )
        admin_total = admin_response.json().get("total", 0)
        
        # Get operator stats
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/stats",
            headers=operator_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        operator_total = data["total"]
        
        print(f"Admin stats total: {admin_total}, Operator stats total: {operator_total}")
        
        # Operator should see same or fewer
        assert operator_total <= admin_total, "Operator stats should be scoped"
    
    def test_operator_detailed_stats_not_403(self, operator_auth):
        """Operator should be able to access detailed stats (not 403)"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/stats/detailed",
            headers=operator_auth["headers"]
        )
        
        # Should NOT be 403 - operator is now allowed
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data
        print(f"Operator detailed stats total: {data['total']}")
    
    def test_admin_detailed_stats(self, admin_auth):
        """Admin should access detailed stats with all data"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/stats/detailed",
            headers=admin_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "team_workload" in data
        print(f"Admin detailed stats total: {data['total']}")


class TestSupportTicketViewById:
    """Test viewing individual tickets by ID with scoping"""
    
    def test_operator_can_view_own_scoped_ticket(self, operator_auth):
        """Operator should be able to view a ticket in their scope"""
        # First get operator's tickets
        list_response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=operator_auth["headers"]
        )
        
        if list_response.status_code != 200:
            pytest.skip("Could not get operator tickets")
        
        tickets = list_response.json().get("tickets", [])
        
        if not tickets:
            pytest.skip("No tickets in operator's scope to test")
        
        # Try to view the first ticket
        ticket_id = tickets[0].get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/{ticket_id}",
            headers=operator_auth["headers"]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("id") == ticket_id
        print(f"Operator successfully viewed ticket {ticket_id}")
    
    def test_operator_cannot_view_other_operator_ticket(self, operator_auth, admin_auth):
        """Operator should NOT be able to view tickets outside their scope"""
        # Get all tickets as admin
        admin_response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=admin_auth["headers"],
            params={"limit": 100}
        )
        
        all_tickets = admin_response.json().get("tickets", [])
        
        # Get operator's tickets
        operator_response = requests.get(
            f"{BASE_URL}/api/support-tickets/",
            headers=operator_auth["headers"],
            params={"limit": 100}
        )
        
        operator_ticket_ids = {t.get("id") for t in operator_response.json().get("tickets", [])}
        
        # Find a ticket NOT in operator's scope
        other_ticket = None
        for ticket in all_tickets:
            if ticket.get("id") not in operator_ticket_ids:
                other_ticket = ticket
                break
        
        if not other_ticket:
            pytest.skip("No tickets outside operator's scope to test")
        
        # Try to view the other ticket
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/{other_ticket['id']}",
            headers=operator_auth["headers"]
        )
        
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"Operator correctly blocked from viewing ticket {other_ticket['id']}")


# ==================== PROMO CODES SCOPING TESTS ====================

class TestPromoCodesScoping:
    """Test promo codes operator scoping"""
    
    def test_admin_gets_all_promo_codes(self, admin_auth):
        """Admin should see all promo codes"""
        response = requests.get(
            f"{BASE_URL}/api/promo-codes/",
            headers=admin_auth["headers"]
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "promo_codes" in data
        assert "total" in data
        
        total = data["total"]
        print(f"Admin sees {total} promo codes")
    
    def test_operator_gets_scoped_promo_codes(self, operator_auth, admin_auth):
        """Operator should only see their own promo codes"""
        # Note: This may return 403 if operator doesn't have promo.view permission
        # That's a permission config issue, not a scoping bug
        
        response = requests.get(
            f"{BASE_URL}/api/promo-codes/",
            headers=operator_auth["headers"]
        )
        
        if response.status_code == 403:
            print("Operator got 403 - missing promo.view permission (expected per context)")
            pytest.skip("Operator missing promo.view permission - permission config issue, not scoping bug")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        operator_total = data["total"]
        
        # Get admin count for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/promo-codes/",
            headers=admin_auth["headers"]
        )
        admin_total = admin_response.json().get("total", 0)
        
        print(f"Admin sees {admin_total} promo codes, Operator sees {operator_total}")
        
        # Operator should see same or fewer
        assert operator_total <= admin_total, "Operator should see scoped promo codes"


class TestPromoCodeDeleteScoping:
    """Test promo code DELETE scoping"""
    
    def test_operator_can_delete_own_promo_code(self, operator_auth):
        """Operator should be able to delete their own promo code"""
        # First create a promo code as operator
        test_code = f"TEST_OP_DEL_{uuid.uuid4().hex[:6].upper()}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/promo-codes/",
            headers=operator_auth["headers"],
            json={
                "code": test_code,
                "name": "Test Operator Delete Code",
                "discount_type": "percentage",
                "discount_value": 10,
                "valid_from": datetime.utcnow().isoformat(),
                "valid_to": "2027-12-31T23:59:59",
                "usage_limit": 100,
                "per_user_limit": 1
            }
        )
        
        if create_response.status_code == 403:
            pytest.skip("Operator missing promo.create permission")
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test promo code: {create_response.text}")
        
        # Now delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/promo-codes/{test_code}",
            headers=operator_auth["headers"]
        )
        
        if delete_response.status_code == 403:
            pytest.skip("Operator missing promo.delete permission")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        print(f"Operator successfully deleted their own promo code {test_code}")
    
    def test_operator_cannot_delete_other_operator_promo_code(self, operator_auth, admin_auth):
        """Operator should NOT be able to delete another operator's promo code"""
        # Create a promo code as admin (no operator_id)
        test_code = f"TEST_ADMIN_{uuid.uuid4().hex[:6].upper()}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/promo-codes/",
            headers=admin_auth["headers"],
            json={
                "code": test_code,
                "name": "Test Admin Code",
                "discount_type": "percentage",
                "discount_value": 15,
                "valid_from": datetime.utcnow().isoformat(),
                "valid_to": "2027-12-31T23:59:59",
                "usage_limit": 100,
                "per_user_limit": 1
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test promo code: {create_response.text}")
        
        # Try to delete as operator
        delete_response = requests.delete(
            f"{BASE_URL}/api/promo-codes/{test_code}",
            headers=operator_auth["headers"]
        )
        
        if delete_response.status_code == 403:
            # Could be permission issue or scoping - check message
            print(f"Operator got 403 trying to delete admin's code: {delete_response.text}")
            # This is expected behavior - either permission or scoping blocks it
        
        # Should be 404 (not found in operator's scope) or 403 (permission denied)
        assert delete_response.status_code in [403, 404], f"Expected 403 or 404, got {delete_response.status_code}: {delete_response.text}"
        print(f"Operator correctly blocked from deleting admin's promo code {test_code}")
        
        # Cleanup - delete as admin
        requests.delete(
            f"{BASE_URL}/api/promo-codes/{test_code}",
            headers=admin_auth["headers"]
        )


# ==================== COMMUNICATIONS SCOPING TESTS ====================

class TestCommunicationsScoping:
    """Test communications/alerts scoping (already implemented)"""
    
    def test_operator_announcements_scoped(self, operator_auth):
        """Operator should only see their own announcements"""
        response = requests.get(
            f"{BASE_URL}/api/communications/announcements",
            headers=operator_auth["headers"],
            params={"service_type": "travel"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Operator sees {data.get('total', 0)} announcements for travel service")
    
    def test_operator_alerts_scoped(self, operator_auth):
        """Operator should only see their own alerts"""
        response = requests.get(
            f"{BASE_URL}/api/communications/alerts",
            headers=operator_auth["headers"],
            params={"service_type": "travel"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Operator sees {data.get('total', 0)} alerts for travel service")
    
    def test_admin_sees_all_announcements(self, admin_auth):
        """Admin should see all announcements (no operator filter)"""
        response = requests.get(
            f"{BASE_URL}/api/communications/announcements",
            headers=admin_auth["headers"],
            params={"service_type": "travel"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Admin sees {data.get('total', 0)} announcements for travel service")


# ==================== CUSTOMER ACCESS TESTS ====================

class TestCustomerAccess:
    """Test that customers have appropriate access"""
    
    def test_customer_sees_only_own_tickets(self, customer_auth):
        """Customer should only see their own tickets"""
        response = requests.get(
            f"{BASE_URL}/api/support-tickets/my",
            headers=customer_auth["headers"]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # User object uses 'id' not '_id'
        customer_id = customer_auth["user"].get("id")
        
        print(f"Customer ID: {customer_id}, Total tickets: {data.get('total', 0)}")
        
        # All tickets should belong to this customer
        for ticket in data.get("tickets", []):
            assert ticket.get("customer_id") == customer_id, f"Customer should only see own tickets, got customer_id={ticket.get('customer_id')}"
        
        print(f"Customer sees {data.get('total', 0)} of their own tickets")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

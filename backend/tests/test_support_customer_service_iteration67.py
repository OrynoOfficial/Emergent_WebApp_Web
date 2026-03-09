"""
Test Support/Customer Service API Endpoints - Iteration 67
Tests for:
- Support tickets CRUD (customer, admin)
- Chat sessions (AI chatbot)
- Ticket creation from chat
- Create ticket on behalf (admin feature)
- Products endpoint for ticket creation
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://modernized-portal.preview.emergentagent.com')

# Test credentials
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
SUPERADMIN_EMAIL = "superadmin@oryno.com"
SUPERADMIN_PASSWORD = "testpassword123"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def customer_session(self):
        """Get authenticated customer session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Customer login failed: {response.status_code}")
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    @pytest.fixture(scope="class")
    def superadmin_session(self):
        """Get authenticated superadmin session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Superadmin login failed: {response.status_code}")
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session


class TestSupportTicketsCustomer(TestAuth):
    """Test support ticket endpoints for customer"""
    
    def test_get_my_tickets(self, customer_session):
        """Test GET /api/support-tickets/my"""
        response = customer_session.get(f"{BASE_URL}/api/support-tickets/my")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Response should contain tickets array"
        print(f"PASS: Customer can get their tickets ({len(data['tickets'])} found)")
    
    def test_get_products_for_tickets(self, customer_session):
        """Test GET /api/support-tickets/products - products for ticket creation"""
        response = customer_session.get(f"{BASE_URL}/api/support-tickets/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "categories" in data, "Response should contain categories"
        assert "products" in data, "Response should contain products"
        print(f"PASS: Products endpoint returns categories ({len(data.get('categories', []))}) and products ({len(data.get('products', []))})")
    
    def test_create_ticket_customer(self, customer_session):
        """Test POST /api/support-tickets/ - customer creates ticket"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        ticket_data = {
            "subject": f"TEST_Customer_Ticket_{timestamp}",
            "description": "This is a test ticket created by customer",
            "category": "booking",
            "priority": "medium",  # Customers send medium but backend should enforce it anyway
            "source": "web",
            "product_involved": "Test Hotel",
            "service_tag": "Hotels"
        }
        response = customer_session.post(f"{BASE_URL}/api/support-tickets/", json=ticket_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ticket" in data, "Response should contain ticket"
        ticket = data["ticket"]
        assert ticket["subject"] == ticket_data["subject"], "Subject should match"
        assert ticket["ticket_number"].startswith("TKT-"), "Ticket number should start with TKT-"
        assert "tags" in ticket and len(ticket["tags"]) > 0, "Auto-tags should be generated"
        print(f"PASS: Customer created ticket {ticket['ticket_number']} with tags: {ticket.get('tags')}")
        return ticket["id"]


class TestChatSessions(TestAuth):
    """Test chat session endpoints"""
    
    def test_create_new_session(self, customer_session):
        """Test POST /api/support/chat/new-session"""
        response = customer_session.post(f"{BASE_URL}/api/support/chat/new-session")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        print(f"PASS: Created new chat session {data['session_id']}")
        return data["session_id"]
    
    def test_get_sessions(self, customer_session):
        """Test GET /api/support/chat/sessions"""
        response = customer_session.get(f"{BASE_URL}/api/support/chat/sessions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "sessions" in data, "Response should contain sessions array"
        print(f"PASS: Retrieved {len(data['sessions'])} chat sessions")
        return data["sessions"]
    
    def test_send_chat_message(self, customer_session):
        """Test POST /api/support/chat - send message to AI"""
        # First create a new session
        session_response = customer_session.post(f"{BASE_URL}/api/support/chat/new-session")
        session_id = session_response.json().get("session_id")
        
        # Send a message
        chat_data = {
            "message": "Hello, I need help with my booking",
            "session_id": session_id
        }
        response = customer_session.post(f"{BASE_URL}/api/support/chat", json=chat_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "response" in data, "Response should contain AI response"
        assert "session_id" in data, "Response should contain session_id"
        assert "escalate_to_human" in data, "Response should contain escalate_to_human flag"
        print(f"PASS: Chat message sent, AI responded with {len(data['response'])} chars")
        return session_id
    
    def test_get_session_messages(self, customer_session):
        """Test GET /api/support/chat/session/{session_id}"""
        # Create and populate a session
        session_response = customer_session.post(f"{BASE_URL}/api/support/chat/new-session")
        session_id = session_response.json().get("session_id")
        
        # Send a message
        customer_session.post(f"{BASE_URL}/api/support/chat", json={
            "message": "Test message",
            "session_id": session_id
        })
        
        # Get session messages
        response = customer_session.get(f"{BASE_URL}/api/support/chat/session/{session_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data, "Response should contain messages array"
        assert len(data["messages"]) >= 2, "Should have at least user message and AI response"
        print(f"PASS: Retrieved {len(data['messages'])} messages from session")


class TestTicketFromChat(TestAuth):
    """Test creating ticket from chat session"""
    
    def test_create_ticket_from_chat(self, customer_session):
        """Test POST /api/support-tickets/from-chat"""
        # Create a chat session with messages
        session_response = customer_session.post(f"{BASE_URL}/api/support/chat/new-session")
        session_id = session_response.json().get("session_id")
        
        # Add some chat messages
        customer_session.post(f"{BASE_URL}/api/support/chat", json={
            "message": "I have an issue with my hotel booking",
            "session_id": session_id
        })
        
        # Create ticket from chat
        ticket_data = {
            "session_id": session_id,
            "subject": "Help with hotel booking",
            "category": "booking",
            "product_involved": "Test Hotel",
            "service_tag": "Hotels"
        }
        response = customer_session.post(f"{BASE_URL}/api/support-tickets/from-chat", json=ticket_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ticket" in data, "Response should contain ticket"
        ticket = data["ticket"]
        assert "from-chat" in ticket.get("tags", []), "Ticket should have 'from-chat' tag"
        assert ticket.get("source") == "chat", "Ticket source should be 'chat'"
        assert "Conversation Context" in ticket.get("description", ""), "Description should contain chat context"
        print(f"PASS: Created ticket {ticket['ticket_number']} from chat session with tags: {ticket.get('tags')}")


class TestAdminTicketFeatures(TestAuth):
    """Test admin-specific ticket features"""
    
    def test_get_ticket_stats(self, superadmin_session):
        """Test GET /api/support-tickets/stats"""
        response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total" in data, "Stats should contain total"
        assert "by_status" in data, "Stats should contain by_status"
        assert "by_category" in data, "Stats should contain by_category"
        print(f"PASS: Stats returned - Total: {data['total']}, Open: {data['by_status'].get('open', 0)}")
    
    def test_get_all_tickets(self, superadmin_session):
        """Test GET /api/support-tickets/ - admin gets all tickets"""
        response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tickets" in data, "Response should contain tickets"
        assert "total" in data, "Response should contain total count"
        print(f"PASS: Admin retrieved {len(data['tickets'])} tickets (total: {data['total']})")
    
    def test_get_team_members(self, superadmin_session):
        """Test GET /api/support-tickets/team-members"""
        response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/team-members")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "team_members" in data, "Response should contain team_members"
        print(f"PASS: Retrieved {len(data['team_members'])} team members")
    
    def test_get_users_for_behalf(self, superadmin_session):
        """Test GET /api/support-tickets/users-for-behalf"""
        response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/users-for-behalf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "users" in data, "Response should contain users"
        print(f"PASS: Retrieved {len(data['users'])} users available for create-on-behalf")
        return data["users"]
    
    def test_create_ticket_on_behalf(self, superadmin_session):
        """Test POST /api/support-tickets/create-on-behalf - admin creates ticket for user"""
        # First get users to create ticket on behalf of
        users_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/users-for-behalf")
        users = users_response.json().get("users", [])
        
        if not users:
            pytest.skip("No users available for create-on-behalf test")
        
        # Find a customer user
        customer_user = next((u for u in users if u.get("role") == "customer"), users[0])
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        ticket_data = {
            "subject": f"TEST_OnBehalf_Ticket_{timestamp}",
            "description": "Ticket created by admin on behalf of customer",
            "category": "payment",
            "priority": "high",
            "on_behalf_of_id": customer_user["id"],
            "on_behalf_of_type": customer_user.get("role", "customer"),
            "product_involved": "Test Service",
            "service_tag": "Hotels"
        }
        response = superadmin_session.post(f"{BASE_URL}/api/support-tickets/create-on-behalf", json=ticket_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "ticket" in data, "Response should contain ticket"
        ticket = data["ticket"]
        assert ticket.get("source") == "admin", "Ticket source should be 'admin'"
        assert ticket.get("created_by_admin_name") is not None, "Should have admin creator info"
        print(f"PASS: Admin created ticket {ticket['ticket_number']} on behalf of {customer_user['name']}")


class TestTicketDetailAndReplies(TestAuth):
    """Test ticket detail view and replies"""
    
    def test_get_ticket_detail(self, customer_session, superadmin_session):
        """Test GET /api/support-tickets/{id}"""
        # First create a ticket
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        ticket_data = {
            "subject": f"TEST_Detail_Ticket_{timestamp}",
            "description": "Ticket for detail test",
            "category": "technical",
            "priority": "low"
        }
        create_response = customer_session.post(f"{BASE_URL}/api/support-tickets/", json=ticket_data)
        ticket_id = create_response.json()["ticket"]["id"]
        
        # Get ticket detail as customer (owner)
        response = customer_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == ticket_id, "Ticket ID should match"
        assert "messages" in data, "Ticket should have messages array"
        print(f"PASS: Retrieved ticket detail for {data['ticket_number']}")
        
        # Get same ticket as admin
        admin_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        assert admin_response.status_code == 200, "Admin should be able to view customer ticket"
        print("PASS: Admin can view customer's ticket detail")
    
    def test_reply_to_ticket(self, customer_session, superadmin_session):
        """Test POST /api/support-tickets/{id}/reply"""
        # Create a ticket
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        create_response = customer_session.post(f"{BASE_URL}/api/support-tickets/", json={
            "subject": f"TEST_Reply_Ticket_{timestamp}",
            "description": "Ticket for reply test",
            "category": "inquiry"
        })
        ticket_id = create_response.json()["ticket"]["id"]
        
        # Customer replies
        customer_reply_response = customer_session.post(
            f"{BASE_URL}/api/support-tickets/{ticket_id}/reply",
            json={"message": "Customer follow-up message", "is_internal": False}
        )
        assert customer_reply_response.status_code == 200, f"Customer reply failed: {customer_reply_response.text}"
        
        # Admin replies
        admin_reply_response = superadmin_session.post(
            f"{BASE_URL}/api/support-tickets/{ticket_id}/reply",
            json={"message": "Support team response", "is_internal": False}
        )
        assert admin_reply_response.status_code == 200, f"Admin reply failed: {admin_reply_response.text}"
        
        # Admin adds internal note
        internal_note_response = superadmin_session.post(
            f"{BASE_URL}/api/support-tickets/{ticket_id}/reply",
            json={"message": "Internal note - not visible to customer", "is_internal": True}
        )
        assert internal_note_response.status_code == 200, f"Internal note failed: {internal_note_response.text}"
        
        # Verify messages in ticket
        ticket_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        ticket_data = ticket_response.json()
        assert len(ticket_data.get("messages", [])) >= 4, "Should have original message + 3 replies"
        print(f"PASS: Ticket has {len(ticket_data['messages'])} messages including replies and internal note")


class TestTicketAssignment(TestAuth):
    """Test ticket assignment functionality"""
    
    def test_assign_ticket(self, superadmin_session):
        """Test POST /api/support-tickets/{id}/assign"""
        # Create a ticket first
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        create_response = superadmin_session.post(f"{BASE_URL}/api/support-tickets/", json={
            "subject": f"TEST_Assign_Ticket_{timestamp}",
            "description": "Ticket for assignment test",
            "category": "complaint"
        })
        ticket_id = create_response.json()["ticket"]["id"]
        
        # Get team members
        team_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/team-members")
        team_members = team_response.json().get("team_members", [])
        
        if not team_members:
            pytest.skip("No team members available for assignment test")
        
        # Assign to first team member
        assignee = team_members[0]
        assign_response = superadmin_session.post(
            f"{BASE_URL}/api/support-tickets/{ticket_id}/assign",
            json={
                "assignee_id": assignee["id"],
                "assignee_name": assignee["name"],
                "notes": "Assigning for testing"
            }
        )
        assert assign_response.status_code == 200, f"Assignment failed: {assign_response.text}"
        
        # Verify assignment
        ticket_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        ticket = ticket_response.json()
        assert ticket.get("assigned_to") == assignee["id"], "Assignee ID should match"
        assert ticket.get("assigned_to_name") == assignee["name"], "Assignee name should match"
        print(f"PASS: Ticket assigned to {assignee['name']}")


class TestTicketStatusUpdate(TestAuth):
    """Test ticket status updates"""
    
    def test_update_ticket_status(self, superadmin_session):
        """Test PUT /api/support-tickets/{id} - status update"""
        # Create a ticket
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        create_response = superadmin_session.post(f"{BASE_URL}/api/support-tickets/", json={
            "subject": f"TEST_Status_Ticket_{timestamp}",
            "description": "Ticket for status test",
            "category": "feedback"
        })
        ticket_id = create_response.json()["ticket"]["id"]
        
        # Update status to in_progress
        update_response = superadmin_session.put(
            f"{BASE_URL}/api/support-tickets/{ticket_id}",
            json={"status": "in_progress"}
        )
        assert update_response.status_code == 200, f"Status update failed: {update_response.text}"
        
        # Verify update
        ticket_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        assert ticket_response.json().get("status") == "in_progress", "Status should be in_progress"
        
        # Update to resolved
        resolved_response = superadmin_session.put(
            f"{BASE_URL}/api/support-tickets/{ticket_id}",
            json={"status": "resolved"}
        )
        assert resolved_response.status_code == 200
        
        # Verify resolved_at is set
        ticket_response = superadmin_session.get(f"{BASE_URL}/api/support-tickets/{ticket_id}")
        ticket = ticket_response.json()
        assert ticket.get("status") == "resolved", "Status should be resolved"
        assert ticket.get("resolved_at") is not None, "resolved_at should be set"
        print("PASS: Ticket status updated through lifecycle (open -> in_progress -> resolved)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

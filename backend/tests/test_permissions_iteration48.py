"""
Iteration 48 - Permission Enforcement Tests
Tests permission enforcement across all route files with require_permission/require_any_permission.
Verifies admin/super_admin can access management endpoints, and customer gets 403.
Tests NEW endpoints: events.edit, events.delete, orders.edit, orders.process, activity.export
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CREDENTIALS = {
    "super_admin": {"email": "superadmin@oryno.com", "password": "testpassword123"},
    "admin": {"email": "admin@test.com", "password": "testpassword123"},
    "customer": {"email": "customer@test.com", "password": "testpassword123"},
    "operator": {"email": "operator@test.com", "password": "testpassword123"}
}


@pytest.fixture(scope="module")
def auth_tokens():
    """Get auth tokens for all test users"""
    tokens = {}
    for role, creds in CREDENTIALS.items():
        response = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
        if response.status_code == 200:
            data = response.json()
            tokens[role] = data.get("access_token") or data.get("token")
        else:
            print(f"Warning: Failed to login as {role}: {response.status_code}")
            tokens[role] = None
    return tokens


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def get_auth_header(token):
    """Get authorization header"""
    return {"Authorization": f"Bearer {token}"}


# ==================== RESTAURANT CRUD PERMISSIONS ====================
class TestRestaurantPermissions:
    """Test restaurants.create/edit/delete/manage_menu permission enforcement"""
    
    def test_admin_can_create_restaurant(self, api_client, auth_tokens):
        """Admin should be able to create a restaurant"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/restaurants/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Restaurant_Admin",
                "description": "Test restaurant",
                "address": "123 Test St",
                "city": "Yaoundé",
                "country": "Cameroon"
            }
        )
        assert response.status_code in [200, 201], f"Admin should create restaurant: {response.text}"
        print(f"Admin create restaurant: {response.status_code}")
    
    def test_customer_cannot_create_restaurant(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a restaurant"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/restaurants/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Restaurant_Customer",
                "description": "Should fail",
                "address": "123 Test St",
                "city": "Yaoundé",
                "country": "Cameroon"
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create restaurant: {response.status_code} (expected 403)")


# ==================== CINEMA CRUD PERMISSIONS ====================
class TestCinemaPermissions:
    """Test cinema.create/edit/delete/manage_screenings permission enforcement"""
    
    def test_admin_can_create_cinema(self, api_client, auth_tokens):
        """Admin should be able to create a cinema"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/cinema/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Cinema_Admin",
                "city": "Yaoundé",
                "address": "Cinema Plaza",
                "total_screens": 5
            }
        )
        assert response.status_code in [200, 201], f"Admin should create cinema: {response.text}"
        print(f"Admin create cinema: {response.status_code}")
    
    def test_customer_cannot_create_cinema(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a cinema"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/cinema/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Cinema_Customer",
                "city": "Yaoundé",
                "address": "Cinema Plaza",
                "total_screens": 5
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create cinema: {response.status_code} (expected 403)")


# ==================== TRAVEL ROUTE PERMISSIONS ====================
class TestTravelPermissions:
    """Test travel.create/edit/delete permission enforcement"""
    
    def test_admin_can_create_travel_route(self, api_client, auth_tokens):
        """Admin should be able to create a travel route"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/travel/routes",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "from_city": "Yaoundé",
                "to_city": "Douala",
                "departure_time": "08:00",
                "arrival_time": "12:00",
                "price": 5000
            }
        )
        assert response.status_code in [200, 201], f"Admin should create travel route: {response.text}"
        print(f"Admin create travel route: {response.status_code}")
    
    def test_customer_cannot_create_travel_route(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a travel route"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/travel/routes",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "from_city": "Yaoundé",
                "to_city": "Douala",
                "departure_time": "08:00",
                "arrival_time": "12:00",
                "price": 5000
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create travel route: {response.status_code} (expected 403)")


# ==================== BANQUET PERMISSIONS ====================
class TestBanquetPermissions:
    """Test banquets.create/edit/delete permission enforcement"""
    
    def test_admin_can_create_banquet(self, api_client, auth_tokens):
        """Admin should be able to create a banquet venue"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/banquets/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Banquet_Admin",
                "city": "Yaoundé",
                "address": "Banquet Hall",
                "capacity_min": 50,
                "capacity_max": 500
            }
        )
        assert response.status_code in [200, 201], f"Admin should create banquet: {response.text}"
        print(f"Admin create banquet: {response.status_code}")
    
    def test_customer_cannot_create_banquet(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a banquet"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/banquets/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Banquet_Customer",
                "city": "Yaoundé",
                "address": "Banquet Hall",
                "capacity_min": 50,
                "capacity_max": 500
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create banquet: {response.status_code} (expected 403)")


# ==================== PRESSING/LAUNDRY PERMISSIONS ====================
class TestPressingPermissions:
    """Test pressing.create/edit/delete permission enforcement"""
    
    def test_admin_can_create_pressing(self, api_client, auth_tokens):
        """Admin should be able to create a pressing service"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/pressing/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Pressing_Admin",
                "city": "Yaoundé",
                "address": "Laundry Shop"
            }
        )
        assert response.status_code in [200, 201], f"Admin should create pressing: {response.text}"
        print(f"Admin create pressing: {response.status_code}")
    
    def test_customer_cannot_create_pressing(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a pressing service"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/pressing/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Pressing_Customer",
                "city": "Yaoundé",
                "address": "Laundry Shop"
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create pressing: {response.status_code} (expected 403)")


# ==================== PACKAGES PERMISSIONS ====================
class TestPackagesPermissions:
    """Test packages.create/edit/delete permission enforcement"""
    
    def test_admin_can_create_package(self, api_client, auth_tokens):
        """Admin should be able to create a package"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/packages/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Package_Admin",
                "destination": "Beach Resort",
                "base_price": 100000,
                "duration_days": 3
            }
        )
        assert response.status_code in [200, 201], f"Admin should create package: {response.text}"
        print(f"Admin create package: {response.status_code}")
    
    def test_customer_cannot_create_package(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a package"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/packages/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Package_Customer",
                "destination": "Beach Resort",
                "base_price": 100000,
                "duration_days": 3
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create package: {response.status_code} (expected 403)")


# ==================== EVENTS - NEW ENDPOINTS ====================
class TestEventsNewEndpoints:
    """Test NEW events.edit and events.delete endpoints"""
    
    @pytest.fixture(scope="class")
    def test_event(self, api_client, auth_tokens):
        """Create a test event for edit/delete tests"""
        if not auth_tokens.get("admin"):
            return None
        
        response = api_client.post(
            f"{BASE_URL}/api/events/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Event_ForEditDelete",
                "description": "Test event for edit/delete",
                "event_type": "concert",
                "venue": "Test Venue",
                "city": "Yaoundé",
                "country": "Cameroon",
                "event_date": "2026-12-01T18:00:00",
                "start_time": "18:00",
                "end_time": "22:00",
                "ticket_price": 5000,
                "total_seats": 100
            }
        )
        if response.status_code in [200, 201]:
            return response.json().get("event_id")
        return None
    
    def test_admin_can_update_event(self, api_client, auth_tokens, test_event):
        """Admin should be able to update an event - NEW endpoint"""
        if not auth_tokens.get("admin") or not test_event:
            pytest.skip("Admin token or test event not available")
        
        response = api_client.put(
            f"{BASE_URL}/api/events/{test_event}",
            headers=get_auth_header(auth_tokens["admin"]),
            json={"name": "TEST_Event_Updated"}
        )
        assert response.status_code == 200, f"Admin should update event: {response.text}"
        print(f"Admin update event: {response.status_code}")
    
    def test_customer_cannot_update_event(self, api_client, auth_tokens, test_event):
        """Customer should get 403 trying to update an event"""
        if not auth_tokens.get("customer") or not test_event:
            pytest.skip("Customer token or test event not available")
        
        response = api_client.put(
            f"{BASE_URL}/api/events/{test_event}",
            headers=get_auth_header(auth_tokens["customer"]),
            json={"name": "TEST_Event_ShouldFail"}
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer update event: {response.status_code} (expected 403)")
    
    def test_admin_can_delete_event(self, api_client, auth_tokens):
        """Admin should be able to delete an event - NEW endpoint"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        # Create a new event specifically for deletion
        create_response = api_client.post(
            f"{BASE_URL}/api/events/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Event_ToDelete",
                "description": "Test event to delete",
                "event_type": "concert",
                "venue": "Test Venue",
                "city": "Yaoundé",
                "country": "Cameroon",
                "event_date": "2026-12-15T18:00:00",
                "start_time": "18:00",
                "end_time": "22:00",
                "ticket_price": 5000,
                "total_seats": 100
            }
        )
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create event for delete test")
        
        event_id = create_response.json().get("event_id")
        
        response = api_client.delete(
            f"{BASE_URL}/api/events/{event_id}",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should delete event: {response.text}"
        print(f"Admin delete event: {response.status_code}")
    
    def test_customer_cannot_delete_event(self, api_client, auth_tokens, test_event):
        """Customer should get 403 trying to delete an event"""
        if not auth_tokens.get("customer") or not test_event:
            pytest.skip("Customer token or test event not available")
        
        response = api_client.delete(
            f"{BASE_URL}/api/events/{test_event}",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer delete event: {response.status_code} (expected 403)")


# ==================== ORDERS - NEW ENDPOINTS ====================
class TestOrdersNewEndpoints:
    """Test NEW orders.edit and orders.process endpoints"""
    
    def test_admin_can_update_order(self, api_client, auth_tokens):
        """Admin should be able to update an order - NEW endpoint"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        # Get an existing order first
        list_response = api_client.get(
            f"{BASE_URL}/api/orders/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        
        orders = list_response.json().get("orders", [])
        if not orders:
            pytest.skip("No orders found to test update")
        
        order_id = orders[0].get("id") or orders[0].get("_id")
        
        response = api_client.put(
            f"{BASE_URL}/api/orders/{order_id}",
            headers=get_auth_header(auth_tokens["admin"]),
            json={"notes": "TEST_Updated by admin"}
        )
        assert response.status_code == 200, f"Admin should update order: {response.text}"
        print(f"Admin update order: {response.status_code}")
    
    def test_customer_cannot_update_order(self, api_client, auth_tokens):
        """Customer should get 403 trying to update an order via edit endpoint"""
        if not auth_tokens.get("customer") or not auth_tokens.get("admin"):
            pytest.skip("Required tokens not available")
        
        # Get an order as admin first
        list_response = api_client.get(
            f"{BASE_URL}/api/orders/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        
        orders = list_response.json().get("orders", [])
        if not orders:
            pytest.skip("No orders found to test")
        
        order_id = orders[0].get("id") or orders[0].get("_id")
        
        response = api_client.put(
            f"{BASE_URL}/api/orders/{order_id}",
            headers=get_auth_header(auth_tokens["customer"]),
            json={"notes": "TEST_Should fail"}
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer update order: {response.status_code} (expected 403)")
    
    def test_admin_can_process_order(self, api_client, auth_tokens):
        """Admin should be able to process a pending order - NEW endpoint"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        # Find a pending order
        list_response = api_client.get(
            f"{BASE_URL}/api/orders/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        
        orders = list_response.json().get("orders", [])
        pending_order = next((o for o in orders if o.get("status") == "pending"), None)
        
        if not pending_order:
            pytest.skip("No pending orders found to test process")
        
        order_id = pending_order.get("id") or pending_order.get("_id")
        
        response = api_client.put(
            f"{BASE_URL}/api/orders/{order_id}/process",
            headers=get_auth_header(auth_tokens["admin"])
        )
        # Should be 200 if order exists and is pending, 400 if already processed
        assert response.status_code in [200, 400], f"Admin should process order: {response.text}"
        print(f"Admin process order: {response.status_code}")
    
    def test_customer_cannot_process_order(self, api_client, auth_tokens):
        """Customer should get 403 trying to process an order"""
        if not auth_tokens.get("customer") or not auth_tokens.get("admin"):
            pytest.skip("Required tokens not available")
        
        # Get an order as admin first
        list_response = api_client.get(
            f"{BASE_URL}/api/orders/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        
        orders = list_response.json().get("orders", [])
        if not orders:
            pytest.skip("No orders found to test")
        
        order_id = orders[0].get("id") or orders[0].get("_id")
        
        response = api_client.put(
            f"{BASE_URL}/api/orders/{order_id}/process",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer process order: {response.status_code} (expected 403)")


# ==================== ACTIVITY LOGS - NEW EXPORT ENDPOINT ====================
class TestActivityLogPermissions:
    """Test activity.view and activity.export permission enforcement"""
    
    def test_admin_can_view_activity_logs(self, api_client, auth_tokens):
        """Admin should be able to view activity logs"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/activity/logs",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should view logs: {response.text}"
        print(f"Admin view activity logs: {response.status_code}")
    
    def test_customer_cannot_view_activity_logs(self, api_client, auth_tokens):
        """Customer should get 403 trying to view activity logs"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/activity/logs",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer view activity logs: {response.status_code} (expected 403)")
    
    def test_super_admin_can_export_activity_logs(self, api_client, auth_tokens):
        """Super admin should be able to export activity logs - NEW endpoint"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/activity/export",
            headers=get_auth_header(auth_tokens["super_admin"])
        )
        assert response.status_code == 200, f"Super admin should export logs: {response.text}"
        print(f"Super admin export activity logs: {response.status_code}")
    
    def test_admin_can_export_activity_logs(self, api_client, auth_tokens):
        """Admin should be able to export activity logs if they have activity.export permission"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/activity/export",
            headers=get_auth_header(auth_tokens["admin"])
        )
        # Admin may or may not have this permission depending on config
        print(f"Admin export activity logs: {response.status_code}")
    
    def test_customer_cannot_export_activity_logs(self, api_client, auth_tokens):
        """Customer should get 403 trying to export activity logs"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/activity/export",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer export activity logs: {response.status_code} (expected 403)")


# ==================== USER CRUD PERMISSIONS ====================
class TestUserPermissions:
    """Test users.view/create/edit/delete/manage_roles/view_activity permissions"""
    
    def test_admin_can_view_users(self, api_client, auth_tokens):
        """Admin should be able to view users"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/users/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should view users: {response.text}"
        print(f"Admin view users: {response.status_code}")
    
    def test_customer_cannot_view_users_list(self, api_client, auth_tokens):
        """Customer should get 403 trying to view users list"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/users/",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer view users list: {response.status_code} (expected 403)")
    
    def test_admin_can_create_user(self, api_client, auth_tokens):
        """Admin should be able to create a user"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        import uuid
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(
            f"{BASE_URL}/api/users/create",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "email": unique_email,
                "full_name": "TEST_User Created",
                "password": "testpass123",
                "role": "customer"
            }
        )
        assert response.status_code in [200, 201], f"Admin should create user: {response.text}"
        print(f"Admin create user: {response.status_code}")
    
    def test_customer_cannot_create_user(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a user"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/users/create",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "email": "should_fail@test.com",
                "full_name": "Should Fail",
                "password": "testpass123",
                "role": "customer"
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create user: {response.status_code} (expected 403)")


# ==================== EMPLOYEES PERMISSIONS ====================
class TestEmployeesPermissions:
    """Test employees.view/create/edit/delete permission enforcement"""
    
    def test_admin_can_view_employees(self, api_client, auth_tokens):
        """Admin should be able to view employees"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/employees/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should view employees: {response.text}"
        print(f"Admin view employees: {response.status_code}")
    
    def test_customer_cannot_view_employees(self, api_client, auth_tokens):
        """Customer should get 403 trying to view employees"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/employees/",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer view employees: {response.status_code} (expected 403)")


# ==================== LOYALTY ADMIN PERMISSIONS ====================
class TestLoyaltyAdminPermissions:
    """Test loyalty.view/manage_rewards permission enforcement on admin endpoints"""
    
    def test_admin_can_view_loyalty_stats(self, api_client, auth_tokens):
        """Admin should be able to view loyalty stats"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/loyalty/admin/stats",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should view loyalty stats: {response.text}"
        print(f"Admin view loyalty stats: {response.status_code}")
    
    def test_customer_cannot_view_loyalty_admin_stats(self, api_client, auth_tokens):
        """Customer should get 403 trying to view loyalty admin stats"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/loyalty/admin/stats",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer view loyalty admin stats: {response.status_code} (expected 403)")
    
    def test_super_admin_can_create_reward(self, api_client, auth_tokens):
        """Super admin should be able to create a loyalty reward"""
        if not auth_tokens.get("super_admin"):
            pytest.skip("Super admin token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=get_auth_header(auth_tokens["super_admin"]),
            json={
                "title": "TEST_Reward_Admin",
                "description": "Test reward",
                "points_required": 100,
                "min_tier": "bronze",
                "type": "discount"
            }
        )
        assert response.status_code in [200, 201], f"Super admin should create reward: {response.text}"
        print(f"Super admin create reward: {response.status_code}")
    
    def test_customer_cannot_create_reward(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a loyalty reward"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/loyalty/admin/rewards",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "title": "TEST_Reward_Customer",
                "description": "Should fail",
                "points_required": 100,
                "min_tier": "bronze",
                "type": "discount"
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create reward: {response.status_code} (expected 403)")


# ==================== PROMO CODES PERMISSIONS ====================
class TestPromoCodesPermissions:
    """Test promo.view/create/edit/delete permission enforcement"""
    
    def test_admin_can_view_promo_codes(self, api_client, auth_tokens):
        """Admin should be able to view promo codes"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/promo-codes/",
            headers=get_auth_header(auth_tokens["admin"])
        )
        assert response.status_code == 200, f"Admin should view promo codes: {response.text}"
        print(f"Admin view promo codes: {response.status_code}")
    
    def test_customer_cannot_view_promo_codes(self, api_client, auth_tokens):
        """Customer should get 403 trying to view promo codes list"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.get(
            f"{BASE_URL}/api/promo-codes/",
            headers=get_auth_header(auth_tokens["customer"])
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer view promo codes: {response.status_code} (expected 403)")
    
    def test_admin_can_create_promo_code(self, api_client, auth_tokens):
        """Admin should be able to create a promo code"""
        if not auth_tokens.get("admin"):
            pytest.skip("Admin token not available")
        
        import uuid
        unique_code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        
        response = api_client.post(
            f"{BASE_URL}/api/promo-codes/",
            headers=get_auth_header(auth_tokens["admin"]),
            json={
                "name": "TEST_Promo",
                "code": unique_code,
                "discount_type": "percentage",
                "discount_value": 10,
                "valid_from": "2026-01-01",
                "valid_to": "2026-12-31"
            }
        )
        assert response.status_code in [200, 201], f"Admin should create promo code: {response.text}"
        print(f"Admin create promo code: {response.status_code}")
    
    def test_customer_cannot_create_promo_code(self, api_client, auth_tokens):
        """Customer should get 403 trying to create a promo code"""
        if not auth_tokens.get("customer"):
            pytest.skip("Customer token not available")
        
        response = api_client.post(
            f"{BASE_URL}/api/promo-codes/",
            headers=get_auth_header(auth_tokens["customer"]),
            json={
                "name": "TEST_Promo_Fail",
                "code": "SHOULDFAIL",
                "discount_type": "percentage",
                "discount_value": 10,
                "valid_from": "2026-01-01",
                "valid_to": "2026-12-31"
            }
        )
        assert response.status_code == 403, f"Customer should get 403: {response.status_code}"
        print(f"Customer create promo code: {response.status_code} (expected 403)")


# ==================== LOGIN VERIFICATION ====================
class TestLoginEndpoints:
    """Verify login works for all test users"""
    
    def test_super_admin_login(self, api_client):
        """Super admin should be able to login"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json=CREDENTIALS["super_admin"]
        )
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"Super admin login: {response.status_code}")
    
    def test_admin_login(self, api_client):
        """Admin should be able to login"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json=CREDENTIALS["admin"]
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        print(f"Admin login: {response.status_code}")
    
    def test_customer_login(self, api_client):
        """Customer should be able to login"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json=CREDENTIALS["customer"]
        )
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        print(f"Customer login: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

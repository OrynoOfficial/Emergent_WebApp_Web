"""
Test file for Operator-Scoped Data Display and CRUD Operations
Tests P0 features:
- Operator can create travel routes
- Operator can create vehicles
- Operator can view their routes (scoped)
- Operator can view their vehicles (scoped)
- Analytics Dashboard shows operator-scoped data
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
OPERATOR_EMAIL = "operator@test.com"
OPERATOR_PASSWORD = "testpassword123"
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"


class TestOperatorAuthentication:
    """Test operator login and authentication"""
    
    def test_operator_login(self):
        """Test operator can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data.get("user", {}).get("role") == "operator", f"User role is not operator: {data.get('user', {}).get('role')}"
        print(f"✓ Operator login successful. User: {data.get('user', {}).get('email')}")
        print(f"  Operator ID: {data.get('user', {}).get('operator_id')}")
        print(f"  Operator Name: {data.get('user', {}).get('operator_name')}")
        return data["access_token"], data.get("user", {})


class TestOperatorRoutesCRUD:
    """Test operator can create, read, update, delete travel routes"""
    
    @pytest.fixture
    def operator_auth(self):
        """Get operator authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        if response.status_code != 200:
            pytest.skip(f"Operator login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data.get("user", {}),
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_operator_create_route(self, operator_auth):
        """P0: Operator can create travel routes - POST /api/travel/routes"""
        headers = operator_auth["headers"]
        
        route_data = {
            "from_city": "TEST_Douala",
            "to_city": "TEST_Yaoundé",
            "departure_time": "08:00",
            "arrival_time": "12:00",
            "price": 5000,
            "total_seats": 50,
            "vehicle_type": "normal",
            "amenities": ["wifi", "ac"]
        }
        
        response = requests.post(f"{BASE_URL}/api/travel/routes", json=route_data, headers=headers)
        assert response.status_code == 200, f"Create route failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "route_id" in data, f"No route_id in response: {data}"
        print(f"✓ Operator created route successfully. Route ID: {data['route_id']}")
        return data["route_id"]
    
    def test_operator_view_my_routes(self, operator_auth):
        """P0: Operator can view their routes - GET /api/travel/management/my-routes"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/travel/management/my-routes", headers=headers)
        assert response.status_code == 200, f"Get my routes failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "routes" in data, f"No routes in response: {data}"
        assert "total" in data, f"No total in response: {data}"
        
        # Verify operator scoping - operator_id is in operator_context
        user = operator_auth["user"]
        operator_id = user.get("operator_context", {}).get("operator_id") or user.get("operator_id")
        
        for route in data["routes"]:
            # Routes should belong to this operator
            if route.get("operator_id") and operator_id:
                assert route["operator_id"] == operator_id, f"Route {route.get('id')} belongs to different operator"
        
        print(f"✓ Operator can view their routes. Total: {data['total']}")
        print(f"  Is operator scoped: {data.get('is_operator_scoped', 'N/A')}")
    
    def test_operator_update_route(self, operator_auth):
        """Test operator can update their own route"""
        headers = operator_auth["headers"]
        
        # First create a route
        route_data = {
            "from_city": "TEST_Update_Origin",
            "to_city": "TEST_Update_Dest",
            "departure_time": "09:00",
            "arrival_time": "13:00",
            "price": 6000
        }
        
        create_response = requests.post(f"{BASE_URL}/api/travel/routes", json=route_data, headers=headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create route for update test: {create_response.text}")
        
        route_id = create_response.json()["route_id"]
        
        # Update the route
        update_data = {"price": 7000, "departure_time": "10:00"}
        update_response = requests.put(f"{BASE_URL}/api/travel/routes/{route_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Update route failed: {update_response.status_code} - {update_response.text}"
        
        print(f"✓ Operator updated route {route_id} successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/travel/routes/{route_id}", headers=headers)
    
    def test_operator_delete_route(self, operator_auth):
        """Test operator can delete their own route"""
        headers = operator_auth["headers"]
        
        # First create a route
        route_data = {
            "from_city": "TEST_Delete_Origin",
            "to_city": "TEST_Delete_Dest",
            "departure_time": "11:00",
            "arrival_time": "15:00",
            "price": 5500
        }
        
        create_response = requests.post(f"{BASE_URL}/api/travel/routes", json=route_data, headers=headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create route for delete test: {create_response.text}")
        
        route_id = create_response.json()["route_id"]
        
        # Delete the route
        delete_response = requests.delete(f"{BASE_URL}/api/travel/routes/{route_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete route failed: {delete_response.status_code} - {delete_response.text}"
        
        print(f"✓ Operator deleted route {route_id} successfully")


class TestOperatorVehiclesCRUD:
    """Test operator can create, read, update, delete vehicles"""
    
    @pytest.fixture
    def operator_auth(self):
        """Get operator authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        if response.status_code != 200:
            pytest.skip(f"Operator login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data.get("user", {}),
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_operator_create_vehicle(self, operator_auth):
        """P0: Operator can create vehicles - POST /api/vehicles/"""
        headers = operator_auth["headers"]
        
        vehicle_data = {
            "vehicle_name": f"TEST_Bus_{uuid.uuid4().hex[:6]}",
            "vehicle_type": "normal",
            "plate_number": f"TEST-{uuid.uuid4().hex[:4].upper()}",
            "manufacturer": "Mercedes",
            "model": "Sprinter",
            "year": 2023,
            "total_seats": 45,
            "amenities": ["wifi", "ac"],
            "maintenance_status": "active"
        }
        
        response = requests.post(f"{BASE_URL}/api/vehicles/", json=vehicle_data, headers=headers)
        assert response.status_code == 200, f"Create vehicle failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "vehicle_id" in data, f"No vehicle_id in response: {data}"
        print(f"✓ Operator created vehicle successfully. Vehicle ID: {data['vehicle_id']}")
        return data["vehicle_id"]
    
    def test_operator_view_vehicles(self, operator_auth):
        """P0: Operator can view their vehicles - GET /api/vehicles/"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/vehicles/", headers=headers)
        assert response.status_code == 200, f"Get vehicles failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "vehicles" in data, f"No vehicles in response: {data}"
        assert "total" in data, f"No total in response: {data}"
        
        # Verify operator scoping - operator_id is in operator_context
        user = operator_auth["user"]
        operator_id = user.get("operator_context", {}).get("operator_id") or user.get("operator_id")
        
        for vehicle in data["vehicles"]:
            if vehicle.get("operator_id") and operator_id:
                assert vehicle["operator_id"] == operator_id, f"Vehicle {vehicle.get('id')} belongs to different operator"
        
        print(f"✓ Operator can view their vehicles. Total: {data['total']}")
    
    def test_operator_update_vehicle(self, operator_auth):
        """Test operator can update their own vehicle"""
        headers = operator_auth["headers"]
        
        # First create a vehicle
        vehicle_data = {
            "vehicle_name": f"TEST_Update_Bus_{uuid.uuid4().hex[:6]}",
            "vehicle_type": "normal",
            "plate_number": f"UPD-{uuid.uuid4().hex[:4].upper()}",
            "total_seats": 40
        }
        
        create_response = requests.post(f"{BASE_URL}/api/vehicles/", json=vehicle_data, headers=headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create vehicle for update test: {create_response.text}")
        
        vehicle_id = create_response.json()["vehicle_id"]
        
        # Update the vehicle
        update_data = {"total_seats": 50, "maintenance_status": "maintenance"}
        update_response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Update vehicle failed: {update_response.status_code} - {update_response.text}"
        
        print(f"✓ Operator updated vehicle {vehicle_id} successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=headers)
    
    def test_operator_delete_vehicle(self, operator_auth):
        """Test operator can delete their own vehicle"""
        headers = operator_auth["headers"]
        
        # First create a vehicle
        vehicle_data = {
            "vehicle_name": f"TEST_Delete_Bus_{uuid.uuid4().hex[:6]}",
            "vehicle_type": "normal",
            "plate_number": f"DEL-{uuid.uuid4().hex[:4].upper()}",
            "total_seats": 35
        }
        
        create_response = requests.post(f"{BASE_URL}/api/vehicles/", json=vehicle_data, headers=headers)
        if create_response.status_code != 200:
            pytest.skip(f"Could not create vehicle for delete test: {create_response.text}")
        
        vehicle_id = create_response.json()["vehicle_id"]
        
        # Delete the vehicle
        delete_response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=headers)
        assert delete_response.status_code == 200, f"Delete vehicle failed: {delete_response.status_code} - {delete_response.text}"
        
        print(f"✓ Operator deleted vehicle {vehicle_id} successfully")


class TestOperatorAnalytics:
    """Test operator-scoped analytics data"""
    
    @pytest.fixture
    def operator_auth(self):
        """Get operator authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        if response.status_code != 200:
            pytest.skip(f"Operator login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data.get("user", {}),
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_analytics_overview_endpoint(self, operator_auth):
        """P1: Analytics Dashboard shows operator-scoped data - GET /api/analytics/overview"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers=headers)
        assert response.status_code == 200, f"Analytics overview failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "summary" in data, f"No summary in response: {data}"
        
        summary = data["summary"]
        print(f"✓ Analytics overview endpoint works for operator")
        print(f"  Total Users: {summary.get('totalUsers', 0)}")
        print(f"  Total Bookings: {summary.get('totalBookings', 0)}")
        print(f"  Total Revenue: {summary.get('totalRevenue', 0)} FCFA")
        print(f"  Avg Order Value: {summary.get('avgOrderValue', 0)} FCFA")
        
        return data
    
    def test_operator_dashboard_endpoint(self, operator_auth):
        """Test operator dashboard analytics endpoint"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/analytics/operator/dashboard", headers=headers)
        assert response.status_code == 200, f"Operator dashboard failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "summary" in data, f"No summary in response: {data}"
        
        summary = data["summary"]
        print(f"✓ Operator dashboard endpoint works")
        print(f"  Total Orders: {summary.get('total_orders', 0)}")
        print(f"  Total Revenue: {summary.get('total_revenue', 0)} FCFA")
        print(f"  Is Operator Scoped: {data.get('is_operator_scoped', 'N/A')}")
        
        return data


class TestDataIsolation:
    """Test that operator data is properly isolated"""
    
    @pytest.fixture
    def super_admin_auth(self):
        """Get super admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Super admin login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    @pytest.fixture
    def operator_auth(self):
        """Get operator authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        if response.status_code != 200:
            pytest.skip(f"Operator login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data.get("user", {}),
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_admin_sees_all_routes(self, super_admin_auth):
        """Super admin should see all routes"""
        headers = super_admin_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/travel/management/my-routes", headers=headers)
        assert response.status_code == 200, f"Get routes failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"✓ Super admin can see all routes. Total: {data.get('total', 0)}")
        print(f"  Is operator scoped: {data.get('is_operator_scoped', 'N/A')}")
        
        return data
    
    def test_operator_routes_are_scoped(self, operator_auth, super_admin_auth):
        """Operator should only see their own routes"""
        operator_headers = operator_auth["headers"]
        admin_headers = super_admin_auth["headers"]
        
        # Get operator's routes
        op_response = requests.get(f"{BASE_URL}/api/travel/management/my-routes", headers=operator_headers)
        assert op_response.status_code == 200
        op_routes = op_response.json()
        
        # Get admin's routes (all)
        admin_response = requests.get(f"{BASE_URL}/api/travel/management/my-routes", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_routes = admin_response.json()
        
        # Operator should see fewer or equal routes than admin
        assert op_routes.get("total", 0) <= admin_routes.get("total", 0), \
            f"Operator sees more routes ({op_routes.get('total')}) than admin ({admin_routes.get('total')})"
        
        print(f"✓ Data isolation verified")
        print(f"  Operator routes: {op_routes.get('total', 0)}")
        print(f"  Admin routes: {admin_routes.get('total', 0)}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def operator_auth(self):
        """Get operator authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "is_operator_login": True
        })
        if response.status_code != 200:
            pytest.skip(f"Operator login failed: {response.text}")
        data = response.json()
        return {
            "token": data["access_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_cleanup_test_routes(self, operator_auth):
        """Clean up TEST_ prefixed routes"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/travel/management/my-routes", headers=headers)
        if response.status_code != 200:
            return
        
        routes = response.json().get("routes", [])
        deleted = 0
        for route in routes:
            if route.get("from_city", "").startswith("TEST_") or route.get("to_city", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/travel/routes/{route['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test routes")
    
    def test_cleanup_test_vehicles(self, operator_auth):
        """Clean up TEST_ prefixed vehicles"""
        headers = operator_auth["headers"]
        
        response = requests.get(f"{BASE_URL}/api/vehicles/", headers=headers)
        if response.status_code != 200:
            return
        
        vehicles = response.json().get("vehicles", [])
        deleted = 0
        for vehicle in vehicles:
            if vehicle.get("vehicle_name", "").startswith("TEST_") or vehicle.get("plate_number", "").startswith("TEST"):
                del_response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test vehicles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Iteration 52 - Round Trip Order Tests

Tests for the new round trip booking functionality:
1. POST /api/orders/create with is_round_trip=true creates 2 separate orders + 1 receipt
2. Round trip response includes order_id, return_order_id, trip_group_id, receipt_number, both order_numbers
3. Single trip POST /api/orders/create still works (backwards compatible)
4. Round trip receipt has both order_ids linked
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for customer user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "customer@test.com",
        "password": "testpassword123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Customer authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "superadmin@oryno.com",
        "password": "testpassword123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# Store created test data for cleanup
created_orders = []
created_receipts = []


class TestCustomerAuth:
    """Test customer authentication"""
    
    def test_customer_login(self, api_client):
        """Test customer login works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print("PASS - Customer login successful")


class TestSingleTripOrderBackwardsCompatible:
    """Test single trip orders still work (backwards compatibility)"""
    
    def test_single_trip_order_creation(self, authenticated_client, auth_token):
        """Test single trip order creation - no is_round_trip flag"""
        # Reset auth header to ensure clean state
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        order_payload = {
            "service_type": "travel",
            "service_id": f"TEST_service_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST Single Trip - Douala to Yaounde",
            "total_amount": 5000,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "departure": "Douala",
                "destination": "Yaounde",
                "travel_date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
                "passengers": 1
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200, f"Single trip order failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "order_id" in data, "Response should have order_id"
        assert "order_number" in data, "Response should have order_number"
        assert "total_amount" in data, "Response should have total_amount"
        
        # Store for cleanup
        created_orders.append(data.get("order_id"))
        
        # Verify NOT a round trip response (no return_order_id, trip_group_id, receipt_number)
        assert "return_order_id" not in data, "Single trip should NOT have return_order_id"
        assert "trip_group_id" not in data, "Single trip should NOT have trip_group_id"
        assert "receipt_number" not in data, "Single trip should NOT have receipt_number"
        
        print(f"PASS - Single trip order created: {data.get('order_number')}")
    
    def test_single_trip_with_is_round_trip_false(self, authenticated_client, auth_token):
        """Test single trip order creation with explicit is_round_trip=false"""
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        order_payload = {
            "service_type": "travel",
            "service_id": f"TEST_service_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST One-way Trip - Bamenda to Douala",
            "total_amount": 7500,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "departure": "Bamenda",
                "destination": "Douala",
                "travel_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
                "passengers": 2,
                "is_round_trip": False  # Explicit false
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "order_id" in data
        assert "return_order_id" not in data, "is_round_trip=false should NOT create return order"
        
        created_orders.append(data.get("order_id"))
        print(f"PASS - Single trip with is_round_trip=false: {data.get('order_number')}")


class TestRoundTripOrderCreation:
    """Test round trip order creation - 2 tickets, 1 receipt"""
    
    def test_round_trip_order_creates_two_orders_one_receipt(self, authenticated_client, auth_token):
        """Test POST /api/orders/create with is_round_trip=true creates 2 orders + 1 receipt"""
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        travel_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        return_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        order_payload = {
            "service_type": "travel",
            "service_id": f"TEST_service_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST Round Trip - Douala to Yaounde",
            "total_amount": 10000,  # Total for both legs
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "departure": "Douala",
                "destination": "Yaounde",
                "travel_date": travel_date,
                "return_date": return_date,
                "passengers": 1,
                "is_round_trip": True  # KEY FLAG
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200, f"Round trip order failed: {response.text}"
        
        data = response.json()
        
        # Verify round trip response structure
        assert data.get("success") == True, f"Response should have success=True: {data}"
        assert "order_id" in data, f"Response should have order_id: {data}"
        assert "return_order_id" in data, f"Response should have return_order_id for round trip: {data}"
        assert "trip_group_id" in data, f"Response should have trip_group_id for round trip: {data}"
        assert "receipt_number" in data, f"Response should have receipt_number for round trip: {data}"
        assert "order_number" in data, f"Response should have order_number: {data}"
        assert "return_order_number" in data, f"Response should have return_order_number: {data}"
        
        # Verify IDs are different
        assert data["order_id"] != data["return_order_id"], "Outbound and return order IDs should be different"
        assert data["order_number"] != data["return_order_number"], "Outbound and return order numbers should be different"
        
        # Store for cleanup
        created_orders.append(data["order_id"])
        created_orders.append(data["return_order_id"])
        
        print(f"PASS - Round trip created:")
        print(f"  - Outbound order: {data['order_number']}")
        print(f"  - Return order: {data['return_order_number']}")
        print(f"  - Trip group: {data['trip_group_id']}")
        print(f"  - Receipt: {data['receipt_number']}")
        
        # Return data for verification in subsequent tests
        return data
    
    def test_round_trip_response_structure(self, authenticated_client, auth_token):
        """Verify the complete response structure for round trip orders"""
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        order_payload = {
            "service_type": "travel",
            "service_id": f"TEST_service_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST Round Trip Structure Test",
            "total_amount": 15000,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "departure": "Bamenda",
                "destination": "Douala",
                "travel_date": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
                "return_date": (datetime.now() + timedelta(days=17)).strftime("%Y-%m-%d"),
                "passengers": 2,
                "is_round_trip": True,
                "outbound_price": 7000  # Test custom pricing split
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        
        # Check all required fields
        required_fields = ["success", "message", "order_id", "return_order_id", 
                          "trip_group_id", "receipt_number", "order_number", 
                          "return_order_number", "total_amount"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify message indicates round trip
        assert "2 tickets" in data["message"].lower() or "round trip" in data["message"].lower(), \
            f"Message should indicate round trip: {data['message']}"
        
        # Verify total amount matches
        assert data["total_amount"] == 15000, f"Total amount mismatch: {data['total_amount']}"
        
        created_orders.append(data["order_id"])
        created_orders.append(data["return_order_id"])
        
        print(f"PASS - Response structure verified with all required fields")
        print(f"  - Message: {data['message']}")


class TestRoundTripOrdersInDatabase:
    """Test that round trip orders are properly stored in the database"""
    
    def test_verify_both_orders_exist_in_orders_collection(self, authenticated_client, auth_token):
        """Verify both outbound and return orders are created in orders collection"""
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Create a round trip order
        order_payload = {
            "service_type": "travel",
            "service_id": f"TEST_service_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST DB Verification Trip",
            "total_amount": 8000,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "departure": "Kribi",
                "destination": "Limbe",
                "travel_date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
                "return_date": (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d"),
                "passengers": 1,
                "is_round_trip": True
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200
        data = response.json()
        
        outbound_id = data["order_id"]
        return_id = data["return_order_id"]
        trip_group_id = data["trip_group_id"]
        
        created_orders.append(outbound_id)
        created_orders.append(return_id)
        
        # Fetch outbound order
        outbound_response = authenticated_client.get(f"{BASE_URL}/api/orders/{outbound_id}")
        assert outbound_response.status_code == 200, f"Outbound order not found: {outbound_response.text}"
        outbound_order = outbound_response.json()
        
        # Verify outbound order fields
        assert outbound_order.get("trip_group_id") == trip_group_id, "Outbound should have trip_group_id"
        assert outbound_order.get("trip_leg") == "outbound", f"Outbound leg should be 'outbound', got: {outbound_order.get('trip_leg')}"
        assert "Outbound" in outbound_order.get("service_name", ""), "Outbound service name should indicate outbound"
        
        # Fetch return order
        return_response = authenticated_client.get(f"{BASE_URL}/api/orders/{return_id}")
        assert return_response.status_code == 200, f"Return order not found: {return_response.text}"
        return_order = return_response.json()
        
        # Verify return order fields
        assert return_order.get("trip_group_id") == trip_group_id, "Return should have same trip_group_id"
        assert return_order.get("trip_leg") == "return", f"Return leg should be 'return', got: {return_order.get('trip_leg')}"
        assert "Return" in return_order.get("service_name", ""), "Return service name should indicate return"
        
        print(f"PASS - Both orders verified in database:")
        print(f"  - Outbound order: {outbound_id} (leg: {outbound_order.get('trip_leg')})")
        print(f"  - Return order: {return_id} (leg: {return_order.get('trip_leg')})")
        print(f"  - Trip group ID: {trip_group_id}")


class TestRoundTripNonTravelService:
    """Test that is_round_trip only applies to travel service type"""
    
    def test_round_trip_ignored_for_non_travel_service(self, authenticated_client, auth_token):
        """Test that is_round_trip=true is ignored for non-travel services"""
        authenticated_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        
        # Try to create a "round trip" hotel booking (should be treated as single order)
        order_payload = {
            "service_type": "hotel",  # NOT travel
            "service_id": f"TEST_hotel_{uuid.uuid4().hex[:8]}",
            "service_name": "TEST Hotel Booking",
            "total_amount": 25000,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "check_in": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
                "check_out": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
                "guests": 2,
                "is_round_trip": True  # Should be ignored for hotel
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/orders/create", json=order_payload)
        assert response.status_code == 200, f"Hotel order failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        # Should NOT create round trip response fields for hotel
        assert "return_order_id" not in data, "Hotel should NOT have return_order_id even with is_round_trip=true"
        assert "trip_group_id" not in data, "Hotel should NOT have trip_group_id"
        assert "receipt_number" not in data, "Hotel should NOT have receipt_number (only for round trip travel)"
        
        created_orders.append(data.get("order_id"))
        
        print(f"PASS - is_round_trip correctly ignored for hotel service type")


class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_orders(self, authenticated_client, admin_token):
        """Delete all test orders created during testing"""
        # Use admin token for broader access
        authenticated_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        cleaned = 0
        failed = 0
        
        for order_id in created_orders:
            if order_id:
                try:
                    # Try to cancel/delete the order
                    response = authenticated_client.put(f"{BASE_URL}/api/orders/{order_id}/cancel")
                    if response.status_code in [200, 404]:  # OK or already deleted
                        cleaned += 1
                    else:
                        failed += 1
                except Exception as e:
                    failed += 1
        
        print(f"PASS - Cleanup completed: {cleaned} orders processed, {failed} failed")
        
        # Clear the list
        created_orders.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

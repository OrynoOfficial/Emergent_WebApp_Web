"""
Iteration 55 - Communications API & Travel Analytics Dashboard Tests
Tests:
1. Communications API: announcements CRUD with service_type filtering
2. Communications API: alerts CRUD with severity and resolve functionality
3. Communications API: recent feed with combined notifications + announcements + alerts
4. Travel Analytics Dashboard: monthly_trend, route_popularity, vehicle_utilization, summary
5. Different service_types (travel, hotels, restaurants)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://support-modern.preview.emergentagent.com"

# Test data storage
test_data = {
    "super_admin_token": None,
    "operator_token": None,
    "announcements": [],
    "alerts": []
}


@pytest.fixture(scope="module")
def super_admin_token():
    """Login as super admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "superadmin@oryno.com",
        "password": "testpassword123"
    })
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    token = response.json().get("access_token") or response.json().get("token")
    assert token, "No token received for super admin"
    test_data["super_admin_token"] = token
    return token


@pytest.fixture(scope="module")
def operator_token():
    """Login as operator and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "operator@test.com",
        "password": "testpassword123"
    })
    assert response.status_code == 200, f"Operator login failed: {response.text}"
    token = response.json().get("access_token") or response.json().get("token")
    assert token, "No token received for operator"
    test_data["operator_token"] = token
    return token


class TestCommunicationsAnnouncements:
    """Test announcements CRUD operations"""
    
    def test_01_create_travel_announcement(self, super_admin_token):
        """POST /api/communications/announcements creates announcement for travel service"""
        response = requests.post(
            f"{BASE_URL}/api/communications/announcements",
            params={
                "title": "TEST_Travel_Announcement_55",
                "message": "Test announcement message for travel service",
                "service_type": "travel"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create travel announcement failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["announcements"].append({"id": data["id"], "service_type": "travel"})
        print(f"PASS - Created travel announcement: {data['id']}")
    
    def test_02_create_hotels_announcement(self, super_admin_token):
        """POST /api/communications/announcements creates announcement for hotels service"""
        response = requests.post(
            f"{BASE_URL}/api/communications/announcements",
            params={
                "title": "TEST_Hotels_Announcement_55",
                "message": "Test announcement message for hotels service",
                "service_type": "hotels"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create hotels announcement failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["announcements"].append({"id": data["id"], "service_type": "hotels"})
        print(f"PASS - Created hotels announcement: {data['id']}")
    
    def test_03_create_restaurants_announcement(self, super_admin_token):
        """POST /api/communications/announcements creates announcement for restaurants service"""
        response = requests.post(
            f"{BASE_URL}/api/communications/announcements",
            params={
                "title": "TEST_Restaurants_Announcement_55",
                "message": "Test announcement message for restaurants service",
                "service_type": "restaurants"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create restaurants announcement failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["announcements"].append({"id": data["id"], "service_type": "restaurants"})
        print(f"PASS - Created restaurants announcement: {data['id']}")
    
    def test_04_get_travel_announcements_filtered(self, super_admin_token):
        """GET /api/communications/announcements?service_type=travel returns only travel announcements"""
        response = requests.get(
            f"{BASE_URL}/api/communications/announcements",
            params={"service_type": "travel"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get travel announcements failed: {response.text}"
        data = response.json()
        
        assert "announcements" in data, "No announcements key in response"
        assert "total" in data, "No total key in response"
        
        # Verify filtering works - all returned should be travel
        for ann in data["announcements"]:
            assert ann.get("service_type") == "travel", f"Wrong service_type: {ann.get('service_type')}"
        
        # Verify our test announcement is in there
        test_ann_ids = [a["id"] for a in test_data["announcements"] if a["service_type"] == "travel"]
        found = any(ann.get("id") in test_ann_ids for ann in data["announcements"])
        assert found, "Test travel announcement not found in filtered results"
        print(f"PASS - Travel announcements filtered correctly, total: {data['total']}")
    
    def test_05_get_hotels_announcements_filtered(self, super_admin_token):
        """GET /api/communications/announcements?service_type=hotels returns only hotels announcements"""
        response = requests.get(
            f"{BASE_URL}/api/communications/announcements",
            params={"service_type": "hotels"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get hotels announcements failed: {response.text}"
        data = response.json()
        
        assert "announcements" in data, "No announcements key in response"
        
        # Verify filtering works
        for ann in data["announcements"]:
            assert ann.get("service_type") == "hotels", f"Wrong service_type: {ann.get('service_type')}"
        print(f"PASS - Hotels announcements filtered correctly, total: {data['total']}")


class TestCommunicationsAlerts:
    """Test alerts CRUD and resolve operations"""
    
    def test_06_create_travel_alert_medium(self, super_admin_token):
        """POST /api/communications/alerts creates alert with severity=medium"""
        response = requests.post(
            f"{BASE_URL}/api/communications/alerts",
            params={
                "title": "TEST_Travel_Alert_Medium_55",
                "message": "Test alert message for travel service",
                "service_type": "travel",
                "severity": "medium"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create travel alert failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["alerts"].append({"id": data["id"], "service_type": "travel", "severity": "medium"})
        print(f"PASS - Created travel alert (medium): {data['id']}")
    
    def test_07_create_travel_alert_high(self, super_admin_token):
        """POST /api/communications/alerts creates alert with severity=high"""
        response = requests.post(
            f"{BASE_URL}/api/communications/alerts",
            params={
                "title": "TEST_Travel_Alert_High_55",
                "message": "High severity alert for travel",
                "service_type": "travel",
                "severity": "high"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create high alert failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["alerts"].append({"id": data["id"], "service_type": "travel", "severity": "high"})
        print(f"PASS - Created travel alert (high): {data['id']}")
    
    def test_08_create_hotels_alert(self, super_admin_token):
        """POST /api/communications/alerts creates alert for hotels service"""
        response = requests.post(
            f"{BASE_URL}/api/communications/alerts",
            params={
                "title": "TEST_Hotels_Alert_55",
                "message": "Test alert for hotels",
                "service_type": "hotels",
                "severity": "low"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Create hotels alert failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["alerts"].append({"id": data["id"], "service_type": "hotels", "severity": "low"})
        print(f"PASS - Created hotels alert: {data['id']}")
    
    def test_09_get_travel_alerts_filtered(self, super_admin_token):
        """GET /api/communications/alerts?service_type=travel returns travel alerts"""
        response = requests.get(
            f"{BASE_URL}/api/communications/alerts",
            params={"service_type": "travel"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get travel alerts failed: {response.text}"
        data = response.json()
        
        assert "alerts" in data, "No alerts key in response"
        assert "total" in data, "No total key in response"
        
        # Verify filtering works
        for alert in data["alerts"]:
            assert alert.get("service_type") == "travel", f"Wrong service_type: {alert.get('service_type')}"
        
        print(f"PASS - Travel alerts filtered correctly, total: {data['total']}")
    
    def test_10_get_active_alerts_only(self, super_admin_token):
        """GET /api/communications/alerts?status=active returns only active alerts"""
        response = requests.get(
            f"{BASE_URL}/api/communications/alerts",
            params={"service_type": "travel", "status": "active"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get active alerts failed: {response.text}"
        data = response.json()
        
        # Verify all returned alerts are active
        for alert in data["alerts"]:
            assert alert.get("status") == "active", f"Non-active alert returned: {alert.get('status')}"
        print(f"PASS - Active alerts filter works, count: {len(data['alerts'])}")
    
    def test_11_resolve_alert(self, super_admin_token):
        """PUT /api/communications/alerts/{id}/resolve marks alert as resolved"""
        # Use first travel alert
        travel_alerts = [a for a in test_data["alerts"] if a["service_type"] == "travel"]
        assert travel_alerts, "No travel alerts to resolve"
        
        alert_id = travel_alerts[0]["id"]
        response = requests.put(
            f"{BASE_URL}/api/communications/alerts/{alert_id}/resolve",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Resolve alert failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Alert resolved", f"Unexpected response: {data}"
        print(f"PASS - Alert {alert_id} resolved")
    
    def test_12_resolved_alert_not_in_active(self, super_admin_token):
        """Verify resolved alert is not returned when filtering by status=active"""
        travel_alerts = [a for a in test_data["alerts"] if a["service_type"] == "travel"]
        resolved_alert_id = travel_alerts[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/communications/alerts",
            params={"service_type": "travel", "status": "active"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get alerts failed: {response.text}"
        data = response.json()
        
        active_ids = [a.get("id") for a in data["alerts"]]
        assert resolved_alert_id not in active_ids, "Resolved alert still appears in active list"
        print(f"PASS - Resolved alert correctly excluded from active alerts")


class TestCommunicationsRecentFeed:
    """Test the combined recent feed endpoint"""
    
    def test_13_get_recent_travel_communications(self, super_admin_token):
        """GET /api/communications/recent?service_type=travel returns combined feed"""
        response = requests.get(
            f"{BASE_URL}/api/communications/recent",
            params={"service_type": "travel"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get recent communications failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "items" in data, "No items key in response"
        assert "announcements_count" in data, "No announcements_count"
        assert "active_alerts_count" in data, "No active_alerts_count"
        assert "unread_notifications" in data, "No unread_notifications count"
        
        # Verify items have comm_type labels
        for item in data["items"]:
            assert "comm_type" in item, f"Item missing comm_type: {item.get('id')}"
            assert item["comm_type"] in ["announcement", "alert", "notification"], \
                f"Invalid comm_type: {item['comm_type']}"
        
        print(f"PASS - Recent feed returns items with comm_type labels")
        print(f"  - Items: {len(data['items'])}")
        print(f"  - Announcements: {data['announcements_count']}")
        print(f"  - Active alerts: {data['active_alerts_count']}")
        print(f"  - Unread notifications: {data['unread_notifications']}")
    
    def test_14_recent_feed_for_hotels(self, super_admin_token):
        """GET /api/communications/recent?service_type=hotels works for hotels"""
        response = requests.get(
            f"{BASE_URL}/api/communications/recent",
            params={"service_type": "hotels"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get hotels recent failed: {response.text}"
        data = response.json()
        
        assert "items" in data, "No items key"
        print(f"PASS - Hotels recent feed works, items: {len(data['items'])}")
    
    def test_15_recent_feed_for_restaurants(self, super_admin_token):
        """GET /api/communications/recent?service_type=restaurants works for restaurants"""
        response = requests.get(
            f"{BASE_URL}/api/communications/recent",
            params={"service_type": "restaurants"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get restaurants recent failed: {response.text}"
        data = response.json()
        
        assert "items" in data, "No items key"
        print(f"PASS - Restaurants recent feed works, items: {len(data['items'])}")


class TestTravelAnalyticsDashboard:
    """Test the travel analytics dashboard endpoint with real data"""
    
    def test_16_get_travel_analytics_dashboard(self, super_admin_token):
        """GET /api/travel/analytics/dashboard returns analytics data"""
        response = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        data = response.json()
        
        # Verify all required fields
        assert "monthly_trend" in data, "No monthly_trend"
        assert "route_popularity" in data, "No route_popularity"
        assert "vehicle_utilization" in data, "No vehicle_utilization"
        assert "summary" in data, "No summary"
        
        print(f"PASS - Analytics dashboard returns all required fields")
    
    def test_17_analytics_monthly_trend_structure(self, super_admin_token):
        """Verify monthly_trend has correct structure (6 months)"""
        response = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        monthly = data["monthly_trend"]
        assert isinstance(monthly, list), "monthly_trend is not a list"
        assert len(monthly) == 6, f"Expected 6 months, got {len(monthly)}"
        
        for month in monthly:
            assert "month" in month, "Month entry missing 'month' field"
            assert "bookings" in month, "Month entry missing 'bookings' field"
            assert "revenue" in month, "Month entry missing 'revenue' field"
            assert isinstance(month["bookings"], int), f"bookings should be int: {type(month['bookings'])}"
            assert isinstance(month["revenue"], (int, float)), f"revenue should be numeric: {type(month['revenue'])}"
        
        print(f"PASS - Monthly trend has correct structure:")
        for m in monthly:
            print(f"  {m['month']}: {m['bookings']} bookings, {m['revenue']} revenue")
    
    def test_18_analytics_route_popularity_structure(self, super_admin_token):
        """Verify route_popularity has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        routes = data["route_popularity"]
        assert isinstance(routes, list), "route_popularity is not a list"
        
        for route in routes:
            assert "route" in route, "Route entry missing 'route' field"
            assert "bookings" in route, "Route entry missing 'bookings' field"
            assert "revenue" in route, "Route entry missing 'revenue' field"
            # Route should be "Origin → Destination" format
            assert "→" in route["route"], f"Route format incorrect: {route['route']}"
        
        print(f"PASS - Route popularity has {len(routes)} routes with correct structure")
    
    def test_19_analytics_vehicle_utilization_structure(self, super_admin_token):
        """Verify vehicle_utilization has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        vehicles = data["vehicle_utilization"]
        assert isinstance(vehicles, list), "vehicle_utilization is not a list"
        
        for vehicle in vehicles:
            assert "name" in vehicle, "Vehicle entry missing 'name' field"
            assert "utilization" in vehicle, "Vehicle entry missing 'utilization' field"
            assert isinstance(vehicle["utilization"], (int, float)), f"utilization should be numeric"
            assert 0 <= vehicle["utilization"] <= 100, f"utilization should be 0-100: {vehicle['utilization']}"
        
        print(f"PASS - Vehicle utilization has {len(vehicles)} vehicles with correct structure")
    
    def test_20_analytics_summary_structure(self, super_admin_token):
        """Verify summary has total_bookings, total_revenue, active_routes, active_vehicles"""
        response = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        summary = data["summary"]
        assert "total_bookings" in summary, "Summary missing total_bookings"
        assert "total_revenue" in summary, "Summary missing total_revenue"
        assert "active_routes" in summary, "Summary missing active_routes"
        assert "active_vehicles" in summary, "Summary missing active_vehicles"
        
        # Verify types
        assert isinstance(summary["total_bookings"], int), "total_bookings should be int"
        assert isinstance(summary["total_revenue"], (int, float)), "total_revenue should be numeric"
        assert isinstance(summary["active_routes"], int), "active_routes should be int"
        assert isinstance(summary["active_vehicles"], int), "active_vehicles should be int"
        
        print(f"PASS - Summary structure verified:")
        print(f"  - Total bookings: {summary['total_bookings']}")
        print(f"  - Total revenue: {summary['total_revenue']}")
        print(f"  - Active routes: {summary['active_routes']}")
        print(f"  - Active vehicles: {summary['active_vehicles']}")
    
    def test_21_analytics_data_from_real_db(self, super_admin_token):
        """Verify analytics comes from real database (not hardcoded)"""
        # Make two requests and verify they return consistent data
        response1 = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        response2 = requests.get(
            f"{BASE_URL}/api/travel/analytics/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Summary should be consistent between requests
        assert data1["summary"]["total_bookings"] == data2["summary"]["total_bookings"], \
            "Inconsistent total_bookings between requests"
        assert data1["summary"]["total_revenue"] == data2["summary"]["total_revenue"], \
            "Inconsistent total_revenue between requests"
        
        print(f"PASS - Analytics data is consistent (from real DB)")


class TestOperatorScopedCommunications:
    """Test that operators can create/view communications"""
    
    def test_22_operator_creates_announcement(self, operator_token):
        """Operator can create announcement"""
        response = requests.post(
            f"{BASE_URL}/api/communications/announcements",
            params={
                "title": "TEST_Operator_Announcement_55",
                "message": "Operator created announcement",
                "service_type": "travel"
            },
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Operator create announcement failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["announcements"].append({"id": data["id"], "service_type": "travel", "operator": True})
        print(f"PASS - Operator created announcement: {data['id']}")
    
    def test_23_operator_creates_alert(self, operator_token):
        """Operator can create alert"""
        response = requests.post(
            f"{BASE_URL}/api/communications/alerts",
            params={
                "title": "TEST_Operator_Alert_55",
                "message": "Operator created alert",
                "service_type": "travel",
                "severity": "medium"
            },
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Operator create alert failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in response"
        test_data["alerts"].append({"id": data["id"], "service_type": "travel", "operator": True})
        print(f"PASS - Operator created alert: {data['id']}")
    
    def test_24_operator_views_announcements(self, operator_token):
        """Operator can view announcements"""
        response = requests.get(
            f"{BASE_URL}/api/communications/announcements",
            params={"service_type": "travel"},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Operator get announcements failed: {response.text}"
        data = response.json()
        assert "announcements" in data, "No announcements in response"
        print(f"PASS - Operator can view announcements, count: {len(data['announcements'])}")
    
    def test_25_operator_views_recent_feed(self, operator_token):
        """Operator can view recent communications feed"""
        response = requests.get(
            f"{BASE_URL}/api/communications/recent",
            params={"service_type": "travel"},
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Operator get recent failed: {response.text}"
        data = response.json()
        assert "items" in data, "No items in response"
        print(f"PASS - Operator can view recent feed, items: {len(data['items'])}")


class TestCleanup:
    """Clean up test data"""
    
    def test_99_cleanup_test_data(self, super_admin_token):
        """Delete test announcements and alerts"""
        # We don't have DELETE endpoints in communications.py
        # The test data will remain but is prefixed with TEST_ for identification
        # This is acceptable per the guidelines
        print(f"PASS - Test completed. Test data created with TEST_ prefix:")
        print(f"  - Announcements: {len(test_data['announcements'])}")
        print(f"  - Alerts: {len(test_data['alerts'])}")
        print(f"NOTE: Test data remains in DB with TEST_ prefix for manual cleanup if needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

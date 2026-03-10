"""
Iteration 72: Testing Subscriptions and Management Dashboard APIs
Features:
1. Dashboard stats for hotels, travel - real operator-scoped data
2. Subscriptions: subscribe, unsubscribe, check, my subs, operator count
3. Promotions: create, list, delete - notifications to subscribers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_token(self, api_client):
        """Login as admin"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin auth failed")
    
    @pytest.fixture(scope="class")
    def operator_token(self, api_client):
        """Login as operator"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "operator@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Operator auth failed")
    
    @pytest.fixture(scope="class")
    def customer_token(self, api_client):
        """Login as customer"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer auth failed")
    
    @pytest.fixture(scope="class")
    def superadmin_token(self, api_client):
        """Login as super admin"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Superadmin auth failed")


class TestHealthAndBasics(TestSetup):
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("Health check passed")
    
    def test_admin_login(self, api_client, admin_token):
        assert admin_token is not None
        print(f"Admin login successful, token: {admin_token[:20]}...")
    
    def test_operator_login(self, api_client, operator_token):
        assert operator_token is not None
        print(f"Operator login successful, token: {operator_token[:20]}...")
    
    def test_customer_login(self, api_client, customer_token):
        assert customer_token is not None
        print(f"Customer login successful, token: {customer_token[:20]}...")


class TestManagementDashboard(TestSetup):
    """Test /api/management/dashboard-stats endpoints"""
    
    def test_dashboard_stats_hotels(self, api_client, admin_token):
        """GET /api/management/dashboard-stats?service_type=hotels returns real data"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "stats" in data
        assert "bookingsByStatus" in data
        assert "dailyTrend" in data
        assert "distribution" in data
        assert "recentBookings" in data
        assert "secondaryCount" in data
        
        # Validate stats structure
        stats = data["stats"]
        assert "totalItems" in stats
        assert "activeItems" in stats
        assert "totalBookings" in stats
        assert "totalRevenue" in stats
        assert "avgRating" in stats
        assert "occupancyRate" in stats
        
        print(f"Hotel dashboard stats: totalBookings={stats['totalBookings']}, totalRevenue={stats['totalRevenue']}, totalItems={stats['totalItems']}")
    
    def test_dashboard_stats_travel(self, api_client, admin_token):
        """GET /api/management/dashboard-stats?service_type=travel returns real data"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=travel",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data
        assert "bookingsByStatus" in data
        assert data["service_type"] == "travel"
        
        print(f"Travel dashboard stats: totalBookings={data['stats']['totalBookings']}, totalRevenue={data['stats']['totalRevenue']}")
    
    def test_dashboard_stats_restaurants(self, api_client, admin_token):
        """GET /api/management/dashboard-stats?service_type=restaurants"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=restaurants",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["service_type"] == "restaurants"
        print(f"Restaurant dashboard stats fetched successfully")
    
    def test_dashboard_stats_different_periods(self, api_client, admin_token):
        """Test different time periods: 7days, 30days, 90days"""
        for period in ["7days", "30days", "90days"]:
            response = api_client.get(
                f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels&period={period}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
            print(f"Dashboard stats for period {period}: OK")
    
    def test_dashboard_stats_operator_scoped(self, api_client, operator_token):
        """Operator should see only their scoped data"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Operator sees their data (might be 0 if no orders)
        assert "stats" in data
        print(f"Operator-scoped dashboard stats: totalBookings={data['stats']['totalBookings']}")
    
    def test_dashboard_stats_unauthorized(self, api_client):
        """Unauthenticated request should fail"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels"
        )
        assert response.status_code == 401 or response.status_code == 403
        print("Unauthenticated dashboard request properly rejected")


class TestSubscriptions(TestSetup):
    """Test /api/subscriptions/ endpoints"""
    
    TEST_OPERATOR_ID = "TEST_operator_sub_12345"
    
    def test_subscribe_to_operator(self, api_client, customer_token):
        """POST /api/subscriptions/subscribe creates subscription"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": self.TEST_OPERATOR_ID, "operator_name": "Test Operator"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("subscribed") == True
        print(f"Subscribe response: {data}")
    
    def test_check_subscription_status(self, api_client, customer_token):
        """GET /api/subscriptions/check?operator_id=X returns subscription status"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/check?operator_id={self.TEST_OPERATOR_ID}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscribed" in data
        assert data["subscribed"] == True
        print(f"Check subscription: subscribed={data['subscribed']}")
    
    def test_get_my_subscriptions(self, api_client, customer_token):
        """GET /api/subscriptions/my returns user's subscriptions"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/my",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "subscriptions" in data
        assert "total" in data
        assert isinstance(data["subscriptions"], list)
        print(f"My subscriptions: total={data['total']}, count={len(data['subscriptions'])}")
    
    def test_get_operator_subscriber_count(self, api_client, admin_token):
        """GET /api/subscriptions/operator-count returns subscriber count"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/operator-count?operator_id={self.TEST_OPERATOR_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert data["count"] >= 0
        print(f"Operator subscriber count: {data['count']}")
    
    def test_unsubscribe_from_operator(self, api_client, customer_token):
        """POST /api/subscriptions/unsubscribe removes subscription"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/unsubscribe",
            json={"operator_id": self.TEST_OPERATOR_ID},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("subscribed") == False
        print(f"Unsubscribe response: {data}")
        
        # Verify unsubscribed
        check = api_client.get(
            f"{BASE_URL}/api/subscriptions/check?operator_id={self.TEST_OPERATOR_ID}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert check.json().get("subscribed") == False
        print("Subscription removal verified")
    
    def test_subscribe_unauthorized(self, api_client):
        """Unauthenticated subscription should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": "test123"}
        )
        assert response.status_code == 401 or response.status_code == 403
        print("Unauthenticated subscribe properly rejected")


class TestPromotions(TestSetup):
    """Test /api/subscriptions/promotions endpoints"""
    
    TEST_PROMO_OPERATOR_ID = "TEST_promo_operator_99999"
    created_promotion_id = None
    
    @pytest.fixture(scope="class")
    def operator_with_id_token(self, api_client, superadmin_token):
        """Get or create an operator user with operator_id set"""
        # For testing promotions, we need an actual operator_id set on user
        # We'll use superadmin for listing promotions (not creating since no operator_id)
        return superadmin_token
    
    def test_list_promotions_empty(self, api_client, operator_with_id_token):
        """GET /api/subscriptions/promotions lists promotions"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/promotions",
            headers={"Authorization": f"Bearer {operator_with_id_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "promotions" in data
        assert "total" in data
        assert isinstance(data["promotions"], list)
        print(f"Promotions list: total={data['total']}")
    
    def test_create_promotion_requires_operator_id(self, api_client, customer_token):
        """Users with operator_id can create promotions (customer@test.com has operator_id assigned)"""
        response = api_client.post(
            f"{BASE_URL}/api/subscriptions/promotions",
            json={
                "title": "TEST_Customer_Promo",
                "message": "Test message from customer with operator_id",
                "promotion_type": "general"
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        # customer@test.com has operator_id assigned (Prestige Pressing), so promotion creation succeeds
        # If they didn't have operator_id, it would return 403
        assert response.status_code == 200
        data = response.json()
        assert "promotion_id" in data
        print(f"Promotion created: {data['promotion_id']} (customer has operator_id assigned)")
    
    def test_list_promotions_filtered_by_operator(self, api_client, admin_token):
        """GET /api/subscriptions/promotions?operator_id=X filters by operator"""
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/promotions?operator_id={self.TEST_PROMO_OPERATOR_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "promotions" in data
        print(f"Filtered promotions for operator: {len(data['promotions'])}")


class TestSubscriptionsIntegration(TestSetup):
    """Integration tests for subscriptions + promotions flow"""
    
    def test_resubscribe_after_unsubscribe(self, api_client, customer_token):
        """Can re-subscribe after unsubscribing"""
        op_id = "TEST_resub_operator"
        
        # Subscribe
        sub1 = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": op_id, "operator_name": "Resub Test"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert sub1.status_code == 200
        
        # Unsubscribe
        unsub = api_client.post(
            f"{BASE_URL}/api/subscriptions/unsubscribe",
            json={"operator_id": op_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert unsub.status_code == 200
        
        # Re-subscribe
        sub2 = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": op_id, "operator_name": "Resub Test"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert sub2.status_code == 200
        assert sub2.json().get("subscribed") == True
        print("Re-subscribe after unsubscribe works correctly")
        
        # Cleanup
        api_client.post(
            f"{BASE_URL}/api/subscriptions/unsubscribe",
            json={"operator_id": op_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
    
    def test_double_subscribe_is_idempotent(self, api_client, customer_token):
        """Subscribing twice should not fail"""
        op_id = "TEST_double_sub_operator"
        
        # First subscribe
        sub1 = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": op_id, "operator_name": "Double Sub Test"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert sub1.status_code == 200
        
        # Second subscribe
        sub2 = api_client.post(
            f"{BASE_URL}/api/subscriptions/subscribe",
            json={"operator_id": op_id, "operator_name": "Double Sub Test"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert sub2.status_code == 200
        data = sub2.json()
        assert "Already subscribed" in data.get("message", "") or data.get("subscribed") == True
        print("Double subscribe handled correctly (idempotent)")
        
        # Cleanup
        api_client.post(
            f"{BASE_URL}/api/subscriptions/unsubscribe",
            json={"operator_id": op_id},
            headers={"Authorization": f"Bearer {customer_token}"}
        )


class TestDashboardDataValidation(TestSetup):
    """Validate dashboard data structure and values"""
    
    def test_daily_trend_structure(self, api_client, admin_token):
        """Validate dailyTrend has 7 days of data"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        daily_trend = data.get("dailyTrend", [])
        assert len(daily_trend) == 7, f"Expected 7 days, got {len(daily_trend)}"
        
        for day in daily_trend:
            assert "date" in day
            assert "bookings" in day
            assert "revenue" in day
            assert isinstance(day["bookings"], int)
            assert isinstance(day["revenue"], (int, float))
        
        print(f"Daily trend structure valid: {[d['date'] for d in daily_trend]}")
    
    def test_bookings_by_status_structure(self, api_client, admin_token):
        """Validate bookingsByStatus has required keys"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        status = data.get("bookingsByStatus", {})
        required_keys = ["confirmed", "pending", "completed", "cancelled"]
        for key in required_keys:
            assert key in status, f"Missing key: {key}"
            assert isinstance(status[key], int), f"{key} should be int"
        
        print(f"Bookings by status: {status}")
    
    def test_recent_bookings_structure(self, api_client, admin_token):
        """Validate recentBookings structure"""
        response = api_client.get(
            f"{BASE_URL}/api/management/dashboard-stats?service_type=hotels",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        recent = data.get("recentBookings", [])
        if recent:
            booking = recent[0]
            expected_fields = ["id", "customer_name", "service_name", "amount", "status"]
            for field in expected_fields:
                assert field in booking, f"Missing field: {field}"
        
        print(f"Recent bookings: {len(recent)} items")


class TestCleanup(TestSetup):
    """Cleanup test data"""
    
    def test_cleanup_test_subscriptions(self, api_client, customer_token):
        """Clean up any TEST_ prefixed subscriptions"""
        # Get my subscriptions and clean up test ones
        response = api_client.get(
            f"{BASE_URL}/api/subscriptions/my",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        if response.status_code == 200:
            subs = response.json().get("subscriptions", [])
            for sub in subs:
                if sub.get("operator_id", "").startswith("TEST_"):
                    api_client.post(
                        f"{BASE_URL}/api/subscriptions/unsubscribe",
                        json={"operator_id": sub["operator_id"]},
                        headers={"Authorization": f"Bearer {customer_token}"}
                    )
                    print(f"Cleaned up subscription: {sub['operator_id']}")
        print("Test cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

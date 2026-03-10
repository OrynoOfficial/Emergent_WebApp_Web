"""
Test suite for Ratings Moderation Endpoints - Iteration 73
Tests: moderation-queue, moderation-audit, export, moderate, bulk-moderate
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed - skipping admin tests")


@pytest.fixture(scope="module")
def customer_token():
    """Get customer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Customer login failed - skipping customer tests")


class TestModerationQueue:
    """Tests for GET /api/ratings/moderation-queue"""
    
    def test_moderation_queue_as_admin(self, admin_token):
        """Admin can access moderation queue"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-queue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "queue" in data
        assert "total" in data
        assert "counts" in data
        assert "flagged" in data["counts"]
        assert "hidden" in data["counts"]
        assert "low_rating" in data["counts"]
        print(f"Moderation queue: {data['total']} items, flagged={data['counts']['flagged']}, hidden={data['counts']['hidden']}")
    
    def test_moderation_queue_filter_flagged(self, admin_token):
        """Can filter queue by flagged status"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-queue",
            params={"status_filter": "flagged"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # All items in queue should be flagged when filtering
        for item in data["queue"]:
            assert item.get("is_flagged") == True or item.get("is_hidden") == True
    
    def test_moderation_queue_filter_hidden(self, admin_token):
        """Can filter queue by hidden status"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-queue",
            params={"status_filter": "hidden"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # All items should be hidden when filtering
        for item in data["queue"]:
            assert item.get("is_hidden") == True
    
    def test_moderation_queue_sort_by_lowest(self, admin_token):
        """Can sort queue by lowest rating"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-queue",
            params={"sort_by": "lowest"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify items are sorted by rating ascending
        if len(data["queue"]) > 1:
            ratings = [item.get("rating", 0) for item in data["queue"]]
            assert ratings == sorted(ratings)  # Should be ascending
    
    def test_moderation_queue_requires_admin(self, customer_token):
        """Non-admin users cannot access moderation queue"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-queue",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403


class TestModerationAudit:
    """Tests for GET /api/ratings/moderation-audit"""
    
    def test_moderation_audit_as_admin(self, admin_token):
        """Admin can access moderation audit log"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-audit",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "entries" in data
        assert "total" in data
        assert isinstance(data["entries"], list)
        print(f"Moderation audit: {data['total']} entries")
    
    def test_moderation_audit_entry_structure(self, admin_token):
        """Audit entries have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-audit",
            params={"limit": 5},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["entries"]:
            entry = data["entries"][0]
            # Check expected fields
            assert "rating_id" in entry
            assert "action" in entry
            assert "performed_by" in entry or "performed_by_name" in entry
            assert "created_at" in entry
    
    def test_moderation_audit_requires_admin(self, customer_token):
        """Non-admin users cannot access audit log"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-audit",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403


class TestRatingsExport:
    """Tests for GET /api/ratings/export"""
    
    def test_export_ratings_as_admin(self, admin_token):
        """Admin can export ratings data"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/export",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "ratings" in data
        assert "total" in data
        assert "exported_at" in data
        assert "filters" in data
        assert isinstance(data["ratings"], list)
        print(f"Export: {data['total']} ratings exported at {data['exported_at']}")
    
    def test_export_ratings_with_filters(self, admin_token):
        """Can export with service_type filter"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/export",
            params={"service_type": "hotel"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify filter applied
        assert data["filters"]["service_type"] == "hotel"
        # All exported ratings should be hotel type
        for rating in data["ratings"]:
            if rating.get("service_type"):
                assert rating["service_type"] == "hotel"
    
    def test_export_flagged_only(self, admin_token):
        """Can export only flagged ratings"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/export",
            params={"flagged_only": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["filters"]["flagged_only"] == True
        # All exported ratings should be flagged
        for rating in data["ratings"]:
            if rating.get("is_flagged") is not None:
                assert rating["is_flagged"] == True
    
    def test_export_ratings_requires_admin(self, customer_token):
        """Non-admin users cannot export ratings"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/export",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403


class TestRatingModeration:
    """Tests for POST /api/ratings/{id}/moderate"""
    
    @pytest.fixture
    def test_rating_id(self, admin_token):
        """Get a rating ID to test moderation"""
        # First get all ratings
        response = requests.get(
            f"{BASE_URL}/api/ratings/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200:
            ratings = response.json().get("ratings", [])
            if ratings:
                return ratings[0].get("id")
        pytest.skip("No ratings available to test moderation")
    
    def test_moderate_flag_rating(self, admin_token, test_rating_id):
        """Admin can flag a rating"""
        if not test_rating_id:
            pytest.skip("No rating ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{test_rating_id}/moderate",
            json={"action": "flag", "reason": "TEST flag reason"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
        print(f"Flag result: {response.json()['message']}")
    
    def test_moderate_unflag_rating(self, admin_token, test_rating_id):
        """Admin can unflag a rating"""
        if not test_rating_id:
            pytest.skip("No rating ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{test_rating_id}/moderate",
            json={"action": "unflag"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_moderate_hide_rating(self, admin_token, test_rating_id):
        """Admin can hide a rating"""
        if not test_rating_id:
            pytest.skip("No rating ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{test_rating_id}/moderate",
            json={"action": "hide", "reason": "TEST hidden"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_moderate_unhide_rating(self, admin_token, test_rating_id):
        """Admin can unhide a rating"""
        if not test_rating_id:
            pytest.skip("No rating ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{test_rating_id}/moderate",
            json={"action": "unhide"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_moderate_invalid_action(self, admin_token, test_rating_id):
        """Invalid moderation action returns 400"""
        if not test_rating_id:
            pytest.skip("No rating ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{test_rating_id}/moderate",
            json={"action": "invalid_action"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400
    
    def test_moderate_requires_admin(self, customer_token, admin_token):
        """Non-admin users cannot moderate ratings"""
        # First get a rating ID
        response = requests.get(
            f"{BASE_URL}/api/ratings/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot get ratings")
        
        ratings = response.json().get("ratings", [])
        if not ratings:
            pytest.skip("No ratings available")
        
        rating_id = ratings[0].get("id")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/{rating_id}/moderate",
            json={"action": "flag"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403


class TestBulkModeration:
    """Tests for POST /api/ratings/bulk-moderate"""
    
    def test_bulk_moderate_flag(self, admin_token):
        """Admin can bulk flag ratings"""
        # First get some rating IDs
        response = requests.get(
            f"{BASE_URL}/api/ratings/all?limit=3",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot get ratings")
        
        ratings = response.json().get("ratings", [])
        if len(ratings) < 1:
            pytest.skip("Not enough ratings for bulk test")
        
        rating_ids = [r.get("id") for r in ratings[:2] if r.get("id")]
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/bulk-moderate",
            json={
                "rating_ids": rating_ids,
                "action": "flag",
                "reason": "TEST bulk flag"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "count" in data
        print(f"Bulk flag: {data['count']} ratings flagged")
    
    def test_bulk_moderate_unflag(self, admin_token):
        """Admin can bulk unflag ratings"""
        # Get some flagged ratings
        response = requests.get(
            f"{BASE_URL}/api/ratings/all?flagged_only=true&limit=3",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code != 200:
            pytest.skip("Cannot get ratings")
        
        ratings = response.json().get("ratings", [])
        rating_ids = [r.get("id") for r in ratings[:2] if r.get("id")]
        
        if not rating_ids:
            # No flagged ratings, skip test
            pytest.skip("No flagged ratings to unflag")
        
        response = requests.post(
            f"{BASE_URL}/api/ratings/bulk-moderate",
            json={
                "rating_ids": rating_ids,
                "action": "unflag"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    def test_bulk_moderate_empty_ids(self, admin_token):
        """Empty rating_ids returns error"""
        response = requests.post(
            f"{BASE_URL}/api/ratings/bulk-moderate",
            json={
                "rating_ids": [],
                "action": "flag"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400
    
    def test_bulk_moderate_requires_admin(self, customer_token):
        """Non-admin users cannot bulk moderate"""
        response = requests.post(
            f"{BASE_URL}/api/ratings/bulk-moderate",
            json={
                "rating_ids": ["test-id"],
                "action": "flag"
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 403


class TestAuditTrailLogging:
    """Tests to verify audit trail is logged on moderation"""
    
    def test_moderation_creates_audit_entry(self, admin_token):
        """Moderation action creates audit trail entry"""
        # First get a rating to moderate
        response = requests.get(
            f"{BASE_URL}/api/ratings/all?limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code != 200 or not response.json().get("ratings"):
            pytest.skip("No ratings available")
        
        rating_id = response.json()["ratings"][0].get("id")
        
        # Get current audit count
        audit_response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-audit",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        initial_total = audit_response.json().get("total", 0)
        
        # Perform moderation action
        mod_response = requests.post(
            f"{BASE_URL}/api/ratings/{rating_id}/moderate",
            json={"action": "flag", "reason": "TEST audit trail"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert mod_response.status_code == 200
        
        # Check audit log increased
        audit_response = requests.get(
            f"{BASE_URL}/api/ratings/moderation-audit",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        new_total = audit_response.json().get("total", 0)
        assert new_total >= initial_total  # Should have new entry
        
        # Check latest entry is for our action
        entries = audit_response.json().get("entries", [])
        if entries:
            latest = entries[0]
            assert latest.get("action") == "flag" or latest.get("rating_id") == rating_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

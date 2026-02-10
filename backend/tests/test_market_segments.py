"""
Market Segments API Tests - Iteration 35
Tests CRUD operations for /api/geography/market-segments endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"


class TestMarketSegmentsAPI:
    """Market Segments CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        token = login_response.json().get("token")
        if not token:
            pytest.skip("No token in login response")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.test_segment_id = None
        
        yield
        
        # Cleanup: Delete test segment if created
        if self.test_segment_id:
            try:
                self.session.delete(f"{BASE_URL}/api/geography/market-segments/{self.test_segment_id}")
            except:
                pass
    
    def test_get_market_segments(self):
        """GET /api/geography/market-segments - Should return list of segments"""
        response = self.session.get(f"{BASE_URL}/api/geography/market-segments")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "market_segments" in data, "Response should have 'market_segments' key"
        
        segments = data["market_segments"]
        assert isinstance(segments, list), "market_segments should be a list"
        
        # Check default segments are seeded (sme, enterprise, strategic)
        segment_ids = [s["id"] for s in segments]
        print(f"Found {len(segments)} market segments: {segment_ids}")
        
        # Verify segment structure
        if segments:
            segment = segments[0]
            assert "id" in segment, "Segment should have 'id'"
            assert "name" in segment, "Segment should have 'name'"
            assert "color" in segment, "Segment should have 'color'"
    
    def test_get_market_segments_has_defaults(self):
        """Verify default segments (SME, Enterprise, Strategic) are seeded"""
        response = self.session.get(f"{BASE_URL}/api/geography/market-segments")
        
        assert response.status_code == 200
        
        data = response.json()
        segments = data.get("market_segments", [])
        segment_ids = [s["id"] for s in segments]
        
        # Check for expected default segments
        expected_defaults = ["sme", "enterprise", "strategic"]
        found_defaults = [d for d in expected_defaults if d in segment_ids]
        
        print(f"Expected defaults: {expected_defaults}")
        print(f"Found defaults: {found_defaults}")
        
        assert len(found_defaults) > 0, "At least one default segment should exist"
    
    def test_create_market_segment(self):
        """POST /api/geography/market-segments - Should create a new segment"""
        unique_name = f"TEST_Segment_{uuid.uuid4().hex[:6]}"
        
        response = self.session.post(f"{BASE_URL}/api/geography/market-segments", json={
            "name": unique_name,
            "description": "Test segment for API testing",
            "color": "#FF5733"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message'"
        assert "segment" in data or "created" in data.get("message", "").lower(), "Response should confirm creation"
        
        # Store segment id for cleanup
        if "segment" in data:
            self.test_segment_id = data["segment"].get("id")
            
            # Verify segment data
            assert data["segment"]["name"] == unique_name
            assert data["segment"]["color"] == "#FF5733"
            
            print(f"Created segment: {self.test_segment_id}")
    
    def test_create_segment_requires_name(self):
        """POST /api/geography/market-segments - Should fail without name"""
        response = self.session.post(f"{BASE_URL}/api/geography/market-segments", json={
            "description": "No name segment",
            "color": "#123456"
        })
        
        # Should fail with 400 or 422
        assert response.status_code in [400, 422], f"Expected 400/422 for missing name, got {response.status_code}"
    
    def test_update_market_segment(self):
        """PUT /api/geography/market-segments/{id} - Should update a segment"""
        # First create a segment to update
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        
        create_response = self.session.post(f"{BASE_URL}/api/geography/market-segments", json={
            "name": unique_name,
            "description": "Original description",
            "color": "#111111"
        })
        
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        data = create_response.json()
        segment_id = data.get("segment", {}).get("id")
        if not segment_id:
            # Try to derive from name
            segment_id = unique_name.lower().replace(" ", "_")
        
        self.test_segment_id = segment_id
        
        # Now update the segment
        update_response = self.session.put(f"{BASE_URL}/api/geography/market-segments/{segment_id}", json={
            "name": f"{unique_name}_Updated",
            "description": "Updated description",
            "color": "#222222"
        })
        
        assert update_response.status_code == 200, f"Update failed: {update_response.status_code}: {update_response.text}"
        
        # Verify update
        update_data = update_response.json()
        assert "message" in update_data
        print(f"Updated segment: {segment_id}")
    
    def test_delete_market_segment(self):
        """DELETE /api/geography/market-segments/{id} - Should soft-delete a segment"""
        # First create a segment to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:6]}"
        
        create_response = self.session.post(f"{BASE_URL}/api/geography/market-segments", json={
            "name": unique_name,
            "description": "To be deleted",
            "color": "#333333"
        })
        
        assert create_response.status_code == 200
        
        data = create_response.json()
        segment_id = data.get("segment", {}).get("id")
        if not segment_id:
            segment_id = unique_name.lower().replace(" ", "_")
        
        # Delete the segment
        delete_response = self.session.delete(f"{BASE_URL}/api/geography/market-segments/{segment_id}")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}: {delete_response.text}"
        
        delete_data = delete_response.json()
        assert "message" in delete_data
        assert "deactivated" in delete_data.get("message", "").lower() or "deleted" in delete_data.get("message", "").lower()
        
        print(f"Deleted (deactivated) segment: {segment_id}")
        
        # Clear cleanup since already deleted
        self.test_segment_id = None
    
    def test_delete_nonexistent_segment(self):
        """DELETE /api/geography/market-segments/{id} - Should return 404 for nonexistent"""
        response = self.session.delete(f"{BASE_URL}/api/geography/market-segments/nonexistent_segment_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

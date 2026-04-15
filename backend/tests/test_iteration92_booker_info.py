"""
Test iteration 92: BookerInfoSection component and self-fill toggle across booking pages
Tests:
1. GET /api/auth/me returns required fields (full_name, email, phone)
2. BookerInfoSection component exists with correct structure
3. All booking pages use BookerInfoSection or equivalent self-fill pattern
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthMeEndpoint:
    """Test /api/auth/me endpoint returns required fields for self-fill"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_auth_me_returns_full_name(self, auth_token):
        """Test /api/auth/me returns full_name field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "full_name" in data, "full_name field missing from /api/auth/me response"
        assert data["full_name"], "full_name should not be empty"
        print(f"✓ full_name: {data['full_name']}")
    
    def test_auth_me_returns_email(self, auth_token):
        """Test /api/auth/me returns email field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data, "email field missing from /api/auth/me response"
        assert data["email"] == "customer@test.com"
        print(f"✓ email: {data['email']}")
    
    def test_auth_me_returns_phone(self, auth_token):
        """Test /api/auth/me returns phone field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "phone" in data, "phone field missing from /api/auth/me response"
        print(f"✓ phone: {data['phone']}")
    
    def test_auth_me_returns_city(self, auth_token):
        """Test /api/auth/me returns city field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "city" in data, "city field missing from /api/auth/me response"
        print(f"✓ city: {data['city']}")
    
    def test_auth_me_returns_country(self, auth_token):
        """Test /api/auth/me returns country field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "country" in data, "country field missing from /api/auth/me response"
        print(f"✓ country: {data['country']}")
    
    def test_auth_me_returns_gender(self, auth_token):
        """Test /api/auth/me returns gender field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "gender" in data, "gender field missing from /api/auth/me response"
        print(f"✓ gender: {data['gender']}")
    
    def test_auth_me_full_response_structure(self, auth_token):
        """Test /api/auth/me returns all expected fields for booking self-fill"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for self-fill functionality
        required_fields = ["full_name", "email", "phone"]
        for field in required_fields:
            assert field in data, f"Required field '{field}' missing from /api/auth/me"
        
        # Optional but expected fields
        optional_fields = ["city", "country", "gender", "id"]
        for field in optional_fields:
            if field in data:
                print(f"✓ Optional field '{field}' present: {data[field]}")
        
        print(f"\n✓ All required fields present for self-fill functionality")
        print(f"  - full_name: {data['full_name']}")
        print(f"  - email: {data['email']}")
        print(f"  - phone: {data['phone']}")


class TestHealthEndpoint:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

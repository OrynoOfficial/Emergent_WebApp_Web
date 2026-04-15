"""
Access Control & Visibility System Tests
Tests for Geography, Pods, Employee Scopes, and Customer Location APIs
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://unified-booking-hub-2.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get super admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Super admin login failed: {response.status_code}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code}")


@pytest.fixture
def auth_headers(super_admin_token):
    """Headers with super admin auth"""
    return {"Authorization": f"Bearer {super_admin_token}"}


class TestGeographyAPI:
    """Geography API Tests - Countries and Regions"""
    
    def test_list_countries(self, auth_headers):
        """Test listing countries - should return 6 countries"""
        response = requests.get(f"{BASE_URL}/api/geography/countries", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "countries" in data
        assert "total" in data
        assert data["total"] == 6  # Expected 6 countries
        
        # Verify Cameroon is in the list
        country_codes = [c["code"] for c in data["countries"]]
        assert "CM" in country_codes
        
    def test_list_cameroon_regions(self, auth_headers):
        """Test listing regions for Cameroon - should return 10 regions"""
        response = requests.get(
            f"{BASE_URL}/api/geography/regions?country_id=CM",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "regions" in data
        assert data["total"] == 10  # Expected 10 Cameroon regions
        
        # Verify some key regions
        region_codes = [r["code"] for r in data["regions"]]
        assert "CM-LT" in region_codes  # Littoral (Douala)
        assert "CM-CE" in region_codes  # Centre (Yaoundé)
        
    def test_get_single_country(self, auth_headers):
        """Test getting a single country by code"""
        response = requests.get(f"{BASE_URL}/api/geography/countries/CM", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["code"] == "CM"
        assert data["name"] == "Cameroon"
        assert data["continent"] == "Africa"
        
    def test_get_market_segments(self, auth_headers):
        """Test listing market segments"""
        response = requests.get(f"{BASE_URL}/api/geography/market-segments", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "market_segments" in data
        segments = [s["value"] for s in data["market_segments"]]
        assert "sme" in segments
        assert "enterprise" in segments
        assert "strategic" in segments
        
    def test_create_country(self, auth_headers):
        """Test creating a new country"""
        test_country = {
            "code": "TZ",
            "name": "TEST_Tanzania",
            "continent": "Africa",
            "currency_code": "TZS",
            "phone_code": "+255",
            "timezone": "Africa/Dar_es_Salaam"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geography/countries",
            json=test_country,
            headers=auth_headers
        )
        
        # May return 400 if already exists, which is fine
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            assert "country_id" in data or "country" in data
        elif response.status_code == 400:
            assert "already exists" in response.json().get("detail", "").lower()
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")
            
    def test_create_region(self, auth_headers):
        """Test creating a new region"""
        # First get Cameroon's ID
        countries_resp = requests.get(f"{BASE_URL}/api/geography/countries", headers=auth_headers)
        cameroon = next((c for c in countries_resp.json()["countries"] if c["code"] == "CM"), None)
        
        if not cameroon:
            pytest.skip("Cameroon not found")
            
        test_region = {
            "country_id": cameroon["id"],
            "code": "CM-TEST",
            "name": "TEST_Region",
            "capital_city": "Test City"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/geography/regions",
            json=test_region,
            headers=auth_headers
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "region_id" in data or "region" in data
        elif response.status_code == 400:
            assert "already exists" in response.json().get("detail", "").lower()
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")


class TestPodsAPI:
    """Pods API Tests - Pod Management"""
    
    def test_list_pods(self, auth_headers):
        """Test listing pods"""
        response = requests.get(f"{BASE_URL}/api/pods", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "pods" in data
        assert "total" in data
        assert data["total"] >= 1  # At least Alpha Team exists
        
    def test_get_pod_details(self, auth_headers):
        """Test getting pod details"""
        # First get list of pods
        list_resp = requests.get(f"{BASE_URL}/api/pods", headers=auth_headers)
        pods = list_resp.json().get("pods", [])
        
        if not pods:
            pytest.skip("No pods found")
            
        pod_id = pods[0]["id"]
        response = requests.get(f"{BASE_URL}/api/pods/{pod_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "members" in data
        
    def test_create_pod(self, auth_headers):
        """Test creating a new pod"""
        test_pod = {
            "name": f"TEST_Pod_{uuid.uuid4().hex[:8]}",
            "description": "Test pod for automated testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pods",
            json=test_pod,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "pod_id" in data
        assert "pod" in data
        assert data["pod"]["name"] == test_pod["name"]
        
        # Store for cleanup
        return data["pod_id"]
        
    def test_update_pod(self, auth_headers):
        """Test updating a pod"""
        # Create a test pod first
        create_resp = requests.post(
            f"{BASE_URL}/api/pods",
            json={"name": f"TEST_Update_{uuid.uuid4().hex[:8]}", "description": "To be updated"},
            headers=auth_headers
        )
        
        if create_resp.status_code not in [200, 201]:
            pytest.skip("Could not create test pod")
            
        pod_id = create_resp.json()["pod_id"]
        
        # Update the pod
        update_data = {"description": "Updated description"}
        response = requests.put(
            f"{BASE_URL}/api/pods/{pod_id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        
    def test_get_pod_members(self, auth_headers):
        """Test getting pod members"""
        list_resp = requests.get(f"{BASE_URL}/api/pods", headers=auth_headers)
        pods = list_resp.json().get("pods", [])
        
        if not pods:
            pytest.skip("No pods found")
            
        pod_id = pods[0]["id"]
        response = requests.get(f"{BASE_URL}/api/pods/{pod_id}/members", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "members" in data
        assert "pod_name" in data


class TestEmployeeScopesAPI:
    """Employee Access Scopes API Tests"""
    
    def test_list_scopes(self, auth_headers):
        """Test listing access scopes - should return 7 default scopes"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "scopes" in data
        assert "total" in data
        assert data["total"] == 7  # Expected 7 default scopes
        
        # Verify some key scopes exist
        scope_names = [s["name"] for s in data["scopes"]]
        assert "Global Access" in scope_names
        assert "Cameroon SME Manager" in scope_names
        
    def test_get_scope_details(self, auth_headers):
        """Test getting scope details"""
        list_resp = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        scopes = list_resp.json().get("scopes", [])
        
        if not scopes:
            pytest.skip("No scopes found")
            
        scope_id = scopes[0]["id"]
        response = requests.get(f"{BASE_URL}/api/employee-scopes/{scope_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "assignments" in data
        
    def test_create_custom_scope(self, auth_headers):
        """Test creating a custom scope with country/segment filters"""
        test_scope = {
            "name": f"TEST_Scope_{uuid.uuid4().hex[:8]}",
            "description": "Test scope for automated testing",
            "countries": ["CM"],
            "regions": [],
            "market_segments": ["sme"],
            "service_types": ["travel"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employee-scopes",
            json=test_scope,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "scope_id" in data
        assert "scope" in data
        assert data["scope"]["countries"] == ["CM"]
        assert data["scope"]["market_segments"] == ["sme"]
        
    def test_get_my_scopes(self, auth_headers):
        """Test getting current user's scopes"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes/my/scopes", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "scopes" in data
        assert "has_global_access" in data


class TestCustomerLocationAPI:
    """Customer Location API Tests"""
    
    def test_ip_info_public(self):
        """Test IP info endpoint (public, no auth required)"""
        response = requests.get(f"{BASE_URL}/api/customer-location/ip-info")
        assert response.status_code == 200
        
        data = response.json()
        assert "ip" in data
        assert "location" in data
        assert "is_in_africa" in data
        
    def test_supported_countries(self, auth_headers):
        """Test getting supported countries"""
        response = requests.get(
            f"{BASE_URL}/api/customer-location/supported-countries",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "countries" in data
        
    def test_resolve_location(self, auth_headers):
        """Test location resolution"""
        response = requests.get(
            f"{BASE_URL}/api/customer-location/resolve",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "location" in data
        assert "operator_filter" in data


class TestPodMembershipRules:
    """Test one employee = one pod rule"""
    
    def test_add_member_to_pod(self, auth_headers):
        """Test adding a member to a pod"""
        # Get list of users
        users_resp = requests.get(f"{BASE_URL}/api/users?role=admin", headers=auth_headers)
        if users_resp.status_code != 200:
            pytest.skip("Could not get users list")
            
        users = users_resp.json().get("users", [])
        if not users:
            pytest.skip("No admin users found")
            
        # Get pods
        pods_resp = requests.get(f"{BASE_URL}/api/pods", headers=auth_headers)
        pods = pods_resp.json().get("pods", [])
        if not pods:
            pytest.skip("No pods found")
            
        # Try to add a user to a pod
        pod_id = pods[0]["id"]
        user_id = users[0].get("id") or users[0].get("_id")
        
        response = requests.post(
            f"{BASE_URL}/api/pods/{pod_id}/members",
            json={"user_id": user_id, "pod_role": "csm"},
            headers=auth_headers
        )
        
        # Either succeeds or fails with "already in pod" message
        if response.status_code in [200, 201]:
            data = response.json()
            assert "membership_id" in data
        elif response.status_code == 400:
            detail = response.json().get("detail", "")
            assert "already" in detail.lower() or "member" in detail.lower()


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_pods(self, auth_headers):
        """Clean up TEST_ prefixed pods"""
        response = requests.get(f"{BASE_URL}/api/pods", headers=auth_headers)
        if response.status_code != 200:
            return
            
        pods = response.json().get("pods", [])
        for pod in pods:
            if pod["name"].startswith("TEST_"):
                # Can only delete if no members
                if pod.get("total_members", 0) == 0:
                    requests.delete(f"{BASE_URL}/api/pods/{pod['id']}", headers=auth_headers)
                    
    def test_cleanup_test_scopes(self, auth_headers):
        """Clean up TEST_ prefixed scopes"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        if response.status_code != 200:
            return
            
        scopes = response.json().get("scopes", [])
        for scope in scopes:
            if scope["name"].startswith("TEST_"):
                if scope.get("assigned_users", 0) == 0:
                    requests.delete(f"{BASE_URL}/api/employee-scopes/{scope['id']}", headers=auth_headers)

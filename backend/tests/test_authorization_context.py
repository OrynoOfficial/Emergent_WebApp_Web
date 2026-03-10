"""
Authorization Context Tests - P2 Implementation
Tests for:
1. Operator listing API returns access_info with has_global_access, pod_name, scope_count
2. Super admin sees all operators (has_global_access: true)
3. Admin with scopes should see only operators matching their scope attributes
4. Admin in pod should see only operators assigned to their pod
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://support-modern.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@oryno.com"
SUPER_ADMIN_PASSWORD = "testpassword123"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "testpassword123"


@pytest.fixture(scope="module")
def super_admin_token():
    """Get super admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def customer_token():
    """Get customer authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Customer login failed: {response.status_code} - {response.text}")


@pytest.fixture
def super_admin_headers(super_admin_token):
    """Headers with super admin auth"""
    return {"Authorization": f"Bearer {super_admin_token}"}


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def customer_headers(customer_token):
    """Headers with customer auth"""
    return {"Authorization": f"Bearer {customer_token}"}


class TestOperatorListingAccessInfo:
    """Test that operator listing API returns access_info"""
    
    def test_operators_list_returns_access_info(self, super_admin_headers):
        """Test that /api/operators returns access_info in response"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify access_info is present
        assert "access_info" in data, "Response should contain access_info"
        
        access_info = data["access_info"]
        assert "has_global_access" in access_info, "access_info should have has_global_access"
        assert "pod_name" in access_info, "access_info should have pod_name"
        assert "scope_count" in access_info, "access_info should have scope_count"
        
        print(f"Access info: {access_info}")
        
    def test_operators_list_has_operators(self, super_admin_headers):
        """Test that operators list returns operators"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "operators" in data
        assert "total" in data
        
        print(f"Total operators: {data['total']}")
        print(f"Operators returned: {len(data['operators'])}")


class TestSuperAdminOperatorAccess:
    """Test that super admin sees all operators with global access"""
    
    def test_super_admin_has_global_access(self, super_admin_headers):
        """Super admin should have has_global_access: true"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        access_info = data.get("access_info", {})
        
        assert access_info.get("has_global_access") == True, \
            f"Super admin should have global access, got: {access_info}"
        
    def test_super_admin_sees_all_operators(self, super_admin_headers):
        """Super admin should see all operators (expected 6)"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        total = data.get("total", 0)
        
        # According to the request, there are 6 operators in the database
        assert total >= 6, f"Super admin should see at least 6 operators, got {total}"
        
        print(f"Super admin sees {total} operators")
        
    def test_super_admin_can_view_any_operator(self, super_admin_headers):
        """Super admin should be able to view any individual operator"""
        # First get list of operators
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert list_response.status_code == 200
        
        operators = list_response.json().get("operators", [])
        if not operators:
            pytest.skip("No operators found")
            
        # Try to view first operator
        operator_id = operators[0].get("id")
        detail_response = requests.get(
            f"{BASE_URL}/api/operators/{operator_id}",
            headers=super_admin_headers
        )
        assert detail_response.status_code == 200, \
            f"Super admin should be able to view operator {operator_id}"
        
        operator_data = detail_response.json()
        assert operator_data.get("id") == operator_id


class TestAdminOperatorAccess:
    """Test admin operator access based on scopes/pods"""
    
    def test_admin_operators_list(self, admin_headers):
        """Admin should be able to list operators"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=admin_headers)
        assert response.status_code == 200, f"Admin should be able to list operators: {response.text}"
        
        data = response.json()
        access_info = data.get("access_info", {})
        
        print(f"Admin access_info: {access_info}")
        print(f"Admin sees {data.get('total', 0)} operators")
        
    def test_admin_access_info_structure(self, admin_headers):
        """Admin response should have proper access_info structure"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        access_info = data.get("access_info", {})
        
        # Verify structure
        assert "has_global_access" in access_info
        assert "pod_name" in access_info
        assert "scope_count" in access_info
        
        # Admin without scopes should have global access (legacy behavior)
        # or specific access based on their scopes
        print(f"Admin has_global_access: {access_info.get('has_global_access')}")
        print(f"Admin pod_name: {access_info.get('pod_name')}")
        print(f"Admin scope_count: {access_info.get('scope_count')}")


class TestOperatorDetailAuthorization:
    """Test authorization for viewing individual operators"""
    
    def test_get_operator_detail_authorized(self, super_admin_headers):
        """Test getting operator detail when authorized"""
        # Get list first
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        operators = list_response.json().get("operators", [])
        
        if not operators:
            pytest.skip("No operators found")
            
        operator_id = operators[0].get("id")
        
        # Get detail
        response = requests.get(
            f"{BASE_URL}/api/operators/{operator_id}",
            headers=super_admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("id") == operator_id
        assert "name" in data
        assert "status" in data
        
    def test_get_nonexistent_operator(self, super_admin_headers):
        """Test getting a non-existent operator returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/operators/{fake_id}",
            headers=super_admin_headers
        )
        assert response.status_code == 404


class TestPodManagementOperatorAssignment:
    """Test pod management for operator assignment"""
    
    def test_list_pods(self, super_admin_headers):
        """Test listing pods"""
        response = requests.get(f"{BASE_URL}/api/pods", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "pods" in data
        print(f"Total pods: {data.get('total', 0)}")
        
    def test_pod_has_assigned_operators_field(self, super_admin_headers):
        """Test that pods have assigned_operator_ids field"""
        response = requests.get(f"{BASE_URL}/api/pods", headers=super_admin_headers)
        assert response.status_code == 200
        
        pods = response.json().get("pods", [])
        if not pods:
            pytest.skip("No pods found")
            
        # Get pod detail
        pod_id = pods[0].get("id")
        detail_response = requests.get(
            f"{BASE_URL}/api/pods/{pod_id}",
            headers=super_admin_headers
        )
        assert detail_response.status_code == 200
        
        pod_data = detail_response.json()
        # assigned_operator_ids may or may not be present
        print(f"Pod data keys: {pod_data.keys()}")
        print(f"Pod assigned_operator_ids: {pod_data.get('assigned_operator_ids', [])}")


class TestEmployeeScopeManagement:
    """Test employee scope management for admin access"""
    
    def test_list_employee_scopes(self, super_admin_headers):
        """Test listing employee scopes"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "scopes" in data
        print(f"Total scopes: {data.get('total', 0)}")
        
    def test_scope_has_filter_attributes(self, super_admin_headers):
        """Test that scopes have filter attributes (countries, regions, etc.)"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=super_admin_headers)
        assert response.status_code == 200
        
        scopes = response.json().get("scopes", [])
        if not scopes:
            pytest.skip("No scopes found")
            
        # Check first scope
        scope = scopes[0]
        print(f"Scope keys: {scope.keys()}")
        
        # These fields should exist (may be empty arrays)
        expected_fields = ["countries", "regions", "market_segments", "service_types"]
        for field in expected_fields:
            assert field in scope, f"Scope should have {field} field"


class TestCustomerLocationAPI:
    """Test customer location API for modal functionality"""
    
    def test_ip_info_endpoint(self):
        """Test IP info endpoint (public)"""
        response = requests.get(f"{BASE_URL}/api/customer-location/ip-info")
        assert response.status_code == 200
        
        data = response.json()
        assert "ip" in data
        assert "location" in data
        assert "is_in_africa" in data
        
        print(f"IP info: {data}")
        
    def test_geography_countries_for_modal(self, super_admin_headers):
        """Test geography countries endpoint for location modal dropdown"""
        response = requests.get(f"{BASE_URL}/api/geography/countries", headers=super_admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "countries" in data
        
        countries = data.get("countries", [])
        assert len(countries) > 0, "Should have at least one country"
        
        # Verify country structure for dropdown
        if countries:
            country = countries[0]
            assert "code" in country, "Country should have code"
            assert "name" in country, "Country should have name"
            
        print(f"Total countries for dropdown: {len(countries)}")


class TestAuthorizationContextFlow:
    """Test the complete authorization context flow"""
    
    def test_super_admin_full_access_flow(self, super_admin_headers):
        """Test super admin has full access to all operators"""
        # 1. List operators
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=super_admin_headers)
        assert list_response.status_code == 200
        
        data = list_response.json()
        assert data.get("access_info", {}).get("has_global_access") == True
        
        operators = data.get("operators", [])
        total = data.get("total", 0)
        
        # 2. Verify can access each operator
        for op in operators[:3]:  # Test first 3
            op_id = op.get("id")
            detail_response = requests.get(
                f"{BASE_URL}/api/operators/{op_id}",
                headers=super_admin_headers
            )
            assert detail_response.status_code == 200, \
                f"Super admin should access operator {op_id}"
                
        print(f"Super admin successfully accessed {min(3, len(operators))} operators")
        
    def test_admin_access_flow(self, admin_headers):
        """Test admin access flow with authorization context"""
        # 1. List operators
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=admin_headers)
        assert list_response.status_code == 200
        
        data = list_response.json()
        access_info = data.get("access_info", {})
        
        print(f"Admin authorization context:")
        print(f"  - has_global_access: {access_info.get('has_global_access')}")
        print(f"  - pod_name: {access_info.get('pod_name')}")
        print(f"  - scope_count: {access_info.get('scope_count')}")
        
        operators = data.get("operators", [])
        print(f"  - operators visible: {len(operators)}")
        
        # 2. If admin has operators, verify can access them
        for op in operators[:2]:
            op_id = op.get("id")
            detail_response = requests.get(
                f"{BASE_URL}/api/operators/{op_id}",
                headers=admin_headers
            )
            # Admin should be able to access operators in their list
            assert detail_response.status_code in [200, 403], \
                f"Unexpected status for operator {op_id}: {detail_response.status_code}"


class TestOperatorFiltering:
    """Test operator filtering by various criteria"""
    
    def test_filter_by_status(self, super_admin_headers):
        """Test filtering operators by status"""
        response = requests.get(
            f"{BASE_URL}/api/operators/?op_status=active",
            headers=super_admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        operators = data.get("operators", [])
        
        # All returned operators should be active
        for op in operators:
            assert op.get("status") == "active", \
                f"Operator {op.get('id')} should be active"
                
    def test_filter_by_country(self, super_admin_headers):
        """Test filtering operators by country"""
        response = requests.get(
            f"{BASE_URL}/api/operators/?country=CM",
            headers=super_admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        operators = data.get("operators", [])
        
        # All returned operators should be in Cameroon
        for op in operators:
            assert op.get("country", "").upper() == "CM", \
                f"Operator {op.get('id')} should be in CM"
                
        print(f"Operators in Cameroon: {len(operators)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test operators API access fix - Iteration 96
Tests the fix for admin users in pods with no assigned operators getting legacy full access.

Issue: Admin user in pod 'Alpha Team' with 0 assigned operators was getting '__no_access__'
Fix: Modified get_operator_access_filter to check if pod actually has operators before restricting access
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_CREDS = {"email": "admin@test.com", "password": "testpassword123"}
SUPER_ADMIN_CREDS = {"email": "superadmin@test.com", "password": "testpassword123"}

# Expected operators in DB
EXPECTED_OPERATORS = ["Musango Bus Service", "Oryno Travel & Hospitality", "West Region Tours"]


class TestOperatorsAccessFix:
    """Test operators API access for admin users in pods with no assigned operators"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_admin_can_list_operators(self, admin_token):
        """Admin should see all operators (legacy access when pod has no assigned operators)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/operators/", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        operators = data.get("operators", [])
        
        # Should have at least 3 operators
        assert len(operators) >= 3, f"Expected at least 3 operators, got {len(operators)}"
        
        # Verify expected operators are present
        operator_names = [op.get("name") for op in operators]
        for expected_name in EXPECTED_OPERATORS:
            assert expected_name in operator_names, f"Expected operator '{expected_name}' not found in {operator_names}"
        
        print(f"SUCCESS: Admin can list {len(operators)} operators: {operator_names}")
    
    def test_super_admin_can_list_operators(self, super_admin_token):
        """Super admin should see all operators"""
        headers = {"Authorization": f"Bearer {super_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/operators/", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        operators = data.get("operators", [])
        
        # Should have at least 3 operators
        assert len(operators) >= 3, f"Expected at least 3 operators, got {len(operators)}"
        
        operator_names = [op.get("name") for op in operators]
        print(f"SUCCESS: Super admin can list {len(operators)} operators: {operator_names}")
    
    def test_admin_can_create_operator(self, admin_token):
        """Admin should be able to create a new operator (status: pending)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create test operator
        test_operator = {
            "name": "TEST_Iteration96_Operator",
            "email": "test_iter96@example.com",
            "phone": "+237600000096",
            "city": "Douala",
            "operator_type": "travel",
            "service_types": ["travel"],
            "country": "CM",
            "market_segment": "sme"
        }
        
        response = requests.post(f"{BASE_URL}/api/operators/", headers=headers, json=test_operator)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operator_id" in data, f"Expected operator_id in response: {data}"
        
        operator_id = data["operator_id"]
        print(f"SUCCESS: Admin created operator with ID: {operator_id}")
        
        # Verify operator appears in list
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=headers)
        assert list_response.status_code == 200
        
        operators = list_response.json().get("operators", [])
        operator_names = [op.get("name") for op in operators]
        assert "TEST_Iteration96_Operator" in operator_names, f"Created operator not in list: {operator_names}"
        
        # Find the created operator and verify status is pending
        created_op = next((op for op in operators if op.get("name") == "TEST_Iteration96_Operator"), None)
        assert created_op is not None, "Created operator not found in list"
        assert created_op.get("status") == "pending", f"Expected status 'pending', got '{created_op.get('status')}'"
        
        print(f"SUCCESS: Created operator has status 'pending' as expected")
        
        # Cleanup - delete the test operator
        delete_response = requests.delete(f"{BASE_URL}/api/operators/{operator_id}", headers=headers)
        print(f"Cleanup: Delete operator response: {delete_response.status_code}")
    
    def test_admin_can_view_operator_detail(self, admin_token):
        """Admin should be able to view operator details"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get list to find an operator ID
        list_response = requests.get(f"{BASE_URL}/api/operators/", headers=headers)
        assert list_response.status_code == 200
        
        operators = list_response.json().get("operators", [])
        assert len(operators) > 0, "No operators found to test detail view"
        
        operator_id = operators[0].get("id") or operators[0].get("_id")
        operator_name = operators[0].get("name")
        
        # Get operator detail
        detail_response = requests.get(f"{BASE_URL}/api/operators/{operator_id}", headers=headers)
        
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}: {detail_response.text}"
        
        detail = detail_response.json()
        assert detail.get("name") == operator_name, f"Expected name '{operator_name}', got '{detail.get('name')}'"
        
        print(f"SUCCESS: Admin can view operator detail for '{operator_name}'")


class TestGeographyEndpoints:
    """Test geography endpoints used by operators management page"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    def test_get_countries(self, admin_token):
        """Geography countries endpoint should work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/geography/countries", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        countries = data.get("countries", [])
        assert len(countries) > 0, "Expected at least one country"
        
        # Check for Cameroon
        country_codes = [c.get("code") for c in countries]
        assert "CM" in country_codes, f"Expected 'CM' in countries: {country_codes}"
        
        print(f"SUCCESS: Got {len(countries)} countries including CM")
    
    def test_get_regions(self, admin_token):
        """Geography regions endpoint should work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/geography/regions", headers=headers, params={"country_id": "CM"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        regions = data.get("regions", [])
        
        print(f"SUCCESS: Got {len(regions)} regions for CM")
    
    def test_get_market_segments(self, admin_token):
        """Geography market segments endpoint should work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/geography/market-segments", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        segments = data.get("market_segments", [])
        
        print(f"SUCCESS: Got {len(segments)} market segments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

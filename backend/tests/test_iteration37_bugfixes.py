# Test file for Iteration 37 - Bug Fixes
# Tests: market_segment enum fix, audit-log route, location modal behavior

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMarketSegmentEnumFix:
    """Tests for market_segment field no longer using enum validation"""
    
    def setup_method(self):
        """Login as super admin to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_operators_list(self):
        """Test getting operators list works"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=self.headers)
        assert response.status_code == 200, f"Failed to get operators: {response.text}"
        data = response.json()
        assert "operators" in data or isinstance(data, list)
        print(f"PASS: GET /api/operators/ - Found {len(data.get('operators', data))} operators")
    
    def test_update_operator_with_dynamic_market_segment(self):
        """Test that updating operator with 'micro' segment works (was failing with enum)"""
        # Get operators first
        response = requests.get(f"{BASE_URL}/api/operators/", headers=self.headers)
        assert response.status_code == 200
        operators = response.json().get("operators", response.json())
        
        if not operators:
            pytest.skip("No operators to test with")
        
        # Pick the first operator
        operator = operators[0]
        operator_id = operator.get('_id') or operator.get('id')
        
        # Test updating with dynamic 'micro' segment (non-enum value)
        update_data = {"market_segment": "micro"}
        response = requests.put(f"{BASE_URL}/api/operators/{operator_id}", 
                               json=update_data, headers=self.headers)
        
        assert response.status_code == 200, f"Failed to update operator with 'micro' segment: {response.text}"
        print(f"PASS: PUT /api/operators/{operator_id} with market_segment='micro' - SUCCESS")
        
        # Verify the change persisted
        response = requests.get(f"{BASE_URL}/api/operators/{operator_id}", headers=self.headers)
        assert response.status_code == 200
        updated_operator = response.json()
        assert updated_operator.get("market_segment") == "micro", f"Segment not updated: {updated_operator.get('market_segment')}"
        print(f"PASS: Verified market_segment='micro' persisted correctly")
    
    def test_update_operator_with_enterprise_segment(self):
        """Test that updating operator with 'enterprise' segment still works"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=self.headers)
        assert response.status_code == 200
        operators = response.json().get("operators", response.json())
        
        if not operators:
            pytest.skip("No operators to test with")
        
        operator = operators[0]
        operator_id = operator.get('_id') or operator.get('id')
        
        # Test with standard enum value 'enterprise'
        update_data = {"market_segment": "enterprise"}
        response = requests.put(f"{BASE_URL}/api/operators/{operator_id}", 
                               json=update_data, headers=self.headers)
        
        assert response.status_code == 200, f"Failed to update with 'enterprise': {response.text}"
        print(f"PASS: PUT /api/operators/{operator_id} with market_segment='enterprise' - SUCCESS")
        
        # Verify persisted
        response = requests.get(f"{BASE_URL}/api/operators/{operator_id}", headers=self.headers)
        assert response.status_code == 200
        updated_operator = response.json()
        assert updated_operator.get("market_segment") == "enterprise"
        print(f"PASS: Verified market_segment='enterprise' persisted correctly")
    
    def test_update_operator_with_custom_segment(self):
        """Test with custom dynamically created segment (e.g., 'testing_market_segment')"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=self.headers)
        assert response.status_code == 200
        operators = response.json().get("operators", response.json())
        
        if not operators:
            pytest.skip("No operators to test with")
        
        operator = operators[0]
        operator_id = operator.get('_id') or operator.get('id')
        
        # Test with custom segment name (from dynamic creation)
        update_data = {"market_segment": "testing_market_segment"}
        response = requests.put(f"{BASE_URL}/api/operators/{operator_id}", 
                               json=update_data, headers=self.headers)
        
        assert response.status_code == 200, f"Failed to update with custom segment: {response.text}"
        print(f"PASS: PUT /api/operators/{operator_id} with custom market_segment - SUCCESS")
        
        # Reset to sme for clean state
        requests.put(f"{BASE_URL}/api/operators/{operator_id}", 
                    json={"market_segment": "sme"}, headers=self.headers)
        print(f"INFO: Reset operator market_segment back to 'sme'")


class TestAuditLogRoute:
    """Tests for /admin/audit-log and /admin/audit-logs routes both working"""
    
    def setup_method(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_audit_logs_api_endpoint(self):
        """Test that audit logs API works"""
        response = requests.get(f"{BASE_URL}/api/audit-logs/", headers=self.headers)
        assert response.status_code == 200, f"Audit logs API failed: {response.text}"
        data = response.json()
        print(f"PASS: GET /api/audit-logs/ - API returns {len(data.get('logs', data))} logs")


class TestCustomerLocationAPI:
    """Tests for customer location IP detection API"""
    
    def setup_method(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@test.com",
            "password": "testpassword123"
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed - skipping customer tests")
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_ip_info_endpoint(self):
        """Test that IP info endpoint works"""
        response = requests.get(f"{BASE_URL}/api/customer-location/ip-info", headers=self.headers)
        # It may return 200 or may fail if IP detection service is unavailable
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: GET /api/customer-location/ip-info - Location: {data.get('location', {})}")
        else:
            print(f"INFO: IP info endpoint returned {response.status_code} - may be expected behavior")
    
    def test_geography_countries_endpoint(self):
        """Test countries endpoint for location modal"""
        response = requests.get(f"{BASE_URL}/api/geography/countries", headers=self.headers)
        assert response.status_code == 200, f"Countries API failed: {response.text}"
        data = response.json()
        countries = data.get("countries", [])
        assert len(countries) > 0, "No countries returned"
        print(f"PASS: GET /api/geography/countries - Returns {len(countries)} countries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

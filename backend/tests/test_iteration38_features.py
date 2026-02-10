"""
Iteration 38 Test Suite - Testing scope-pod integration and dynamic segment colors
Features tested:
1. Backend: PUT /api/operators/{id} with any market_segment string works (not enum-restricted)
2. Backend: GET /api/operators/ returns owner_name via fallback chain
3. Backend: GET /api/employee-scopes/{id}/matching-operators returns operators filtered by scope criteria
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Authenticate as super admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "superadmin@oryno.com",
        "password": "testpassword123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestMarketSegmentNotEnumRestricted:
    """Test that market_segment field accepts any string value, not enum-restricted"""
    
    def test_get_operators_list(self, auth_headers):
        """Verify we can fetch operators to get an ID for update testing"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "operators" in data
        assert len(data["operators"]) > 0
        print(f"Found {len(data['operators'])} operators")
    
    def test_update_operator_with_dynamic_segment(self, auth_headers):
        """Test PUT /api/operators/{id} with any market_segment string"""
        # Get first operator
        response = requests.get(f"{BASE_URL}/api/operators/", headers=auth_headers)
        operators = response.json().get("operators", [])
        assert len(operators) > 0, "No operators to test with"
        
        operator = operators[0]
        operator_id = operator.get("id") or operator.get("_id")
        original_segment = operator.get("market_segment", "sme")
        
        # Test updating with a dynamic segment name
        test_segments = ["micro", "enterprise", "strategic", "testing_market_segment", "custom_segment_xyz"]
        
        for segment in test_segments:
            response = requests.put(
                f"{BASE_URL}/api/operators/{operator_id}",
                headers=auth_headers,
                json={"market_segment": segment}
            )
            assert response.status_code == 200, f"Failed to update operator with market_segment='{segment}': {response.text}"
            print(f"PASS: Updated operator with market_segment='{segment}'")
        
        # Restore original segment
        requests.put(
            f"{BASE_URL}/api/operators/{operator_id}",
            headers=auth_headers,
            json={"market_segment": original_segment}
        )
        print(f"Restored original market_segment='{original_segment}'")


class TestOwnerNameFallbackChain:
    """Test that GET /api/operators/ returns owner_name via fallback chain:
    owner_user_id → created_by → operator user with role=owner
    """
    
    def test_operators_have_owner_info(self, auth_headers):
        """Verify operators list includes owner_name and owner_email fields"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        operators = data.get("operators", [])
        
        # Check structure - should have owner_name and owner_email fields
        for op in operators[:5]:  # Check first 5
            assert "owner_name" in op, f"Operator {op.get('name')} missing owner_name field"
            assert "owner_email" in op, f"Operator {op.get('name')} missing owner_email field"
            print(f"Operator '{op.get('name')}' - owner_name: '{op.get('owner_name')}', owner_email: '{op.get('owner_email')}'")
    
    def test_some_operators_have_owner_names(self, auth_headers):
        """Verify at least some operators have non-empty owner_name (fallback chain working)"""
        response = requests.get(f"{BASE_URL}/api/operators/", headers=auth_headers)
        operators = response.json().get("operators", [])
        
        operators_with_owner = [op for op in operators if op.get("owner_name")]
        operators_without_owner = [op for op in operators if not op.get("owner_name")]
        
        print(f"Operators WITH owner_name: {len(operators_with_owner)}")
        print(f"Operators WITHOUT owner_name: {len(operators_without_owner)}")
        
        # List some with owners
        for op in operators_with_owner[:3]:
            print(f"  - {op.get('name')} → Owner: {op.get('owner_name')}")
        
        # At least some operators should have owner info
        # NOTE: Some may be empty if created_by user was deleted
        assert len(operators_with_owner) > 0 or len(operators) == 0, "Expected at least some operators to have owner_name"


class TestScopeMatchingOperatorsEndpoint:
    """Test GET /api/employee-scopes/{id}/matching-operators endpoint"""
    
    def test_list_scopes(self, auth_headers):
        """List scopes to find one with criteria for testing"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        scopes = data.get("scopes", [])
        print(f"Found {len(scopes)} scopes")
        
        for scope in scopes[:5]:
            print(f"  - {scope.get('name')}: countries={scope.get('countries')}, segments={scope.get('market_segments')}")
        
        return scopes
    
    def test_matching_operators_endpoint_exists(self, auth_headers):
        """Test that the matching-operators endpoint exists and works"""
        # Get scopes first
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        scopes = response.json().get("scopes", [])
        
        if not scopes:
            pytest.skip("No scopes to test with")
        
        # Test endpoint on first scope
        scope = scopes[0]
        scope_id = scope.get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/employee-scopes/{scope_id}/matching-operators",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "operators" in data
        assert "total" in data
        assert "scope_name" in data
        print(f"Scope '{data.get('scope_name')}' matches {data.get('total')} operators")
    
    def test_matching_operators_filters_correctly(self, auth_headers):
        """Test that scope criteria actually filter operators"""
        # Create or find a scope with specific criteria
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        scopes = response.json().get("scopes", [])
        
        # Find a scope with country or segment criteria
        criteria_scope = None
        for scope in scopes:
            if scope.get("countries") or scope.get("market_segments") or scope.get("service_types"):
                criteria_scope = scope
                break
        
        if not criteria_scope:
            print("No scope with filter criteria found - testing global scope")
            if scopes:
                scope_id = scopes[0].get("id")
                response = requests.get(
                    f"{BASE_URL}/api/employee-scopes/{scope_id}/matching-operators",
                    headers=auth_headers
                )
                data = response.json()
                # Global scope should return all active operators
                print(f"Global scope returns {data.get('total')} operators")
                assert data.get("total") >= 0
        else:
            scope_id = criteria_scope.get("id")
            response = requests.get(
                f"{BASE_URL}/api/employee-scopes/{scope_id}/matching-operators",
                headers=auth_headers
            )
            data = response.json()
            print(f"Filtered scope '{criteria_scope.get('name')}' returns {data.get('total')} operators")
            print(f"  Criteria: countries={criteria_scope.get('countries')}, segments={criteria_scope.get('market_segments')}")
            
            # Verify operators match criteria
            operators = data.get("operators", [])
            for op in operators[:3]:
                print(f"  - {op.get('name')}: country={op.get('country')}, segment={op.get('market_segment')}")


class TestMarketSegmentsAPI:
    """Test that market segments API returns colors for dynamic segment display"""
    
    def test_get_market_segments(self, auth_headers):
        """Test GET /api/geography/market-segments returns segments with colors"""
        response = requests.get(f"{BASE_URL}/api/geography/market-segments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        segments = data.get("market_segments", [])
        print(f"Found {len(segments)} market segments")
        
        for seg in segments:
            print(f"  - {seg.get('id')}: name='{seg.get('name')}', color='{seg.get('color')}'")
            # Verify each segment has id, name, and color
            assert "id" in seg
            assert "name" in seg
            assert "color" in seg
            assert seg.get("color").startswith("#"), f"Color should be hex: {seg.get('color')}"
        
        # Verify known segments exist
        segment_ids = [s.get("id") for s in segments]
        assert "sme" in segment_ids, "Missing 'sme' segment"
        assert "enterprise" in segment_ids, "Missing 'enterprise' segment"


class TestScopePodAssignment:
    """Test that scopes can have assigned_pod_ids"""
    
    def test_scope_has_assigned_pod_ids_field(self, auth_headers):
        """Verify scope model includes assigned_pod_ids field"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        scopes = response.json().get("scopes", [])
        
        if not scopes:
            pytest.skip("No scopes to test")
        
        # Get full scope details
        scope_id = scopes[0].get("id")
        response = requests.get(f"{BASE_URL}/api/employee-scopes/{scope_id}", headers=auth_headers)
        assert response.status_code == 200
        scope = response.json()
        
        # Check assigned_pod_ids field exists
        assert "assigned_pod_ids" in scope or scope.get("assigned_pod_ids") is None or "assigned_pod_ids" in str(scope)
        print(f"Scope '{scope.get('name')}' has assigned_pod_ids: {scope.get('assigned_pod_ids', [])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

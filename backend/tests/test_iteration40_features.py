"""
Iteration 40 Tests - UI Improvements Feature Verification
Testing:
1. Backend: Employee scope assignment accepts role='employee' users
2. Verify search and filter fields exist in frontend components
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmployeeScopeAssignment:
    """Test that employee scope assignment accepts role='employee' users"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for super_admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_scopes_list(self, auth_headers):
        """Test that we can list employee scopes"""
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "scopes" in data, "Response should contain 'scopes' key"
        print(f"Found {len(data['scopes'])} scopes")
    
    def test_create_employee_role_user(self, auth_headers):
        """Create a test user with role='employee' to verify scope assignment"""
        # First, check if the user already exists
        response = requests.get(f"{BASE_URL}/api/users/", headers=auth_headers)
        if response.status_code == 200:
            users = response.json().get("users", [])
            for u in users:
                if u.get("email") == "test_employee_role@oryno.com":
                    print(f"Test employee user already exists: {u.get('id') or u.get('_id')}")
                    return u.get("id") or u.get("_id")
        
        # Create new user with employee role
        user_data = {
            "email": "test_employee_role@oryno.com",
            "full_name": "Test Employee Role User",
            "password": "testpassword123",
            "role": "employee"
        }
        response = requests.post(f"{BASE_URL}/api/users/", json=user_data, headers=auth_headers)
        # Accept 201 or 200 or even 400 if user exists
        if response.status_code in [200, 201]:
            data = response.json()
            user_id = data.get("id") or data.get("user_id") or data.get("_id")
            print(f"Created test employee user: {user_id}")
            return user_id
        elif response.status_code == 400 and "exists" in response.text.lower():
            # User already exists, fetch it
            response = requests.get(f"{BASE_URL}/api/users/", headers=auth_headers)
            users = response.json().get("users", [])
            for u in users:
                if u.get("email") == "test_employee_role@oryno.com":
                    return u.get("id") or u.get("_id")
        
        pytest.skip(f"Could not create/find test user: {response.status_code}")
    
    def test_assign_scope_to_employee_role_user(self, auth_headers, test_create_employee_role_user):
        """TEST CRITICAL: Verify scope can be assigned to a user with role='employee'"""
        user_id = test_create_employee_role_user
        if not user_id:
            pytest.skip("No test user available")
        
        # First, get available scopes
        response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        assert response.status_code == 200
        scopes = response.json().get("scopes", [])
        
        if not scopes:
            # Create a test scope
            scope_data = {
                "name": "Test Scope for Employee Role",
                "description": "Test scope for iteration 40 testing",
                "countries": ["CM"],
                "market_segments": [],
                "service_types": []
            }
            response = requests.post(f"{BASE_URL}/api/employee-scopes", json=scope_data, headers=auth_headers)
            if response.status_code in [200, 201]:
                scope_id = response.json().get("scope_id")
                print(f"Created test scope: {scope_id}")
            else:
                pytest.skip(f"Could not create test scope: {response.text}")
        else:
            scope_id = scopes[0]["id"]
            print(f"Using existing scope: {scope_id} ({scopes[0]['name']})")
        
        # Remove any existing assignment first (to avoid duplicate error)
        requests.delete(f"{BASE_URL}/api/employee-scopes/{scope_id}/users/{user_id}", headers=auth_headers)
        
        # Now try to assign scope to employee-role user
        assign_data = {"user_id": user_id}
        response = requests.post(
            f"{BASE_URL}/api/employee-scopes/{scope_id}/assign",
            json=assign_data,
            headers=auth_headers
        )
        
        # This is the critical test - backend should accept role='employee'
        # If it fails with 400 "Only platform employees can have access scopes" then the fix didn't work
        assert response.status_code in [200, 201], \
            f"FAILED: Scope assignment to employee-role user failed with {response.status_code}: {response.text}. " \
            f"Check backend employee_scopes.py line 206 - should include 'employee' in role check."
        
        print(f"SUCCESS: Scope assigned to employee-role user - {response.json()}")
    
    def test_backend_role_check_includes_employee(self):
        """Code review check: Verify backend has 'employee' in role validation"""
        import os
        backend_file = "/app/backend/routes/employee_scopes.py"
        if os.path.exists(backend_file):
            with open(backend_file, "r") as f:
                content = f.read()
            
            # Check line 206 area for employee role
            if '"employee"' in content or "'employee'" in content:
                # Find the specific role check line
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if "role" in line and "employee" in line and ("admin" in line or "super_admin" in line):
                        print(f"VERIFIED: Line {i+1} contains employee role check: {line.strip()}")
                        return
            
            pytest.fail("Could not find 'employee' in role validation in employee_scopes.py")


class TestUIComponentsExist:
    """Test that UI components have the required search/filter elements"""
    
    def test_pod_management_has_member_search(self):
        """Verify PodManagement.jsx has search input in Add Member modal"""
        frontend_file = "/app/frontend/src/pages/admin/PodManagement.jsx"
        if os.path.exists(frontend_file):
            with open(frontend_file, "r") as f:
                content = f.read()
            
            assert 'memberSearch' in content, "PodManagement should have memberSearch state"
            assert 'member-search-input' in content or 'memberSearch' in content, "Should have search input in member modal"
            assert 'memberDeptFilter' in content, "Should have department filter"
            assert 'type="radio"' in content, "Should use radio buttons, not select dropdown"
            print("VERIFIED: PodManagement has search input, department filter, and radio buttons")
        else:
            pytest.skip("PodManagement.jsx not found")
    
    def test_employee_scope_has_assign_search(self):
        """Verify EmployeeScopeManagement.jsx has search in Assign Employee modal"""
        frontend_file = "/app/frontend/src/pages/admin/EmployeeScopeManagement.jsx"
        if os.path.exists(frontend_file):
            with open(frontend_file, "r") as f:
                content = f.read()
            
            assert 'assignSearch' in content, "Should have assignSearch state"
            assert 'assign-search-input' in content or 'Search by name or email' in content, "Should have search input"
            print("VERIFIED: EmployeeScopeManagement has search in Assign Employee modal")
        else:
            pytest.skip("EmployeeScopeManagement.jsx not found")
    
    def test_employee_scope_has_country_segment_search(self):
        """Verify EmployeeScopeManagement.jsx has search for Countries and Market Segments"""
        frontend_file = "/app/frontend/src/pages/admin/EmployeeScopeManagement.jsx"
        if os.path.exists(frontend_file):
            with open(frontend_file, "r") as f:
                content = f.read()
            
            assert 'countrySearch' in content, "Should have countrySearch state"
            assert 'segmentSearch' in content, "Should have segmentSearch state"
            assert 'scope-country-search' in content or 'Search countries' in content, "Should have country search input"
            assert 'scope-segment-search' in content or 'Search segments' in content, "Should have segment search input"
            print("VERIFIED: EmployeeScopeManagement has search for Countries and Market Segments")
        else:
            pytest.skip("EmployeeScopeManagement.jsx not found")
    
    def test_employees_page_has_view_toggle(self):
        """Verify EmployeesManagement.jsx has grid/list view toggle"""
        frontend_file = "/app/frontend/src/pages/admin/EmployeesManagement.jsx"
        if os.path.exists(frontend_file):
            with open(frontend_file, "r") as f:
                content = f.read()
            
            assert 'viewMode' in content, "Should have viewMode state"
            assert 'LayoutGrid' in content, "Should import LayoutGrid icon"
            assert 'List' in content, "Should import List icon"
            assert 'grid-view-btn' in content or "setViewMode('grid')" in content, "Should have grid view button"
            assert 'list-view-btn' in content or "setViewMode('list')" in content, "Should have list view button"
            assert 'employees-grid' in content or 'employees-list' in content, "Should have grid/list containers"
            print("VERIFIED: EmployeesManagement has grid/list view toggle")
        else:
            pytest.skip("EmployeesManagement.jsx not found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

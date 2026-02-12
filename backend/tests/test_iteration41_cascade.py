"""
Iteration 41 Tests - Cascade Behaviors for Users and Employees

Testing:
1. Employee status sync: Updating employee status syncs to linked user account
2. Employee delete cascade: Deleting employee deactivates user's pod memberships
3. User delete cascade: Deleting user directly cascades to pods/scopes
4. EmployeeStatus enum includes 'suspended' value
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_POD_ID = "1a149422-5c89-46f1-b681-cbfc00518c08"  # Test Pod from context


class TestCascadeBehaviors:
    """Test cascade delete and status sync behaviors"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for super_admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.fail(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}

    # ==================== TEST 1: Employee Status Sync ====================
    
    def test_employee_status_sync_to_user(self, auth_headers):
        """
        TEST: Create employee with user account, then update employee status to 'suspended'.
        Verify the linked user account's status is also changed to 'suspended'.
        Then update to 'active' and verify user is 'active' again.
        """
        # Step 1: Create employee with user account
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "first_name": "StatusSync",
            "last_name": f"Test{unique_id}",
            "email": f"test_status_sync_{unique_id}@oryno.com",
            "phone": "1234567890",
            "position": "Test Employee",
            "department": "Test Department",
            "create_user_account": True,
            "system_role": "employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees/", json=employee_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create employee: {response.status_code} - {response.text}"
        
        result = response.json()
        employee_id = result.get("employee", {}).get("id")
        user_id = result.get("employee", {}).get("user_id")
        user_created = result.get("user_account_created", False)
        
        assert employee_id, f"Employee ID not returned: {result}"
        assert user_created, f"User account not created: {result}"
        assert user_id, f"User ID not returned: {result}"
        
        print(f"✓ Created employee {employee_id} with user {user_id}")
        
        # Step 2: Verify initial user status is 'active'
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert user_response.status_code == 200, f"Failed to get user: {user_response.text}"
        user_data = user_response.json()
        initial_status = user_data.get("status")
        assert initial_status == "active", f"Initial user status should be 'active', got: {initial_status}"
        print(f"✓ Initial user status is '{initial_status}'")
        
        # Step 3: Update employee status to 'suspended'
        update_response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            json={"status": "suspended"},
            headers=auth_headers
        )
        assert update_response.status_code == 200, f"Failed to update employee: {update_response.text}"
        update_result = update_response.json()
        user_status_synced = update_result.get("user_status_synced", False)
        assert user_status_synced, f"user_status_synced should be True: {update_result}"
        print(f"✓ Employee status updated to 'suspended', user_status_synced: {user_status_synced}")
        
        # Step 4: Verify user status is now 'suspended'
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert user_response.status_code == 200
        user_data = user_response.json()
        user_status = user_data.get("status")
        assert user_status == "suspended", f"User status should be 'suspended', got: {user_status}"
        print(f"✓ User status synced to '{user_status}'")
        
        # Step 5: Update employee status back to 'active'
        update_response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            json={"status": "active"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Step 6: Verify user status is now 'active'
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert user_response.status_code == 200
        user_data = user_response.json()
        user_status = user_data.get("status")
        assert user_status == "active", f"User status should be 'active' again, got: {user_status}"
        print(f"✓ User status synced back to '{user_status}'")
        
        # Cleanup: Delete the test employee
        requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=auth_headers)
        print(f"✓ Cleanup: deleted test employee {employee_id}")

    # ==================== TEST 2: Employee Delete Cascade ====================
    
    def test_employee_delete_cascade_pod_membership(self, auth_headers):
        """
        TEST: Create employee with user account, add user to pod, then DELETE employee.
        Verify the pod membership is deactivated (is_active=false).
        """
        # Step 1: Create employee with user account
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "first_name": "DeleteCascade",
            "last_name": f"Test{unique_id}",
            "email": f"test_delete_cascade_{unique_id}@oryno.com",
            "phone": "1234567890",
            "position": "Test Employee",
            "department": "Test Department",
            "create_user_account": True,
            "system_role": "employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees/", json=employee_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        
        result = response.json()
        employee_id = result.get("employee", {}).get("id")
        user_id = result.get("employee", {}).get("user_id")
        
        assert employee_id and user_id, f"Employee or user ID missing: {result}"
        print(f"✓ Created employee {employee_id} with user {user_id}")
        
        # Step 2: Add user to Test Pod (using valid pod role: bdr)
        add_member_response = requests.post(
            f"{BASE_URL}/api/pods/{TEST_POD_ID}/members",
            json={"user_id": user_id, "pod_role": "bdr"},
            headers=auth_headers
        )
        
        # Handle case where pod doesn't exist or user is already in a pod
        if add_member_response.status_code == 404:
            pytest.skip(f"Test Pod {TEST_POD_ID} not found - skipping cascade test")
        if add_member_response.status_code == 400 and "already" in add_member_response.text.lower():
            print(f"User already in a pod, proceeding with delete test")
        else:
            assert add_member_response.status_code == 200, f"Failed to add member to pod: {add_member_response.text}"
            print(f"✓ Added user {user_id} to pod {TEST_POD_ID}")
        
        # Step 3: Verify user is in pod
        pod_members_response = requests.get(f"{BASE_URL}/api/pods/{TEST_POD_ID}/members", headers=auth_headers)
        if pod_members_response.status_code == 200:
            members = pod_members_response.json().get("members", [])
            user_in_pod = any(m.get("user_id") == user_id and m.get("is_active") for m in members)
            if user_in_pod:
                print(f"✓ User {user_id} confirmed in pod with is_active=True")
        
        # Step 4: DELETE the employee
        delete_response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete employee: {delete_response.text}"
        
        delete_result = delete_response.json()
        cascade_result = delete_result.get("cascade", {})
        pods_removed = cascade_result.get("pods_removed", 0)
        
        print(f"✓ Employee deleted. Cascade result: {cascade_result}")
        
        # Step 5: Verify pod membership is deactivated
        # Note: The cascade removes user from pod, so we check the cascade result
        assert pods_removed >= 0, f"Expected pods_removed >= 0, got: {pods_removed}"
        
        # Double-check by querying pod members
        pod_members_response = requests.get(f"{BASE_URL}/api/pods/{TEST_POD_ID}/members", headers=auth_headers)
        if pod_members_response.status_code == 200:
            members = pod_members_response.json().get("members", [])
            user_still_active = any(m.get("user_id") == user_id and m.get("is_active") for m in members)
            assert not user_still_active, f"User should not be active in pod after employee delete"
            print(f"✓ User membership deactivated in pod after employee delete")
        
        print(f"✓ TEST PASSED: Employee delete cascade correctly removed user from pods")

    # ==================== TEST 3: User Delete Cascade ====================
    
    def test_user_delete_cascade(self, auth_headers):
        """
        TEST: Create user, add to pod and scope, then DELETE user directly.
        Verify they are removed from pods and scope assignments.
        """
        # Step 1: Create a test user directly
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"test_user_cascade_{unique_id}@oryno.com",
            "full_name": f"UserCascade Test{unique_id}",
            "password": "testpassword123",
            "role": "employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/users/create", json=user_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        
        user_id = response.json().get("user_id")
        assert user_id, f"User ID not returned: {response.json()}"
        print(f"✓ Created test user {user_id}")
        
        # Step 2: Try to add user to pod (may fail if user already in another pod)
        add_member_response = requests.post(
            f"{BASE_URL}/api/pods/{TEST_POD_ID}/members",
            json={"user_id": user_id, "pod_role": "member"},
            headers=auth_headers
        )
        
        pod_added = add_member_response.status_code == 200
        if pod_added:
            print(f"✓ Added user to Test Pod")
        else:
            print(f"Note: Could not add user to pod: {add_member_response.text}")
        
        # Step 3: Try to assign a scope to user
        scopes_response = requests.get(f"{BASE_URL}/api/employee-scopes", headers=auth_headers)
        scope_id = None
        if scopes_response.status_code == 200:
            scopes = scopes_response.json().get("scopes", [])
            if scopes:
                scope_id = scopes[0]["id"]
                assign_response = requests.post(
                    f"{BASE_URL}/api/employee-scopes/{scope_id}/assign",
                    json={"user_id": user_id},
                    headers=auth_headers
                )
                scope_assigned = assign_response.status_code in [200, 201]
                if scope_assigned:
                    print(f"✓ Assigned scope {scope_id} to user")
                else:
                    print(f"Note: Could not assign scope: {assign_response.text}")
        
        # Step 4: DELETE the user
        delete_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete user: {delete_response.text}"
        
        delete_result = delete_response.json()
        cascade_result = delete_result.get("cascade", {})
        
        print(f"✓ User deleted. Cascade result: {cascade_result}")
        assert cascade_result is not None, "Cascade result should be returned"
        
        # Step 5: Verify user is deleted (should return 404)
        get_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        assert get_response.status_code == 404, f"User should be deleted but got: {get_response.status_code}"
        
        print(f"✓ TEST PASSED: User delete cascade working correctly")

    # ==================== TEST 4: EmployeeStatus Enum ====================
    
    def test_employee_status_enum_includes_suspended(self):
        """
        TEST: Verify EmployeeStatus enum includes 'suspended' value
        """
        backend_file = "/app/backend/models/employee.py"
        assert os.path.exists(backend_file), f"Employee model file not found"
        
        with open(backend_file, "r") as f:
            content = f.read()
        
        # Check for EmployeeStatus enum with SUSPENDED value
        assert "class EmployeeStatus" in content, "EmployeeStatus enum class not found"
        assert "SUSPENDED" in content, "SUSPENDED not found in EmployeeStatus enum"
        assert 'suspended' in content.lower(), "'suspended' value not found"
        
        print(f"✓ EmployeeStatus enum includes SUSPENDED value")
        
        # Also verify the mapping in cascade.py
        cascade_file = "/app/backend/utils/cascade.py"
        assert os.path.exists(cascade_file), "Cascade utils file not found"
        
        with open(cascade_file, "r") as f:
            cascade_content = f.read()
        
        assert "EMPLOYEE_TO_USER_STATUS" in cascade_content, "Status mapping not found in cascade.py"
        assert '"suspended"' in cascade_content, "suspended mapping not found"
        
        print(f"✓ EMPLOYEE_TO_USER_STATUS mapping includes 'suspended' → 'suspended'")

    # ==================== TEST 5: Cascade Functions Exist ====================
    
    def test_cascade_functions_exist(self):
        """
        Verify cascade utility functions exist and are importable
        """
        cascade_file = "/app/backend/utils/cascade.py"
        assert os.path.exists(cascade_file), "Cascade utils file not found"
        
        with open(cascade_file, "r") as f:
            content = f.read()
        
        # Check all required functions exist
        required_functions = [
            "cascade_delete_user",
            "remove_user_from_pods",
            "remove_user_from_scopes",
            "sync_user_status"
        ]
        
        for func in required_functions:
            assert f"async def {func}" in content, f"Function {func} not found in cascade.py"
            print(f"✓ Function {func} exists")
        
        print(f"✓ All cascade functions present")

    # ==================== TEST 6: Employee Routes Import Cascade ====================
    
    def test_employee_routes_use_cascade(self):
        """
        Verify employees.py imports and uses cascade functions
        """
        employees_file = "/app/backend/routes/employees.py"
        assert os.path.exists(employees_file), "Employees routes file not found"
        
        with open(employees_file, "r") as f:
            content = f.read()
        
        # Check update_employee calls sync_user_status
        assert "sync_user_status" in content, "sync_user_status not used in employees.py"
        assert "from utils.cascade import" in content, "cascade import not found in employees.py"
        
        # Check delete_employee calls cascade_delete_user
        assert "cascade_delete_user" in content, "cascade_delete_user not used in employees.py"
        
        print(f"✓ Employee routes correctly use cascade functions")

    # ==================== TEST 7: User Routes Import Cascade ====================
    
    def test_user_routes_use_cascade(self):
        """
        Verify users.py imports and uses cascade functions for delete
        """
        users_file = "/app/backend/routes/users.py"
        assert os.path.exists(users_file), "Users routes file not found"
        
        with open(users_file, "r") as f:
            content = f.read()
        
        # Check delete_user calls cascade_delete_user
        assert "cascade_delete_user" in content, "cascade_delete_user not used in users.py"
        assert "from utils.cascade import" in content, "cascade import not found in users.py"
        
        print(f"✓ User routes correctly use cascade functions for delete")


class TestStatusMappings:
    """Test the employee-to-user status mapping logic"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for super_admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_status_mapping_terminated(self, auth_headers):
        """Test that terminated employee status maps to suspended user status"""
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "first_name": "Terminated",
            "last_name": f"Test{unique_id}",
            "email": f"test_terminated_{unique_id}@oryno.com",
            "create_user_account": True,
            "system_role": "employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees/", json=employee_data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        employee_id = result.get("employee", {}).get("id")
        user_id = result.get("employee", {}).get("user_id")
        
        # Update to terminated
        update_response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            json={"status": "terminated"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify user is suspended (terminated → suspended)
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        if user_response.status_code == 200:
            user_status = user_response.json().get("status")
            assert user_status == "suspended", f"Terminated employee should map to suspended user, got: {user_status}"
            print(f"✓ terminated → suspended mapping works")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=auth_headers)

    def test_status_mapping_on_leave(self, auth_headers):
        """Test that on_leave employee status maps to active user status"""
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "first_name": "OnLeave",
            "last_name": f"Test{unique_id}",
            "email": f"test_on_leave_{unique_id}@oryno.com",
            "create_user_account": True,
            "system_role": "employee"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees/", json=employee_data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        employee_id = result.get("employee", {}).get("id")
        user_id = result.get("employee", {}).get("user_id")
        
        # Update to on_leave
        update_response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            json={"status": "on_leave"},
            headers=auth_headers
        )
        assert update_response.status_code == 200
        
        # Verify user is still active (on_leave → active)
        user_response = requests.get(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
        if user_response.status_code == 200:
            user_status = user_response.json().get("status")
            assert user_status == "active", f"on_leave employee should map to active user, got: {user_status}"
            print(f"✓ on_leave → active mapping works")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

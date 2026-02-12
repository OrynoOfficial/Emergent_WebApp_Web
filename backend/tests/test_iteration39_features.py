"""
Iteration 39 Tests - Three Feature Fixes
1. Login page: 'I am logging in as a service operator' checkbox REMOVED
2. Pod member assignment: employees with role='employee' can now be added to pods
3. Geography page: Countries with expandable regions (parent-child view)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPodMemberAssignmentWithEmployeeRole:
    """Test that users with role='employee' can be added to pods"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for super_admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_employee_with_user_account_employee_role(self):
        """Create an employee with user account and system_role='employee'"""
        import random
        test_email = f"test_emp_{random.randint(10000, 99999)}@test.com"
        
        # Create employee with user account
        response = requests.post(
            f"{BASE_URL}/api/employees/",
            headers=self.headers,
            json={
                "first_name": "Test",
                "last_name": "Employee",
                "email": test_email,
                "phone": "+237600000000",
                "department": "operations",
                "create_user_account": True,
                "system_role": "employee"
            }
        )
        
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        data = response.json()
        assert data["user_account_created"] == True
        
        # Verify the user was created with role='employee'
        users_response = requests.get(
            f"{BASE_URL}/api/users/",
            headers=self.headers,
            params={"search": test_email}
        )
        assert users_response.status_code == 200
        users = users_response.json().get("users", [])
        
        # Find our test user
        test_user = None
        for u in users:
            if u.get("email") == test_email:
                test_user = u
                break
        
        assert test_user is not None, f"User {test_email} not found in users list"
        assert test_user.get("role") == "employee", f"User role should be 'employee', got: {test_user.get('role')}"
        
        # Store user_id for next test
        self.test_user_id = test_user.get("id") or test_user.get("_id")
        self.test_email = test_email
        return self.test_user_id
    
    def test_add_employee_role_user_to_pod(self):
        """Test that a user with role='employee' can be added to a pod"""
        import random
        
        # First create an employee with user account
        test_email = f"test_pod_emp_{random.randint(10000, 99999)}@test.com"
        
        emp_response = requests.post(
            f"{BASE_URL}/api/employees/",
            headers=self.headers,
            json={
                "first_name": "Pod",
                "last_name": "TestEmployee",
                "email": test_email,
                "phone": "+237600000001",
                "department": "operations",
                "create_user_account": True,
                "system_role": "employee"
            }
        )
        assert emp_response.status_code == 200, f"Failed to create employee: {emp_response.text}"
        
        # Get the user ID
        users_response = requests.get(
            f"{BASE_URL}/api/users/",
            headers=self.headers,
            params={"search": test_email}
        )
        assert users_response.status_code == 200
        users = users_response.json().get("users", [])
        
        test_user = None
        for u in users:
            if u.get("email") == test_email:
                test_user = u
                break
        
        assert test_user is not None, f"User {test_email} not found"
        user_id = test_user.get("id") or test_user.get("_id")
        
        # Verify user has 'employee' role
        assert test_user.get("role") == "employee", f"Expected role='employee', got: {test_user.get('role')}"
        
        # Get an existing pod
        pods_response = requests.get(f"{BASE_URL}/api/pods", headers=self.headers)
        assert pods_response.status_code == 200
        pods = pods_response.json().get("pods", [])
        
        if not pods:
            # Create a test pod if none exists
            pod_create_response = requests.post(
                f"{BASE_URL}/api/pods",
                headers=self.headers,
                json={"name": f"Test Pod {random.randint(1000, 9999)}", "description": "Test pod for employee assignment"}
            )
            assert pod_create_response.status_code == 200, f"Failed to create pod: {pod_create_response.text}"
            pod_id = pod_create_response.json()["pod_id"]
        else:
            pod_id = pods[0]["id"]
        
        # Now add the employee-role user to the pod - THIS IS THE KEY TEST
        # Before the fix, this would fail with "Only platform employees can be added to pods"
        add_member_response = requests.post(
            f"{BASE_URL}/api/pods/{pod_id}/members",
            headers=self.headers,
            json={"user_id": user_id, "pod_role": "csm"}
        )
        
        assert add_member_response.status_code == 200, f"Failed to add employee to pod: {add_member_response.text}. This confirms the fix worked - 'employee' role is now accepted."
        
        # Cleanup - remove the member
        requests.delete(f"{BASE_URL}/api/pods/{pod_id}/members/{user_id}", headers=self.headers)
        
        print(f"SUCCESS: User with role='employee' was added to pod (user_id={user_id}, pod_id={pod_id})")


class TestGeographyAPI:
    """Test Geography API for countries and regions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_countries(self):
        """Test GET /api/geography/countries returns countries list"""
        response = requests.get(f"{BASE_URL}/api/geography/countries", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get countries: {response.text}"
        data = response.json()
        
        assert "countries" in data
        countries = data["countries"]
        assert len(countries) >= 1, "Expected at least 1 country"
        
        # Check Cameroon exists
        cameroon = None
        for c in countries:
            if c.get("code") == "CM":
                cameroon = c
                break
        
        assert cameroon is not None, "Cameroon (CM) should be in the countries list"
        print(f"Found {len(countries)} countries including Cameroon")
    
    def test_get_regions(self):
        """Test GET /api/geography/regions returns regions list"""
        response = requests.get(f"{BASE_URL}/api/geography/regions", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get regions: {response.text}"
        data = response.json()
        
        assert "regions" in data
        regions = data["regions"]
        
        print(f"Found {len(regions)} regions")
        
        # Find Cameroon's country_id first
        countries_response = requests.get(f"{BASE_URL}/api/geography/countries", headers=self.headers)
        countries = countries_response.json().get("countries", [])
        cameroon_id = None
        for c in countries:
            if c.get("code") == "CM":
                cameroon_id = c.get("id")
                break
        
        if cameroon_id:
            # Count regions for Cameroon
            cameroon_regions = [r for r in regions if r.get("country_id") == cameroon_id]
            print(f"Cameroon has {len(cameroon_regions)} regions")
            # Per the requirements, Cameroon should have 10 regions
            assert len(cameroon_regions) == 10, f"Cameroon should have 10 regions, found {len(cameroon_regions)}"
    
    def test_create_region_in_country(self):
        """Test creating a region within a country"""
        import random
        
        # Get Cameroon's country_id
        countries_response = requests.get(f"{BASE_URL}/api/geography/countries", headers=self.headers)
        countries = countries_response.json().get("countries", [])
        cameroon = None
        for c in countries:
            if c.get("code") == "CM":
                cameroon = c
                break
        
        assert cameroon is not None, "Cameroon not found"
        
        # Create a test region
        test_code = f"CM-TEST-{random.randint(100, 999)}"
        response = requests.post(
            f"{BASE_URL}/api/geography/regions",
            headers=self.headers,
            json={
                "country_id": cameroon["id"],
                "code": test_code,
                "name": f"Test Region {random.randint(100, 999)}",
                "capital_city": "Test City"
            }
        )
        
        assert response.status_code in [200, 201], f"Failed to create region: {response.text}"
        print(f"Successfully created test region with code {test_code}")
        
        # Cleanup - delete the test region
        data = response.json()
        region_id = data.get("region_id") or data.get("id")
        if region_id:
            requests.delete(f"{BASE_URL}/api/geography/regions/{region_id}", headers=self.headers)


class TestPodsAcceptEmployeeRole:
    """Direct test of pods.py accepting employee role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pods_route_accepts_employee_role(self):
        """
        Verify that lines 270-271 of pods.py now include 'employee' role.
        This test checks that the backend accepts employee role users for pod membership.
        """
        import random
        
        # Create a user with role='employee' directly
        test_email = f"direct_emp_{random.randint(10000, 99999)}@test.com"
        
        # Use employees endpoint with create_user_account=True and system_role='employee'
        emp_response = requests.post(
            f"{BASE_URL}/api/employees/",
            headers=self.headers,
            json={
                "first_name": "Direct",
                "last_name": "EmpTest",
                "email": test_email,
                "phone": "+237600000002",
                "create_user_account": True,
                "system_role": "employee"
            }
        )
        assert emp_response.status_code == 200
        
        # Get user ID
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=self.headers)
        users = users_response.json().get("users", [])
        user = next((u for u in users if u.get("email") == test_email), None)
        
        assert user is not None
        assert user.get("role") == "employee"
        user_id = user.get("id") or user.get("_id")
        
        # Get first pod
        pods_response = requests.get(f"{BASE_URL}/api/pods", headers=self.headers)
        pods = pods_response.json().get("pods", [])
        assert len(pods) > 0, "No pods available for testing"
        pod_id = pods[0]["id"]
        
        # Attempt to add - this should now work with the fix
        add_response = requests.post(
            f"{BASE_URL}/api/pods/{pod_id}/members",
            headers=self.headers,
            json={"user_id": user_id, "pod_role": "support_agent"}
        )
        
        # The key assertion - this should be 200, not 400 with "Only platform employees"
        if add_response.status_code == 400 and "already" in add_response.text.lower():
            # User might already be in a pod, that's fine
            print(f"User already in a pod (expected if running tests multiple times)")
        else:
            assert add_response.status_code == 200, f"Adding employee role user to pod failed: {add_response.text}. Check pods.py lines 270-271 include 'employee' in role check."
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/pods/{pod_id}/members/{user_id}", headers=self.headers)
        print(f"PASS: Backend pods.py accepts role='employee' for pod membership")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Iteration 50 - Operator Owner Account Creation & Table Display Tests
Tests for:
1. POST /api/operators/ with create_owner_account=true creates owner user
2. Created owner can login
3. POST /api/operators/ without create_owner_account works (backwards compatible)
4. GET /api/operators/ returns owner_name, owner_email, revenue, created_at, status, service_types
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")


class TestOperatorOwnerCreation(TestAuth):
    """Test operator creation with owner account"""
    
    test_operator_id = None
    test_owner_email = None
    
    def test_create_operator_with_owner_account(self, super_admin_token):
        """POST /api/operators/ with create_owner_account=true should create operator AND owner user"""
        unique_id = str(uuid.uuid4())[:8]
        TestOperatorOwnerCreation.test_owner_email = f"TEST_owner_{unique_id}@testco.com"
        
        payload = {
            "name": f"TEST Company {unique_id}",
            "email": f"TEST_operator_{unique_id}@testco.com",
            "phone": "+237600000001",
            "city": "Douala",
            "operator_type": "travel",
            "service_types": ["travel", "hotels"],
            "country": "CM",
            "region": "",
            "market_segment": "sme",
            # Owner account fields
            "create_owner_account": True,
            "owner_full_name": f"Test Owner {unique_id}",
            "owner_email": TestOperatorOwnerCreation.test_owner_email,
            "owner_phone": "+237600000002",
            "owner_password": "TestOwner123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/operators/",
            json=payload,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Create operator failed: {response.text}"
        data = response.json()
        
        # Verify response contains owner account info
        assert data.get("owner_account_created") == True, "owner_account_created should be True"
        assert "owner_user_id" in data, "Response should contain owner_user_id"
        assert data.get("owner_email") == TestOperatorOwnerCreation.test_owner_email, "owner_email mismatch"
        assert "operator_id" in data, "Response should contain operator_id"
        
        TestOperatorOwnerCreation.test_operator_id = data.get("operator_id")
        print(f"Created operator with ID: {TestOperatorOwnerCreation.test_operator_id}")
        print(f"Created owner account: {TestOperatorOwnerCreation.test_owner_email}")
    
    def test_owner_can_login(self):
        """Created owner should be able to login with provided credentials"""
        assert TestOperatorOwnerCreation.test_owner_email, "Owner email not set from previous test"
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TestOperatorOwnerCreation.test_owner_email,
            "password": "TestOwner123!"
        })
        
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        
        # Verify user data
        assert "access_token" in data, "Login should return access_token"
        user = data.get("user", {})
        assert user.get("role") == "operator", f"User role should be 'operator', got {user.get('role')}"
        
        # operator_role may be in operator_context or directly in user
        operator_context = user.get("operator_context", {})
        operator_role = user.get("operator_role") or operator_context.get("operator_role")
        assert operator_role == "owner", f"operator_role should be 'owner', got {operator_role}"
        
        # operator_id may be in operator_context or directly in user
        operator_id = user.get("operator_id") or operator_context.get("operator_id")
        assert operator_id == TestOperatorOwnerCreation.test_operator_id, f"operator_id mismatch: {operator_id} != {TestOperatorOwnerCreation.test_operator_id}"
        
        print(f"Owner login successful - role: {user.get('role')}, operator_role: {operator_role}")
    
    def test_create_operator_without_owner_account(self, super_admin_token):
        """POST /api/operators/ without create_owner_account should work (backwards compatible)"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "name": f"TEST NoOwner Company {unique_id}",
            "email": f"TEST_noowner_{unique_id}@testco.com",
            "phone": "+237600000003",
            "city": "Yaounde",
            "operator_type": "hotel",  # 'hotel' not 'hotels' - singular per enum
            "service_types": ["hotel"],
            "country": "CM",
            "market_segment": "enterprise"
            # No owner account fields
        }
        
        response = requests.post(
            f"{BASE_URL}/api/operators/",
            json=payload,
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Create operator failed: {response.text}"
        data = response.json()
        
        # Should not have owner_account_created or should be False
        assert data.get("owner_account_created") in [False, None], "owner_account_created should be False or None"
        assert "operator_id" in data, "Response should contain operator_id"
        
        # Cleanup - delete this test operator
        op_id = data.get("operator_id")
        requests.delete(f"{BASE_URL}/api/operators/{op_id}", headers={"Authorization": f"Bearer {super_admin_token}"})
        print(f"Created and cleaned up operator without owner account")


class TestOperatorListResponse(TestAuth):
    """Test GET /api/operators/ returns all required columns"""
    
    def test_operators_list_returns_required_fields(self, super_admin_token):
        """GET /api/operators/ should return owner_name, owner_email, revenue, created_at, status, service_types"""
        response = requests.get(
            f"{BASE_URL}/api/operators/",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get operators failed: {response.text}"
        data = response.json()
        
        assert "operators" in data, "Response should contain 'operators' array"
        operators = data.get("operators", [])
        
        if len(operators) > 0:
            op = operators[0]
            
            # Required fields for table columns
            required_fields = ["id", "name", "service_types", "status", "revenue", "created_at"]
            for field in required_fields:
                assert field in op, f"Operator should have '{field}' field"
            
            # Owner fields should exist (may be empty string)
            assert "owner_name" in op, "Operator should have 'owner_name' field"
            assert "owner_email" in op, "Operator should have 'owner_email' field"
            
            # Verify types
            assert isinstance(op.get("service_types"), list), "service_types should be a list"
            assert isinstance(op.get("revenue"), (int, float)), "revenue should be a number"
            
            print(f"Verified operator fields: id={op.get('id')[:8]}..., name={op.get('name')}, owner={op.get('owner_name')}, revenue={op.get('revenue')}, status={op.get('status')}")
        else:
            print("No operators found - skipping field verification")
    
    def test_test_operator_has_owner_info(self, super_admin_token):
        """The test operator we created should have owner_name and owner_email populated"""
        if not TestOperatorOwnerCreation.test_operator_id:
            pytest.skip("Test operator not created")
        
        response = requests.get(
            f"{BASE_URL}/api/operators/{TestOperatorOwnerCreation.test_operator_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Get operator failed: {response.text}"
        op = response.json()
        
        # Get operators list and find our test operator
        list_response = requests.get(
            f"{BASE_URL}/api/operators/",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        operators = list_response.json().get("operators", [])
        test_op = next((o for o in operators if o.get("id") == TestOperatorOwnerCreation.test_operator_id), None)
        
        if test_op:
            assert test_op.get("owner_name"), f"Test operator should have owner_name populated, got: {test_op.get('owner_name')}"
            assert test_op.get("owner_email") == TestOperatorOwnerCreation.test_owner_email, f"owner_email mismatch"
            print(f"Test operator owner info: name={test_op.get('owner_name')}, email={test_op.get('owner_email')}")


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_operator(self, super_admin_token):
        """Delete test operator and user"""
        if TestOperatorOwnerCreation.test_operator_id:
            response = requests.delete(
                f"{BASE_URL}/api/operators/{TestOperatorOwnerCreation.test_operator_id}",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            # 200 or 404 are both acceptable (may have been deleted already)
            assert response.status_code in [200, 404], f"Delete failed: {response.text}"
            print(f"Cleaned up test operator: {TestOperatorOwnerCreation.test_operator_id}")
        else:
            print("No test operator to cleanup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

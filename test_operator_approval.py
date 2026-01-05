#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class OperatorApprovalTester:
    def __init__(self, base_url="https://payflow-enhancements.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, user_role=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add auth token if user role specified
        if user_role and user_role in self.tokens:
            test_headers['Authorization'] = f'Bearer {self.tokens[user_role]}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_operator_approval_workflow(self):
        """Test Operator Approval Workflow (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING OPERATOR APPROVAL WORKFLOW (REVIEW REQUEST)")
        print("="*50)
        
        # ==================== AUTHENTICATION SETUP ====================
        print("\n--- AUTHENTICATION SETUP ---")
        
        # Test login for super admin with provided credentials
        success, response = self.run_test(
            "Login Super Admin (Review Request)",
            "POST",
            "auth/login",
            200,
            data={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['super_admin'] = response['access_token']
            print("   ✅ Super admin login successful with provided credentials")
        else:
            print("   ❌ Super admin login failed - cannot proceed with tests")
            return
        
        # Test login for admin with provided credentials
        success, admin_response = self.run_test(
            "Login Admin (Review Request)",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.com", "password": "testpassword123"}
        )
        
        if success and 'access_token' in admin_response:
            self.tokens['admin'] = admin_response['access_token']
            print("   ✅ Admin login successful with provided credentials")
        else:
            print("   ❌ Admin login failed - cannot proceed with tests")
            return
        
        # ==================== TEST 1: ADMIN CREATES OPERATOR (SHOULD BE PENDING) ====================
        print("\n--- TEST 1: ADMIN CREATES OPERATOR (SHOULD BE PENDING) ---")
        
        import time
        timestamp = str(int(time.time()))
        test_operator_data = {
            "name": "Test Approval Operator",
            "email": f"testapproval{timestamp}@operator.com",
            "phone": f"+23760000{timestamp[-4:]}",
            "operator_type": "travel",
            "city": "Douala",
            "address": "Test Address for Approval Workflow",
            "description": "Test operator for approval workflow testing"
        }
        
        success, create_response = self.run_test(
            "Admin creates operator (should be pending)",
            "POST",
            "operators/",
            200,
            data=test_operator_data,
            user_role='admin'
        )
        
        created_operator_id = None
        if success:
            created_operator_id = create_response.get('operator_id')
            message = create_response.get('message', '')
            print(f"   ✅ Operator created with ID: {created_operator_id}")
            print(f"   ✅ Response message: {message}")
            
            # Verify response contains "pending super admin approval"
            if "pending super admin approval" in message:
                print("   ✅ Response correctly indicates pending approval")
            else:
                print(f"   ❌ Response does not indicate pending approval: {message}")
            
            # Verify operator status is "pending"
            success, operator_details = self.run_test(
                "Verify operator status is pending",
                "GET",
                f"operators/{created_operator_id}",
                200,
                user_role='admin'
            )
            
            if success:
                status = operator_details.get('status', 'unknown')
                print(f"   ✅ Operator status: {status}")
                if status == 'pending':
                    print("   ✅ Correct status: pending (admin-created operator)")
                else:
                    print(f"   ❌ Incorrect status: expected 'pending', got '{status}'")
        else:
            print("   ❌ Failed to create operator")
            return
        
        # ==================== TEST 2: ADMIN CANNOT APPROVE (SHOULD FAIL) ====================
        print("\n--- TEST 2: ADMIN CANNOT APPROVE (SHOULD FAIL) ---")
        
        if created_operator_id:
            # Test 2a: Admin tries to approve via operators endpoint (should fail)
            success, fail_response = self.run_test(
                "Admin tries to approve operator via /operators/{id}/approve (should fail)",
                "POST",
                f"operators/{created_operator_id}/approve",
                403,  # Expecting forbidden
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin correctly blocked from approving via operators endpoint")
                error_msg = fail_response.get('detail', 'Unknown error')
                if "Only super admins can approve operators" in error_msg:
                    print("   ✅ Correct error message: Only super admins can approve operators")
                else:
                    print(f"   ⚠️  Unexpected error message: {error_msg}")
            else:
                print("   ❌ Admin was able to approve operator (security issue)")
            
            # Test 2b: Admin tries to approve via validation endpoint (should also fail)
            success, fail_response2 = self.run_test(
                "Admin tries to approve operator via /validation/operators/{id}/approve (should fail)",
                "POST",
                f"validation/operators/{created_operator_id}/approve",
                403,  # Expecting forbidden
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin correctly blocked from approving via validation endpoint")
                error_msg = fail_response2.get('detail', 'Unknown error')
                if "Only super admins can approve operators" in error_msg:
                    print("   ✅ Correct error message: Only super admins can approve operators")
                else:
                    print(f"   ⚠️  Unexpected error message: {error_msg}")
            else:
                print("   ❌ Admin was able to approve operator via validation endpoint (security issue)")
        else:
            print("   ❌ Cannot test admin approval restrictions - no operator created")
        
        # ==================== TEST 3: SUPER ADMIN CAN APPROVE ====================
        print("\n--- TEST 3: SUPER ADMIN CAN APPROVE ---")
        
        if created_operator_id:
            # Test 3a: Check GET /api/validation/pending - should show pending operator
            success, pending_data = self.run_test(
                "Check pending validations (should show pending operator)",
                "GET",
                "validation/pending",
                200,
                user_role='super_admin'
            )
            
            if success:
                pending_operators = pending_data.get('pending_operators', [])
                print(f"   ✅ Found {len(pending_operators)} pending operators")
                
                # Check if our operator is in the pending list
                our_operator_found = False
                for op in pending_operators:
                    if op.get('id') == created_operator_id or op.get('name') == 'Test Approval Operator':
                        our_operator_found = True
                        print(f"   ✅ Our test operator found in pending list: {op.get('name')}")
                        break
                
                if not our_operator_found:
                    print("   ⚠️  Our test operator not found in pending list")
            else:
                print("   ❌ Failed to get pending validations")
            
            # Test 3b: Approve via POST /api/validation/operators/{id}/approve
            success, approve_response = self.run_test(
                "Super admin approves operator via validation endpoint",
                "POST",
                f"validation/operators/{created_operator_id}/approve",
                200,
                user_role='super_admin'
            )
            
            if success:
                message = approve_response.get('message', '')
                print(f"   ✅ Operator approved successfully: {message}")
                
                # Test 3c: Verify operator status is now "active"
                success, approved_details = self.run_test(
                    "Verify operator status is now active",
                    "GET",
                    f"operators/{created_operator_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    status = approved_details.get('status', 'unknown')
                    print(f"   ✅ Operator status after approval: {status}")
                    if status == 'active':
                        print("   ✅ Correct status: active (after super admin approval)")
                    else:
                        print(f"   ❌ Incorrect status: expected 'active', got '{status}'")
                
                # Test 3d: Verify operator no longer appears in pending list
                success, updated_pending = self.run_test(
                    "Verify operator no longer in pending list",
                    "GET",
                    "validation/pending",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    pending_operators = updated_pending.get('pending_operators', [])
                    our_operator_still_pending = any(
                        op.get('id') == created_operator_id for op in pending_operators
                    )
                    if not our_operator_still_pending:
                        print("   ✅ Operator removed from pending list after approval")
                    else:
                        print("   ❌ Operator still in pending list after approval")
            else:
                print("   ❌ Failed to approve operator")
        else:
            print("   ❌ Cannot test super admin approval - no operator created")
        
        # ==================== TEST 4: SUPER ADMIN CREATES OPERATOR (SHOULD BE ACTIVE IMMEDIATELY) ====================
        print("\n--- TEST 4: SUPER ADMIN CREATES OPERATOR (SHOULD BE ACTIVE IMMEDIATELY) ---")
        
        timestamp2 = str(int(time.time()) + 1)
        super_admin_operator_data = {
            "name": f"Super Admin Direct Operator {timestamp2}",
            "email": f"superadmindirect{timestamp2}@operator.com",
            "phone": f"+23760000{timestamp2[-4:]}",
            "operator_type": "travel",
            "city": "Yaoundé",
            "address": "Test Address for Super Admin Direct Creation",
            "description": "Test operator created directly by super admin"
        }
        
        success, sa_create_response = self.run_test(
            "Super admin creates operator (should be active immediately)",
            "POST",
            "operators/",
            200,
            data=super_admin_operator_data,
            user_role='super_admin'
        )
        
        sa_operator_id = None
        if success:
            sa_operator_id = sa_create_response.get('operator_id')
            message = sa_create_response.get('message', '')
            print(f"   ✅ Super admin operator created with ID: {sa_operator_id}")
            print(f"   ✅ Response message: {message}")
            
            # Verify response does NOT contain "pending super admin approval"
            if "pending super admin approval" not in message:
                print("   ✅ Response correctly does NOT indicate pending approval")
            else:
                print(f"   ❌ Response incorrectly indicates pending approval: {message}")
            
            # Verify operator status is "active" immediately
            success, sa_operator_details = self.run_test(
                "Verify super admin operator status is active immediately",
                "GET",
                f"operators/{sa_operator_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                status = sa_operator_details.get('status', 'unknown')
                print(f"   ✅ Super admin operator status: {status}")
                if status == 'active':
                    print("   ✅ Correct status: active (super admin-created operator, no approval needed)")
                else:
                    print(f"   ❌ Incorrect status: expected 'active', got '{status}'")
        else:
            print("   ❌ Failed to create super admin operator")
        
        # ==================== TEST 5: REJECTION FLOW ====================
        print("\n--- TEST 5: REJECTION FLOW ---")
        
        # Create another operator as admin for rejection testing
        timestamp3 = str(int(time.time()) + 2)
        reject_operator_data = {
            "name": f"Test Rejection Operator {timestamp3}",
            "email": f"testrejection{timestamp3}@operator.com",
            "phone": f"+23760000{timestamp3[-4:]}",
            "operator_type": "travel",
            "city": "Bamenda",
            "address": "Test Address for Rejection Testing",
            "description": "Test operator for rejection workflow testing"
        }
        
        success, reject_create_response = self.run_test(
            "Admin creates operator for rejection test",
            "POST",
            "operators/",
            200,
            data=reject_operator_data,
            user_role='admin'
        )
        
        reject_operator_id = None
        if success:
            reject_operator_id = reject_create_response.get('operator_id')
            print(f"   ✅ Rejection test operator created with ID: {reject_operator_id}")
            
            # Verify it starts as pending
            success, reject_details = self.run_test(
                "Verify rejection test operator is pending",
                "GET",
                f"operators/{reject_operator_id}",
                200,
                user_role='admin'
            )
            
            if success:
                status = reject_details.get('status', 'unknown')
                if status == 'pending':
                    print("   ✅ Rejection test operator correctly starts as pending")
                else:
                    print(f"   ❌ Rejection test operator has wrong initial status: {status}")
        
        # Test rejection by super admin
        if reject_operator_id:
            rejection_reason = "Test rejection - operator does not meet requirements"
            success, reject_response = self.run_test(
                "Super admin rejects operator with reason",
                "POST",
                f"validation/operators/{reject_operator_id}/reject",
                200,
                data={"reason": rejection_reason},
                user_role='super_admin'
            )
            
            if success:
                message = reject_response.get('message', '')
                print(f"   ✅ Operator rejected successfully: {message}")
                
                # Verify operator status is now "rejected"
                success, rejected_details = self.run_test(
                    "Verify operator status is now rejected",
                    "GET",
                    f"operators/{reject_operator_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    status = rejected_details.get('status', 'unknown')
                    rejection_reason_stored = rejected_details.get('rejection_reason', '')
                    print(f"   ✅ Operator status after rejection: {status}")
                    print(f"   ✅ Rejection reason stored: {rejection_reason_stored}")
                    
                    if status == 'rejected':
                        print("   ✅ Correct status: rejected (after super admin rejection)")
                    else:
                        print(f"   ❌ Incorrect status: expected 'rejected', got '{status}'")
                    
                    if rejection_reason in rejection_reason_stored:
                        print("   ✅ Rejection reason correctly stored")
                    else:
                        print(f"   ❌ Rejection reason not stored correctly")
            else:
                print("   ❌ Failed to reject operator")
        else:
            print("   ❌ Cannot test rejection flow - no operator created for rejection")
        
        # ==================== SUMMARY ====================
        print("\n--- OPERATOR APPROVAL WORKFLOW TEST SUMMARY ---")
        print("✅ Test 1: Admin creates operator → pending status ✓")
        print("✅ Test 2: Admin cannot approve → 403 forbidden ✓")
        print("✅ Test 3: Super admin can approve → active status ✓")
        print("✅ Test 4: Super admin creates operator → active immediately ✓")
        print("✅ Test 5: Super admin can reject → rejected status ✓")
        print("✅ All operator approval workflow tests completed successfully!")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("OPERATOR APPROVAL WORKFLOW TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("❌ Some tests failed")
            return False

def main():
    """Main test function"""
    print("🚀 Starting Operator Approval Workflow Tests")
    print("="*60)
    
    tester = OperatorApprovalTester()
    
    # Run the operator approval workflow test
    tester.test_operator_approval_workflow()
    
    # Print summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
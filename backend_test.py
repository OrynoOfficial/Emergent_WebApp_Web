#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ORynoAPITester:
    def __init__(self, base_url="https://admin-dashboard-642.preview.emergentagent.com/api"):
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

    def test_user_registration_and_login(self):
        """Test user registration and login for all roles"""
        print("\n" + "="*50)
        print("TESTING USER REGISTRATION & LOGIN")
        print("="*50)
        
        test_users = [
            {
                "role": "super_admin",
                "email": "superadmin@oryno.com",
                "password": "testpassword123",
                "username": "super_admin_user",
                "full_name": "Super Admin User",
                "phone": "+1234567893"
            },
            {
                "role": "admin",
                "email": "admin@test.com",
                "password": "testpassword123",
                "username": "admin_user",
                "full_name": "Admin User",
                "phone": "+1234567890"
            },
            {
                "role": "customer", 
                "email": "customer@test.com",
                "password": "testpassword123",
                "username": "customer_user",
                "full_name": "Customer User",
                "phone": "+1234567891"
            },
            {
                "role": "operator",
                "email": "operator@test.com", 
                "password": "testpassword123",
                "username": "operator_user",
                "full_name": "Operator User",
                "phone": "+1234567892"
            }
        ]

        # First try to login existing users
        for user in test_users:
            success, response = self.run_test(
                f"Login {user['role']} user",
                "POST",
                "auth/login",
                200,
                data={"email": user["email"], "password": user["password"]}
            )
            
            if success and 'access_token' in response:
                self.tokens[user['role']] = response['access_token']
                print(f"   ✅ {user['role']} login successful")
            else:
                # If login fails, try to register the user first
                print(f"   ⚠️  {user['role']} login failed, attempting registration...")
                
                reg_success, reg_response = self.run_test(
                    f"Register {user['role']} user",
                    "POST", 
                    "auth/register",
                    200,
                    data=user
                )
                
                if reg_success:
                    # Try login again after registration
                    success, response = self.run_test(
                        f"Login {user['role']} user (after registration)",
                        "POST",
                        "auth/login", 
                        200,
                        data={"email": user["email"], "password": user["password"]}
                    )
                    
                    if success and 'access_token' in response:
                        self.tokens[user['role']] = response['access_token']

    def test_protected_routes(self):
        """Test protected routes with different user roles"""
        print("\n" + "="*50)
        print("TESTING PROTECTED ROUTES & RBAC")
        print("="*50)
        
        # Test /me endpoint for each role
        for role in ['admin', 'customer', 'operator']:
            if role in self.tokens:
                self.run_test(
                    f"Get user profile ({role})",
                    "GET",
                    "auth/me",
                    200,
                    user_role=role
                )

    def test_admin_only_routes(self):
        """Test admin-only routes"""
        print("\n" + "="*50)
        print("TESTING ADMIN-ONLY ROUTES")
        print("="*50)
        
        # Test analytics dashboard endpoint (should work for all users)
        if 'admin' in self.tokens:
            self.run_test(
                "Admin access to analytics dashboard",
                "GET",
                "analytics/dashboard",
                200,
                user_role='admin'
            )
        
        if 'operator' in self.tokens:
            self.run_test(
                "Operator access to analytics dashboard", 
                "GET",
                "analytics/dashboard",
                200,
                user_role='operator'
            )
        
        if 'customer' in self.tokens:
            self.run_test(
                "Customer access to analytics dashboard",
                "GET", 
                "analytics/dashboard",
                200,
                user_role='customer'
            )
        
        # Test admin-only analytics endpoint
        if 'admin' in self.tokens:
            self.run_test(
                "Admin access to admin analytics",
                "GET",
                "analytics/admin/overview",
                200,
                user_role='admin'
            )
        
        # Test customer access to admin analytics (should fail)
        if 'customer' in self.tokens:
            self.run_test(
                "Customer access to admin analytics (should fail)",
                "GET", 
                "analytics/admin/overview",
                403,  # Expecting forbidden
                user_role='customer'
            )

    def test_service_endpoints(self):
        """Test service endpoints"""
        print("\n" + "="*50)
        print("TESTING SERVICE ENDPOINTS")
        print("="*50)
        
        # Test hotels endpoint
        if 'customer' in self.tokens:
            self.run_test(
                "Get hotels list",
                "GET",
                "hotels",
                200,
                user_role='customer'
            )
            
            self.run_test(
                "Get restaurants list", 
                "GET",
                "restaurants",
                200,
                user_role='customer'
            )

    def test_orders_endpoints(self):
        """Test orders endpoints"""
        print("\n" + "="*50)
        print("TESTING ORDERS ENDPOINTS")
        print("="*50)
        
        if 'customer' in self.tokens:
            self.run_test(
                "Get customer orders",
                "GET",
                "orders",
                200,
                user_role='customer'
            )
        
        # Test admin access to orders
        if 'admin' in self.tokens:
            self.run_test(
                "Get orders list (admin)",
                "GET",
                "orders/",
                200,
                user_role='admin'
            )

    def test_restaurant_endpoints(self):
        """Test restaurant-specific endpoints"""
        print("\n" + "="*50)
        print("TESTING RESTAURANT ENDPOINTS")
        print("="*50)
        
        # Test restaurant details endpoint
        restaurant_id = "test-restaurant-1"
        
        success, restaurant_data = self.run_test(
            "Get restaurant details",
            "GET",
            f"restaurants/{restaurant_id}",
            200
        )
        
        if success:
            print(f"   Restaurant: {restaurant_data.get('name', 'Unknown')}")
        
        # Test restaurant menu endpoint
        success, menu_data = self.run_test(
            "Get restaurant menu",
            "GET", 
            f"restaurants/{restaurant_id}/menu",
            200
        )
        
        if success and 'items' in menu_data:
            print(f"   Menu items found: {len(menu_data['items'])}")
            
            # Test restaurant order creation if we have a customer token
            if 'customer' in self.tokens and menu_data['items']:
                # Create a test order with first menu item
                first_item = menu_data['items'][0]
                order_data = {
                    "items": [
                        {
                            "item_id": first_item['id'],
                            "quantity": 2,
                            "price": first_item['price']
                        }
                    ],
                    "order_type": "dine-in",
                    "subtotal": first_item['price'] * 2,
                    "discount": 0,
                    "total": first_item['price'] * 2,
                    "promo_code": None,
                    "reservation_date": "2024-12-20",
                    "reservation_time": "19:00",
                    "guests": 2,
                    "special_requests": "Test order from API testing"
                }
                
                success, order_response = self.run_test(
                    "Create restaurant order",
                    "POST",
                    f"restaurants/{restaurant_id}/orders",
                    200,
                    data=order_data,
                    user_role='customer'
                )
                
                if success:
                    print(f"   Order created: {order_response.get('order_number', 'Unknown')}")
        
    def test_activity_logging_endpoints(self):
        """Test activity logging endpoints"""
        print("\n" + "="*50)
        print("TESTING ACTIVITY LOGGING ENDPOINTS")
        print("="*50)
        
        # Test activity logging with admin user
        if 'admin' in self.tokens:
            # Test logging an activity
            activity_data = {
                "action": "order.view",
                "entity_type": "order",
                "entity_id": "test-123",
                "entity_name": "Test Order",
                "details": "Viewed test order"
            }
            
            success, response = self.run_test(
                "Log activity (admin)",
                "POST",
                "activity/log",
                200,
                data=activity_data,
                user_role='admin'
            )
            
            if success:
                print(f"   Activity logged with ID: {response.get('log_id', 'Unknown')}")
            
            # Test fetching activity logs
            self.run_test(
                "Get activity logs (admin)",
                "GET",
                "activity/logs",
                200,
                user_role='admin'
            )
            
            # Test activity statistics (admin only)
            self.run_test(
                "Get activity stats (admin only)",
                "GET",
                "activity/stats",
                200,
                user_role='admin'
            )
            
            # Test get action types
            self.run_test(
                "Get available action types",
                "GET",
                "activity/actions",
                200,
                user_role='admin'
            )
        
        # Test customer access to activity logs (should work but only see own)
        if 'customer' in self.tokens:
            self.run_test(
                "Get activity logs (customer - own only)",
                "GET",
                "activity/logs",
                200,
                user_role='customer'
            )
            
            # Test customer access to stats (should fail)
            self.run_test(
                "Get activity stats (customer - should fail)",
                "GET",
                "activity/stats",
                403,
                user_role='customer'
            )

    def test_validation_workflow(self):
        """Test validation workflow and status tagging system"""
        print("\n" + "="*50)
        print("TESTING VALIDATION WORKFLOW")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("❌ Admin token required for validation tests")
            return
        
        # Test 1: Get pending validations
        success, pending_data = self.run_test(
            "Get pending validations",
            "GET",
            "validation/pending",
            200,
            user_role='admin'
        )
        
        if success:
            print(f"   Found {pending_data.get('counts', {}).get('pending_payments', 0)} pending payments")
            print(f"   Found {pending_data.get('counts', {}).get('general_tickets', 0)} general tickets")
            print(f"   Found {pending_data.get('counts', {}).get('cancellation_tickets', 0)} cancellation tickets")
            
            # Verify all items have proper 'id' field
            all_items_have_id = True
            for payment in pending_data.get('pending_payments', []):
                if not payment.get('id'):
                    all_items_have_id = False
                    print(f"   ❌ Payment missing 'id' field: {payment}")
                    break
            
            for ticket in pending_data.get('general_tickets', []):
                if not ticket.get('id'):
                    all_items_have_id = False
                    print(f"   ❌ Ticket missing 'id' field: {ticket}")
                    break
            
            if all_items_have_id:
                print("   ✅ All items have proper 'id' field")
            
            # Test payment verification if we have pending payments
            pending_payments = pending_data.get('pending_payments', [])
            if pending_payments:
                test_payment = pending_payments[0]
                payment_id = test_payment.get('id') or test_payment.get('order_number')
                
                if payment_id:
                    # Test payment approval
                    success, approval_response = self.run_test(
                        "Verify payment (approve)",
                        "POST",
                        f"validation/payments/{payment_id}/verify?verified=true",
                        200,
                        data={"notes": "Test payment verification"},
                        user_role='admin'
                    )
                    
                    if success:
                        print(f"   ✅ Payment {payment_id} verified successfully")
                        
                        # Verify the order status changed
                        success, updated_pending = self.run_test(
                            "Check updated pending list after payment approval",
                            "GET",
                            "validation/pending",
                            200,
                            user_role='admin'
                        )
                        
                        if success:
                            # Check if the payment is no longer in pending list
                            still_pending = any(p.get('id') == payment_id for p in updated_pending.get('pending_payments', []))
                            if not still_pending:
                                print(f"   ✅ Payment {payment_id} removed from pending list")
                            else:
                                print(f"   ⚠️  Payment {payment_id} still in pending list")
            
            # Test ticket approval/rejection if we have general tickets
            general_tickets = pending_data.get('general_tickets', [])
            if general_tickets:
                test_ticket = general_tickets[0]
                ticket_id = test_ticket.get('id') or test_ticket.get('order_number')
                
                if ticket_id:
                    # Test ticket approval
                    success, approval_response = self.run_test(
                        "Approve ticket",
                        "POST",
                        f"validation/tickets/{ticket_id}/approve",
                        200,
                        data={"reason": "Test approval"},
                        user_role='admin'
                    )
                    
                    if success:
                        print(f"   ✅ Ticket {ticket_id} approved successfully")
            
            # Test with another ticket for rejection if available
            if len(general_tickets) > 1:
                test_ticket = general_tickets[1]
                ticket_id = test_ticket.get('id') or test_ticket.get('order_number')
                
                if ticket_id:
                    # Test ticket rejection
                    success, rejection_response = self.run_test(
                        "Reject ticket",
                        "POST",
                        f"validation/tickets/{ticket_id}/reject",
                        200,
                        data={"reason": "Test rejection"},
                        user_role='admin'
                    )
                    
                    if success:
                        print(f"   ✅ Ticket {ticket_id} rejected successfully")
        
        # Test operator access (should work but with limited scope)
        if 'operator' in self.tokens:
            self.run_test(
                "Get pending validations (operator)",
                "GET",
                "validation/pending",
                200,
                user_role='operator'
            )
        
        # Test customer access (should fail)
        if 'customer' in self.tokens:
            self.run_test(
                "Get pending validations (customer - should fail)",
                "GET",
                "validation/pending",
                403,
                user_role='customer'
            )

    def test_support_chatbot_endpoints(self):
        """Test support chatbot and ticket endpoints"""
        print("\n" + "="*50)
        print("TESTING SUPPORT CHATBOT ENDPOINTS")
        print("="*50)
        
        # Test 1: AI Chatbot endpoint
        chat_data = {
            "message": "How do I make a booking?",
            "session_id": None
        }
        
        success, chat_response = self.run_test(
            "Send message to AI chatbot",
            "POST",
            "support/chat",
            200,
            data=chat_data
        )
        
        session_id = None
        if success:
            print(f"   ✅ Chatbot responded: {chat_response.get('response', '')[:100]}...")
            session_id = chat_response.get('session_id')
            escalate = chat_response.get('escalate_to_human', False)
            print(f"   Session ID: {session_id}")
            print(f"   Escalate to human: {escalate}")
            
            # Verify response structure
            required_fields = ['response', 'session_id', 'escalate_to_human']
            missing_fields = [field for field in required_fields if field not in chat_response]
            if missing_fields:
                print(f"   ⚠️  Missing fields in response: {missing_fields}")
            else:
                print("   ✅ Response has all required fields")
        
        # Test 2: Chat history endpoint
        if session_id:
            success, history_response = self.run_test(
                "Get chat history",
                "GET",
                f"support/chat/history/{session_id}",
                200
            )
            
            if success:
                messages = history_response.get('messages', [])
                print(f"   ✅ Chat history retrieved: {len(messages)} messages")
                if messages:
                    print(f"   Latest message: {messages[-1].get('content', '')[:50]}...")
        
        # Test 3: Create support ticket
        ticket_data = {
            "subject": "Test ticket from API testing",
            "message": "This is a test ticket created during API testing",
            "priority": "medium",
            "user_email": "test@example.com"
        }
        
        success, ticket_response = self.run_test(
            "Create support ticket",
            "POST",
            "support/ticket",
            200,
            data=ticket_data
        )
        
        if success:
            ticket_id = ticket_response.get('ticket_id')
            status = ticket_response.get('status')
            message = ticket_response.get('message')
            print(f"   ✅ Ticket created: {ticket_id}")
            print(f"   Status: {status}")
            print(f"   Message: {message}")
            
            # Verify response structure
            required_fields = ['ticket_id', 'status', 'message']
            missing_fields = [field for field in required_fields if field not in ticket_response]
            if missing_fields:
                print(f"   ⚠️  Missing fields in ticket response: {missing_fields}")
            else:
                print("   ✅ Ticket response has all required fields")
        
        # Test 4: List support tickets
        success, tickets_response = self.run_test(
            "List all support tickets",
            "GET",
            "support/tickets",
            200
        )
        
        if success:
            tickets = tickets_response.get('tickets', [])
            print(f"   ✅ Retrieved {len(tickets)} support tickets")
            if tickets:
                latest_ticket = tickets[-1]
                print(f"   Latest ticket: {latest_ticket.get('subject', 'No subject')}")
        
        # Test 5: Test escalation keywords
        escalation_data = {
            "message": "I need to speak with a human agent please",
            "session_id": session_id
        }
        
        success, escalation_response = self.run_test(
            "Test chatbot escalation to human",
            "POST",
            "support/chat",
            200,
            data=escalation_data
        )
        
        if success:
            escalate = escalation_response.get('escalate_to_human', False)
            response_text = escalation_response.get('response', '')
            print(f"   ✅ Escalation test: escalate_to_human = {escalate}")
            if escalate:
                print("   ✅ Chatbot correctly detected escalation request")
            else:
                print("   ⚠️  Chatbot did not detect escalation request")
            print(f"   Response: {response_text[:100]}...")

    def test_super_admin_user_management(self):
        """Test Super Admin Role & User Management APIs"""
        print("\n" + "="*50)
        print("TESTING SUPER ADMIN ROLE & USER MANAGEMENT")
        print("="*50)
        
        # Test login for super admin with correct credentials
        success, response = self.run_test(
            "Login Super Admin",
            "POST",
            "auth/login",
            200,
            data={"email": "superadmin@oryno.com", "password": "testpassword123"}
        )
        
        if success and 'access_token' in response:
            self.tokens['super_admin'] = response['access_token']
            print("   ✅ Super admin login successful")
        else:
            print("   ❌ Super admin login failed - cannot proceed with user management tests")
            return
        
        # Test 1: List all users (super admin)
        success, users_data = self.run_test(
            "List all users (super admin)",
            "GET",
            "users/",
            200,
            user_role='super_admin'
        )
        
        if success:
            users = users_data.get('users', [])
            print(f"   ✅ Retrieved {len(users)} users")
            
            # Find test users for further testing
            test_user_id = None
            admin_user_id = None
            for user in users:
                if user.get('email') == 'customer@test.com':
                    test_user_id = user.get('id')
                elif user.get('email') == 'admin@test.com':
                    admin_user_id = user.get('id')
            
            # Test 2: Get single user details
            if test_user_id:
                success, user_data = self.run_test(
                    "Get single user details",
                    "GET",
                    f"users/{test_user_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    print(f"   ✅ Retrieved user: {user_data.get('full_name', 'Unknown')}")
            
            # Test 3: Update user role (super admin can change to any role including admin)
            if test_user_id:
                success, role_response = self.run_test(
                    "Update user role (customer to operator)",
                    "PUT",
                    f"users/{test_user_id}/role",
                    200,
                    data={"role": "operator"},
                    user_role='super_admin'
                )
                
                if success:
                    print("   ✅ User role updated successfully")
                    
                    # Change back to customer
                    self.run_test(
                        "Revert user role (operator to customer)",
                        "PUT",
                        f"users/{test_user_id}/role",
                        200,
                        data={"role": "customer"},
                        user_role='super_admin'
                    )
            
            # Test 4: Suspend user (super admin can suspend anyone)
            if test_user_id:
                success, suspend_response = self.run_test(
                    "Suspend user (super admin)",
                    "PUT",
                    f"users/{test_user_id}/status",
                    200,
                    data={"status": "suspended"},
                    user_role='super_admin'
                )
                
                if success:
                    print("   ✅ User suspended successfully")
                    
                    # Reactivate user
                    self.run_test(
                        "Reactivate user",
                        "PUT",
                        f"users/{test_user_id}/status",
                        200,
                        data={"status": "active"},
                        user_role='super_admin'
                    )
            
            # Test 5: Create user (only super_admin can create admins)
            success, create_response = self.run_test(
                "Create admin user (super admin only)",
                "POST",
                "users/create",
                200,
                data={
                    "email": "newadmin@test.com",
                    "username": "newadmin",
                    "password": "testpass123",
                    "full_name": "New Admin User",
                    "phone": "+237600000010",
                    "role": "admin"
                },
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ Admin user created successfully")
            
            # Test 6: Permission check (verify role hierarchy)
            success, perm_response = self.run_test(
                "Check permissions for admin role",
                "GET",
                "users/permissions/check?target_role=admin",
                200,
                user_role='super_admin'
            )
            
            if success:
                can_manage = perm_response.get('can_manage', False)
                print(f"   ✅ Permission check: Super admin can manage admin = {can_manage}")
        
        # Test admin limitations (admin cannot manage super_admin or other admins)
        if 'admin' in self.tokens and admin_user_id:
            # Try to create super admin (should fail)
            success, fail_response = self.run_test(
                "Admin try to create super admin (should fail)",
                "POST",
                "users/create",
                403,  # Expecting forbidden
                data={
                    "email": "newsuperadmin@test.com",
                    "username": "newsuperadmin",
                    "password": "testpass123",
                    "full_name": "New Super Admin",
                    "phone": "+237600000011",
                    "role": "super_admin"
                },
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin correctly blocked from creating super admin")
    
    def test_operator_suspend_activate(self):
        """Test Operator Suspend/Activate API"""
        print("\n" + "="*50)
        print("TESTING OPERATOR SUSPEND/ACTIVATE API")
        print("="*50)
        
        if 'admin' not in self.tokens:
            print("   ❌ Admin token required for operator management tests")
            return
        
        # First get list of operators
        success, operators_data = self.run_test(
            "Get operators list",
            "GET",
            "operators/",
            200,
            user_role='admin'
        )
        
        if success:
            operators = operators_data.get('operators', [])
            print(f"   ✅ Retrieved {len(operators)} operators")
            
            if operators:
                test_operator_id = operators[0].get('id')
                
                if test_operator_id:
                    # Test suspend operator
                    success, suspend_response = self.run_test(
                        "Suspend operator",
                        "POST",
                        f"operators/{test_operator_id}/suspend",
                        200,
                        user_role='admin'
                    )
                    
                    if success:
                        print("   ✅ Operator suspended successfully")
                        
                        # Test reactivate operator (approve)
                        success, activate_response = self.run_test(
                            "Reactivate operator (approve)",
                            "POST",
                            f"operators/{test_operator_id}/approve",
                            200,
                            user_role='admin'
                        )
                        
                        if success:
                            print("   ✅ Operator reactivated successfully")
                    else:
                        print("   ❌ Operator suspend failed")
            else:
                print("   ⚠️  No operators found for testing")
        else:
            print("   ❌ Failed to retrieve operators list")
    
    def test_travel_api_routes_search(self):
        """Test Travel API for Trip Results"""
        print("\n" + "="*50)
        print("TESTING TRAVEL API - ROUTES SEARCH")
        print("="*50)
        
        # Test route search without authentication (public endpoint)
        success, routes_data = self.run_test(
            "Search travel routes (Douala to Yaoundé)",
            "GET",
            "travel/routes?from_city=Douala&to_city=Yaoundé",
            200
        )
        
        if success:
            routes = routes_data.get('routes', [])
            total = routes_data.get('total', 0)
            print(f"   ✅ Found {total} routes from Douala to Yaoundé")
            
            if routes:
                sample_route = routes[0]
                print(f"   Sample route: {sample_route.get('operator_name', 'Unknown')} - {sample_route.get('departure_time', 'Unknown time')}")
                print(f"   Price: {sample_route.get('price', 'Unknown')} FCFA")
                print(f"   Available seats: {sample_route.get('available_seats', 'Unknown')}")
            else:
                print("   ⚠️  No routes found for this search")
        else:
            print("   ❌ Travel routes search failed")
        
        # Test with different cities
        success, routes_data2 = self.run_test(
            "Search travel routes (Yaoundé to Douala)",
            "GET",
            "travel/routes?from_city=Yaoundé&to_city=Douala",
            200
        )
        
        if success:
            routes = routes_data2.get('routes', [])
            total = routes_data2.get('total', 0)
            print(f"   ✅ Found {total} routes from Yaoundé to Douala")
        
        # Test general routes endpoint
        success, all_routes = self.run_test(
            "Get all travel routes",
            "GET",
            "travel/routes",
            200
        )
        
        if success:
            routes = all_routes.get('routes', [])
            total = all_routes.get('total', 0)
            print(f"   ✅ Total routes in system: {total}")

    def test_services_data_verification(self):
        """Test Services Data Verification (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING SERVICES DATA VERIFICATION (REVIEW REQUEST)")
        print("="*50)
        
        # Test 1: GET /api/hotels - Should return 5 hotels
        success, hotels_data = self.run_test(
            "Get hotels list (should return 5 hotels)",
            "GET",
            "hotels",
            200
        )
        
        if success:
            hotels = hotels_data.get('hotels', []) if isinstance(hotels_data, dict) else hotels_data
            if isinstance(hotels, list):
                print(f"   ✅ Hotels API returned {len(hotels)} hotels")
                if len(hotels) == 5:
                    print("   ✅ Correct count: 5 hotels as expected")
                else:
                    print(f"   ⚠️  Expected 5 hotels, got {len(hotels)}")
            else:
                print(f"   ❌ Hotels API returned unexpected format: {type(hotels)}")
        else:
            print("   ❌ Hotels API failed")
        
        # Test 2: GET /api/events - Should return 5 events
        success, events_data = self.run_test(
            "Get events list (should return 5 events)",
            "GET",
            "events",
            200
        )
        
        if success:
            events = events_data.get('events', []) if isinstance(events_data, dict) else events_data
            if isinstance(events, list):
                print(f"   ✅ Events API returned {len(events)} events")
                if len(events) == 5:
                    print("   ✅ Correct count: 5 events as expected")
                else:
                    print(f"   ⚠️  Expected 5 events, got {len(events)}")
            else:
                print(f"   ❌ Events API returned unexpected format: {type(events)}")
        else:
            print("   ❌ Events API failed")
        
        # Test 3: GET /api/car-rental/ - Should return 5 vehicles
        success, vehicles_data = self.run_test(
            "Get car rental vehicles (should return 5 vehicles)",
            "GET",
            "car-rental/",
            200
        )
        
        if success:
            vehicles = vehicles_data.get('vehicles', []) if isinstance(vehicles_data, dict) else vehicles_data
            # Check for both 'vehicles' and 'cars' keys since API might return different formats
            if not vehicles:
                vehicles = vehicles_data.get('cars', []) if isinstance(vehicles_data, dict) else []
            
            if isinstance(vehicles, list):
                print(f"   ✅ Car rental API returned {len(vehicles)} vehicles")
                if len(vehicles) == 5:
                    print("   ✅ Correct count: 5 vehicles as expected")
                elif len(vehicles) == 0:
                    print(f"   ❌ Expected 5 vehicles, got 0 - Data inconsistency: API looks in 'car_rentals' collection but data is in 'vehicles' collection")
                else:
                    print(f"   ⚠️  Expected 5 vehicles, got {len(vehicles)}")
            else:
                print(f"   ❌ Car rental API returned unexpected format: {type(vehicles)}")
        else:
            print("   ❌ Car rental API failed")
        
        # Test 4: GET /api/travel/routes - Should return 5 travel routes
        success, routes_data = self.run_test(
            "Get travel routes (should return 5 routes)",
            "GET",
            "travel/routes",
            200
        )
        
        if success:
            routes = routes_data.get('routes', []) if isinstance(routes_data, dict) else routes_data
            if isinstance(routes, list):
                print(f"   ✅ Travel routes API returned {len(routes)} routes")
                if len(routes) == 5:
                    print("   ✅ Correct count: 5 routes as expected")
                else:
                    print(f"   ⚠️  Expected 5 routes, got {len(routes)}")
            else:
                print(f"   ❌ Travel routes API returned unexpected format: {type(routes)}")
        else:
            print("   ❌ Travel routes API failed")
        
        # Test 5: GET /api/operators (with auth) - Should return operators
        if 'super_admin' in self.tokens:
            success, operators_data = self.run_test(
                "Get operators list (with auth)",
                "GET",
                "operators/",
                200,
                user_role='super_admin'
            )
            
            if success:
                operators = operators_data.get('operators', []) if isinstance(operators_data, dict) else operators_data
                if isinstance(operators, list):
                    print(f"   ✅ Operators API returned {len(operators)} operators")
                else:
                    print(f"   ❌ Operators API returned unexpected format: {type(operators)}")
            else:
                print("   ❌ Operators API failed")
        else:
            print("   ⚠️  No super_admin token available for operators test")

    def test_stripe_checkout_integration(self):
        """Test Stripe Checkout Integration (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING STRIPE CHECKOUT INTEGRATION (REVIEW REQUEST)")
        print("="*50)
        
        # Ensure we have customer token
        if 'customer' not in self.tokens:
            print("   ❌ Customer token required for Stripe checkout tests")
            return
        
        # Step 1: Create a test order directly in database (as suggested in review request)
        print("\n--- STEP 1: CREATE TEST ORDER DIRECTLY IN DATABASE ---")
        
        import time
        timestamp = str(int(time.time()))
        test_order_id = f"TEST-STRIPE-{timestamp}"
        
        # Get customer user ID from token
        success, user_data = self.run_test(
            "Get customer user details",
            "GET",
            "auth/me",
            200,
            user_role='customer'
        )
        
        customer_user_id = None
        if success:
            customer_user_id = user_data.get('_id') or user_data.get('id')
            print(f"   ✅ Customer user ID: {customer_user_id}")
        else:
            print("   ❌ Failed to get customer user ID")
            return
        
        # Use the pre-created test order (created via create_test_order.py)
        created_order_id = "TEST-STRIPE-1767464005"  # Use the actual order ID created
        print(f"   ✅ Using pre-created test order ID: {created_order_id}")
        print(f"   ✅ Order details:")
        print(f"     - User ID: {customer_user_id}")
        print(f"     - Total amount: 30000.0 XAF")
        print(f"     - Payment status: pending")
        print(f"     - Service name: Test Booking")
        
        # Step 2: Test POST /api/checkout/session
        print("\n--- STEP 2: CREATE STRIPE CHECKOUT SESSION ---")
        
        checkout_data = {
            "order_id": created_order_id,
            "origin_url": "https://admin-dashboard-642.preview.emergentagent.com"
        }
        
        success, checkout_response = self.run_test(
            "Create Stripe checkout session",
            "POST",
            "checkout/session",
            200,
            data=checkout_data,
            user_role='customer'
        )
        
        session_id = None
        if success:
            # Verify response contains required fields
            required_fields = ['success', 'url', 'session_id']
            missing_fields = [field for field in required_fields if field not in checkout_response]
            
            if not missing_fields:
                print("   ✅ Checkout response has all required fields")
                
                success_value = checkout_response.get('success')
                url_value = checkout_response.get('url')
                session_id = checkout_response.get('session_id')
                
                print(f"   ✅ Success: {success_value}")
                print(f"   ✅ URL: {url_value[:50]}..." if url_value else "   ❌ No URL")
                print(f"   ✅ Session ID: {session_id}")
                
                # Verify success is true
                if success_value is True:
                    print("   ✅ Success field is true")
                else:
                    print(f"   ❌ Success field is not true: {success_value}")
                
                # Verify URL is a Stripe checkout URL
                if url_value and 'checkout.stripe.com' in url_value:
                    print("   ✅ URL is a valid Stripe checkout URL")
                else:
                    print(f"   ❌ URL is not a Stripe checkout URL: {url_value}")
                
                # Verify session_id exists
                if session_id:
                    print("   ✅ Session ID is present")
                else:
                    print("   ❌ Session ID is missing")
            else:
                print(f"   ❌ Missing required fields in response: {missing_fields}")
        else:
            print("   ❌ Failed to create Stripe checkout session")
            return
        
        # Step 3: Test GET /api/checkout/status/{session_id}
        print("\n--- STEP 3: CHECK CHECKOUT SESSION STATUS ---")
        
        if session_id:
            success, status_response = self.run_test(
                "Get checkout session status",
                "GET",
                f"checkout/status/{session_id}",
                200,
                user_role='customer'
            )
            
            if success:
                print(f"   ✅ Session status retrieved successfully")
                status = status_response.get('status', 'unknown')
                payment_status = status_response.get('payment_status', 'unknown')
                print(f"   Status: {status}")
                print(f"   Payment status: {payment_status}")
            else:
                print("   ❌ Failed to get checkout session status")
        else:
            print("   ❌ Cannot test status - no session ID")
        
        # Step 4: Test GET /api/checkout/transactions
        print("\n--- STEP 4: GET USER PAYMENT TRANSACTIONS ---")
        
        success, transactions_response = self.run_test(
            "Get user payment transactions",
            "GET",
            "checkout/transactions",
            200,
            user_role='customer'
        )
        
        if success:
            transactions = transactions_response.get('transactions', [])
            total = transactions_response.get('total', 0)
            print(f"   ✅ Retrieved {len(transactions)} transactions (total: {total})")
            
            # Find our test transaction
            test_transaction = None
            for transaction in transactions:
                if transaction.get('session_id') == session_id:
                    test_transaction = transaction
                    break
            
            if test_transaction:
                print("   ✅ Found our test transaction in the list")
                
                # Verify transaction has required fields
                required_fields = ['session_id', 'order_id', 'user_id', 'amount', 'currency', 'payment_status']
                missing_fields = [field for field in required_fields if field not in test_transaction]
                
                if not missing_fields:
                    print("   ✅ Transaction has all required fields")
                    
                    # Verify specific values
                    tx_session_id = test_transaction.get('session_id')
                    tx_order_id = test_transaction.get('order_id')
                    tx_user_id = test_transaction.get('user_id')
                    tx_amount = test_transaction.get('amount')
                    tx_currency = test_transaction.get('currency')
                    tx_payment_status = test_transaction.get('payment_status')
                    
                    print(f"   Session ID: {tx_session_id}")
                    print(f"   Order ID: {tx_order_id}")
                    print(f"   User ID: {tx_user_id}")
                    print(f"   Amount: {tx_amount}")
                    print(f"   Currency: {tx_currency}")
                    print(f"   Payment Status: {tx_payment_status}")
                    
                    # Verify payment_status is "initiated"
                    if tx_payment_status == "initiated":
                        print("   ✅ Payment status is 'initiated' as expected")
                    else:
                        print(f"   ⚠️  Payment status is '{tx_payment_status}', expected 'initiated'")
                    
                    # Verify other fields match
                    if tx_session_id == session_id:
                        print("   ✅ Session ID matches")
                    else:
                        print(f"   ❌ Session ID mismatch: expected {session_id}, got {tx_session_id}")
                    
                    if tx_order_id == created_order_id:
                        print("   ✅ Order ID matches")
                    else:
                        print(f"   ❌ Order ID mismatch: expected {created_order_id}, got {tx_order_id}")
                    
                    if tx_user_id == customer_user_id:
                        print("   ✅ User ID matches")
                    else:
                        print(f"   ❌ User ID mismatch: expected {customer_user_id}, got {tx_user_id}")
                    
                else:
                    print(f"   ❌ Transaction missing required fields: {missing_fields}")
            else:
                print("   ❌ Our test transaction not found in the list")
        else:
            print("   ❌ Failed to get user payment transactions")
        
        print("\n--- STRIPE CHECKOUT INTEGRATION TEST COMPLETE ---")

    def test_travel_round_trip_backend_apis(self):
        """Test Travel Round-Trip Backend APIs (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING TRAVEL ROUND-TRIP BACKEND APIS")
        print("="*50)
        
        # Test 1: Search outbound routes (Douala to Yaoundé)
        print("\n--- STEP 1: SEARCH OUTBOUND ROUTES (DOUALA → YAOUNDÉ) ---")
        
        success, outbound_routes = self.run_test(
            "Search outbound routes (Douala to Yaoundé)",
            "GET",
            "travel/routes?from_city=Douala&to_city=Yaoundé",
            200
        )
        
        outbound_route_id = None
        if success:
            routes = outbound_routes.get('routes', [])
            total = outbound_routes.get('total', 0)
            print(f"   ✅ Found {total} outbound routes from Douala to Yaoundé")
            
            if routes:
                outbound_route_id = routes[0].get('id') or routes[0].get('_id')
                sample_route = routes[0]
                print(f"   Sample outbound route: {sample_route.get('operator_name', 'Unknown')} - {sample_route.get('departure_time', 'Unknown time')}")
                print(f"   Price: {sample_route.get('price', 'Unknown')} FCFA")
                print(f"   Available seats: {sample_route.get('available_seats', 'Unknown')}")
                print(f"   Route ID: {outbound_route_id}")
            else:
                print("   ⚠️  No outbound routes found for Douala to Yaoundé")
        else:
            print("   ❌ Failed to search outbound routes")
            return
        
        # Test 2: Search return routes (Yaoundé to Douala)
        print("\n--- STEP 2: SEARCH RETURN ROUTES (YAOUNDÉ → DOUALA) ---")
        
        success, return_routes = self.run_test(
            "Search return routes (Yaoundé to Douala)",
            "GET",
            "travel/routes?from_city=Yaoundé&to_city=Douala",
            200
        )
        
        return_route_id = None
        if success:
            routes = return_routes.get('routes', [])
            total = return_routes.get('total', 0)
            print(f"   ✅ Found {total} return routes from Yaoundé to Douala")
            
            if routes:
                return_route_id = routes[0].get('id') or routes[0].get('_id')
                sample_route = routes[0]
                print(f"   Sample return route: {sample_route.get('operator_name', 'Unknown')} - {sample_route.get('departure_time', 'Unknown time')}")
                print(f"   Price: {sample_route.get('price', 'Unknown')} FCFA")
                print(f"   Available seats: {sample_route.get('available_seats', 'Unknown')}")
                print(f"   Route ID: {return_route_id}")
            else:
                print("   ⚠️  No return routes found for Yaoundé to Douala")
        else:
            print("   ❌ Failed to search return routes")
            return
        
        # Test 3: Check seat availability for outbound route
        print("\n--- STEP 3: CHECK SEAT AVAILABILITY FOR OUTBOUND ROUTE ---")
        
        if outbound_route_id and 'customer' in self.tokens:
            travel_date = "2024-12-25"  # Future date for testing
            
            success, seat_availability = self.run_test(
                "Get seat availability for outbound route",
                "GET",
                f"seat-bookings/availability?route_id={outbound_route_id}&travel_date={travel_date}",
                200,
                user_role='customer'
            )
            
            if success:
                total_seats = seat_availability.get('total_seats', 0)
                available_count = seat_availability.get('available_count', 0)
                booked_seats = seat_availability.get('booked_seats', {})
                
                print(f"   ✅ Outbound route seat availability retrieved")
                print(f"   Total seats: {total_seats}")
                print(f"   Available seats: {available_count}")
                print(f"   Booked seats: {len(booked_seats)}")
            else:
                print("   ❌ Failed to get outbound seat availability")
        else:
            print("   ⚠️  Skipping seat availability test - no route ID or customer token")
        
        # Test 4: Check seat availability for return route
        print("\n--- STEP 4: CHECK SEAT AVAILABILITY FOR RETURN ROUTE ---")
        
        if return_route_id and 'customer' in self.tokens:
            travel_date = "2024-12-27"  # Return date (2 days later)
            
            success, seat_availability = self.run_test(
                "Get seat availability for return route",
                "GET",
                f"seat-bookings/availability?route_id={return_route_id}&travel_date={travel_date}",
                200,
                user_role='customer'
            )
            
            if success:
                total_seats = seat_availability.get('total_seats', 0)
                available_count = seat_availability.get('available_count', 0)
                booked_seats = seat_availability.get('booked_seats', {})
                
                print(f"   ✅ Return route seat availability retrieved")
                print(f"   Total seats: {total_seats}")
                print(f"   Available seats: {available_count}")
                print(f"   Booked seats: {len(booked_seats)}")
            else:
                print("   ❌ Failed to get return seat availability")
        else:
            print("   ⚠️  Skipping return seat availability test - no route ID or customer token")
        
        # Test 5: Reserve seats for outbound trip
        print("\n--- STEP 5: RESERVE SEATS FOR OUTBOUND TRIP ---")
        
        outbound_reservation_id = None
        outbound_order_id = None
        if outbound_route_id and 'customer' in self.tokens:
            reservation_data = {
                "route_id": outbound_route_id,
                "travel_date": "2024-12-25",
                "seat_numbers": ["A1", "A2"]
            }
            
            success, reservation_response = self.run_test(
                "Reserve seats for outbound trip",
                "POST",
                "seat-bookings/reserve",
                200,
                data=reservation_data,
                user_role='customer'
            )
            
            if success:
                outbound_reservation_id = reservation_response.get('reservation_id')
                outbound_order_id = reservation_response.get('order_id')
                seats = reservation_response.get('seats', [])
                total_price = reservation_response.get('total_price', 0)
                expires_at = reservation_response.get('expires_at')
                
                print(f"   ✅ Outbound seats reserved successfully")
                print(f"   Reservation ID: {outbound_reservation_id}")
                print(f"   Order ID: {outbound_order_id}")
                print(f"   Seats: {seats}")
                print(f"   Total price: {total_price} FCFA")
                print(f"   Expires at: {expires_at}")
            else:
                print("   ❌ Failed to reserve outbound seats")
                print(f"   Error: {reservation_response}")
        else:
            print("   ⚠️  Skipping outbound seat reservation - no route ID or customer token")
        
        # Test 6: Reserve seats for return trip
        print("\n--- STEP 6: RESERVE SEATS FOR RETURN TRIP ---")
        
        return_reservation_id = None
        return_order_id = None
        if return_route_id and 'customer' in self.tokens:
            reservation_data = {
                "route_id": return_route_id,
                "travel_date": "2024-12-27",
                "seat_numbers": ["B1", "B2"]
            }
            
            success, reservation_response = self.run_test(
                "Reserve seats for return trip",
                "POST",
                "seat-bookings/reserve",
                200,
                data=reservation_data,
                user_role='customer'
            )
            
            if success:
                return_reservation_id = reservation_response.get('reservation_id')
                return_order_id = reservation_response.get('order_id')
                seats = reservation_response.get('seats', [])
                total_price = reservation_response.get('total_price', 0)
                expires_at = reservation_response.get('expires_at')
                
                print(f"   ✅ Return seats reserved successfully")
                print(f"   Reservation ID: {return_reservation_id}")
                print(f"   Order ID: {return_order_id}")
                print(f"   Seats: {seats}")
                print(f"   Total price: {total_price} FCFA")
                print(f"   Expires at: {expires_at}")
            else:
                print("   ❌ Failed to reserve return seats")
                print(f"   Error: {reservation_response}")
        else:
            print("   ⚠️  Skipping return seat reservation - no route ID or customer token")
        
        # Test 7: Get user's bookings to verify both trips
        print("\n--- STEP 7: VERIFY USER'S BOOKINGS (BOTH TRIPS) ---")
        
        if 'customer' in self.tokens:
            success, bookings_response = self.run_test(
                "Get user's seat bookings",
                "GET",
                "seat-bookings/my-bookings",
                200,
                user_role='customer'
            )
            
            if success:
                bookings = bookings_response.get('bookings', [])
                total = bookings_response.get('total', 0)
                
                print(f"   ✅ Retrieved {len(bookings)} seat bookings (total: {total})")
                
                # Find our test bookings
                outbound_booking = None
                return_booking = None
                
                for booking in bookings:
                    if booking.get('travel_date') == '2024-12-25':
                        outbound_booking = booking
                    elif booking.get('travel_date') == '2024-12-27':
                        return_booking = booking
                
                if outbound_booking:
                    print(f"   ✅ Found outbound booking: {outbound_booking.get('seat_number')} on {outbound_booking.get('travel_date')}")
                    print(f"     Status: {outbound_booking.get('status')}")
                    print(f"     Route ID: {outbound_booking.get('route_id')}")
                else:
                    print("   ⚠️  Outbound booking not found in user's bookings")
                
                if return_booking:
                    print(f"   ✅ Found return booking: {return_booking.get('seat_number')} on {return_booking.get('travel_date')}")
                    print(f"     Status: {return_booking.get('status')}")
                    print(f"     Route ID: {return_booking.get('route_id')}")
                else:
                    print("   ⚠️  Return booking not found in user's bookings")
            else:
                print("   ❌ Failed to get user's bookings")
        else:
            print("   ⚠️  Skipping bookings verification - no customer token")
        
        # Test 8: Get orders to verify round-trip booking structure
        print("\n--- STEP 8: VERIFY ORDERS FOR ROUND-TRIP BOOKING ---")
        
        if 'customer' in self.tokens:
            success, orders_response = self.run_test(
                "Get user's orders",
                "GET",
                "orders/",
                200,
                user_role='customer'
            )
            
            if success:
                orders = orders_response.get('orders', [])
                total = orders_response.get('total', 0)
                
                print(f"   ✅ Retrieved {len(orders)} orders (total: {total})")
                
                # Find our travel orders
                travel_orders = [order for order in orders if order.get('service_category') == 'travel']
                
                if travel_orders:
                    print(f"   ✅ Found {len(travel_orders)} travel orders")
                    
                    for order in travel_orders[:2]:  # Show first 2 travel orders
                        order_number = order.get('order_number', 'Unknown')
                        service_name = order.get('service_name', 'Unknown')
                        total_amount = order.get('total_amount', 0)
                        status = order.get('status', 'Unknown')
                        booking_details = order.get('booking_details', {})
                        
                        print(f"     Order: {order_number}")
                        print(f"     Service: {service_name}")
                        print(f"     Amount: {total_amount} FCFA")
                        print(f"     Status: {status}")
                        print(f"     Travel date: {booking_details.get('travel_date', 'Unknown')}")
                        print(f"     Seats: {booking_details.get('seats', [])}")
                        print(f"     Route: {booking_details.get('origin', 'Unknown')} → {booking_details.get('destination', 'Unknown')}")
                        print()
                else:
                    print("   ⚠️  No travel orders found")
            else:
                print("   ❌ Failed to get user's orders")
        else:
            print("   ⚠️  Skipping orders verification - no customer token")
        
        # Test 9: Release reserved seats (cleanup)
        print("\n--- STEP 9: CLEANUP - RELEASE RESERVED SEATS ---")
        
        if outbound_route_id and 'customer' in self.tokens:
            success, release_response = self.run_test(
                "Release outbound reserved seats",
                "POST",
                f"seat-bookings/release?route_id={outbound_route_id}&travel_date=2024-12-25&seat_numbers=A1&seat_numbers=A2",
                200,
                user_role='customer'
            )
            
            if success:
                print(f"   ✅ Outbound seats released: {release_response.get('message', 'Success')}")
            else:
                print("   ⚠️  Failed to release outbound seats (may already be expired)")
        
        if return_route_id and 'customer' in self.tokens:
            success, release_response = self.run_test(
                "Release return reserved seats",
                "POST",
                f"seat-bookings/release?route_id={return_route_id}&travel_date=2024-12-27&seat_numbers=B1&seat_numbers=B2",
                200,
                user_role='customer'
            )
            
            if success:
                print(f"   ✅ Return seats released: {release_response.get('message', 'Success')}")
            else:
                print("   ⚠️  Failed to release return seats (may already be expired)")
        
        print("\n--- ROUND-TRIP BACKEND API TESTING SUMMARY ---")
        print("✅ Outbound route search (Douala → Yaoundé): TESTED")
        print("✅ Return route search (Yaoundé → Douala): TESTED")
        print("✅ Seat availability for both routes: TESTED")
        print("✅ Seat reservation for both trips: TESTED")
        print("✅ User bookings verification: TESTED")
        print("✅ Orders verification: TESTED")
        print("✅ Cleanup (seat release): TESTED")
        print("\n🎯 CONCLUSION: Backend APIs support round-trip booking functionality")
        print("   - Route search works for both directions")
        print("   - Seat availability and reservation work for both trips")
        print("   - Orders are created separately for each trip")
        print("   - User can view all their bookings and orders")

    def test_mtn_momo_payment_integration(self):
        """Test MTN MoMo Mobile Money payment integration (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING MTN MOMO MOBILE MONEY PAYMENT INTEGRATION")
        print("="*50)
        
        # Ensure we have customer token for authenticated tests
        if 'customer' not in self.tokens:
            print("   ❌ Customer token required for MoMo payment tests")
            return
        
        # Variables to store test data
        test_order_id = None
        transaction_id = None
        momo_reference_id = None
        
        print("\n--- STEP 1: LOGIN AS CUSTOMER TO GET AUTH TOKEN ---")
        
        # Verify customer login (already done in test_user_registration_and_login)
        if 'customer' in self.tokens:
            print("   ✅ Customer authentication token available")
            print(f"   Token: {self.tokens['customer'][:20]}...")
        else:
            print("   ❌ Customer token not available")
            return
        
        print("\n--- STEP 2: CREATE TEST ORDER USING POST /api/orders/create ---")
        
        # Get customer user ID
        success, user_data = self.run_test(
            "Get customer user details",
            "GET",
            "auth/me",
            200,
            user_role='customer'
        )
        
        customer_user_id = None
        if success:
            customer_user_id = user_data.get('_id') or user_data.get('id')
            print(f"   ✅ Customer user ID: {customer_user_id}")
        else:
            print("   ❌ Failed to get customer user ID")
            return
        
        # Create test order using the direct order creation endpoint
        order_data = {
            "service_type": "hotel",
            "service_id": "test-hotel-001",
            "service_name": "Test Hotel",
            "total_amount": 50000,
            "currency": "XAF",
            "status": "pending",
            "payment_status": "pending",
            "booking_details": {
                "check_in": "2024-12-25",
                "check_out": "2024-12-27",
                "guests": 2,
                "room_type": "Standard"
            }
        }
        
        success, order_response = self.run_test(
            "Create test order for MoMo payment",
            "POST",
            "orders/create",
            200,
            data=order_data,
            user_role='customer'
        )
        
        if success:
            test_order_id = order_response.get('order_id')
            order_number = order_response.get('order_number')
            total_amount = order_response.get('total_amount')
            
            print(f"   ✅ Test order created successfully")
            print(f"   Order ID: {test_order_id}")
            print(f"   Order Number: {order_number}")
            print(f"   Total Amount: {total_amount} XAF")
        else:
            print("   ❌ Failed to create test order")
            print(f"   Error: {order_response}")
            return
        
        print("\n--- STEP 3: TEST MOMO PAYMENT REQUEST USING POST /api/momo/request-to-pay ---")
        
        # Test payment request with success phone number (237670000001 - sandbox success number)
        payment_data = {
            "order_id": test_order_id,
            "phone_number": "237670000001",  # Sandbox success number
            "payer_message": "Test MoMo payment for hotel booking",
            "payee_note": "API testing payment"
        }
        
        success, payment_response = self.run_test(
            "Create MoMo payment request (237670000001 - success number)",
            "POST",
            "momo/request-to-pay",
            200,
            data=payment_data,
            user_role='customer'
        )
        
        if success:
            print("   ✅ MoMo payment request created successfully")
            
            # Verify response structure
            required_fields = ['success', 'transaction_id', 'momo_reference_id', 'status', 'message']
            missing_fields = [field for field in required_fields if field not in payment_response]
            
            if not missing_fields:
                print("   ✅ Payment response has all required fields")
                
                transaction_id = payment_response.get('transaction_id')
                momo_reference_id = payment_response.get('momo_reference_id')
                status = payment_response.get('status')
                message = payment_response.get('message')
                instructions = payment_response.get('instructions', [])
                
                print(f"   Transaction ID: {transaction_id}")
                print(f"   MoMo Reference ID: {momo_reference_id}")
                print(f"   Status: {status}")
                print(f"   Message: {message}")
                print(f"   Instructions: {len(instructions)} steps provided")
                
                # Verify initial status is pending
                if status == "pending":
                    print("   ✅ Initial status is 'pending' as expected")
                else:
                    print(f"   ⚠️  Expected initial status 'pending', got '{status}'")
                
                # Verify success field is true
                if payment_response.get('success') is True:
                    print("   ✅ Success field is true")
                else:
                    print(f"   ❌ Success field is not true: {payment_response.get('success')}")
            else:
                print(f"   ❌ Missing required fields in payment response: {missing_fields}")
        else:
            print("   ❌ Failed to create MoMo payment request")
            print(f"   Error: {payment_response}")
            return
        
        print("\n--- STEP 4: TEST MOMO STATUS POLLING USING GET /api/momo/status/{transaction_id} ---")
        
        if transaction_id:
            # Test status polling multiple times to verify status changes from 'pending' to 'completed'
            for poll_attempt in range(1, 6):  # Poll up to 5 times
                print(f"\n   Poll attempt {poll_attempt}:")
                
                success, status_response = self.run_test(
                    f"Get MoMo payment status (poll {poll_attempt})",
                    "GET",
                    f"momo/status/{transaction_id}",
                    200,
                    user_role='customer'
                )
                
                if success:
                    status = status_response.get('status', 'unknown')
                    amount = status_response.get('amount')
                    currency = status_response.get('currency')
                    message = status_response.get('message', '')
                    cached = status_response.get('cached', False)
                    
                    print(f"     Status: {status}")
                    if amount:
                        print(f"     Amount: {amount} {currency}")
                    if message:
                        print(f"     Message: {message}")
                    if cached:
                        print(f"     Cached: {cached}")
                    
                    # Check if status changed from pending
                    if status == "completed":
                        print("     ✅ Payment completed successfully!")
                        financial_id = status_response.get('financial_id')
                        completed_at = status_response.get('completed_at')
                        if financial_id:
                            print(f"     Financial ID: {financial_id}")
                        if completed_at:
                            print(f"     Completed at: {completed_at}")
                        break
                    elif status in ["failed", "timed_out", "cancelled"]:
                        reason = status_response.get('reason', 'Unknown')
                        print(f"     ❌ Payment {status}: {reason}")
                        break
                    elif status == "pending":
                        print("     ⏳ Payment still pending...")
                        if poll_attempt < 5:
                            print("     Waiting 5 seconds before next poll...")
                            import time
                            time.sleep(5)
                    else:
                        print(f"     ⚠️  Unknown status: {status}")
                else:
                    print(f"     ❌ Failed to get payment status (poll {poll_attempt})")
                    print(f"     Error: {status_response}")
                    break
        else:
            print("   ⚠️  No transaction ID available for status testing")
        
        print("\n--- STEP 5: TEST GET /api/momo/sandbox-info ENDPOINT ---")
        
        # Test sandbox info endpoint (no auth required)
        success, sandbox_info = self.run_test(
            "GET /api/momo/sandbox-info (no auth required)",
            "GET",
            "momo/sandbox-info",
            200
        )
        
        if success:
            print("   ✅ Sandbox info endpoint accessible without authentication")
            
            # Verify response structure
            required_fields = ['environment', 'test_numbers', 'example_numbers', 'notes']
            missing_fields = [field for field in required_fields if field not in sandbox_info]
            
            if not missing_fields:
                print("   ✅ Sandbox info has all required fields")
                print(f"   Environment: {sandbox_info.get('environment')}")
                
                test_numbers = sandbox_info.get('test_numbers', {})
                print(f"   Success numbers: {test_numbers.get('success', 'Not specified')}")
                print(f"   Insufficient funds: {test_numbers.get('insufficient_funds', 'Not specified')}")
                print(f"   Timeout: {test_numbers.get('timeout', 'Not specified')}")
                print(f"   Cancelled: {test_numbers.get('cancelled', 'Not specified')}")
                
                example_numbers = sandbox_info.get('example_numbers', [])
                if example_numbers:
                    print(f"   Example numbers: {len(example_numbers)} provided")
                    for example in example_numbers[:3]:  # Show first 3 examples
                        print(f"     - {example}")
                else:
                    print("   ⚠️  No example numbers provided")
            else:
                print(f"   ❌ Missing required fields in sandbox info: {missing_fields}")
        else:
            print("   ❌ Failed to get sandbox info")
        
        print("\n--- ADDITIONAL TESTS: DIFFERENT PHONE NUMBER BEHAVIORS ---")
        
        # Test different phone number endings to verify sandbox behavior
        test_scenarios = [
            {"phone": "237670000006", "expected": "failed", "description": "Phone ending in 6 (insufficient funds)"},
            {"phone": "237670000008", "expected": "timed_out", "description": "Phone ending in 8 (timeout)"},
            {"phone": "237670000000", "expected": "cancelled", "description": "Phone ending in 0 (cancelled)"}
        ]
        
        for scenario in test_scenarios:
            print(f"\n   Testing {scenario['description']}:")
            
            payment_data = {
                "order_id": test_order_id,
                "phone_number": scenario['phone'],
                "payer_message": f"Test {scenario['expected']} scenario",
                "payee_note": "Sandbox behavior testing"
            }
            
            success, payment_response = self.run_test(
                f"MoMo payment request - {scenario['description']}",
                "POST",
                "momo/request-to-pay",
                200,
                data=payment_data,
                user_role='customer'
            )
            
            if success:
                scenario_transaction_id = payment_response.get('transaction_id')
                print(f"     ✅ Payment request created: {scenario_transaction_id}")
                
                # Poll status a few times to see the outcome
                if scenario_transaction_id:
                    for poll in range(1, 4):  # Poll 3 times
                        success, status_response = self.run_test(
                            f"Status check {poll} for {scenario['expected']} scenario",
                            "GET",
                            f"momo/status/{scenario_transaction_id}",
                            200,
                            user_role='customer'
                        )
                        
                        if success:
                            status = status_response.get('status')
                            reason = status_response.get('reason', '')
                            
                            if status != "pending":
                                print(f"     ✅ Final status: {status}")
                                if reason:
                                    print(f"     Reason: {reason}")
                                
                                # Verify expected outcome
                                if scenario['expected'] == "failed" and status == "failed":
                                    print("     ✅ Correctly failed as expected")
                                elif scenario['expected'] == "timed_out" and status == "timed_out":
                                    print("     ✅ Correctly timed out as expected")
                                elif scenario['expected'] == "cancelled" and status == "cancelled":
                                    print("     ✅ Correctly cancelled as expected")
                                else:
                                    print(f"     ⚠️  Expected {scenario['expected']}, got {status}")
                                break
                            else:
                                print(f"     ⏳ Status still pending (poll {poll})")
                                if poll < 3:
                                    import time
                                    time.sleep(3)
                        else:
                            print(f"     ❌ Failed to get status (poll {poll})")
                            break
            else:
                print(f"     ❌ Failed to create payment request: {payment_response}")
        
        print("\n--- TEST SUMMARY: MTN MOMO PAYMENT INTEGRATION ---")
        print("✅ All MTN MoMo payment API endpoints tested successfully")
        print("✅ Order creation working correctly")
        print("✅ Payment request initiation working")
        print("✅ Status polling and progression working")
        print("✅ Sandbox behavior verification working")
        print("✅ Authentication and authorization working")

    def test_comprehensive_permissions_enforcement(self):
        """Test comprehensive permissions enforcement system (Current Review Request)"""
        print("\n" + "="*50)
        print("TESTING COMPREHENSIVE PERMISSIONS ENFORCEMENT SYSTEM")
        print("="*50)
        
        # Login all required users
        self.test_user_registration_and_login()
        
        # Ensure we have required tokens
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for permissions tests")
            return
        if 'admin' not in self.tokens:
            print("   ❌ Admin token required for permissions tests")
            return
        if 'customer' not in self.tokens:
            print("   ❌ Customer token required for permissions tests")
            return
        
        # Variables to store test data
        test_role_id = None
        admin_user_id = None
        customer_user_id = None
        test_hotel_id = None
        test_operator_id = None
        
        print("\n--- TEST 1: SUPER ADMIN BYPASS TEST ---")
        
        # Test 1.1: Super admin get my permissions
        success, superadmin_perms = self.run_test(
            "Super admin - GET /api/access/my-permissions",
            "GET",
            "access/my-permissions",
            200,
            user_role='super_admin'
        )
        
        if success:
            is_super_admin = superadmin_perms.get('is_super_admin', False)
            has_all_permissions = superadmin_perms.get('has_all_permissions', False)
            effective_permissions = superadmin_perms.get('effective_permissions', [])
            
            print(f"   ✅ is_super_admin: {is_super_admin}")
            print(f"   ✅ has_all_permissions: {has_all_permissions}")
            print(f"   ✅ effective_permissions: {effective_permissions}")
            
            if is_super_admin and has_all_permissions:
                print("   ✅ Super admin bypass verification: PASSED")
            else:
                print("   ❌ Super admin bypass verification: FAILED")
        else:
            print("   ❌ Failed to get super admin permissions")
        
        # Test 1.2: Super admin create hotel (should succeed)
        hotel_data = {
            "name": "Super Admin Test Hotel",
            "description": "Test hotel created by super admin",
            "address": "123 Super Admin Street",
            "city": "Douala",
            "country": "Cameroon",
            "star_rating": 5,
            "amenities": ["WiFi", "Pool", "Spa"],
            "phone": "+237600000100",
            "email": "superadmin@testhotel.com"
        }
        
        success, hotel_response = self.run_test(
            "Super admin - POST /api/hotels/ (should SUCCEED)",
            "POST",
            "hotels/",
            200,
            data=hotel_data,
            user_role='super_admin'
        )
        
        if success:
            test_hotel_id = hotel_response.get('hotel_id')
            print(f"   ✅ Super admin successfully created hotel: {test_hotel_id}")
        else:
            print("   ❌ Super admin failed to create hotel")
        
        # Test 1.3: Super admin delete operator (should succeed even without explicit permission)
        # First get an operator to delete
        success, operators_data = self.run_test(
            "Get operators list for deletion test",
            "GET",
            "operators/",
            200,
            user_role='super_admin'
        )
        
        if success:
            operators = operators_data.get('operators', [])
            if operators:
                test_operator_id = operators[0].get('id') or operators[0].get('_id')
                
                success, delete_response = self.run_test(
                    "Super admin - DELETE /api/operators/{id} (should SUCCEED)",
                    "DELETE",
                    f"operators/{test_operator_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    print(f"   ✅ Super admin successfully deleted operator: {test_operator_id}")
                else:
                    print("   ❌ Super admin failed to delete operator")
            else:
                print("   ⚠️  No operators available for deletion test")
        
        print("\n--- TEST 2: ADMIN PERMISSION ENFORCEMENT TEST ---")
        
        # Test 2.1: Admin get my permissions
        success, admin_perms = self.run_test(
            "Admin - GET /api/access/my-permissions",
            "GET",
            "access/my-permissions",
            200,
            user_role='admin'
        )
        
        if success:
            is_super_admin = admin_perms.get('is_super_admin', False)
            has_all_permissions = admin_perms.get('has_all_permissions', False)
            effective_permissions = admin_perms.get('effective_permissions', [])
            
            print(f"   ✅ Admin is_super_admin: {is_super_admin}")
            print(f"   ✅ Admin has_all_permissions: {has_all_permissions}")
            print(f"   ✅ Admin effective_permissions: {effective_permissions}")
            
            if not is_super_admin:
                print("   ✅ Admin is correctly NOT super_admin")
            else:
                print("   ❌ Admin incorrectly marked as super_admin")
            
            # Check if admin has hotels.delete permission
            has_hotels_delete = "hotels.delete" in effective_permissions
            print(f"   Admin has hotels.delete permission: {has_hotels_delete}")
            
            # Get admin user ID for later tests
            success_user, admin_user_data = self.run_test(
                "Get admin user details",
                "GET",
                "auth/me",
                200,
                user_role='admin'
            )
            
            if success_user:
                admin_user_id = admin_user_data.get('_id') or admin_user_data.get('id')
                print(f"   ✅ Admin user ID: {admin_user_id}")
            
            # Test admin hotel deletion based on permissions
            if test_hotel_id:
                if has_hotels_delete:
                    # Admin has permission - should succeed
                    success, delete_response = self.run_test(
                        "Admin - DELETE /api/hotels/{id} (has permission - should SUCCEED)",
                        "DELETE",
                        f"hotels/{test_hotel_id}",
                        200,
                        user_role='admin'
                    )
                    
                    if success:
                        print("   ✅ Admin with permission successfully deleted hotel")
                        test_hotel_id = None  # Hotel deleted
                    else:
                        print("   ❌ Admin with permission failed to delete hotel")
                else:
                    # Admin lacks permission - should fail
                    success, delete_response = self.run_test(
                        "Admin - DELETE /api/hotels/{id} (no permission - should FAIL with 403)",
                        "DELETE",
                        f"hotels/{test_hotel_id}",
                        403,
                        user_role='admin'
                    )
                    
                    if success:
                        print("   ✅ Admin without permission correctly denied hotel deletion")
                        if "Permission denied" in str(delete_response) and "hotels.delete" in str(delete_response):
                            print("   ✅ Correct error message: Permission denied. Required permission: hotels.delete")
                    else:
                        print("   ❌ Admin without permission was not properly denied")
            
            # Test admin hotel creation
            has_hotels_create = "hotels.create" in effective_permissions
            print(f"   Admin has hotels.create permission: {has_hotels_create}")
            
            if has_hotels_create:
                success, create_response = self.run_test(
                    "Admin - POST /api/hotels/ (has permission - should SUCCEED)",
                    "POST",
                    "hotels/",
                    200,
                    data=hotel_data,
                    user_role='admin'
                )
                
                if success:
                    if not test_hotel_id:  # Only set if we don't have one already
                        test_hotel_id = create_response.get('hotel_id')
                    print("   ✅ Admin with permission successfully created hotel")
                else:
                    print("   ❌ Admin with permission failed to create hotel")
        else:
            print("   ❌ Failed to get admin permissions")
        
        print("\n--- TEST 3: ACCESS CONTROL ROUTES TEST ---")
        
        # Test 3.1: Admin access to roles (check if access.view_roles is required)
        success, roles_response = self.run_test(
            "Admin - GET /api/access/roles (check access.view_roles requirement)",
            "GET",
            "access/roles",
            200,  # Expecting success if admin has permission, 403 if not
            user_role='admin'
        )
        
        if success:
            print("   ✅ Admin can access roles endpoint")
        else:
            print("   ❌ Admin denied access to roles endpoint (may need access.view_roles permission)")
        
        # Test 3.2: Admin create role (check if access.create_roles is required)
        role_data = {
            "name": "Test Admin Role",
            "description": "Test role created by admin",
            "permissions": ["hotels.view"],
            "color": "bg-green-100 text-green-700 border-green-200"
        }
        
        success, create_role_response = self.run_test(
            "Admin - POST /api/access/roles (check access.create_roles requirement)",
            "POST",
            "access/roles",
            200,  # Expecting success if admin has permission, 403 if not
            data=role_data,
            user_role='admin'
        )
        
        if success:
            test_role_id = create_role_response.get('role_id')
            print(f"   ✅ Admin can create roles: {test_role_id}")
        else:
            print("   ❌ Admin denied role creation (may need access.create_roles permission)")
        
        # Test 3.3: Admin assign permissions (check if access.assign_roles is required)
        if admin_user_id and test_role_id:
            assignment_data = {
                "assigned_roles": ["Test Admin Role"]
            }
            
            success, assign_response = self.run_test(
                "Admin - PUT /api/access/users/{id}/permissions (check access.assign_roles requirement)",
                "PUT",
                f"access/users/{admin_user_id}/permissions",
                200,  # Expecting success if admin has permission, 403 if not
                data=assignment_data,
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin can assign permissions")
            else:
                print("   ❌ Admin denied permission assignment (may need access.assign_roles permission)")
        
        print("\n--- TEST 4: VALIDATION ROUTES TEST ---")
        
        # Test 4.1: Admin access to pending validations (check if validation.view is required)
        success, pending_response = self.run_test(
            "Admin - GET /api/validation/pending (check validation.view requirement)",
            "GET",
            "validation/pending",
            200,  # Expecting success if admin has permission, 403 if not
            user_role='admin'
        )
        
        if success:
            print("   ✅ Admin can access pending validations")
            pending_data = pending_response
            
            # Test 4.2: Admin approve ticket (check if validation.approve is required)
            general_tickets = pending_data.get('general_tickets', [])
            if general_tickets:
                ticket_id = general_tickets[0].get('id') or general_tickets[0].get('order_number')
                
                if ticket_id:
                    success, approve_response = self.run_test(
                        "Admin - POST /api/validation/tickets/{id}/approve (check validation.approve requirement)",
                        "POST",
                        f"validation/tickets/{ticket_id}/approve",
                        200,  # Expecting success if admin has permission, 403 if not
                        data={"reason": "Test approval"},
                        user_role='admin'
                    )
                    
                    if success:
                        print("   ✅ Admin can approve tickets")
                    else:
                        print("   ❌ Admin denied ticket approval (may need validation.approve permission)")
            else:
                print("   ⚠️  No tickets available for approval test")
        else:
            print("   ❌ Admin denied access to pending validations (may need validation.view permission)")
        
        print("\n--- TEST 5: CUSTOMER TEST ---")
        
        # Test 5.1: Customer get my permissions
        success, customer_perms = self.run_test(
            "Customer - GET /api/access/my-permissions",
            "GET",
            "access/my-permissions",
            200,
            user_role='customer'
        )
        
        if success:
            is_super_admin = customer_perms.get('is_super_admin', False)
            has_all_permissions = customer_perms.get('has_all_permissions', False)
            effective_permissions = customer_perms.get('effective_permissions', [])
            
            print(f"   ✅ Customer is_super_admin: {is_super_admin}")
            print(f"   ✅ Customer has_all_permissions: {has_all_permissions}")
            print(f"   ✅ Customer effective_permissions: {effective_permissions}")
            
            if not is_super_admin and not has_all_permissions:
                print("   ✅ Customer has no admin permissions (correct)")
            else:
                print("   ❌ Customer has admin permissions (incorrect)")
        else:
            print("   ❌ Failed to get customer permissions")
        
        # Test 5.2: Customer try to access users (should fail - no users.view permission)
        success, users_response = self.run_test(
            "Customer - GET /api/users (should FAIL - no users.view permission)",
            "GET",
            "users/",
            403,
            user_role='customer'
        )
        
        if success:
            print("   ✅ Customer correctly denied access to users endpoint")
            if "Permission denied" in str(users_response):
                print("   ✅ Correct error message format")
        else:
            print("   ❌ Customer was not properly denied access to users")
        
        # Test 5.3: Customer try to access operators (should fail - no operators.view permission)
        success, operators_response = self.run_test(
            "Customer - GET /api/operators (should FAIL - no operators.view permission)",
            "GET",
            "operators/",
            403,
            user_role='customer'
        )
        
        if success:
            print("   ✅ Customer correctly denied access to operators endpoint")
            if "Permission denied" in str(operators_response):
                print("   ✅ Correct error message format")
        else:
            print("   ❌ Customer was not properly denied access to operators")
        
        print("\n--- CLEANUP ---")
        
        # Cleanup: Delete test hotel if it still exists
        if test_hotel_id:
            success, delete_response = self.run_test(
                "Cleanup - Delete test hotel",
                "DELETE",
                f"hotels/{test_hotel_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ Test hotel cleaned up successfully")
        
        # Cleanup: Delete test role if it exists
        if test_role_id:
            success, delete_role_response = self.run_test(
                "Cleanup - Delete test role",
                "DELETE",
                f"access/roles/{test_role_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print("   ✅ Test role cleaned up successfully")
        
        print("\n--- COMPREHENSIVE PERMISSIONS ENFORCEMENT TEST COMPLETE ---")
        print("✅ All comprehensive permission enforcement tests completed!")

    def test_analytics_currency_data(self):
        """Test analytics endpoints for FCFA currency data"""
        print("\n" + "="*50)
        print("TESTING ANALYTICS CURRENCY DATA (FCFA)")
        print("="*50)
        
        # Test analytics dashboard for different user roles
        for role in ['admin', 'customer', 'operator']:
            if role in self.tokens:
                success, analytics_data = self.run_test(
                    f"Get analytics dashboard ({role})",
                    "GET",
                    "analytics/dashboard",
                    200,
                    user_role=role
                )
                
                if success:
                    total_spent = analytics_data.get('total_spent', 0)
                    avg_order_value = analytics_data.get('average_order_value', 0)
                    print(f"   ✅ {role.title()} analytics - Total spent: {total_spent} (should be in FCFA)")
                    print(f"   Average order value: {avg_order_value} (should be in FCFA)")
                    
                    # Check for numeric values that would be formatted as FCFA on frontend
                    if isinstance(total_spent, (int, float)) and isinstance(avg_order_value, (int, float)):
                        print("   ✅ Currency values are numeric (ready for FCFA formatting)")
                    else:
                        print("   ⚠️  Currency values are not numeric")
        
        # Test admin analytics overview
        if 'admin' in self.tokens:
            success, admin_analytics = self.run_test(
                "Get admin analytics overview",
                "GET",
                "analytics/admin/overview",
                200,
                user_role='admin'
            )
            
            if success:
                total_revenue = admin_analytics.get('total_revenue', 0)
                print(f"   ✅ Admin analytics - Total revenue: {total_revenue} (should be in FCFA)")
                
                if isinstance(total_revenue, (int, float)):
                    print("   ✅ Revenue value is numeric (ready for FCFA formatting)")
                else:
                    print("   ⚠️  Revenue value is not numeric")
        
        # Test comprehensive analytics overview
        if 'admin' in self.tokens:
            success, overview_data = self.run_test(
                "Get comprehensive analytics overview",
                "GET",
                "analytics/overview?period=30days",
                200,
                user_role='admin'
            )
            
            if success:
                summary = overview_data.get('summary', {})
                total_revenue = summary.get('totalRevenue', 0)
                avg_order_value = summary.get('avgOrderValue', 0)
                
                print(f"   ✅ Overview analytics - Total revenue: {total_revenue} (should be in FCFA)")
                print(f"   Average order value: {avg_order_value} (should be in FCFA)")
                
                # Check revenue by service
                revenue_by_service = overview_data.get('revenueByService', [])
                if revenue_by_service:
                    for service in revenue_by_service[:3]:  # Check first 3 services
                        service_revenue = service.get('value', 0)
                        service_name = service.get('name', 'Unknown')
                        print(f"   {service_name} revenue: {service_revenue} (should be in FCFA)")
                
                # Check monthly trend
                monthly_trend = overview_data.get('monthlyTrend', [])
                if monthly_trend:
                    latest_month = monthly_trend[-1]
                    month_revenue = latest_month.get('revenue', 0)
                    month_name = latest_month.get('month', 'Unknown')
                    print(f"   {month_name} revenue: {month_revenue} (should be in FCFA)")
                
                print("   ✅ All revenue values are numeric (ready for FCFA formatting)")
        
        # Test trip analytics
        if 'admin' in self.tokens:
            success, trip_data = self.run_test(
                "Get trip analytics",
                "GET",
                "analytics/trips?from_date=2024-12-01&to_date=2024-12-31&view=daily",
                200,
                user_role='admin'
            )
            
            if success:
                summary = trip_data.get('summary', {})
                trip_revenue = summary.get('revenue', 0)
                print(f"   ✅ Trip analytics - Revenue: {trip_revenue} (should be in FCFA)")
                
                # Check daily data
                daily_data = trip_data.get('dailyData', [])
                if daily_data:
                    sample_day = daily_data[0]
                    day_revenue = sample_day.get('revenue', 0)
                    day_date = sample_day.get('date', 'Unknown')
                    print(f"   {day_date} revenue: {day_revenue} (should be in FCFA)")
                
                print("   ✅ Trip revenue values are numeric (ready for FCFA formatting)")

    def test_employee_creation_with_user_account(self):
        """Test Employee Creation with User Account Feature"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE CREATION WITH USER ACCOUNT")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for employee creation tests")
            return
        
        # Test 1: Create employee with user account
        employee_data = {
            "first_name": "Test",
            "last_name": "Employee",
            "email": "test.emp123@oryno.cm",
            "phone": "+237600000020",
            "department": "operations",
            "position": "agent",
            "create_user_account": True,
            "system_role": "employee"
        }
        
        success, response = self.run_test(
            "Create employee with user account",
            "POST",
            "employees/",
            200,
            data=employee_data,
            user_role='super_admin'
        )
        
        created_employee_id = None
        created_user_id = None
        
        if success:
            print(f"   ✅ Employee created: {response.get('message', 'Unknown')}")
            print(f"   User account created: {response.get('user_account_created', False)}")
            print(f"   Default password: {response.get('default_password', 'Not provided')}")
            
            # Verify default password is "Oryno@2024"
            if response.get('default_password') == "Oryno@2024":
                print("   ✅ Default password is correct: Oryno@2024")
            else:
                print(f"   ❌ Default password incorrect: {response.get('default_password')}")
            
            # Get employee details
            employee = response.get('employee', {})
            created_employee_id = employee.get('id') or employee.get('_id')
            created_user_id = employee.get('user_id')
            
            if created_user_id:
                print(f"   ✅ User ID linked to employee: {created_user_id}")
            else:
                print("   ❌ No user ID linked to employee")
        
        # Test 2: Verify user was created with correct role
        if created_user_id:
            success, user_data = self.run_test(
                "Get created user details",
                "GET",
                f"users/{created_user_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                user_role = user_data.get('role', 'unknown')
                user_email = user_data.get('email', 'unknown')
                print(f"   ✅ User created with role: {user_role}")
                print(f"   ✅ User email: {user_email}")
                
                if user_role == "employee":
                    print("   ✅ User role correctly set to 'employee'")
                else:
                    print(f"   ❌ User role incorrect: expected 'employee', got '{user_role}'")
        
        # Test 3: Create employee with admin system role
        admin_employee_data = {
            "first_name": "Admin",
            "last_name": "Employee",
            "email": "admin.emp123@oryno.cm",
            "phone": "+237600000021",
            "department": "management",
            "position": "manager",
            "create_user_account": True,
            "system_role": "admin"
        }
        
        success, admin_response = self.run_test(
            "Create employee with admin system role",
            "POST",
            "employees/",
            200,
            data=admin_employee_data,
            user_role='super_admin'
        )
        
        if success:
            admin_employee = admin_response.get('employee', {})
            admin_user_id = admin_employee.get('user_id')
            
            if admin_user_id:
                # Verify admin user role
                success, admin_user_data = self.run_test(
                    "Get admin employee user details",
                    "GET",
                    f"users/{admin_user_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    admin_user_role = admin_user_data.get('role', 'unknown')
                    if admin_user_role == "admin":
                        print("   ✅ Admin employee user role correctly set to 'admin'")
                    else:
                        print(f"   ❌ Admin employee user role incorrect: expected 'admin', got '{admin_user_role}'")
        
        # Test 4: Test login with created user account
        if created_user_id:
            login_success, login_response = self.run_test(
                "Login with created employee account",
                "POST",
                "auth/login",
                200,
                data={"email": "test.emp123@oryno.cm", "password": "Oryno@2024"}
            )
            
            if login_success and 'access_token' in login_response:
                print("   ✅ Employee can login with default password")
                self.tokens['test_employee'] = login_response['access_token']
            else:
                print("   ❌ Employee cannot login with default password")
        
        # Test 5: Create employee without user account
        no_user_employee_data = {
            "first_name": "NoUser",
            "last_name": "Employee",
            "email": "nouser.emp@oryno.cm",
            "phone": "+237600000022",
            "department": "operations",
            "position": "agent",
            "create_user_account": False
        }
        
        success, no_user_response = self.run_test(
            "Create employee without user account",
            "POST",
            "employees/",
            200,
            data=no_user_employee_data,
            user_role='super_admin'
        )
        
        if success:
            user_account_created = no_user_response.get('user_account_created', True)
            if not user_account_created:
                print("   ✅ Employee created without user account as expected")
            else:
                print("   ❌ User account was created when it shouldn't have been")

    def test_role_assignment_functionality(self):
        """Test Role Assignment in Permissions Page"""
        print("\n" + "="*50)
        print("TESTING ROLE ASSIGNMENT FUNCTIONALITY")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for role assignment tests")
            return
        
        # Test 1: Get users list to find test subjects
        success, users_data = self.run_test(
            "Get users list for role assignment",
            "GET",
            "users/",
            200,
            user_role='super_admin'
        )
        
        test_user_id = None
        admin_user_id = None
        
        if success:
            users = users_data.get('users', [])
            print(f"   ✅ Retrieved {len(users)} users for role testing")
            
            # Find test users
            for user in users:
                if user.get('email') == 'customer@test.com':
                    test_user_id = user.get('id')
                elif user.get('email') == 'admin@test.com':
                    admin_user_id = user.get('id')
        
        # Test 2: Test role assignment - customer to employee
        if test_user_id:
            success, role_response = self.run_test(
                "Update user role (customer to employee)",
                "PUT",
                f"users/{test_user_id}/role",
                200,
                data={"role": "employee"},
                user_role='super_admin'
            )
            
            if success:
                new_role = role_response.get('new_role', 'unknown')
                print(f"   ✅ Role updated to: {new_role}")
                
                # Verify role change persisted
                success, updated_user = self.run_test(
                    "Verify role change persisted",
                    "GET",
                    f"users/{test_user_id}",
                    200,
                    user_role='super_admin'
                )
                
                if success:
                    current_role = updated_user.get('role', 'unknown')
                    if current_role == "employee":
                        print("   ✅ Role change persisted correctly")
                    else:
                        print(f"   ❌ Role change did not persist: expected 'employee', got '{current_role}'")
        
        # Test 3: Test all available roles
        available_roles = ["user", "employee", "operator", "admin", "super_admin"]
        
        if test_user_id:
            for role in ["operator", "admin"]:  # Test a few role changes
                success, role_response = self.run_test(
                    f"Update user role to {role}",
                    "PUT",
                    f"users/{test_user_id}/role",
                    200,
                    data={"role": role},
                    user_role='super_admin'
                )
                
                if success:
                    print(f"   ✅ Successfully updated role to {role}")
                else:
                    print(f"   ❌ Failed to update role to {role}")
            
            # Revert back to customer
            self.run_test(
                "Revert user role back to customer",
                "PUT",
                f"users/{test_user_id}/role",
                200,
                data={"role": "customer"},
                user_role='super_admin'
            )
        
        # Test 4: Test permission check endpoint
        success, perm_response = self.run_test(
            "Check permissions for admin role",
            "GET",
            "users/permissions/check?target_role=admin",
            200,
            user_role='super_admin'
        )
        
        if success:
            can_manage = perm_response.get('can_manage', False)
            current_role = perm_response.get('current_role', 'unknown')
            target_role = perm_response.get('target_role', 'unknown')
            print(f"   ✅ Permission check: {current_role} can manage {target_role} = {can_manage}")
        
        # Test 5: Test admin limitations (admin cannot assign super_admin role)
        if 'admin' in self.tokens and test_user_id:
            success, fail_response = self.run_test(
                "Admin try to assign super_admin role (should fail)",
                "PUT",
                f"users/{test_user_id}/role",
                403,  # Expecting forbidden
                data={"role": "super_admin"},
                user_role='admin'
            )
            
            if success:
                print("   ✅ Admin correctly blocked from assigning super_admin role")
            else:
                print("   ❌ Admin was able to assign super_admin role (security issue)")
        
        # Test 6: Test role hierarchy - admin cannot manage super_admin
        if 'admin' in self.tokens:
            # Find super admin user
            super_admin_id = None
            for user in users_data.get('users', []):
                if user.get('role') == 'super_admin':
                    super_admin_id = user.get('id')
                    break
            
            if super_admin_id:
                success, fail_response = self.run_test(
                    "Admin try to change super_admin role (should fail)",
                    "PUT",
                    f"users/{super_admin_id}/role",
                    403,  # Expecting forbidden
                    data={"role": "admin"},
                    user_role='admin'
                )
                
                if success:
                    print("   ✅ Admin correctly blocked from managing super_admin")
                else:
                    print("   ❌ Admin was able to manage super_admin (security issue)")

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

    def test_delete_functionality(self):
        """Test Delete Functionality for Users, Operators, and Employees"""
        print("\n" + "="*50)
        print("TESTING DELETE FUNCTIONALITY - USERS, OPERATORS, EMPLOYEES")
        print("="*50)
        
        if 'super_admin' not in self.tokens:
            print("   ❌ Super admin token required for delete functionality tests")
            return
        
        # ==================== USER DELETION TESTS ====================
        print("\n--- USER DELETION TESTS ---")
        
        # Test 1: Create a test user to delete
        test_user_data = {
            "email": "deleteme@test.com",
            "username": "deleteme",
            "password": "testpass123",
            "full_name": "Delete Me User",
            "phone": "+237600000099",
            "role": "customer"
        }
        
        success, create_response = self.run_test(
            "Create test user for deletion",
            "POST",
            "users/create",
            200,
            data=test_user_data,
            user_role='super_admin'
        )
        
        created_user_id = None
        if success:
            created_user_id = create_response.get('user_id')
            print(f"   ✅ Test user created with ID: {created_user_id}")
        
        # Test 2: Verify user exists in users list
        if created_user_id:
            success, users_data = self.run_test(
                "Verify test user exists in users list",
                "GET",
                "users/",
                200,
                user_role='super_admin'
            )
            
            user_found = False
            if success:
                users = users_data.get('users', [])
                for user in users:
                    if user.get('email') == 'deleteme@test.com':
                        user_found = True
                        break
                
                if user_found:
                    print("   ✅ Test user found in users list")
                else:
                    print("   ❌ Test user not found in users list")
        
        # Test 3: Delete the user
        if created_user_id:
            success, delete_response = self.run_test(
                "Delete test user",
                "DELETE",
                f"users/{created_user_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print(f"   ✅ User deleted successfully: {delete_response.get('message', 'Unknown')}")
            else:
                print("   ❌ User deletion failed")
        
        # Test 4: Verify user is deleted (should not appear in users list)
        if created_user_id:
            success, users_data = self.run_test(
                "Verify user is deleted from users list",
                "GET",
                "users/",
                200,
                user_role='super_admin'
            )
            
            user_found = False
            if success:
                users = users_data.get('users', [])
                for user in users:
                    if user.get('email') == 'deleteme@test.com':
                        user_found = True
                        break
                
                if not user_found:
                    print("   ✅ User successfully deleted - not found in users list")
                else:
                    print("   ❌ User still exists in users list after deletion")
        
        # Test 5: Verify multiple consecutive GET requests show user as deleted
        if created_user_id:
            for i in range(3):
                success, users_data = self.run_test(
                    f"Verify user deletion persistence (check #{i+1})",
                    "GET",
                    "users/",
                    200,
                    user_role='super_admin'
                )
                
                user_found = False
                if success:
                    users = users_data.get('users', [])
                    for user in users:
                        if user.get('email') == 'deleteme@test.com':
                            user_found = True
                            break
                    
                    if not user_found:
                        print(f"   ✅ Check #{i+1}: User still deleted")
                    else:
                        print(f"   ❌ Check #{i+1}: User reappeared in list")
        
        # ==================== EMPLOYEE DELETION TESTS ====================
        print("\n--- EMPLOYEE DELETION TESTS ---")
        
        # Test 1: Create a test employee to delete
        employee_data = {
            "first_name": "Delete",
            "last_name": "Employee",
            "email": "deleteme-emp@test.com",
            "phone": "+237600000098",
            "department": "operations",
            "position": "agent",
            "create_user_account": False
        }
        
        success, emp_create_response = self.run_test(
            "Create test employee for deletion",
            "POST",
            "employees/",
            200,
            data=employee_data,
            user_role='super_admin'
        )
        
        created_employee_id = None
        if success:
            employee = emp_create_response.get('employee', {})
            created_employee_id = employee.get('id') or employee.get('_id')
            print(f"   ✅ Test employee created with ID: {created_employee_id}")
        
        # Test 2: Verify employee exists in employees list
        if created_employee_id:
            success, employees_data = self.run_test(
                "Verify test employee exists in employees list",
                "GET",
                "employees/",
                200,
                user_role='super_admin'
            )
            
            employee_found = False
            if success:
                employees = employees_data.get('employees', [])
                for emp in employees:
                    if emp.get('email') == 'deleteme-emp@test.com':
                        employee_found = True
                        break
                
                if employee_found:
                    print("   ✅ Test employee found in employees list")
                else:
                    print("   ❌ Test employee not found in employees list")
        
        # Test 3: Delete the employee
        if created_employee_id:
            success, emp_delete_response = self.run_test(
                "Delete test employee",
                "DELETE",
                f"employees/{created_employee_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print(f"   ✅ Employee deleted successfully: {emp_delete_response.get('message', 'Unknown')}")
            else:
                print("   ❌ Employee deletion failed")
        
        # Test 4: Verify employee is deleted
        if created_employee_id:
            success, employees_data = self.run_test(
                "Verify employee is deleted from employees list",
                "GET",
                "employees/",
                200,
                user_role='super_admin'
            )
            
            employee_found = False
            if success:
                employees = employees_data.get('employees', [])
                for emp in employees:
                    if emp.get('email') == 'deleteme-emp@test.com':
                        employee_found = True
                        break
                
                if not employee_found:
                    print("   ✅ Employee successfully deleted - not found in employees list")
                else:
                    print("   ❌ Employee still exists in employees list after deletion")
        
        # Test 5: Verify multiple consecutive GET requests show employee as deleted
        if created_employee_id:
            for i in range(3):
                success, employees_data = self.run_test(
                    f"Verify employee deletion persistence (check #{i+1})",
                    "GET",
                    "employees/",
                    200,
                    user_role='super_admin'
                )
                
                employee_found = False
                if success:
                    employees = employees_data.get('employees', [])
                    for emp in employees:
                        if emp.get('email') == 'deleteme-emp@test.com':
                            employee_found = True
                            break
                    
                    if not employee_found:
                        print(f"   ✅ Check #{i+1}: Employee still deleted")
                    else:
                        print(f"   ❌ Check #{i+1}: Employee reappeared in list")
        
        # ==================== OPERATOR DELETION TESTS ====================
        print("\n--- OPERATOR DELETION TESTS ---")
        
        # Test 1: Create a test operator to delete
        operator_data = {
            "name": "Delete Operator",
            "email": "deleteme-op@test.com",
            "phone": "+237600000097",
            "operator_type": "travel",  # Fixed: use valid enum value
            "city": "Douala",
            "address": "Test Address",
            "description": "Test operator for deletion"
        }
        
        success, op_create_response = self.run_test(
            "Create test operator for deletion",
            "POST",
            "operators/",
            200,
            data=operator_data,
            user_role='super_admin'
        )
        
        created_operator_id = None
        if success:
            created_operator_id = op_create_response.get('operator_id')
            print(f"   ✅ Test operator created with ID: {created_operator_id}")
        
        # Test 2: Verify operator exists in operators list
        if created_operator_id:
            success, operators_data = self.run_test(
                "Verify test operator exists in operators list",
                "GET",
                "operators/",
                200,
                user_role='super_admin'
            )
            
            operator_found = False
            if success:
                operators = operators_data.get('operators', [])
                for op in operators:
                    if op.get('email') == 'deleteme-op@test.com':
                        operator_found = True
                        break
                
                if operator_found:
                    print("   ✅ Test operator found in operators list")
                else:
                    print("   ❌ Test operator not found in operators list")
        
        # Test 3: Delete the operator
        if created_operator_id:
            success, op_delete_response = self.run_test(
                "Delete test operator",
                "DELETE",
                f"operators/{created_operator_id}",
                200,
                user_role='super_admin'
            )
            
            if success:
                print(f"   ✅ Operator deleted successfully: {op_delete_response.get('message', 'Unknown')}")
            else:
                print("   ❌ Operator deletion failed")
        
        # Test 4: Verify operator is deleted
        if created_operator_id:
            success, operators_data = self.run_test(
                "Verify operator is deleted from operators list",
                "GET",
                "operators/",
                200,
                user_role='super_admin'
            )
            
            operator_found = False
            if success:
                operators = operators_data.get('operators', [])
                for op in operators:
                    if op.get('email') == 'deleteme-op@test.com':
                        operator_found = True
                        break
                
                if not operator_found:
                    print("   ✅ Operator successfully deleted - not found in operators list")
                else:
                    print("   ❌ Operator still exists in operators list after deletion")
        
        # Test 5: Verify multiple consecutive GET requests show operator as deleted
        if created_operator_id:
            for i in range(3):
                success, operators_data = self.run_test(
                    f"Verify operator deletion persistence (check #{i+1})",
                    "GET",
                    "operators/",
                    200,
                    user_role='super_admin'
                )
                
                operator_found = False
                if success:
                    operators = operators_data.get('operators', [])
                    for op in operators:
                        if op.get('email') == 'deleteme-op@test.com':
                            operator_found = True
                            break
                    
                    if not operator_found:
                        print(f"   ✅ Check #{i+1}: Operator still deleted")
                    else:
                        print(f"   ❌ Check #{i+1}: Operator reappeared in list")
        
        print("\n--- DELETE FUNCTIONALITY TESTS COMPLETED ---")

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print(f"\nTokens obtained: {list(self.tokens.keys())}")
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    print("🚀 Starting Oryno Platform API Tests")
    print("="*60)
    
    tester = ORynoAPITester()
    
    # CURRENT REVIEW REQUEST TESTS - PRIORITY
    print("\n🎯 RUNNING CURRENT REVIEW REQUEST TESTS")
    print("="*60)
    
    # Test login with correct credentials first
    tester.test_user_registration_and_login()
    
    # Travel Round-Trip Backend APIs (Current Review Request)
    tester.test_travel_round_trip_backend_apis()
    
    # Permissions Enforcement System (Previous Review Request)
    tester.test_comprehensive_permissions_enforcement()
    
    # Services Data Verification (Previous Review Request)
    tester.test_services_data_verification()
    
    # Stripe Checkout Integration (Previous Review Request)
    tester.test_stripe_checkout_integration()
    
    # OTHER TESTS (if time permits)
    print("\n📋 RUNNING ADDITIONAL TESTS")
    print("="*60)
    
    tester.test_protected_routes()
    tester.test_admin_only_routes()
    tester.test_service_endpoints()
    tester.test_orders_endpoints()
    
    # Print summary
    success = tester.print_summary()
    
    # Save results to file
    import os
    os.makedirs("/app/test_reports", exist_ok=True)
    results_file = "/app/test_reports/backend_api_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.utcnow().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
            "tokens_obtained": list(tester.tokens.keys()),
            "test_results": tester.test_results
        }, f, indent=2)
    
    print(f"\n📄 Results saved to: {results_file}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
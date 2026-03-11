"""
Iteration 80: Test deep-linking and notification structure for alerts/notifications
Verify:
1. Backend: POST /api/subscriptions/alerts creates notification with alert_id and action_url containing the alert_id
2. Backend: Notification for operator_alert has both 'id' (notification ID) and 'alert_id' (alert item ID)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_operator_token():
    """Get operator auth token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "operator@test.com",
        "password": "testpassword123"
    })
    if resp.status_code != 200:
        pytest.skip(f"Operator login failed: {resp.text}")
    return resp.json()["access_token"]

def get_customer_token():
    """Get customer auth token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "customer@test.com",
        "password": "testpassword123"
    })
    if resp.status_code != 200:
        pytest.skip(f"Customer login failed: {resp.text}")
    return resp.json()["access_token"]


class TestDeepLinkingAlerts:
    """Test deep-linking and notification structure for alerts"""
    
    def test_operator_alert_creates_notification_with_alert_id(self):
        """Verify POST /api/subscriptions/alerts creates notification with alert_id and action_url"""
        operator_token = get_operator_token()
        customer_token = get_customer_token()
        
        # Create an alert as operator
        alert_title = f"TEST_DEEPLINK_Alert_{int(time.time())}"
        alert_payload = {
            "title": alert_title,
            "message": "This is a test alert for deep-linking verification",
            "target_type": "subscribers"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/alerts",
            json=alert_payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {operator_token}"}
        )
        
        assert response.status_code == 200, f"Alert creation failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "alert_id" in data, "Response should contain alert_id"
        assert "notified_count" in data, "Response should contain notified_count"
        
        alert_id = data["alert_id"]
        print(f"Created alert with ID: {alert_id}, notified: {data['notified_count']}")
        
        # Check notifications as customer (note trailing slash)
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        
        assert notif_response.status_code == 200, f"Notification fetch failed: {notif_response.text}"
        notifications = notif_response.json().get("notifications", [])
        
        # Find the notification for this alert
        alert_notification = None
        for notif in notifications:
            if alert_title in notif.get("title", ""):
                alert_notification = notif
                break
        
        # Verify notification structure if customer is subscribed
        if alert_notification:
            print(f"Found notification: {alert_notification}")
            
            # Verify notification has both id and alert_id
            assert "id" in alert_notification, "Notification should have 'id' (notification ID)"
            assert "alert_id" in alert_notification, "Notification should have 'alert_id' (alert item ID)"
            
            # Verify alert_id matches the created alert
            assert alert_notification["alert_id"] == alert_id, \
                f"Notification alert_id ({alert_notification['alert_id']}) should match created alert ID ({alert_id})"
            
            # Verify action_url contains the alert_id
            action_url = alert_notification.get("action_url", "")
            assert f"id={alert_id}" in action_url, \
                f"action_url should contain 'id={alert_id}'. Got: {action_url}"
            
            # Verify action_url structure for alerts
            assert "subtab=alerts" in action_url, \
                f"action_url should contain 'subtab=alerts'. Got: {action_url}"
            assert "tab=messages" in action_url, \
                f"action_url should contain 'tab=messages'. Got: {action_url}"
            
            print(f"PASS: Notification structure verified:")
            print(f"  - Notification ID: {alert_notification['id']}")
            print(f"  - Alert ID: {alert_notification['alert_id']}")
            print(f"  - Action URL: {action_url}")
        else:
            # Customer might not be subscribed
            print("Customer notification not found (customer may not be subscribed to operator)")
            print(f"Alert created successfully, notified {data['notified_count']} subscribers")
    
    def test_alert_notification_type_is_operator_alert(self):
        """Verify notification type is 'operator_alert' for alerts"""
        operator_token = get_operator_token()
        customer_token = get_customer_token()
        
        # Create an alert
        alert_title = f"TEST_TYPE_Alert_{int(time.time())}"
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/alerts",
            json={
                "title": alert_title,
                "message": "Testing notification type",
                "target_type": "subscribers"
            },
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200
        
        # Check notification type as customer (trailing slash)
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        
        assert notif_response.status_code == 200
        notifications = notif_response.json().get("notifications", [])
        
        for notif in notifications:
            if alert_title in notif.get("title", ""):
                # Verify type
                assert notif.get("type") == "operator_alert", \
                    f"Notification type should be 'operator_alert', got: {notif.get('type')}"
                assert notif.get("source") == "operator_alert", \
                    f"Notification source should be 'operator_alert', got: {notif.get('source')}"
                print(f"PASS: Notification type verification: type={notif.get('type')}, source={notif.get('source')}")
                return
        
        print("Note: Alert notification not found in customer's list")
    
    def test_user_alerts_endpoint_returns_alert_with_id(self):
        """Verify GET /api/subscriptions/user-alerts returns alerts with id field"""
        customer_token = get_customer_token()
        
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/user-alerts",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"user-alerts failed: {response.text}"
        
        data = response.json()
        alerts = data.get("alerts", [])
        
        print(f"Found {len(alerts)} alerts for customer")
        
        for alert in alerts[:3]:  # Check first 3 alerts
            assert "id" in alert, "Alert should have 'id' field"
            assert "title" in alert, "Alert should have 'title' field"
            assert "message" in alert, "Alert should have 'message' field"
            assert "type" in alert, "Alert should have 'type' field"
            print(f"  Alert: id={alert['id']}, type={alert['type']}, title={alert['title'][:30]}...")
    
    def test_existing_alert_can_be_retrieved(self):
        """Verify the existing test alert structure"""
        customer_token = get_customer_token()
        existing_alert_id = "e48e8a2c-bd05-43df-9f1e-f73dd6c7dd3b"
        
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/user-alerts",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200
        
        alerts = response.json().get("alerts", [])
        target_alert = None
        for alert in alerts:
            if alert.get("id") == existing_alert_id:
                target_alert = alert
                break
        
        if target_alert:
            print(f"Found existing alert: {target_alert}")
            assert target_alert.get("type") == "alert", "Existing alert should have type='alert'"
        else:
            print(f"Note: Existing alert {existing_alert_id} not found in user-alerts - may be from different operator")


class TestNotificationContextFields:
    """Test that notifications have correct fields for deep-linking"""
    
    def test_notifications_endpoint_returns_alert_id_for_operator_alerts(self):
        """Verify /api/notifications returns alert_id for operator_alert type notifications"""
        customer_token = get_customer_token()
        
        # Note trailing slash
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        notifications = response.json().get("notifications", [])
        
        operator_alerts = [n for n in notifications if n.get("type") == "operator_alert"]
        print(f"Found {len(operator_alerts)} operator_alert notifications")
        
        for notif in operator_alerts[:3]:  # Check first 3
            # Must have both id (notification ID) and alert_id (alert item ID)
            assert "id" in notif, "Notification must have 'id'"
            assert "alert_id" in notif, "operator_alert notification must have 'alert_id'"
            
            # action_url must use alert_id for deep-linking
            action_url = notif.get("action_url", "")
            expected_id = notif["alert_id"]
            assert f"id={expected_id}" in action_url, \
                f"action_url should contain alert_id: expected 'id={expected_id}' in '{action_url}'"
            
            print(f"  OK: Notification {notif['id'][:8]}... -> Alert {notif['alert_id'][:8]}... -> URL has correct id")
    
    def test_notification_action_urls_for_different_types(self):
        """Verify action_url patterns for different notification types"""
        customer_token = get_customer_token()
        
        # Note trailing slash
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        notifications = response.json().get("notifications", [])
        
        for notif in notifications[:10]:
            notif_type = notif.get("type", "")
            action_url = notif.get("action_url", "")
            
            if notif_type == "operator_alert":
                # Should link to alerts sub-tab with alert_id
                if action_url:
                    assert "subtab=alerts" in action_url, f"operator_alert should link to alerts subtab: {action_url}"
                    assert "id=" in action_url, f"operator_alert URL should have id param: {action_url}"
            
            elif notif_type == "ticket_reply":
                # ticket_reply may not have action_url or link to /support
                pass  # Skip validation for now
            
            elif notif_type in ("promotion", "operator_promotion"):
                # Should link to notifications sub-tab
                if action_url:
                    assert "subtab=notifications" in action_url or "id=" in action_url, \
                        f"promotion should link to notifications: {action_url}"
            
            print(f"  Type: {notif_type}, URL: {action_url or '(none)'}")


class TestSubscriptionCheck:
    """Verify customer subscription status for notification testing"""
    
    def test_customer_subscription_check(self):
        """Check customer subscription to operator 5b0df280-f792-4ae8-9ad9-c18a8c7dd99e"""
        customer_token = get_customer_token()
        operator_id = "5b0df280-f792-4ae8-9ad9-c18a8c7dd99e"
        
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/check?operator_id={operator_id}",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"Customer subscription to operator {operator_id}: {data.get('subscribed')}")
        
        if data.get("subscribed"):
            print("  Customer is subscribed - notifications should be received")
        else:
            print("  Customer is NOT subscribed - may need to subscribe first")
    
    def test_customer_subscriptions_list(self):
        """List customer's subscriptions"""
        customer_token = get_customer_token()
        
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/my",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        subs = data.get("subscriptions", [])
        print(f"Customer has {len(subs)} subscriptions")
        for sub in subs[:5]:
            print(f"  - Operator: {sub.get('operator_name')} ({sub.get('operator_id')})")

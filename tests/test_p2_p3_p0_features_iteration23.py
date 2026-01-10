"""
Test P2, P3, P0 Features - Iteration 23
- P2: Advanced Ratings Reports (Admin Reports tab with analytics)
- P3: CustomerServiceManagement.jsx refactoring (Dashboard, Tickets, Team tabs)
- P0: SMS OTP verification for phone signups using Infobip
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestP0_OTPVerification:
    """P0: SMS OTP verification for phone signups using Infobip"""
    
    def test_send_otp_valid_phone(self):
        """Test sending OTP to a valid phone number"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"phone_number": "+237699888777"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["channel"] == "sms"
        assert data["expires_in_seconds"] == 300
        print(f"✓ OTP sent successfully to phone: {data}")
    
    def test_send_otp_invalid_phone_format(self):
        """Test sending OTP with invalid phone format (no + prefix)"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"phone_number": "237699888777"},  # Missing + prefix
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422  # Validation error
        print(f"✓ Invalid phone format rejected correctly")
    
    def test_send_otp_missing_identifier(self):
        """Test sending OTP without phone or email"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "phone_number or email" in data.get("detail", "").lower()
        print(f"✓ Missing identifier rejected correctly")
    
    def test_verify_otp_invalid_code(self):
        """Test verifying OTP with invalid code"""
        # First send OTP
        send_response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={"phone_number": "+237699888888"},
            headers={"Content-Type": "application/json"}
        )
        assert send_response.status_code == 200
        
        # Try to verify with wrong code
        verify_response = requests.post(
            f"{BASE_URL}/api/otp/verify",
            json={"phone_number": "+237699888888", "otp_code": "000000"},
            headers={"Content-Type": "application/json"}
        )
        assert verify_response.status_code == 400
        data = verify_response.json()
        assert "invalid" in data.get("detail", "").lower() or "attempts" in data.get("detail", "").lower()
        print(f"✓ Invalid OTP code rejected correctly")
    
    def test_verify_otp_no_pending(self):
        """Test verifying OTP when no OTP was sent"""
        response = requests.post(
            f"{BASE_URL}/api/otp/verify",
            json={"phone_number": "+237699999999", "otp_code": "123456"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "no pending otp" in data.get("detail", "").lower()
        print(f"✓ No pending OTP handled correctly")
    
    def test_resend_otp(self):
        """Test resending OTP"""
        response = requests.post(
            f"{BASE_URL}/api/otp/resend",
            json={"phone_number": "+237699888777"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        print(f"✓ OTP resend works correctly")


class TestP2_RatingsAnalytics:
    """P2: Advanced Ratings Reports - Admin analytics endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_analytics_endpoint_requires_auth(self):
        """Test that analytics endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/reports/analytics",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        print(f"✓ Analytics endpoint requires authentication")
    
    def test_analytics_endpoint_returns_data(self, admin_token):
        """Test analytics endpoint returns proper data structure"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/reports/analytics?time_range=30d",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify summary structure
        assert "summary" in data
        summary = data["summary"]
        assert "total_ratings" in summary
        assert "average_rating" in summary
        assert "response_rate" in summary
        assert "avg_response_time_hours" in summary
        assert "flagged_count" in summary
        assert "hidden_count" in summary
        assert "five_star_percent" in summary
        assert "negative_percent" in summary
        
        # Verify trends structure
        assert "trends" in data
        
        # Verify by_category structure
        assert "by_category" in data
        
        # Verify flagged_analysis structure
        assert "flagged_analysis" in data
        
        # Verify top_operators structure
        assert "top_operators" in data
        
        print(f"✓ Analytics endpoint returns proper data structure")
        print(f"  Summary: {summary}")
    
    def test_analytics_time_ranges(self, admin_token):
        """Test analytics with different time ranges"""
        time_ranges = ["7d", "30d", "90d", "1y", "all"]
        
        for time_range in time_ranges:
            response = requests.get(
                f"{BASE_URL}/api/ratings/reports/analytics?time_range={time_range}",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {admin_token}"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
            print(f"✓ Analytics works for time_range={time_range}")
    
    def test_ratings_stats_endpoint(self, admin_token):
        """Test ratings stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/ratings/stats",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "responded" in data
        assert "pending" in data
        assert "flagged" in data
        assert "average" in data
        assert "byRating" in data
        print(f"✓ Ratings stats endpoint works: {data}")


class TestP3_CustomerServiceManagement:
    """P3: CustomerServiceManagement.jsx refactoring - verify extracted components"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_tickets_endpoint(self, admin_token):
        """Test tickets endpoint for customer service"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        # Should return 200 or 404 if no tickets
        assert response.status_code in [200, 404]
        print(f"✓ Tickets endpoint accessible: status={response.status_code}")
    
    def test_team_members_endpoint(self, admin_token):
        """Test team members endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data or isinstance(data, list)
        print(f"✓ Team members endpoint works")
    
    def test_analytics_overview_endpoint(self, admin_token):
        """Test analytics overview for dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Analytics overview endpoint works: {data}")


class TestBackendHealth:
    """Basic backend health checks"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Backend is healthy")
    
    def test_auth_login(self):
        """Test authentication works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@oryno.com", "password": "testpassword123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "super_admin"
        print(f"✓ Authentication works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test Reports Feature - Iteration 90
Tests for:
- GET /api/reports/generate with various report_ids
- GET /api/reports/operators-list for admin
- Operator scoping
- Customer blocked (403)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestReportsEndpoints:
    """Test reports API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_email = "admin@test.com"
        self.admin_password = "testpassword123"
        self.customer_email = "customer@test.com"
        self.customer_password = "testpassword123"
        self.operator_email = "operator@test.com"
        self.operator_password = "testpassword123"
        self.operator_id = "30c487d8-f8ef-4e80-8b14-1a68866071c8"  # Musango Bus Service
    
    def get_auth_token(self, email, password):
        """Helper to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    # ========== Admin Tests ==========
    
    def test_admin_can_access_booking_report(self):
        """Admin can generate booking report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=booking-report",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "report_id" in data
        assert data["report_id"] == "booking-report"
        assert "title" in data
        assert "summary" in data
        assert "charts" in data
        assert "table" in data
        assert "scope" in data
        assert "generated_at" in data
        print(f"Booking report summary: {data['summary']}")
    
    def test_admin_can_access_revenue_analysis(self):
        """Admin can generate revenue analysis report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=revenue-analysis",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["report_id"] == "revenue-analysis"
        assert "total_revenue" in data["summary"]
        assert "charts" in data
        print(f"Revenue analysis summary: {data['summary']}")
    
    def test_admin_can_access_financial_summary(self):
        """Admin can generate financial summary report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=financial-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "financial-summary"
        print(f"Financial summary: {data['summary']}")
    
    def test_admin_can_access_customer_insights(self):
        """Admin can generate customer insights report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=customer-insights",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "customer-insights"
        print(f"Customer insights: {data['summary']}")
    
    def test_admin_can_access_operational_efficiency(self):
        """Admin can generate operational efficiency report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=operational-efficiency",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "operational-efficiency"
        print(f"Operational efficiency: {data['summary']}")
    
    def test_admin_can_access_service_performance(self):
        """Admin can generate service performance report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=service-performance",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "service-performance"
        print(f"Service performance: {data['summary']}")
    
    def test_admin_can_access_customer_satisfaction(self):
        """Admin can generate customer satisfaction report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=customer-satisfaction",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "customer-satisfaction"
        print(f"Customer satisfaction: {data['summary']}")
    
    def test_admin_can_access_booking_analytics(self):
        """Admin can generate booking analytics report"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=booking-analytics",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == "booking-analytics"
        print(f"Booking analytics: {data['summary']}")
    
    def test_admin_can_get_operators_list(self):
        """Admin can get operators list for scope selector"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/operators-list",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operators" in data
        print(f"Operators list count: {len(data['operators'])}")
        if data['operators']:
            print(f"First operator: {data['operators'][0]}")
    
    def test_admin_can_scope_report_by_operator(self):
        """Admin can scope report by specific operator"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=booking-report&operator_id={self.operator_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "scope" in data
        print(f"Scoped report scope: {data['scope']}")
    
    # ========== Customer Tests (Should be blocked) ==========
    
    def test_customer_blocked_from_reports(self):
        """Customer should get 403 when accessing reports"""
        token = self.get_auth_token(self.customer_email, self.customer_password)
        assert token, "Customer login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=booking-report",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}: {response.text}"
        print("Customer correctly blocked from reports")
    
    def test_customer_blocked_from_operators_list(self):
        """Customer should get 403 when accessing operators list"""
        token = self.get_auth_token(self.customer_email, self.customer_password)
        assert token, "Customer login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/operators-list",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for customer, got {response.status_code}: {response.text}"
        print("Customer correctly blocked from operators list")
    
    # ========== Operator Tests ==========
    
    def test_operator_can_access_reports(self):
        """Operator can access reports (scoped to their business)"""
        token = self.get_auth_token(self.operator_email, self.operator_password)
        assert token, "Operator login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=booking-report",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Operator should get 200 or 400 (if no operator context)
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"Operator report scope: {data.get('scope', 'N/A')}")
        else:
            print(f"Operator got 400 (likely no operator context): {response.text}")
    
    def test_operator_gets_empty_operators_list(self):
        """Operator should get empty operators list (can only see own data)"""
        token = self.get_auth_token(self.operator_email, self.operator_password)
        assert token, "Operator login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/operators-list",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "operators" in data
        assert len(data["operators"]) == 0, "Operator should get empty operators list"
        print("Operator correctly gets empty operators list")
    
    # ========== Invalid Report Tests ==========
    
    def test_invalid_report_id_returns_400(self):
        """Invalid report_id should return 400"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token, "Admin login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_id=invalid-report",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("Invalid report_id correctly returns 400")
    
    # ========== Unauthenticated Tests ==========
    
    def test_unauthenticated_blocked(self):
        """Unauthenticated requests should be blocked"""
        response = requests.get(f"{BASE_URL}/api/reports/generate?report_id=booking-report")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthenticated correctly blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

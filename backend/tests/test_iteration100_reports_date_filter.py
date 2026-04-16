"""
Test iteration 100: Reports Date Range Filter Feature
Tests the date_from and date_to query parameters on /api/reports/generate endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReportsDateFilter:
    """Test date range filtering on reports endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        assert token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ========== Booking Report Tests ==========
    
    def test_booking_report_with_date_range(self):
        """Test booking-report with date_from and date_to parameters"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report",
            "date_from": "2026-01-01",
            "date_to": "2026-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "report_id" in data
        assert data["report_id"] == "booking-report"
        assert "title" in data
        assert "summary" in data
        assert "charts" in data
        assert "generated_at" in data
        print(f"Booking report with date range returned successfully: {data.get('summary', {})}")
    
    def test_booking_report_without_dates(self):
        """Test booking-report without date parameters (unfiltered)"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["report_id"] == "booking-report"
        assert "summary" in data
        print(f"Booking report without dates returned successfully: {data.get('summary', {})}")
    
    def test_booking_report_with_only_date_from(self):
        """Test booking-report with only date_from parameter"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report",
            "date_from": "2025-01-01"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["report_id"] == "booking-report"
        print(f"Booking report with only date_from returned successfully")
    
    def test_booking_report_with_only_date_to(self):
        """Test booking-report with only date_to parameter"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report",
            "date_to": "2026-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["report_id"] == "booking-report"
        print(f"Booking report with only date_to returned successfully")
    
    # ========== Revenue Analysis Tests ==========
    
    def test_revenue_analysis_with_date_range(self):
        """Test revenue-analysis with date_from and date_to for 2025"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "revenue-analysis",
            "date_from": "2025-01-01",
            "date_to": "2025-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["report_id"] == "revenue-analysis"
        assert "summary" in data
        assert "total_revenue" in data["summary"]
        print(f"Revenue analysis for 2025 returned: total_revenue={data['summary'].get('total_revenue')}")
    
    def test_revenue_analysis_without_dates(self):
        """Test revenue-analysis without date parameters"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "revenue-analysis"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["report_id"] == "revenue-analysis"
        print(f"Revenue analysis without dates returned successfully")
    
    # ========== All 8 Report Types Tests ==========
    
    @pytest.mark.parametrize("report_id", [
        "booking-report",
        "revenue-analysis",
        "financial-summary",
        "customer-insights",
        "operational-efficiency",
        "service-performance",
        "customer-satisfaction",
        "booking-analytics"
    ])
    def test_all_reports_with_date_filter(self, report_id):
        """Test all 8 report types accept date_from and date_to parameters"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": report_id,
            "date_from": "2025-06-01",
            "date_to": "2026-06-01"
        })
        assert response.status_code == 200, f"Report {report_id} failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data["report_id"] == report_id, f"Expected report_id={report_id}, got {data.get('report_id')}"
        assert "summary" in data, f"Report {report_id} missing summary"
        assert "generated_at" in data, f"Report {report_id} missing generated_at"
        print(f"Report '{report_id}' with date filter: OK")
    
    @pytest.mark.parametrize("report_id", [
        "booking-report",
        "revenue-analysis",
        "financial-summary",
        "customer-insights",
        "operational-efficiency",
        "service-performance",
        "customer-satisfaction",
        "booking-analytics"
    ])
    def test_all_reports_without_date_filter(self, report_id):
        """Test all 8 report types work without date parameters"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": report_id
        })
        assert response.status_code == 200, f"Report {report_id} failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data["report_id"] == report_id
        assert "summary" in data
        print(f"Report '{report_id}' without date filter: OK")
    
    # ========== Edge Cases ==========
    
    def test_invalid_date_format_gracefully_handled(self):
        """Test that invalid date format is handled gracefully (not crash)"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report",
            "date_from": "invalid-date",
            "date_to": "also-invalid"
        })
        # Should still return 200 (invalid dates are ignored per backend code)
        assert response.status_code == 200, f"Expected 200 (graceful handling), got {response.status_code}"
        print("Invalid date format handled gracefully")
    
    def test_date_range_with_operator_filter(self):
        """Test date range combined with operator_id filter"""
        response = self.session.get(f"{BASE_URL}/api/reports/generate", params={
            "report_id": "booking-report",
            "operator_id": "all",
            "date_from": "2025-01-01",
            "date_to": "2026-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["report_id"] == "booking-report"
        print("Date range with operator filter works correctly")


class TestReportsOperatorsList:
    """Test operators list endpoint for admin scope selector"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_operators_list_endpoint(self):
        """Test /api/reports/operators-list returns operators for admin"""
        response = self.session.get(f"{BASE_URL}/api/reports/operators-list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "operators" in data
        assert isinstance(data["operators"], list)
        print(f"Operators list returned {len(data['operators'])} operators")

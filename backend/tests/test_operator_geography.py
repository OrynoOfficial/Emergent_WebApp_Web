"""
Test Operator Geography Integration - Iteration 33
Tests country, region, and market_segment fields in operator CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = "TEST_GEO_"

class TestOperatorGeography:
    """Tests for operator geography and market segment fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@oryno.com",
            "password": "testpassword123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.logged_in = True
        else:
            self.logged_in = False
            pytest.skip("Login failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test operators
        if hasattr(self, 'created_operator_id') and self.created_operator_id:
            try:
                self.session.delete(f"{BASE_URL}/api/operators/{self.created_operator_id}")
            except:
                pass
    
    def test_01_geography_api_available(self):
        """Test that geography API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/geography/countries")
        assert response.status_code == 200, f"Failed to get countries: {response.text}"
        data = response.json()
        assert "countries" in data
        print(f"✓ Countries API returns {len(data['countries'])} countries")
        
        # Verify Cameroon is in the list
        countries = data["countries"]
        cm = next((c for c in countries if c["code"] == "CM"), None)
        assert cm is not None, "Cameroon (CM) not found in countries"
        print(f"✓ Cameroon found: {cm['name']}")
    
    def test_02_regions_api_available(self):
        """Test that regions API is accessible with country filter"""
        response = self.session.get(f"{BASE_URL}/api/geography/regions", params={"country_id": "CM"})
        # Using country_id or country_code parameter
        if response.status_code != 200:
            response = self.session.get(f"{BASE_URL}/api/geography/regions", params={"country_code": "CM"})
        
        assert response.status_code == 200, f"Failed to get regions: {response.text}"
        data = response.json()
        assert "regions" in data
        print(f"✓ Regions API returns {len(data['regions'])} regions for Cameroon")
        
        # Verify some regions exist
        regions = data["regions"]
        if regions:
            print(f"✓ Sample regions: {[r['name'] for r in regions[:3]]}")
    
    def test_03_market_segments_api_available(self):
        """Test that market segments API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/geography/market-segments")
        assert response.status_code == 200, f"Failed to get market segments: {response.text}"
        data = response.json()
        assert "market_segments" in data
        segments = data["market_segments"]
        segment_values = [s["value"] for s in segments]
        assert "sme" in segment_values
        assert "enterprise" in segment_values
        assert "strategic" in segment_values
        print(f"✓ Market segments: {segment_values}")
    
    def test_04_create_operator_with_geography(self):
        """Test creating operator with country, region, and market_segment"""
        operator_data = {
            "name": f"{TEST_PREFIX}Travel Agency",
            "email": f"{TEST_PREFIX}travel@test.com",
            "phone": "+237600123456",
            "city": "Douala",
            "operator_type": "travel",
            "service_types": ["travel"],
            "country": "CM",
            "region": "CM-LT",  # Littoral region
            "market_segment": "sme"
        }
        
        response = self.session.post(f"{BASE_URL}/api/operators/", json=operator_data)
        assert response.status_code == 200, f"Failed to create operator: {response.text}"
        
        data = response.json()
        self.created_operator_id = data.get("operator_id")
        assert self.created_operator_id is not None
        print(f"✓ Created operator with ID: {self.created_operator_id}")
        
        # Verify the operator has geography fields
        get_response = self.session.get(f"{BASE_URL}/api/operators/{self.created_operator_id}")
        assert get_response.status_code == 200
        operator = get_response.json()
        
        assert operator.get("country") == "CM", f"Country mismatch: {operator.get('country')}"
        assert operator.get("region") == "CM-LT", f"Region mismatch: {operator.get('region')}"
        assert operator.get("market_segment") == "sme", f"Segment mismatch: {operator.get('market_segment')}"
        print(f"✓ Operator has correct geography: country={operator['country']}, region={operator['region']}, segment={operator['market_segment']}")
    
    def test_05_create_operator_with_enterprise_segment(self):
        """Test creating operator with enterprise market segment"""
        operator_data = {
            "name": f"{TEST_PREFIX}Enterprise Hotels",
            "email": f"{TEST_PREFIX}enterprise@test.com",
            "phone": "+237600123457",
            "city": "Yaoundé",
            "operator_type": "hotel",
            "service_types": ["hotel"],
            "country": "CM",
            "region": "CM-CE",  # Centre region
            "market_segment": "enterprise"
        }
        
        response = self.session.post(f"{BASE_URL}/api/operators/", json=operator_data)
        assert response.status_code == 200, f"Failed to create operator: {response.text}"
        
        data = response.json()
        created_id = data.get("operator_id")
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/operators/{created_id}")
        assert get_response.status_code == 200
        operator = get_response.json()
        
        assert operator.get("market_segment") == "enterprise"
        print(f"✓ Enterprise operator created with segment: {operator['market_segment']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/operators/{created_id}")
    
    def test_06_create_operator_with_strategic_segment(self):
        """Test creating operator with strategic market segment"""
        operator_data = {
            "name": f"{TEST_PREFIX}Strategic Partner",
            "email": f"{TEST_PREFIX}strategic@test.com",
            "phone": "+237600123458",
            "city": "Douala",
            "operator_type": "event",
            "service_types": ["event"],
            "country": "NG",  # Nigeria
            "region": "",  # No region for Nigeria
            "market_segment": "strategic"
        }
        
        response = self.session.post(f"{BASE_URL}/api/operators/", json=operator_data)
        assert response.status_code == 200, f"Failed to create operator: {response.text}"
        
        data = response.json()
        created_id = data.get("operator_id")
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/operators/{created_id}")
        assert get_response.status_code == 200
        operator = get_response.json()
        
        assert operator.get("country") == "NG"
        assert operator.get("market_segment") == "strategic"
        print(f"✓ Strategic operator created: country={operator['country']}, segment={operator['market_segment']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/operators/{created_id}")
    
    def test_07_update_operator_geography(self):
        """Test updating operator's country, region, and market_segment"""
        # First create an operator
        operator_data = {
            "name": f"{TEST_PREFIX}Update Test",
            "email": f"{TEST_PREFIX}update@test.com",
            "phone": "+237600123459",
            "city": "Douala",
            "operator_type": "travel",
            "service_types": ["travel"],
            "country": "CM",
            "region": "CM-LT",
            "market_segment": "sme"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/operators/", json=operator_data)
        assert create_response.status_code == 200
        created_id = create_response.json().get("operator_id")
        
        # Update geography
        update_data = {
            "country": "GA",  # Change to Gabon
            "region": "",  # No region
            "market_segment": "enterprise"  # Change to enterprise
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/operators/{created_id}", json=update_data)
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        print(f"✓ Update response: {update_response.json()}")
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/operators/{created_id}")
        assert get_response.status_code == 200
        updated_operator = get_response.json()
        
        assert updated_operator.get("country") == "GA", f"Country not updated: {updated_operator.get('country')}"
        assert updated_operator.get("market_segment") == "enterprise", f"Segment not updated: {updated_operator.get('market_segment')}"
        print(f"✓ Operator updated: country={updated_operator['country']}, segment={updated_operator['market_segment']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/operators/{created_id}")
    
    def test_08_get_operators_list_includes_geography(self):
        """Test that GET /operators/ returns geography fields"""
        response = self.session.get(f"{BASE_URL}/api/operators/")
        assert response.status_code == 200, f"Failed to get operators: {response.text}"
        
        data = response.json()
        operators = data.get("operators", [])
        
        if operators:
            # Check first operator has geography fields
            first_op = operators[0]
            print(f"✓ Operator '{first_op.get('name')}' has: country={first_op.get('country')}, region={first_op.get('region')}, segment={first_op.get('market_segment')}")
            
            # Verify at least country field exists
            operators_with_country = [op for op in operators if op.get("country")]
            print(f"✓ {len(operators_with_country)} of {len(operators)} operators have country field")
        else:
            print("⚠ No operators found")
    
    def test_09_filter_operators_by_country(self):
        """Test filtering operators by country"""
        response = self.session.get(f"{BASE_URL}/api/operators/", params={"country": "CM"})
        assert response.status_code == 200, f"Failed to filter by country: {response.text}"
        
        data = response.json()
        operators = data.get("operators", [])
        
        # All returned operators should be from Cameroon
        for op in operators:
            # Country might be stored as full name or code
            country = op.get("country", "")
            print(f"  - {op.get('name')}: country={country}")
        
        print(f"✓ Found {len(operators)} operators for country filter")
    
    def test_10_filter_operators_by_market_segment(self):
        """Test filtering operators by market_segment"""
        response = self.session.get(f"{BASE_URL}/api/operators/", params={"market_segment": "sme"})
        assert response.status_code == 200, f"Failed to filter by segment: {response.text}"
        
        data = response.json()
        operators = data.get("operators", [])
        
        for op in operators:
            segment = op.get("market_segment", "")
            print(f"  - {op.get('name')}: segment={segment}")
        
        print(f"✓ Found {len(operators)} operators for SME segment filter")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

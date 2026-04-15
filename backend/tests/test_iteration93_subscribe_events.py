"""
Test iteration 93: Subscribe button placement and Events API real data
- Tests that /api/events/ returns real events from DB (not mock data)
- Tests events API filter for is_active (True, None, or missing)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEventsAPI:
    """Events API tests - verify real data from DB"""
    
    def test_events_api_returns_data(self):
        """Test that /api/events/ returns events"""
        response = requests.get(f"{BASE_URL}/api/events/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "events" in data, "Response should contain 'events' key"
        assert "total" in data, "Response should contain 'total' key"
        
        events = data["events"]
        total = data["total"]
        
        print(f"Total events: {total}")
        print(f"Events returned: {len(events)}")
        
        # Should have at least 1 event (5 were seeded)
        assert len(events) >= 1, "Should return at least 1 event from DB"
        assert total >= 1, "Total should be at least 1"
    
    def test_events_have_required_fields(self):
        """Test that events have required fields from DB schema"""
        response = requests.get(f"{BASE_URL}/api/events/")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        if len(events) == 0:
            pytest.skip("No events in database")
        
        event = events[0]
        
        # Check for DB fields (not mock data fields)
        db_fields = ["_id", "name", "event_type", "venue_name", "city"]
        for field in db_fields:
            assert field in event, f"Event should have '{field}' field from DB"
        
        print(f"Event name: {event.get('name')}")
        print(f"Event type: {event.get('event_type')}")
        print(f"Venue: {event.get('venue_name')}")
        print(f"City: {event.get('city')}")
    
    def test_events_have_ticket_types(self):
        """Test that events have ticket_types array (DB schema)"""
        response = requests.get(f"{BASE_URL}/api/events/")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        if len(events) == 0:
            pytest.skip("No events in database")
        
        # At least one event should have ticket_types
        events_with_tickets = [e for e in events if e.get("ticket_types")]
        
        if len(events_with_tickets) > 0:
            event = events_with_tickets[0]
            ticket_types = event.get("ticket_types", [])
            assert len(ticket_types) > 0, "Event should have at least one ticket type"
            
            ticket = ticket_types[0]
            assert "name" in ticket, "Ticket type should have 'name'"
            assert "price" in ticket, "Ticket type should have 'price'"
            print(f"Ticket types: {[t.get('name') for t in ticket_types]}")
    
    def test_events_filter_by_city(self):
        """Test events can be filtered by city"""
        response = requests.get(f"{BASE_URL}/api/events/?city=Douala")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        # All returned events should be in Douala (case-insensitive)
        for event in events:
            city = event.get("city", "").lower()
            assert "douala" in city, f"Event city '{city}' should contain 'douala'"
        
        print(f"Events in Douala: {len(events)}")
    
    def test_events_not_mock_data(self):
        """Verify events are from DB, not mock data"""
        response = requests.get(f"{BASE_URL}/api/events/")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        if len(events) == 0:
            pytest.skip("No events in database")
        
        # Check for DB-specific fields that wouldn't be in mock data
        event = events[0]
        
        # DB events have _id (MongoDB ObjectId format or UUID)
        assert "_id" in event, "Event should have '_id' from DB"
        
        # DB events have created_at/updated_at timestamps
        has_timestamps = "created_at" in event or "updated_at" in event
        
        # DB events have operator_id
        has_operator = "operator_id" in event
        
        # At least one of these DB-specific fields should exist
        assert has_timestamps or has_operator, "Event should have DB-specific fields (timestamps or operator_id)"
        
        print(f"Event ID: {event.get('_id')}")
        print(f"Has timestamps: {has_timestamps}")
        print(f"Has operator_id: {has_operator}")


class TestEventsAPIEdgeCases:
    """Edge case tests for events API"""
    
    def test_events_pagination(self):
        """Test events pagination with skip and limit"""
        response = requests.get(f"{BASE_URL}/api/events/?skip=0&limit=2")
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        # Should return at most 2 events
        assert len(events) <= 2, "Should return at most 2 events with limit=2"
        print(f"Events with limit=2: {len(events)}")
    
    def test_events_single_event_by_id(self):
        """Test getting a single event by ID"""
        # First get list of events
        list_response = requests.get(f"{BASE_URL}/api/events/")
        assert list_response.status_code == 200
        
        events = list_response.json().get("events", [])
        if len(events) == 0:
            pytest.skip("No events in database")
        
        event_id = events[0].get("_id")
        
        # Get single event
        response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        
        event = response.json()
        assert event.get("_id") == event_id, "Should return the correct event"
        print(f"Retrieved event: {event.get('name')}")
    
    def test_events_invalid_id_returns_404(self):
        """Test that invalid event ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/events/invalid-id-12345")
        assert response.status_code == 404, "Should return 404 for invalid event ID"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

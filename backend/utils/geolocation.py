import ipapi
from typing import Optional, Dict

def get_country_from_ip(ip_address: str) -> Optional[str]:
    """Get country from IP address"""
    try:
        location = ipapi.location(ip_address)
        return location.get('country_code', None)
    except:
        return None

def get_location_data(ip_address: str) -> Dict:
    """Get full location data from IP address"""
    try:
        location = ipapi.location(ip_address)
        return {
            "country": location.get('country', None),
            "country_code": location.get('country_code', None),
            "city": location.get('city', None),
            "region": location.get('region', None),
            "timezone": location.get('timezone', None),
            "latitude": location.get('latitude', None),
            "longitude": location.get('longitude', None)
        }
    except:
        return {}
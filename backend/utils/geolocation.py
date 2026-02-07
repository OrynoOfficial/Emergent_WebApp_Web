import ipapi
from typing import Optional, Dict, List
from datetime import datetime

# African country codes (ISO 3166-1 alpha-2)
AFRICAN_COUNTRIES = {
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD",
    "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "KE",
    "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
    "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
    "EH", "ZM", "ZW"
}


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


def is_african_country(country_code: Optional[str]) -> bool:
    """Check if a country code is in Africa"""
    if not country_code:
        return False
    return country_code.upper() in AFRICAN_COUNTRIES


class CustomerLocationContext:
    """
    Customer location context for dynamic content filtering.
    
    Location Resolution Priority:
    1. GPS coordinates (if provided by frontend)
    2. IP geolocation
    3. SIM/phone country
    4. Country from user profile (registration)
    5. Manual override (if allowed)
    
    Visibility Rules:
    - If user is IN Africa: Show only operators in user's current country
    - If user is OUTSIDE Africa: Show all operators globally
    """
    
    def __init__(
        self,
        gps_lat: Optional[float] = None,
        gps_lng: Optional[float] = None,
        ip_address: Optional[str] = None,
        sim_country: Optional[str] = None,
        profile_country: Optional[str] = None,
        manual_override: Optional[str] = None
    ):
        self.gps_lat = gps_lat
        self.gps_lng = gps_lng
        self.ip_address = ip_address
        self.sim_country = sim_country
        self.profile_country = profile_country
        self.manual_override = manual_override
        
        # Resolved location
        self._resolved_country: Optional[str] = None
        self._resolved_city: Optional[str] = None
        self._resolution_method: Optional[str] = None
        self._is_in_africa: bool = False
        self._resolved_at: Optional[datetime] = None
    
    def resolve(self) -> "CustomerLocationContext":
        """
        Resolve the customer's current location using priority-based fallback.
        """
        self._resolved_at = datetime.utcnow()
        
        # Priority 1: Manual override (highest priority if allowed)
        if self.manual_override:
            self._resolved_country = self.manual_override.upper()
            self._resolution_method = "manual_override"
        
        # Priority 2: GPS (requires reverse geocoding - simplified to IP fallback)
        elif self.gps_lat and self.gps_lng:
            # In production, use reverse geocoding API here
            # For now, fall through to IP
            if self.ip_address:
                ip_data = get_location_data(self.ip_address)
                self._resolved_country = ip_data.get("country_code")
                self._resolved_city = ip_data.get("city")
                self._resolution_method = "gps_with_ip_fallback"
        
        # Priority 3: IP geolocation
        elif self.ip_address:
            ip_data = get_location_data(self.ip_address)
            self._resolved_country = ip_data.get("country_code")
            self._resolved_city = ip_data.get("city")
            self._resolution_method = "ip_geolocation"
        
        # Priority 4: SIM/phone country
        elif self.sim_country:
            self._resolved_country = self.sim_country.upper()
            self._resolution_method = "sim_country"
        
        # Priority 5: Profile country (registration)
        elif self.profile_country:
            self._resolved_country = self.profile_country.upper()
            self._resolution_method = "profile_country"
        
        # Update Africa status
        self._is_in_africa = is_african_country(self._resolved_country)
        
        return self
    
    @property
    def resolved_country(self) -> Optional[str]:
        return self._resolved_country
    
    @property
    def resolved_city(self) -> Optional[str]:
        return self._resolved_city
    
    @property
    def is_in_africa(self) -> bool:
        return self._is_in_africa
    
    @property
    def resolution_method(self) -> Optional[str]:
        return self._resolution_method
    
    def get_operator_filter(self) -> Dict:
        """
        Returns a MongoDB filter for operators based on visibility rules.
        
        - If in Africa: Filter to user's current country
        - If outside Africa: No filter (show all)
        """
        if not self._resolved_country:
            # No location resolved - show all (permissive default)
            return {}
        
        if self._is_in_africa:
            # In Africa: Show only operators in user's country
            return {"country": self._resolved_country}
        else:
            # Outside Africa: Show all operators globally
            return {}
    
    def to_dict(self) -> Dict:
        """Serialize location context for API response"""
        return {
            "resolved_country": self._resolved_country,
            "resolved_city": self._resolved_city,
            "is_in_africa": self._is_in_africa,
            "resolution_method": self._resolution_method,
            "resolved_at": self._resolved_at.isoformat() if self._resolved_at else None,
            "visibility_scope": "country" if self._is_in_africa else "global"
        }


def resolve_customer_location(
    request_ip: str,
    user: Optional[Dict] = None,
    gps_lat: Optional[float] = None,
    gps_lng: Optional[float] = None,
    manual_country: Optional[str] = None
) -> CustomerLocationContext:
    """
    Helper function to resolve customer location from request context.
    """
    context = CustomerLocationContext(
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        ip_address=request_ip,
        sim_country=user.get("phone_country_code") if user else None,
        profile_country=user.get("country") if user else None,
        manual_override=manual_country
    )
    return context.resolve()
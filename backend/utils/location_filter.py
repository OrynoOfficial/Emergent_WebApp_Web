"""
Location-Based Filtering Utility
Applies customer location context to service queries
"""
from typing import Optional, Dict
from utils.geolocation import is_african_country


def get_customer_location_filter(
    country_code: Optional[str] = None,
    city: Optional[str] = None,
    is_customer: bool = False
) -> Dict:
    """
    Build MongoDB filter based on customer's location.
    
    Rules:
    - If customer is IN Africa (has African country code): Filter to that country
    - If customer is OUTSIDE Africa: No filter (show all globally)
    - If no location provided: No filter (show all)
    - Non-customers (admins/operators): No location filter applied
    
    Args:
        country_code: ISO 3166-1 alpha-2 country code (e.g., "CM")
        city: City name (optional, for more precise filtering)
        is_customer: Whether the user is a customer role
    
    Returns:
        MongoDB query filter dict
    """
    if not is_customer:
        return {}
    
    if not country_code:
        return {}
    
    # Check if customer is in Africa
    if is_african_country(country_code):
        # In Africa: Filter to customer's country
        filter_query = {"country": {"$regex": f"^{country_code}$", "$options": "i"}}
        
        # Optionally add city filter if provided
        if city:
            # Don't make city filter too strict - customer might want to see nearby cities too
            pass
        
        return filter_query
    else:
        # Outside Africa: Show all (global view)
        return {}


def apply_location_filter_to_query(
    base_query: Dict,
    country_code: Optional[str] = None,
    city: Optional[str] = None,
    is_customer: bool = False,
    location_field: str = "country"
) -> Dict:
    """
    Apply location filter to an existing query.
    
    Args:
        base_query: Existing MongoDB query dict
        country_code: Customer's country code
        city: Customer's city
        is_customer: Whether user is a customer
        location_field: Field name to filter on (default: "country")
    
    Returns:
        Updated query with location filter applied
    """
    location_filter = get_customer_location_filter(country_code, city, is_customer)
    
    if not location_filter:
        return base_query
    
    # Merge filters
    if base_query and location_filter:
        # If base_query already has $and, append
        if "$and" in base_query:
            base_query["$and"].append(location_filter)
        else:
            # Combine with $and
            return {"$and": [base_query, location_filter]}
    
    return {**base_query, **location_filter}


def get_location_from_request(
    request_country: Optional[str] = None,
    user: Optional[Dict] = None
) -> tuple:
    """
    Extract location info from request params or user profile.
    
    Returns:
        Tuple of (country_code, city, is_customer)
    """
    is_customer = user.get("role") == "customer" if user else False
    
    # Priority: Request param > User profile
    country_code = request_country
    city = None
    
    if not country_code and user:
        country_code = user.get("country")
        city = user.get("city")
    
    return country_code, city, is_customer

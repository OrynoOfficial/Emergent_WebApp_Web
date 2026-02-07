"""
Location-Based Filtering Utility
Applies customer location context to service queries.

Services with `country` field: hotels, events, restaurants → filter directly.
Services without `country` field: car_rental, cinema, pressing, banquets, packages, travel → filter via operator lookup.
"""
from typing import Optional, Dict
from utils.geolocation import is_african_country


def get_country_filter(country_code: Optional[str]) -> Dict:
    """
    Build a direct country filter for services that have a `country` field.
    Only filters if the country is in Africa; otherwise returns empty (global view).
    """
    if not country_code:
        return {}
    if is_african_country(country_code):
        return {"country": {"$regex": f"^{country_code}$", "$options": "i"}}
    return {}


async def get_operator_ids_for_country(db, country_code: str) -> list:
    """Get operator _ids whose country matches the given code."""
    operators = await db.operators.find(
        {"country": {"$regex": f"^{country_code}$", "$options": "i"}, "status": "active"},
        {"_id": 1}
    ).to_list(1000)
    return [op["_id"] for op in operators]


async def get_operator_country_filter(db, country_code: Optional[str]) -> Dict:
    """
    Build an operator_id filter for services that lack a `country` field.
    Finds operators in the given country and returns {"operator_id": {"$in": [...]}}
    Only filters if the country is in Africa.
    """
    if not country_code or not is_african_country(country_code):
        return {}
    op_ids = await get_operator_ids_for_country(db, country_code)
    if op_ids:
        return {"operator_id": {"$in": op_ids}}
    return {"operator_id": "__no_match__"}

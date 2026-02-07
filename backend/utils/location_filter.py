"""
Location-Based Filtering Utility
Applies customer location context to service queries.

Services with `country` field: hotels, events, restaurants - filter directly.
Services without `country` field: car_rental, cinema, pressing, banquets, packages, travel - filter via operator lookup.
"""
from typing import Optional, Dict
from utils.geolocation import is_african_country
import re


async def _resolve_country_name(db, country_code: str) -> str:
    """Look up the full country name from the countries collection."""
    country = await db.countries.find_one(
        {"code": country_code.upper()},
        {"_id": 0, "name": 1}
    )
    return country["name"] if country else country_code


async def get_country_filter(db, country_code: Optional[str]) -> Dict:
    """
    Build a direct country filter for services that have a `country` field.
    Matches both ISO code (CM) and full name (Cameroon).
    Only filters if the country is in Africa; otherwise returns empty (global view).
    """
    if not country_code or not is_african_country(country_code):
        return {}
    code = country_code.strip().upper()
    name = await _resolve_country_name(db, code)
    escaped_name = re.escape(name)
    return {"country": {"$regex": f"^({code}|{escaped_name})$", "$options": "i"}}


async def get_operator_ids_for_country(db, country_code: str) -> list:
    """Get operator _ids whose country matches the given code or name."""
    code = country_code.strip().upper()
    name = await _resolve_country_name(db, code)
    escaped_name = re.escape(name)
    operators = await db.operators.find(
        {
            "country": {"$regex": f"^({code}|{escaped_name})$", "$options": "i"},
            "status": "active"
        },
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

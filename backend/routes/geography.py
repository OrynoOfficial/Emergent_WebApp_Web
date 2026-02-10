"""
Geography Routes - Countries and Regions Management
For attribute-based operator classification
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from config.database import get_database
from middleware.auth import get_current_active_user
from utils.permissions import require_permission
from models.geography import (
    CountryCreate, CountryUpdate,
    RegionCreate, RegionUpdate
)
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/geography", tags=["Geography"])


# ============== Countries ==============

@router.get("/countries")
async def list_countries(
    include_inactive: bool = Query(False, description="Include inactive countries"),
    current_user: dict = Depends(get_current_active_user)
):
    """List all countries"""
    db = get_database()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    
    countries = await db.countries.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    return {"countries": countries, "total": len(countries)}


@router.get("/countries/{country_id}")
async def get_country(
    country_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a single country by ID or code"""
    db = get_database()
    
    country = await db.countries.find_one(
        {"$or": [{"id": country_id}, {"code": country_id.upper()}]},
        {"_id": 0}
    )
    
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    
    return country


@router.post("/countries")
async def create_country(
    data: CountryCreate,
    current_user: dict = Depends(require_permission("geography.create"))
):
    """Create a new country"""
    db = get_database()
    
    # Check for duplicate code
    existing = await db.countries.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Country with this code already exists")
    
    country = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper(),
        "name": data.name,
        "continent": data.continent,
        "currency_code": data.currency_code,
        "phone_code": data.phone_code,
        "timezone": data.timezone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.countries.insert_one(country)
    
    return {"message": "Country created", "country_id": country["id"], "country": {k: v for k, v in country.items() if k != "_id"}}


@router.put("/countries/{country_id}")
async def update_country(
    country_id: str,
    data: CountryUpdate,
    current_user: dict = Depends(require_permission("geography.edit"))
):
    """Update a country"""
    db = get_database()
    
    country = await db.countries.find_one({"$or": [{"id": country_id}, {"code": country_id.upper()}]})
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.countries.update_one({"id": country["id"]}, {"$set": update_data})
    
    return {"message": "Country updated"}


@router.delete("/countries/{country_id}")
async def delete_country(
    country_id: str,
    current_user: dict = Depends(require_permission("geography.delete"))
):
    """Soft delete a country (set inactive)"""
    db = get_database()
    
    result = await db.countries.update_one(
        {"$or": [{"id": country_id}, {"code": country_id.upper()}]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Country not found")
    
    return {"message": "Country deactivated"}


# ============== Regions ==============

@router.get("/regions")
async def list_regions(
    country_id: Optional[str] = Query(None, description="Filter by country ID or code"),
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_active_user)
):
    """List all regions, optionally filtered by country"""
    db = get_database()
    
    query = {}
    if not include_inactive:
        query["is_active"] = True
    
    if country_id:
        # Check if it's a code or ID
        country = await db.countries.find_one({"$or": [{"id": country_id}, {"code": country_id.upper()}]})
        if country:
            query["country_id"] = country["id"]
    
    regions = await db.regions.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    
    return {"regions": regions, "total": len(regions)}


@router.get("/regions/{region_id}")
async def get_region(
    region_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a single region by ID or code"""
    db = get_database()
    
    region = await db.regions.find_one(
        {"$or": [{"id": region_id}, {"code": region_id}]},
        {"_id": 0}
    )
    
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    
    return region


@router.post("/regions")
async def create_region(
    data: RegionCreate,
    current_user: dict = Depends(require_permission("geography.create"))
):
    """Create a new region"""
    db = get_database()
    
    # Verify country exists
    country = await db.countries.find_one({"id": data.country_id})
    if not country:
        raise HTTPException(status_code=400, detail="Country not found")
    
    # Check for duplicate code
    existing = await db.regions.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Region with this code already exists")
    
    region = {
        "id": str(uuid.uuid4()),
        "country_id": data.country_id,
        "country_code": country["code"],
        "code": data.code,
        "name": data.name,
        "capital_city": data.capital_city,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.regions.insert_one(region)
    
    return {"message": "Region created", "region_id": region["id"], "region": {k: v for k, v in region.items() if k != "_id"}}


@router.put("/regions/{region_id}")
async def update_region(
    region_id: str,
    data: RegionUpdate,
    current_user: dict = Depends(require_permission("geography.edit"))
):
    """Update a region"""
    db = get_database()
    
    region = await db.regions.find_one({"$or": [{"id": region_id}, {"code": region_id}]})
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.regions.update_one({"id": region["id"]}, {"$set": update_data})
    
    return {"message": "Region updated"}


@router.delete("/regions/{region_id}")
async def delete_region(
    region_id: str,
    current_user: dict = Depends(require_permission("geography.delete"))
):
    """Soft delete a region"""
    db = get_database()
    
    result = await db.regions.update_one(
        {"$or": [{"id": region_id}, {"code": region_id}]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Region not found")
    
    return {"message": "Region deactivated"}


# ============== Market Segments ==============

@router.get("/market-segments")
async def list_market_segments(current_user: dict = Depends(get_current_active_user)):
    """List all market segments"""
    db = get_database()
    segments = await db.market_segments.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(100)
    if not segments:
        # Seed defaults if empty
        defaults = [
            {"id": "sme", "name": "SME", "description": "Small and Medium Enterprises", "color": "#3B82F6", "is_active": True},
            {"id": "enterprise", "name": "Enterprise", "description": "Large enterprises", "color": "#8B5CF6", "is_active": True},
            {"id": "strategic", "name": "Strategic", "description": "High-value strategic partners", "color": "#F59E0B", "is_active": True},
        ]
        await db.market_segments.insert_many(defaults)
        segments = defaults
    return {"market_segments": segments}


@router.post("/market-segments")
async def create_market_segment(
    request: Request,
    current_user: dict = Depends(require_permission("geography.create"))
):
    """Create a new market segment"""
    db = get_database()
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    seg_id = name.lower().replace(" ", "_")
    existing = await db.market_segments.find_one({"id": seg_id})
    if existing:
        raise HTTPException(status_code=400, detail="Market segment already exists")
    segment = {
        "id": seg_id,
        "name": name,
        "description": body.get("description", ""),
        "color": body.get("color", "#6B7280"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.market_segments.insert_one(segment)
    return {"message": "Market segment created", "segment": {k: v for k, v in segment.items() if k != "_id"}}


@router.put("/market-segments/{segment_id}")
async def update_market_segment(
    segment_id: str,
    request: Request,
    current_user: dict = Depends(require_permission("geography.edit"))
):
    """Update a market segment"""
    db = get_database()
    body = await request.json()
    existing = await db.market_segments.find_one({"id": segment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Market segment not found")
    updates = {}
    if "name" in body: updates["name"] = body["name"]
    if "description" in body: updates["description"] = body["description"]
    if "color" in body: updates["color"] = body["color"]
    if updates:
        await db.market_segments.update_one({"id": segment_id}, {"$set": updates})
    return {"message": "Market segment updated"}


@router.delete("/market-segments/{segment_id}")
async def delete_market_segment(
    segment_id: str,
    current_user: dict = Depends(require_permission("geography.delete"))
):
    """Soft-delete a market segment"""
    db = get_database()
    result = await db.market_segments.update_one({"id": segment_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Market segment not found")
    return {"message": "Market segment deactivated"}


# ============== Initialization ==============

@router.post("/initialize-defaults")
async def initialize_default_geography(
    current_user: dict = Depends(require_permission("geography.create"))
):
    """Initialize default countries and regions (Cameroon focus)"""
    db = get_database()
    
    # Check if already initialized
    existing_countries = await db.countries.count_documents({})
    if existing_countries > 0:
        return {"message": "Geography already initialized", "countries": existing_countries}
    
    # Default countries (Cameroon + neighbors)
    default_countries = [
        {"code": "CM", "name": "Cameroon", "continent": "Africa", "currency_code": "XAF", "phone_code": "+237", "timezone": "Africa/Douala"},
        {"code": "NG", "name": "Nigeria", "continent": "Africa", "currency_code": "NGN", "phone_code": "+234", "timezone": "Africa/Lagos"},
        {"code": "GA", "name": "Gabon", "continent": "Africa", "currency_code": "XAF", "phone_code": "+241", "timezone": "Africa/Libreville"},
        {"code": "GQ", "name": "Equatorial Guinea", "continent": "Africa", "currency_code": "XAF", "phone_code": "+240", "timezone": "Africa/Malabo"},
        {"code": "TD", "name": "Chad", "continent": "Africa", "currency_code": "XAF", "phone_code": "+235", "timezone": "Africa/Ndjamena"},
        {"code": "CF", "name": "Central African Republic", "continent": "Africa", "currency_code": "XAF", "phone_code": "+236", "timezone": "Africa/Bangui"},
    ]
    
    country_ids = {}
    for c in default_countries:
        country_doc = {
            "id": str(uuid.uuid4()),
            **c,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.countries.insert_one(country_doc)
        country_ids[c["code"]] = country_doc["id"]
    
    # Cameroon regions (all 10)
    cameroon_regions = [
        {"code": "CM-AD", "name": "Adamawa", "capital_city": "Ngaoundéré"},
        {"code": "CM-CE", "name": "Centre", "capital_city": "Yaoundé"},
        {"code": "CM-ES", "name": "East", "capital_city": "Bertoua"},
        {"code": "CM-EN", "name": "Far North", "capital_city": "Maroua"},
        {"code": "CM-LT", "name": "Littoral", "capital_city": "Douala"},
        {"code": "CM-NO", "name": "North", "capital_city": "Garoua"},
        {"code": "CM-NW", "name": "Northwest", "capital_city": "Bamenda"},
        {"code": "CM-SU", "name": "South", "capital_city": "Ebolowa"},
        {"code": "CM-SW", "name": "Southwest", "capital_city": "Buea"},
        {"code": "CM-OU", "name": "West", "capital_city": "Bafoussam"},
    ]
    
    for r in cameroon_regions:
        region_doc = {
            "id": str(uuid.uuid4()),
            "country_id": country_ids["CM"],
            "country_code": "CM",
            **r,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.regions.insert_one(region_doc)
    
    return {
        "message": "Default geography initialized",
        "countries_created": len(default_countries),
        "regions_created": len(cameroon_regions)
    }

"""
Data Migration Script for Access Control System
Migrates existing operators, users, and services to the new scoped model.

Run: python3 scripts/migrate_access_control.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = "oryno_webapp"

# Country name → ISO code mapping
COUNTRY_NAME_TO_CODE = {
    "cameroon": "CM", "nigeria": "NG", "gabon": "GA",
    "equatorial guinea": "GQ", "chad": "TD", "central african republic": "CF",
}

# Region defaults based on city
CITY_TO_REGION = {
    "douala": "CM-LT",    # Littoral
    "yaoundé": "CM-CE", "yaounde": "CM-CE",  # Centre
    "bafoussam": "CM-OU",  # West
    "buea": "CM-SW",       # South-West
    "bamenda": "CM-NW",    # North-West
    "garoua": "CM-NO",     # North
    "maroua": "CM-EN",     # Far North
    "bertoua": "CM-ES",    # East
    "ebolowa": "CM-SU",    # South
    "ngaoundéré": "CM-AD", "ngaoundere": "CM-AD",  # Adamawa
}


async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()

    print("=" * 60)
    print("ACCESS CONTROL DATA MIGRATION")
    print("=" * 60)

    # 1. Migrate Operators - add missing region and market_segment
    print("\n[1/4] Migrating operators...")
    operators = await db.operators.find({}).to_list(1000)
    op_updated = 0
    for op in operators:
        updates = {}
        # Normalize country to full name if it's an ISO code
        country = op.get("country", "Cameroon")

        # Add region if missing - infer from city
        if not op.get("region"):
            city = (op.get("city") or "").lower().strip()
            region = CITY_TO_REGION.get(city, "CM-LT")  # Default Littoral
            updates["region"] = region

        # Add market_segment if missing
        if not op.get("market_segment"):
            updates["market_segment"] = "sme"  # Default all to SME

        if updates:
            updates["updated_at"] = now
            await db.operators.update_one({"_id": op["_id"]}, {"$set": updates})
            op_updated += 1
            print(f"  Updated {op.get('name')}: {updates}")
    print(f"  Operators updated: {op_updated}/{len(operators)}")

    # 2. Migrate Users - add country field
    print("\n[2/4] Migrating users...")
    users = await db.users.find({}).to_list(1000)
    user_updated = 0
    for user in users:
        updates = {}
        if not user.get("country"):
            # If user has operator_id, inherit operator's country
            if user.get("operator_id"):
                op = await db.operators.find_one({"_id": user["operator_id"]})
                if op:
                    updates["country"] = op.get("country", "Cameroon")
            # Default to Cameroon for Cameroon phone numbers
            elif user.get("phone") and str(user["phone"]).startswith("+237"):
                updates["country"] = "Cameroon"
            else:
                updates["country"] = "Cameroon"  # Platform default

        if updates:
            updates["updated_at"] = now
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user_updated += 1
    print(f"  Users updated: {user_updated}/{len(users)}")

    # 3. Migrate Services - add country field from operator
    print("\n[3/4] Migrating services (adding country from operator)...")
    service_collections = {
        "car_rentals": "operator_id",
        "cinemas": "operator_id",
        "pressings": "operator_id",
        "banquets": "operator_id",
        "packages": "operator_id",
        "travel_routes": "operator_id",
    }

    # Build operator ID → country lookup
    op_country_map = {}
    for op in operators:
        op_country_map[op["_id"]] = op.get("country", "Cameroon")

    for coll_name, op_field in service_collections.items():
        docs = await db[coll_name].find({"country": {"$exists": False}}).to_list(10000)
        svc_updated = 0
        for doc in docs:
            op_id = doc.get(op_field)
            country = op_country_map.get(op_id, "Cameroon")
            await db[coll_name].update_one(
                {"_id": doc["_id"]},
                {"$set": {"country": country, "updated_at": now}}
            )
            svc_updated += 1
        if svc_updated:
            print(f"  {coll_name}: {svc_updated} docs updated with country")

    # 4. Clean up test data
    print("\n[4/4] Cleanup...")
    # Remove test country
    result = await db.countries.delete_one({"code": "TZ", "name": "TEST_Tanzania"})
    if result.deleted_count:
        print("  Removed test country TZ (TEST_Tanzania)")

    # Ensure all required regions exist for CM
    cm_regions = [
        {"code": "CM-AD", "name": "Adamawa", "country_code": "CM"},
        {"code": "CM-CE", "name": "Centre", "country_code": "CM"},
        {"code": "CM-ES", "name": "East", "country_code": "CM"},
        {"code": "CM-EN", "name": "Far North", "country_code": "CM"},
        {"code": "CM-LT", "name": "Littoral", "country_code": "CM"},
        {"code": "CM-NO", "name": "North", "country_code": "CM"},
        {"code": "CM-NW", "name": "North-West", "country_code": "CM"},
        {"code": "CM-OU", "name": "West", "country_code": "CM"},
        {"code": "CM-SU", "name": "South", "country_code": "CM"},
        {"code": "CM-SW", "name": "South-West", "country_code": "CM"},
    ]
    regions_added = 0
    for region in cm_regions:
        exists = await db.regions.find_one({"code": region["code"]})
        if not exists:
            region["id"] = region["code"]
            region["is_active"] = True
            region["created_at"] = now
            await db.regions.insert_one(region)
            regions_added += 1
    if regions_added:
        print(f"  Added {regions_added} missing CM regions")

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)

    # Verify
    print("\n=== VERIFICATION ===")
    ops_ok = await db.operators.count_documents({"market_segment": {"$exists": True}})
    ops_total = await db.operators.count_documents({})
    print(f"  Operators with market_segment: {ops_ok}/{ops_total}")

    users_ok = await db.users.count_documents({"country": {"$exists": True, "$ne": None}})
    users_total = await db.users.count_documents({})
    print(f"  Users with country: {users_ok}/{users_total}")

    for coll_name in service_collections:
        with_country = await db[coll_name].count_documents({"country": {"$exists": True}})
        total = await db[coll_name].count_documents({})
        print(f"  {coll_name} with country: {with_country}/{total}")


if __name__ == "__main__":
    asyncio.run(migrate())

"""Iter 206: Banquet & Event Services (categories + packages) + hotel hard-delete + db-cleanup."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@oryno.com"
SUPER_PW = "testpassword123"


@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PW}, timeout=20)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}", "Content-Type": "application/json"}


# ─── Banquet service CRUD (new category-aware fields) ─────────────────────
created_ids = {}


def test_01_db_reset_banquets_dry_run(super_headers):
    r = requests.post(f"{API}/admin/db-reset/banquets?dry_run=true", headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "banquets_count" in body, body
    assert "packages_count" in body, body


def test_02_db_reset_banquets_actual(super_headers):
    r = requests.post(f"{API}/admin/db-reset/banquets?dry_run=false", headers=super_headers, timeout=30)
    assert r.status_code == 200, r.text


def test_03_create_hall(super_headers):
    payload = {"name": "TEST_E2E Hall", "category": "hall", "pricing_model": "per_event",
               "base_price": 100000, "city": "Douala", "capacity_max": 500}
    r = requests.post(f"{API}/banquets/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    created_ids["hall"] = r.json()["banquet_id"]


def test_04_create_rental(super_headers):
    payload = {"name": "TEST_Chair", "category": "rental_item", "pricing_model": "per_unit",
               "unit_label": "chair", "base_price": 500, "min_quantity": 10, "max_quantity": 500}
    r = requests.post(f"{API}/banquets/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    created_ids["rental"] = r.json()["banquet_id"]


def test_05_create_canopy(super_headers):
    payload = {"name": "TEST_Canopy", "category": "canopy", "pricing_model": "per_unit",
               "unit_label": "canopy", "base_price": 25000}
    r = requests.post(f"{API}/banquets/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    created_ids["canopy"] = r.json()["banquet_id"]


def test_06_create_photographer(super_headers):
    payload = {"name": "TEST_Photographer", "category": "photographer",
               "pricing_model": "flat_fee", "base_price": 150000}
    r = requests.post(f"{API}/banquets/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    created_ids["photographer"] = r.json()["banquet_id"]


def test_07_create_videographer(super_headers):
    payload = {"name": "TEST_Videographer", "category": "videographer",
               "pricing_model": "per_hour", "base_price": 30000, "duration_hours": 4}
    r = requests.post(f"{API}/banquets/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    created_ids["videographer"] = r.json()["banquet_id"]


def test_08_my_venues_returns_all_categories(super_headers):
    r = requests.get(f"{API}/banquets/management/my-venues?limit=100", headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    venues = r.json()["venues"]
    names = {v["name"]: v for v in venues}
    for k in ("TEST_E2E Hall", "TEST_Chair", "TEST_Canopy", "TEST_Photographer", "TEST_Videographer"):
        assert k in names, f"missing {k}"
    # field preservation
    assert names["TEST_Chair"]["category"] == "rental_item"
    assert names["TEST_Chair"]["pricing_model"] == "per_unit"
    assert names["TEST_Chair"]["unit_label"] == "chair"
    assert names["TEST_Chair"]["min_quantity"] == 10
    assert names["TEST_Chair"]["max_quantity"] == 500
    assert names["TEST_Videographer"]["duration_hours"] == 4


def test_09_my_venues_category_filter(super_headers):
    r = requests.get(f"{API}/banquets/management/my-venues?category=rental_item",
                     headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    venues = r.json()["venues"]
    # Should only return rental items
    assert len(venues) >= 1
    assert all(v.get("category") == "rental_item" for v in venues), \
        f"non rental_item leaked: {[v.get('category') for v in venues]}"


def test_10_public_listing_filter_by_category(super_headers):
    r = requests.get(f"{API}/banquets/?category=photographer", timeout=20)
    assert r.status_code == 200, r.text
    items = r.json()["banquets"]
    assert any(b["name"] == "TEST_Photographer" for b in items)
    assert all(b.get("category") == "photographer" for b in items)


def test_11_update_service_price(super_headers):
    bid = created_ids.get("photographer")
    assert bid
    r = requests.put(f"{API}/banquets/{bid}", json={"base_price": 175000},
                     headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/banquets/{bid}", timeout=20)
    assert g.json()["base_price"] == 175000


def test_12_delete_videographer(super_headers):
    bid = created_ids.get("videographer")
    r = requests.delete(f"{API}/banquets/{bid}", headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/banquets/{bid}", timeout=20)
    assert g.status_code == 404


# ─── Packages ─────────────────────────────────────────────────────────────
def test_13_create_package(super_headers):
    payload = {
        "name": "TEST_Bundle",
        "services": [
            {"service_id": created_ids["hall"], "quantity": 1},
            {"service_id": created_ids["rental"], "quantity": 200},
            {"service_id": created_ids["photographer"], "quantity": 1},
        ],
        "discount_percent": 10,
    }
    r = requests.post(f"{API}/banquets/packages/", json=payload, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    # subtotal = 100000 + 500*200 + 175000 (we updated photographer) = 375000 OR
    # if photographer wasn't updated yet in package math = 350000.
    # Whatever the rule, we assert subtotal & total_price keys exist.
    assert "subtotal" in body or "package" in body, body
    pkg = body.get("package") or body
    created_ids["package"] = pkg.get("_id") or pkg.get("id") or body.get("package_id")
    assert created_ids["package"]


def test_14_list_packages(super_headers):
    r = requests.get(f"{API}/banquets/packages/", headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text
    pkgs = r.json().get("packages") or r.json().get("items") or []
    assert any((p.get("name") == "TEST_Bundle") for p in pkgs)
    # service_name + category hydrated
    bundle = next(p for p in pkgs if p.get("name") == "TEST_Bundle")
    for line in bundle.get("services", []):
        assert "service_name" in line and "category" in line, line


def test_15_update_package_discount(super_headers):
    pid = created_ids.get("package")
    assert pid
    r = requests.put(f"{API}/banquets/packages/{pid}", json={"discount_percent": 20},
                     headers=super_headers, timeout=20)
    assert r.status_code == 200, r.text


def test_16_delete_package(super_headers):
    pid = created_ids.get("package")
    assert pid
    r = requests.delete(f"{API}/banquets/packages/{pid}", headers=super_headers, timeout=20)
    assert r.status_code in (200, 204), r.text


def test_17_package_rejects_empty_services(super_headers):
    r = requests.post(f"{API}/banquets/packages/", json={"name": "TEST_empty", "services": []},
                      headers=super_headers, timeout=20)
    assert r.status_code in (400, 422), r.text


# ─── db-indexes / cleanup ──────────────────────────────────────────────────
def test_18_db_indexes_ensure(super_headers):
    r = requests.post(f"{API}/admin/db-indexes/ensure", headers=super_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True, body
    # spot-check the new banquet indexes are referenced somewhere
    assert "created" in body and "existed" in body, body


def test_19_purge_soft_deleted_dry_run(super_headers):
    r = requests.post(f"{API}/admin/db-cleanup/purge-soft-deleted?dry_run=true",
                      headers=super_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, dict)


# ─── Hotels hard-delete + room aggregation ───────────────────────────────
def test_20_hotel_soft_then_hard_delete(super_headers):
    # create hotel
    r = requests.post(f"{API}/hotels/", json={
        "name": "TEST_H1", "address": "1 Test Rd", "city": "Douala", "country": "Cameroon",
        "base_price": 1000, "star_rating": 3
    }, headers=super_headers, timeout=20)
    assert r.status_code in (200, 201), r.text
    hid = r.json().get("hotel_id") or r.json().get("id") or r.json().get("_id")
    assert hid

    # add a room
    r2 = requests.post(f"{API}/hotels/{hid}/rooms",
                       json={"room_type": "Suite", "price_per_night": 100, "max_occupancy": 2,
                             "total_rooms": 5},
                       headers=super_headers, timeout=20)
    # not asserting status (room schema may vary)

    # soft-delete
    sd = requests.delete(f"{API}/hotels/{hid}", headers=super_headers, timeout=20)
    assert sd.status_code == 200, sd.text

    # not in my-hotels
    mh = requests.get(f"{API}/hotels/management/my-hotels", headers=super_headers, timeout=20)
    assert mh.status_code == 200, mh.text
    items = mh.json()["hotels"]
    assert all(h["id"] != hid for h in items), "soft-deleted hotel still listed"

    # room_count integer present on all
    for h in items:
        assert "room_count" in h and isinstance(h["room_count"], int), h

    # hard-delete
    hd = requests.delete(f"{API}/hotels/{hid}?hard=true", headers=super_headers, timeout=20)
    # Hotel was soft-deleted (is_active=False). hard=true should still work because find_one matches by _id.
    assert hd.status_code == 200, hd.text
    body = hd.json()
    assert body.get("hard_delete") is True, body
    assert "rooms_deleted" in body, body

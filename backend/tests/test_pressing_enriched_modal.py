"""Tests for the enriched Pressing/Laundry shop CRUD + collection-mismatch fix.

Locks in:
  1. POST /api/pressing/ accepts the new schema (shop_type, item_prices, etc.)
     for a laundry-only, pressing-only and mixed shop.
  2. The freshly-created shop appears in GET /api/pressing/management/my-shops
     (previously broken: that endpoint read `db.laundry_shops` while POST wrote
     to `db.pressings`, so the list was always empty).
  3. _sanitize_pricing strips the irrelevant pricing slot on save:
       - shop_type='laundry' → item_prices forced to []
       - shop_type='pressing' → price_per_kg forced to None
  4. The legacy free-text `services: ["washing"]` shape is silently coerced
     (no more 422 validation errors against the old UI).
  5. GET /api/pressing/item-presets returns a non-empty list of pressing items.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://cinema-management-p0.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASS = "testpassword123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture
def cleanup_shops(admin_token):
    """Track every shop id created during the test so we can delete it afterwards."""
    created = []
    yield created
    for sid in created:
        try:
            requests.delete(f"{BASE_URL}/api/pressing/{sid}", headers=_h(admin_token), timeout=10)
        except Exception:
            pass


def test_item_presets_endpoint_returns_non_empty():
    r = requests.get(f"{BASE_URL}/api/pressing/item-presets", timeout=15)
    assert r.status_code == 200, r.text
    presets = r.json().get("presets")
    assert isinstance(presets, list) and len(presets) >= 8
    assert any("Shirt" in p for p in presets)
    assert any("Suit" in p for p in presets)


def test_create_laundry_only_shop_persists_kg_and_clears_items(admin_token, cleanup_shops):
    payload = {
        "name": f"Laundry-{uuid.uuid4().hex[:8]}",
        "address": "123 Main St",
        "city": "Douala",
        "shop_type": "laundry",
        "price_per_kg": 1500,
        # Stale item_prices that the server should strip out.
        "item_prices": [{"item": "Shirt", "price": 500}],
        "services": ["washing", "ironing"],
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["shop_type"] == "laundry"
    assert body["price_per_kg"] == 1500
    assert body["item_prices"] == []  # sanitised by backend
    assert set(body["services"]) == {"washing", "ironing"}


def test_create_pressing_only_shop_persists_items_and_clears_kg(admin_token, cleanup_shops):
    payload = {
        "name": f"Pressing-{uuid.uuid4().hex[:8]}",
        "address": "456 Test Rd",
        "city": "Yaoundé",
        "shop_type": "pressing",
        # Stale price_per_kg that the server should strip out.
        "price_per_kg": 999,
        "item_prices": [
            {"item": "Shirt", "price": 500},
            {"item": "Trousers", "price": 750},
            {"item": "Suit", "price": 2500},
        ],
        "services": ["dry_cleaning"],
        "turnaround_hours": 48,
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10)
    body = g.json()
    assert body["shop_type"] == "pressing"
    assert body["price_per_kg"] in (None, 0)
    items = {i["item"]: i["price"] for i in body["item_prices"]}
    assert items == {"Shirt": 500, "Trousers": 750, "Suit": 2500}
    assert body["turnaround_hours"] == 48


def test_create_both_shop_keeps_both_pricing_modes(admin_token, cleanup_shops):
    payload = {
        "name": f"Both-{uuid.uuid4().hex[:8]}",
        "address": "789 Test Blvd",
        "city": "Douala",
        "shop_type": "both",
        "price_per_kg": 1200,
        "item_prices": [{"item": "Shirt", "price": 500}],
        "delivery_available": True,
        "delivery_fee": 1000,
        "pickup_radius_km": 5,
        "accepts_momo": True,
        "accepts_card": True,
        "accepts_cash": False,
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10).json()
    assert g["shop_type"] == "both"
    assert g["price_per_kg"] == 1200
    assert len(g["item_prices"]) == 1 and g["item_prices"][0]["item"] == "Shirt"
    assert g["delivery_available"] is True
    assert g["accepts_card"] is True and g["accepts_cash"] is False


def test_my_shops_lists_freshly_created_shop(admin_token, cleanup_shops):
    """Locks in the collection-mismatch fix: shop POSTed to db.pressings must
    appear in GET /management/my-shops (which previously read db.laundry_shops
    and was always empty)."""
    unique_name = f"Visible-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/pressing/",
        json={
            "name": unique_name,
            "address": "1 Sanity Lane",
            "city": "Douala",
            "shop_type": "laundry",
            "price_per_kg": 1000,
        },
        headers=_h(admin_token),
        timeout=20,
    )
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    r = requests.get(f"{BASE_URL}/api/pressing/management/my-shops?search={unique_name}", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    shops = r.json().get("shops", [])
    assert any(s["id"] == sid for s in shops), \
        f"Newly-created shop {sid} not surfaced in /my-shops (collection mismatch is back?)"


def test_legacy_services_dict_payload_is_coerced(admin_token, cleanup_shops):
    """The old UI was sending `services: [{name:'washing'}, …]` — the validator
    must coerce these to plain string tags instead of returning 422."""
    payload = {
        "name": f"Legacy-{uuid.uuid4().hex[:8]}",
        "address": "Legacy 1",
        "city": "Douala",
        "shop_type": "laundry",
        "price_per_kg": 1500,
        "services": [{"name": "washing"}, {"type": "ironing"}, "folding"],
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)
    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10).json()
    assert set(g["services"]) == {"washing", "ironing", "folding"}


def test_update_flipping_shop_type_resets_irrelevant_pricing(admin_token, cleanup_shops):
    """Operator flips a laundry shop into pressing mode. After the PUT the
    backend should null out price_per_kg automatically (and vice-versa)."""
    payload = {
        "name": f"Flip-{uuid.uuid4().hex[:8]}",
        "address": "Flip 1",
        "city": "Douala",
        "shop_type": "laundry",
        "price_per_kg": 2000,
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    # Flip to pressing-only with item prices
    flip = requests.put(
        f"{BASE_URL}/api/pressing/{sid}",
        json={
            "shop_type": "pressing",
            "item_prices": [{"item": "Shirt", "price": 500}],
        },
        headers=_h(admin_token),
        timeout=15,
    )
    assert flip.status_code == 200, flip.text
    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10).json()
    assert g["shop_type"] == "pressing"
    assert g["price_per_kg"] in (None, 0)
    assert len(g["item_prices"]) == 1


def test_item_prices_persist_image_url(admin_token, cleanup_shops):
    """Each ItemPrice can now carry an optional image_url. The backend must
    persist it round-trip — this powers the per-item thumbnails in the
    Pressing menu gallery (View dialog + pre-booking modal)."""
    img = "/api/uploads/pressing-items/shirt-thumb.jpg"
    payload = {
        "name": f"Itemimg-{uuid.uuid4().hex[:8]}",
        "address": "1 Photo Av",
        "city": "Douala",
        "shop_type": "pressing",
        "item_prices": [
            {"item": "Shirt", "price": 500, "image_url": img},
            {"item": "Trousers", "price": 750},                 # no image
        ],
    }
    r = requests.post(f"{BASE_URL}/api/pressing/", json=payload, headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["shop_id"]
    cleanup_shops.append(sid)

    g = requests.get(f"{BASE_URL}/api/pressing/{sid}", timeout=10).json()
    items = {i["item"]: i for i in g["item_prices"]}
    assert items["Shirt"]["image_url"] == img
    assert items["Trousers"].get("image_url") in (None, "")

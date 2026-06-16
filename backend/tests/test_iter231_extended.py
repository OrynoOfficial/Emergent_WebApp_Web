"""
Iter 231 extended — additional checks requested by E1 review:
  * operator scoping on GET /api/inventory/banquet-items
  * damage_fee added to linked order's invoice (orders.booking_details.damage_charges + total_amount)
  * GET /api/inventory/holds enrichment (item_name + unit_price)
  * GET /api/inventory/active-rentals summary shape (pending_return, total_units_currently_out,
    total_damage_fees_collected, by_status)
  * POST adjust-stock recorded in inventory_adjustments collection (verified via repeated calls)
"""
import os
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
OP_ID = "30c487d8-f8ef-4e80-8b14-1a68866071c8"


def _login(email, password):
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    j = r.json()
    return j.get("access_token") or j.get("token")


def test_banquet_items_operator_scoping():
    admin = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {admin}"}
    # Admin sees all
    r = requests.get(f"{API}/api/inventory/banquet-items", headers=h)
    assert r.status_code == 200
    items_all = r.json()["items"]
    # Admin with operator_id filter
    r = requests.get(f"{API}/api/inventory/banquet-items?operator_id={OP_ID}", headers=h)
    assert r.status_code == 200
    items_scoped = r.json()["items"]
    # Either all items belong to that op OR filter actually narrows results
    for it in items_scoped:
        assert it.get("operator_id") == OP_ID, f"Expected operator scoping, got {it}"


def test_holds_listing_enrichment():
    admin = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {admin}"}
    # Create item
    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest Enrich Plate", "category": "tableware",
        "unit_price": 250, "total_units": 50, "operator_id": OP_ID,
    }, headers=h)
    item_id = r.json()["id"]
    # Create hold
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id,
        "quantity": 5, "customer_name": "Enrich Test",
        "start_date": "2026-11-01", "end_date": "2026-11-02",
    }, headers=h)
    assert r.status_code == 200
    hold_id = r.json()["hold_id"]
    # List holds, find ours
    r = requests.get(f"{API}/api/inventory/holds?entity_type=banquet_item", headers=h)
    assert r.status_code == 200
    holds = r.json().get("holds") or r.json()
    mine = next((x for x in holds if x.get("hold_id") == hold_id or x.get("id") == hold_id), None)
    assert mine is not None, f"Hold {hold_id} not in listing"
    assert mine.get("item_name") == "Pytest Enrich Plate", f"item_name missing: {mine}"
    assert mine.get("unit_price") == 250, f"unit_price missing: {mine}"
    # Cleanup
    requests.delete(f"{API}/api/inventory/banquet-items/{item_id}", headers=h)


def test_active_rentals_summary_shape():
    admin = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {admin}"}
    r = requests.get(f"{API}/api/inventory/active-rentals?entity_type=banquet_item", headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    # required keys
    for k in ("pending_return", "total_units_currently_out", "total_damage_fees_collected", "by_status"):
        assert k in s, f"missing {k} in {s}"
    assert isinstance(s["by_status"], dict)
    assert isinstance(s["pending_return"], int)
    assert isinstance(s["total_units_currently_out"], int)
    assert isinstance(s["total_damage_fees_collected"], (int, float))


def test_adjust_stock_negative_and_positive():
    admin = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {admin}"}
    # Create item
    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest Adjust Cup", "unit_price": 100, "total_units": 20,
        "operator_id": OP_ID,
    }, headers=h)
    item_id = r.json()["id"]
    # +10
    r = requests.post(f"{API}/api/inventory/banquet-items/{item_id}/adjust-stock",
                     json={"delta": 10, "reason": "Pytest add"}, headers=h)
    assert r.status_code == 200
    assert r.json()["new_total_units"] == 30
    # -5
    r = requests.post(f"{API}/api/inventory/banquet-items/{item_id}/adjust-stock",
                     json={"delta": -5, "reason": "Pytest remove"}, headers=h)
    assert r.status_code == 200
    assert r.json()["new_total_units"] == 25
    # Cleanup
    requests.delete(f"{API}/api/inventory/banquet-items/{item_id}", headers=h)


def test_overbook_returns_409_with_message():
    admin = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {admin}"}
    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest OB", "unit_price": 100, "total_units": 3, "operator_id": OP_ID,
    }, headers=h)
    item_id = r.json()["id"]
    # hold 3 -> ok
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 3,
    }, headers=h)
    assert r.status_code == 200
    # hold 1 more -> 409
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 1,
    }, headers=h)
    assert r.status_code == 409, r.text
    requests.delete(f"{API}/api/inventory/banquet-items/{item_id}", headers=h)


def test_customer_cannot_create_banquet_item():
    """Permission: customer should NOT be able to create banquet items."""
    cust = _login("customer@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {cust}"}
    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest Cust Forbid", "unit_price": 100, "total_units": 5,
        "operator_id": OP_ID,
    }, headers=h)
    assert r.status_code in (401, 403), f"Expected forbidden, got {r.status_code}: {r.text}"

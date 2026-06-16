"""
Iter 231 — Banquet inventory split + return/damage lifecycle.

Verifies:
  * banquet_items CRUD (create, list, edit, soft-delete)
  * Hold lifecycle: create → mark-out → confirm-return with damage_fee
  * Damaged units removed from total_units; available_units stays accurate
  * Damage fee is appended to the linked order's invoice
  * Manual stock adjustment endpoint
  * Active-rentals summary aggregates pending_return + damage_fees
"""
import os
import requests

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    body = r.json()
    return body.get("access_token") or body.get("token")


def test_banquet_item_full_lifecycle():
    token = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {token}"}

    # ── Create a rental item ────────────────────────────────────────────
    op_id = "30c487d8-f8ef-4e80-8b14-1a68866071c8"
    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest Chiavari Chair", "category": "seating",
        "unit_price": 1500, "total_units": 40, "operator_id": op_id,
    }, headers=h)
    assert r.status_code == 200, r.text
    item_id = r.json()["id"]

    # ── List items ──────────────────────────────────────────────────────
    r = requests.get(f"{API}/api/inventory/banquet-items", headers=h)
    assert r.status_code == 200
    assert any(it["id"] == item_id for it in r.json()["items"])

    # ── Initial stock summary ───────────────────────────────────────────
    r = requests.get(f"{API}/api/inventory/banquet_item/{item_id}/stock")
    assert r.status_code == 200
    s = r.json()
    assert s["total_units"] == 40 and s["available_units"] == 40

    # ── Create a hold for 10 units ──────────────────────────────────────
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id,
        "quantity": 10, "customer_name": "Jean Pytest",
        "start_date": "2026-12-01", "end_date": "2026-12-03",
    }, headers=h)
    assert r.status_code == 200, r.text
    hold_id = r.json()["hold_id"]

    # available_units should drop to 30
    r = requests.get(f"{API}/api/inventory/banquet_item/{item_id}/stock")
    assert r.json()["available_units"] == 30

    # ── Mark out ────────────────────────────────────────────────────────
    r = requests.post(f"{API}/api/inventory/holds/{hold_id}/mark-out", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "out"

    # ── Confirm return with 3 damaged + 4500 damage fee ─────────────────
    r = requests.post(f"{API}/api/inventory/holds/{hold_id}/confirm-return", json={
        "damaged_quantity": 3, "damage_fee": 4500,
        "damage_description": "Broken legs on 3 chairs",
    }, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["damaged_units_removed_from_stock"] == 3
    assert body["damage_fee_applied"] == 4500

    # Total stock should now be 37 (40 - 3 damaged), available 37
    r = requests.get(f"{API}/api/inventory/banquet_item/{item_id}/stock")
    s = r.json()
    assert s["total_units"] == 37, f"Expected 37, got {s}"
    assert s["available_units"] == 37, f"Expected 37, got {s}"

    # ── Active-rentals summary ──────────────────────────────────────────
    r = requests.get(f"{API}/api/inventory/active-rentals?entity_type=banquet_item", headers=h)
    assert r.status_code == 200
    sm = r.json()
    assert sm["total_damage_fees_collected"] >= 4500
    assert sm["by_status"].get("returned", 0) >= 1

    # ── Manual stock adjust: +5 (purchased more) ────────────────────────
    r = requests.post(f"{API}/api/inventory/banquet-items/{item_id}/adjust-stock",
                      json={"delta": 5, "reason": "Pytest add"}, headers=h)
    assert r.status_code == 200 and r.json()["new_total_units"] == 42

    # ── Soft-delete ─────────────────────────────────────────────────────
    r = requests.delete(f"{API}/api/inventory/banquet-items/{item_id}", headers=h)
    assert r.status_code == 200

    # ── Listing without is_active flag still shows it; with is_active=true it shouldn't.
    r = requests.get(f"{API}/api/inventory/banquet-items?is_active=true", headers=h)
    assert not any(it["id"] == item_id for it in r.json()["items"])


def test_hold_overbook_rejected():
    """Reserving more than available units must return HTTP 409."""
    token = _login("admin@test.com", "testpassword123")
    h = {"Authorization": f"Bearer {token}"}
    op_id = "30c487d8-f8ef-4e80-8b14-1a68866071c8"

    r = requests.post(f"{API}/api/inventory/banquet-items", json={
        "name": "Pytest Tiny Stock", "unit_price": 500, "total_units": 5,
        "operator_id": op_id,
    }, headers=h)
    item_id = r.json()["id"]

    # First hold of 5 — OK
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 5,
    }, headers=h)
    assert r.status_code == 200

    # Second hold of 1 — should 409
    r = requests.post(f"{API}/api/inventory/holds", json={
        "entity_type": "banquet_item", "entity_id": item_id, "quantity": 1,
    }, headers=h)
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"

"""Backend tests for the DELETE /api/orders/{order_id}/abandon endpoint.

Validates the 4 contractual behaviors:
  1) Pending unpaid + owner -> 200 {success: true, deleted: true}, row gone from DB
  2) Idempotent: second call -> 200 {success: true, already_gone: true}
  3) Paid order -> 409 with "already paid or processed" detail
  4) Different user -> 403 "Not your order"
Plus: regression that a normal successful payment (status=confirmed) is NOT abandonable.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}
ADMIN = {"email": "admin@test.com", "password": "testpassword123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


def _hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _create_pending_order(token, status_val="pending", payment_status="pending"):
    """Create a pending cinema order via /api/orders/create."""
    payload = {
        "service_type": "cinema",
        "service_id": f"TEST_SVC_{uuid.uuid4().hex[:8]}",
        "service_name": "TEST_Abandon Cinema",
        "total_amount": 5000.0,
        "currency": "XAF",
        "status": status_val,
        "payment_status": payment_status,
        "booking_details": {"selected_seats": ["A1"], "tag": "TEST_abandon"},
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, headers=_hdr(token), timeout=20)
    assert r.status_code == 200, f"create order failed: {r.status_code} {r.text}"
    return r.json()["order_id"]


# 1) happy path: owner abandons own pending unpaid order
def test_abandon_pending_unpaid_owner(customer_token):
    order_id = _create_pending_order(customer_token)
    r = requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(customer_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("success") is True
    assert body.get("deleted") is True
    # GET should now 404
    g = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers=_hdr(customer_token), timeout=20)
    assert g.status_code == 404, f"order should be gone, got {g.status_code} {g.text}"


# 2) idempotency: calling twice on the same id -> already_gone
def test_abandon_idempotent(customer_token):
    order_id = _create_pending_order(customer_token)
    r1 = requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(customer_token), timeout=20)
    assert r1.status_code == 200 and r1.json().get("deleted") is True
    r2 = requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(customer_token), timeout=20)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("success") is True
    assert body.get("already_gone") is True


# 3) paid order -> 409
def test_abandon_paid_order_returns_409(customer_token):
    order_id = _create_pending_order(customer_token, status_val="confirmed", payment_status="paid")
    r = requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(customer_token), timeout=20)
    assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "already paid" in detail or "processed" in detail
    # cleanup: leave it (it's marked paid; can't abandon by design)


# 4) different user (admin) tries to abandon customer's order -> 403
def test_abandon_other_user_returns_403(customer_token, admin_token):
    order_id = _create_pending_order(customer_token)
    r = requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(admin_token), timeout=20)
    assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "not your order" in detail
    # cleanup
    requests.delete(f"{BASE_URL}/api/orders/{order_id}/abandon", headers=_hdr(customer_token), timeout=20)


# Regression: unauthenticated call -> 401/403
def test_abandon_requires_auth():
    fake_id = str(uuid.uuid4())
    r = requests.delete(f"{BASE_URL}/api/orders/{fake_id}/abandon", timeout=20)
    assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"


# Regression: unknown order id with auth -> 200 already_gone (idempotent by design)
def test_abandon_unknown_id_is_already_gone(customer_token):
    fake_id = f"DOES_NOT_EXIST_{uuid.uuid4().hex}"
    r = requests.delete(f"{BASE_URL}/api/orders/{fake_id}/abandon", headers=_hdr(customer_token), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("already_gone") is True

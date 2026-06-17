"""
Tests for the super-admin-only system cleanup endpoint.
"""
import os
import pytest
import httpx

API = os.environ.get("PUBLIC_API", "http://localhost:8001")


def _login(email: str, password: str) -> str:
    r = httpx.post(f"{API}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]


def test_cleanup_preview_requires_super_admin():
    """Regular admin gets 403 on the preview endpoint."""
    token = _login("admin@test.com", "testpassword123")
    r = httpx.get(f"{API}/api/admin/ops/cleanup/preview",
                  headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 403, r.text


def test_cleanup_preview_super_admin_returns_stats():
    """Super-admin gets a dry-run summary with the expected shape."""
    token = _login("superadmin@oryno.com", "testpassword123")
    r = httpx.get(f"{API}/api/admin/ops/cleanup/preview",
                  headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "dry_run"
    assert "admin@test.com" in body["protected_emails"]
    assert "superadmin@oryno.com" in body["protected_emails"]
    stats = body["stats"]
    # Required scan keys are always present even when zero.
    for k in ("users_matched", "orders_matched", "showtimes_matched", "locations_matched"):
        assert k in stats, f"missing scan key: {k}"


def test_cleanup_unauthenticated_blocked():
    r = httpx.get(f"{API}/api/admin/ops/cleanup/preview", timeout=10)
    assert r.status_code in (401, 403)

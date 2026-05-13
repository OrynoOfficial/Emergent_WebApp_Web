"""
Iteration 144 — Packages module image enhancements.

Covers:
  1. POST /api/package-services/ with images=[...] by super_admin → status=active,
     GET /{id} returns the same images.
  2. GET /api/package-services/search → each service has an 'images' field (list).
  3. POST /api/packages/ with package_photos=[...] against CoCo-Yams service →
     GET {id} / track/{tracking_number} returns the package_photos.
  4. POST /api/uploads/ with a small PNG (folder=package_services) →
     { success:true, file_url:'/api/uploads/...' }.
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")

SUPER_ADMIN = {"email": "superadmin@oryno.com", "password": "testpassword123"}
CUSTOMER = {"email": "customer@test.com", "password": "testpassword123"}
COCO_SERVICE_ID = "49abbd6f-6d7c-462c-872d-a3950abb34fd"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _make_tiny_png_bytes() -> bytes:
    """Return a valid 1x1 red PNG as raw bytes."""
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00" + bytes([255, 0, 0])
    idat = chunk(b"IDAT", zlib.compress(raw, 9))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(SUPER_ADMIN)}"}


@pytest.fixture(scope="module")
def customer_headers():
    return {"Authorization": f"Bearer {_login(CUSTOMER)}"}


# ---------------------------------------------------------------------------
# 1. Package service offerings — images field persisted
# ---------------------------------------------------------------------------
class TestPackageServiceImages:
    def test_create_service_with_images_by_super_admin(self, admin_headers):
        payload = {
            "name": "TEST_ImagesSvc_144",
            "origin_city": "Yaoundé",
            "destination_city": "Douala",
            "pricing_model": "per_kg",
            "base_price": 1000,
            "per_kg_rate": 200,
            "max_weight_kg": 20,
            "accepted_types": ["parcel"],
            "delivery_time_hours": 24,
            "features": ["tracking"],
            "images": [
                "/api/uploads/x.jpg",
                "/api/uploads/y.jpg",
                "/api/uploads/z.jpg",
            ],
        }
        r = requests.post(
            f"{BASE_URL}/api/package-services/",
            json=payload,
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code in (200, 201), f"POST failed: {r.status_code} {r.text}"
        body = r.json()
        svc_id = body.get("id") or body.get("_id") or body.get("service_id")
        assert svc_id, f"no id in create response: {body}"

        # admin fast-track must produce 'active'
        assert body.get("status") == "active", f"expected active, got {body.get('status')}"

        try:
            # GET by id should return same images
            r2 = requests.get(f"{BASE_URL}/api/package-services/{svc_id}", timeout=30)
            assert r2.status_code == 200, f"GET failed: {r2.status_code} {r2.text}"
            fetched = r2.json()
            assert fetched.get("images") == payload["images"], (
                f"persisted images mismatch: {fetched.get('images')}"
            )
            assert fetched.get("status") == "active"
        finally:
            requests.delete(
                f"{BASE_URL}/api/package-services/{svc_id}",
                headers=admin_headers,
                timeout=30,
            )

    def test_search_services_returns_images_field(self):
        r = requests.get(
            f"{BASE_URL}/api/package-services/search",
            params={"origin_city": "Yaoundé", "destination_city": "Douala", "weight_kg": 2},
            timeout=30,
        )
        assert r.status_code == 200, f"search failed: {r.status_code} {r.text}"
        data = r.json()
        services = data.get("services") if isinstance(data, dict) else data
        assert isinstance(services, list) and len(services) >= 1, f"no services returned: {data}"
        for svc in services:
            assert "images" in svc, f"missing images field on service id={svc.get('id')}"
            assert isinstance(svc["images"], list), f"images must be list, got {type(svc['images'])}"


# ---------------------------------------------------------------------------
# 2. Package bookings — package_photos field persisted
# ---------------------------------------------------------------------------
class TestPackagePhotos:
    def test_create_package_booking_persists_package_photos(self, customer_headers):
        payload = {
            "package_service_id": COCO_SERVICE_ID,
            "sender": {
                "name": "TEST_Sender",
                "phone": "+237600000001",
                "address": "Yaoundé",
                "email": "test_sender@example.com",
            },
            "receiver": {
                "name": "TEST_Receiver",
                "phone": "+237600000002",
                "address": "Douala",
                "email": "test_receiver@example.com",
            },
            "origin_city": "Yaoundé",
            "destination_city": "Douala",
            "package_type": "parcel",
            "weight_kg": 2.0,
            "dimensions": {"length_cm": 10, "width_cm": 10, "height_cm": 10},
            "declared_value": 5000,
            "description": "Test iter144 parcel",
            "package_photos": ["/test1.jpg", "/test2.jpg", "/test3.jpg"],
        }
        r = requests.post(
            f"{BASE_URL}/api/packages/",
            json=payload,
            headers=customer_headers,
            timeout=30,
        )
        assert r.status_code in (200, 201), f"create booking failed: {r.status_code} {r.text}"
        body = r.json()
        pkg_id = body.get("package_id") or body.get("id") or body.get("_id")
        tracking = body.get("tracking_number")
        assert pkg_id, f"no package id in response: {body}"
        assert tracking, f"no tracking number in response: {body}"

        # Verify via GET /api/packages/{id}
        r2 = requests.get(
            f"{BASE_URL}/api/packages/{pkg_id}",
            headers=customer_headers,
            timeout=30,
        )
        assert r2.status_code == 200, f"GET package failed: {r2.status_code} {r2.text}"
        pkg = r2.json()
        assert pkg.get("package_photos") == payload["package_photos"], (
            f"package_photos not persisted: got {pkg.get('package_photos')}"
        )

        # Also verify via tracking endpoint (public shape) — status code only
        r3 = requests.get(f"{BASE_URL}/api/packages/track/{tracking}", timeout=30)
        assert r3.status_code == 200


# ---------------------------------------------------------------------------
# 3. Uploads infrastructure
# ---------------------------------------------------------------------------
class TestUploads:
    def test_upload_png_file(self, customer_headers):
        png = _make_tiny_png_bytes()
        files = {"file": ("test144.png", io.BytesIO(png), "image/png")}
        data = {"folder": "package_services"}
        r = requests.post(
            f"{BASE_URL}/api/uploads/",
            files=files,
            data=data,
            headers=customer_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True, f"success!=True: {body}"
        url = body.get("file_url") or body.get("url")
        assert url, f"no file_url in response: {body}"
        # LocalStorage returns /api/static/..., S3 returns https://...
        assert (
            "/api/uploads/" in url
            or "/api/static/" in url
            or url.startswith("http")
        ), f"unexpected file_url: {url}"

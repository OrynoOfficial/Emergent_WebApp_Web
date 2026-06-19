"""
iter253 - Emergent Object Storage migration verification.

Validates:
  1. STORAGE_BACKEND=emergent is active (uploads return /api/uploads/serve/oryno/...).
  2. /api/uploads/serve/<path> works without auth, returns Cache-Control + ETag headers (direct localhost origin).
  3. If-None-Match short-circuits to 304.
  4. New upload (POST /api/uploads/) returns /api/uploads/serve/oryno/uploads/... URL and is re-fetchable.
  5. No /api/static/ URLs remain across image-bearing collections; all use /api/uploads/serve/oryno/.
  6. Operator logo enrichment (operator_logo_url) on representative endpoints returns /api/uploads/serve/oryno/operator-logos/...
"""

import io
import os
import re
import requests
import pytest

PUBLIC_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cinema-management-p0.preview.emergentagent.com").rstrip("/")
ORIGIN_URL = "http://localhost:8001"   # Use direct origin to verify CDN headers (platform CF may strip)

CUSTOMER_EMAIL = "customer@test.com"
ADMIN_EMAIL = "admin@test.com"
PASSWORD = "testpassword123"


# ---- Auth helpers ---------------------------------------------------------

def _login(email, password, base=PUBLIC_URL):
    r = requests.post(f"{base}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, PASSWORD)


# ---- 1. Find a real served object via API list ----------------------------

def _find_emergent_image_url(token):
    """Find any /api/uploads/serve/oryno/... URL by scanning several authed/public endpoints."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    candidates = ["/api/operators", "/api/hotels", "/api/restaurants",
                  "/api/cinema/films", "/api/packages", "/api/vehicles", "/api/event-showtimes"]
    pattern = re.compile(r"(/api/uploads/serve/oryno/[A-Za-z0-9_\-/\.]+\.[A-Za-z0-9]{2,5})")
    for ep in candidates:
        try:
            r = requests.get(f"{PUBLIC_URL}{ep}", headers=headers, timeout=20)
        except Exception:
            continue
        if r.status_code != 200:
            continue
        m = pattern.search(r.text)
        if m:
            return m.group(1), ep
    return None, None


@pytest.fixture(scope="module")
def sample_operator_logo_path(admin_token):
    path, src = _find_emergent_image_url(admin_token)
    if not path:
        pytest.skip("No /api/uploads/serve/oryno/ URL discoverable via public/admin endpoints")
    return path


# ---- 2. Serve endpoint headers (origin) -----------------------------------

class TestServeEndpointHeaders:
    """Verify CDN headers on origin (direct port-8001 bypassing platform CF)."""

    def test_origin_serve_returns_image_with_cdn_headers(self, sample_operator_logo_path):
        path = sample_operator_logo_path
        r = requests.get(f"{ORIGIN_URL}{path}", timeout=20)
        assert r.status_code == 200, f"origin GET {path} → {r.status_code}"
        assert int(r.headers.get("Content-Length", len(r.content))) > 0
        # Image-ish content-type
        assert r.headers.get("Content-Type", "").startswith(("image/", "application/octet-stream")), r.headers
        # CDN headers
        cc = r.headers.get("Cache-Control", "")
        assert "public" in cc and "max-age=31536000" in cc and "immutable" in cc, f"Bad Cache-Control: {cc!r}"
        assert r.headers.get("ETag"), "Missing ETag"

    def test_origin_serve_304_on_if_none_match(self, sample_operator_logo_path):
        path = sample_operator_logo_path
        first = requests.get(f"{ORIGIN_URL}{path}", timeout=20)
        etag = first.headers.get("ETag")
        assert etag, "no etag on first hit"
        second = requests.get(f"{ORIGIN_URL}{path}", headers={"If-None-Match": etag}, timeout=20)
        assert second.status_code == 304, f"Expected 304 got {second.status_code} body={second.text[:200]}"
        assert second.headers.get("ETag") == etag

    def test_serve_no_auth_required(self, sample_operator_logo_path):
        path = sample_operator_logo_path
        # Explicitly no Authorization header
        s = requests.Session()
        s.headers.clear()
        s.headers["Accept"] = "*/*"
        r = s.get(f"{ORIGIN_URL}{path}", timeout=20)
        assert r.status_code == 200, f"no-auth GET → {r.status_code}: {r.text[:200]}"

    def test_public_url_serve_returns_bytes(self, sample_operator_logo_path):
        """Public URL must also resolve image bytes (CF may rewrite cache headers but origin must return 200)."""
        path = sample_operator_logo_path
        r = requests.get(f"{PUBLIC_URL}{path}", timeout=20)
        assert r.status_code == 200, f"public GET {path} → {r.status_code}"
        assert len(r.content) > 100


# ---- 3. Upload returns new emergent URL ----------------------------------

class TestUploadReturnsEmergentURL:
    def test_upload_new_image_returns_serve_url_and_refetches(self, customer_token):
        # Tiny 1x1 PNG
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff"
            b"\xff?\x00\x05\xfe\x02\xfe\xa3\x9e\x9f\x96\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("test_iter253.png", io.BytesIO(png), "image/png")}
        headers = {"Authorization": f"Bearer {customer_token}"}
        r = requests.post(f"{PUBLIC_URL}/api/uploads/", files=files, headers=headers, timeout=30)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        body = r.json()
        url = body.get("file_url", "")
        assert url.startswith("/api/uploads/serve/oryno/"), f"file_url is not emergent: {url}"
        assert "/api/static/" not in url
        assert body.get("storage") == "emergent", f"storage label: {body.get('storage')}"

        # Re-fetch via origin (CDN-friendly path)
        r2 = requests.get(f"{ORIGIN_URL}{url}", timeout=20)
        assert r2.status_code == 200, f"refetch failed: {r2.status_code}"
        assert r2.content == png, "refetched bytes mismatch original"


# ---- 4. DB image URL audit -------------------------------------------------

class TestNoStaticURLsInDB:
    """Spot-check public API endpoints — none should leak /api/static/ image URLs;
    all image URLs should be /api/uploads/serve/oryno/..."""

    PUBLIC_LIST_ENDPOINTS = [
        "/api/operators",
        "/api/hotels",
        "/api/restaurants",
        "/api/cinema/films",
        "/api/packages",
        "/api/vehicles",
        "/api/event-showtimes",
    ]

    @pytest.mark.parametrize("endpoint", PUBLIC_LIST_ENDPOINTS)
    def test_no_static_urls(self, endpoint, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{PUBLIC_URL}{endpoint}", headers=headers, timeout=30)
        if r.status_code in (401, 403, 404):
            pytest.skip(f"{endpoint} requires auth/not-mounted: {r.status_code}")
        assert r.status_code == 200, f"{endpoint} → {r.status_code}: {r.text[:200]}"
        body = r.text
        # Static URLs would look like /api/static/<folder>/<file>
        # Allow matches inside null/empty contexts: just count occurrences.
        static_hits = re.findall(r"/api/static/[a-z0-9_\-/]+\.(?:png|jpe?g|webp|gif|svg|mp4)", body, flags=re.I)
        assert not static_hits, f"{endpoint} still references /api/static/: first 3 = {static_hits[:3]}"


class TestOperatorLogosOnEmergent:
    def test_at_least_one_operator_logo_on_emergent(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{PUBLIC_URL}/api/operators", headers=headers, timeout=20)
        if r.status_code in (401, 403):
            pytest.skip(f"/api/operators not accessible: {r.status_code}")
        assert r.status_code == 200, r.text
        ops = r.json()
        if isinstance(ops, dict):
            ops = ops.get("items") or ops.get("operators") or []
        # Look for any field containing the emergent serve URL
        emergent_logos = []
        for op in ops:
            for k, v in op.items():
                if isinstance(v, str) and "/api/uploads/serve/oryno/operator-logos/" in v:
                    emergent_logos.append(v)
        assert emergent_logos, "No operator has an /api/uploads/serve/oryno/operator-logos/ URL"

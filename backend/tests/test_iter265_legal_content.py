"""Iteration 265 — Legal content endpoints (cached oryno.tech terms/privacy)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/legal/content?type=terms|privacy ---

class TestLegalContent:
    def test_terms_ok(self, api):
        r = api.get(f"{BASE_URL}/api/legal/content", params={"type": "terms"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "terms"
        assert data["source_url"] == "https://oryno.tech/terms"
        # required keys
        for k in ("title", "html_content", "text_content", "fetched_at", "stale"):
            assert k in data

    def test_privacy_ok(self, api):
        r = api.get(f"{BASE_URL}/api/legal/content", params={"type": "privacy"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == "privacy"
        assert data["source_url"] == "https://oryno.tech/privacy"
        for k in ("title", "html_content", "text_content", "fetched_at", "stale"):
            assert k in data

    def test_invalid_type_rejected(self, api):
        r = api.get(f"{BASE_URL}/api/legal/content", params={"type": "invalid"}, timeout=15)
        # FastAPI regex validator → 422
        assert r.status_code == 422, r.text

    def test_refresh_param_triggers_rescrape(self, api):
        r = api.get(
            f"{BASE_URL}/api/legal/content",
            params={"type": "terms", "refresh": "true"},
            timeout=45,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["source_url"] == "https://oryno.tech/terms"

    def test_post_refresh_all(self, api):
        r = api.post(f"{BASE_URL}/api/legal/content/refresh", timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "results" in body
        assert set(body["results"].keys()) >= {"terms", "privacy"}

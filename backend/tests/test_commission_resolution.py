"""
Commission resolution hierarchy — the booking pages call
GET /api/commission-config/resolve which must follow:
  operator-specific > category default > global default > 5% fallback.

Also covers CRUD via the admin endpoints (PUT/DELETE used to be locked to
role == "admin" which excluded super_admin; we now gate on the
`commission.edit` permission which super_admins automatically have).
"""
import os
import uuid

import requests

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
_tok_cache: dict[str, str] = {}


def _login(email, pwd):
    if email in _tok_cache:
        return _tok_cache[email]
    t = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pwd}).json().get("access_token")
    if t:
        _tok_cache[email] = t
    return t


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _wipe_test_configs(service_type, operator_id=None):
    """Best-effort cleanup so tests are isolated even when run multiple times."""
    listing = requests.get(
        f"{API}/api/commission-config/",
        params={"service_type": service_type, "is_active": "all", "limit": 100},
        headers=_super(),
    ).json().get("configs", [])
    for c in listing:
        if operator_id is None and c.get("operator_id") is not None:
            continue
        if operator_id is not None and c.get("operator_id") != operator_id:
            continue
        requests.delete(f"{API}/api/commission-config/{c['_id']}", headers=_super())


def test_fallback_when_no_config_returns_5pct():
    # Pick a service_type that won't have any config seeded.
    st = f"qa_dummy_{uuid.uuid4().hex[:6]}"
    r = requests.get(f"{API}/api/commission-config/resolve", params={"service_type": st})
    assert r.status_code == 200
    body = r.json()
    assert body["rate"] == 5.0
    assert body["source"] == "fallback"


def test_global_default_wins_when_no_category():
    _wipe_test_configs("*")
    # Create global default
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Global", "service_type": "*", "base_rate": 7.0},
        headers=_super(),
    )
    try:
        st = f"qa_unmapped_{uuid.uuid4().hex[:6]}"
        r = requests.get(f"{API}/api/commission-config/resolve", params={"service_type": st}).json()
        assert r["rate"] == 7.0
        assert r["source"] == "global"
    finally:
        _wipe_test_configs("*")


def test_category_overrides_global():
    _wipe_test_configs("*")
    _wipe_test_configs("qa_cat")
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Global", "service_type": "*", "base_rate": 7.0},
        headers=_super(),
    )
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Cat", "service_type": "qa_cat", "base_rate": 12.5},
        headers=_super(),
    )
    try:
        r = requests.get(
            f"{API}/api/commission-config/resolve",
            params={"service_type": "qa_cat"},
        ).json()
        assert r["rate"] == 12.5
        assert r["source"] == "category"
    finally:
        _wipe_test_configs("*")
        _wipe_test_configs("qa_cat")


def test_operator_overrides_category_and_global():
    _wipe_test_configs("*")
    _wipe_test_configs("qa_cat2")
    op_id = f"qa_op_{uuid.uuid4().hex[:6]}"
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Global", "service_type": "*", "base_rate": 7.0},
        headers=_super(),
    )
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Cat", "service_type": "qa_cat2", "base_rate": 12.5},
        headers=_super(),
    )
    requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Op", "service_type": "qa_cat2", "operator_id": op_id, "base_rate": 3.0},
        headers=_super(),
    )
    try:
        # With operator_id → 3%
        r = requests.get(
            f"{API}/api/commission-config/resolve",
            params={"service_type": "qa_cat2", "operator_id": op_id},
        ).json()
        assert r["rate"] == 3.0
        assert r["source"] == "operator"
        # Without operator_id → falls back to category default
        r = requests.get(
            f"{API}/api/commission-config/resolve",
            params={"service_type": "qa_cat2"},
        ).json()
        assert r["rate"] == 12.5
        assert r["source"] == "category"
    finally:
        _wipe_test_configs("*")
        _wipe_test_configs("qa_cat2")
        _wipe_test_configs("qa_cat2", op_id)


def test_inactive_configs_ignored():
    _wipe_test_configs("qa_cat3")
    create = requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Cat3", "service_type": "qa_cat3", "base_rate": 11.0},
        headers=_super(),
    ).json()
    cid = create["config_id"]
    # Deactivate
    requests.put(
        f"{API}/api/commission-config/{cid}",
        json={"is_active": False},
        headers=_super(),
    )
    try:
        r = requests.get(
            f"{API}/api/commission-config/resolve",
            params={"service_type": "qa_cat3"},
        ).json()
        assert r["source"] == "fallback"
        assert r["rate"] == 5.0
    finally:
        _wipe_test_configs("qa_cat3")


def test_super_admin_can_crud_via_endpoints():
    """The PUT/DELETE endpoints used to be locked to role=='admin' which
    excluded super_admin. Confirm super_admin now passes the permission gate."""
    create = requests.post(
        f"{API}/api/commission-config/",
        json={"name": "QA Super", "service_type": "qa_super", "base_rate": 6.0},
        headers=_super(),
    )
    assert create.status_code == 200
    cid = create.json()["config_id"]
    upd = requests.put(
        f"{API}/api/commission-config/{cid}",
        json={"base_rate": 9.0},
        headers=_super(),
    )
    assert upd.status_code == 200
    delete = requests.delete(f"{API}/api/commission-config/{cid}", headers=_super())
    assert delete.status_code == 200

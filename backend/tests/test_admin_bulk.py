"""Admin bulk-actions endpoint — whitelist + permission gating + cascade."""
import os
import uuid

import requests

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
_tok: dict[str, str] = {}


def _login(email, pwd):
    if email in _tok:
        return _tok[email]
    t = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pwd}).json().get("access_token")
    if t:
        _tok[email] = t
    return t


def _super():
    return {"Authorization": f"Bearer {_login('superadmin@oryno.com', 'testpassword123')}"}


def _customer():
    return {"Authorization": f"Bearer {_login('customer@test.com', 'testpassword123')}"}


def _make_commission(name):
    # Use commission_configs as a cheap, non-cascading collection for delete/activate tests.
    r = requests.post(
        f"{API}/api/commission-config/",
        json={"name": name, "service_type": f"bulk_qa_{uuid.uuid4().hex[:5]}", "base_rate": 4.0},
        headers=_super(),
    ).json()
    return r["config_id"]


def test_bulk_delete_happy_path():
    ids = [_make_commission(f"bulk_qa_{i}_{uuid.uuid4().hex[:5]}") for i in range(3)]
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "delete", "ids": ids},
        headers=_super(),
    )
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == 3


def test_bulk_deactivate_then_activate():
    cid = _make_commission(f"bulk_qa_toggle_{uuid.uuid4().hex[:5]}")
    deact = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "deactivate", "ids": [cid]},
        headers=_super(),
    )
    assert deact.json()["modified"] == 1
    act = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "activate", "ids": [cid]},
        headers=_super(),
    )
    assert act.json()["modified"] == 1
    # Cleanup
    requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "delete", "ids": [cid]},
        headers=_super(),
    )


def test_bulk_rejects_unknown_collection():
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "users_secret_table", "action": "delete", "ids": ["x"]},
        headers=_super(),
    )
    assert r.status_code == 400


def test_bulk_requires_admin_perm():
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "delete", "ids": ["x"]},
        headers=_customer(),
    )
    assert r.status_code == 403


def test_bulk_validates_action():
    r = requests.post(
        f"{API}/api/admin/bulk",
        json={"collection": "commission_configs", "action": "nuke", "ids": ["x"]},
        headers=_super(),
    )
    assert r.status_code == 400

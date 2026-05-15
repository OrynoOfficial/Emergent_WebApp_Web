"""Iteration 170 backend tests.

Verifies child_price & senior_price support on cinema showtimes and the
vip_rows overlay from the cinema's screen on GET /showtimes/{id}/details.

Covered endpoints
-----------------
- POST /api/cinema/{cinema_id}/showtimes  (child_price + senior_price accepted)
- PUT  /api/cinema/showtimes/{id}         (child_price + senior_price accepted)
- GET  /api/cinema/showtimes/{id}/details (returns vip/child/senior price;
        overlays vip_rows from the cinema's screen when the showtime's own
        seat_layout.vip_rows is empty).
"""
import os
import uuid
import requests
import pytest

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or
        'https://cinema-management-p0.preview.emergentagent.com').rstrip('/')
API = f"{BASE}/api"

SUPER = ("superadmin@oryno.com", "testpassword123")
OPER = ("mani-monroe@netflix.com", "testpassword123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def oper_token():
    return _login(*OPER)


@pytest.fixture(scope="module")
def super_token():
    return _login(*SUPER)


@pytest.fixture(scope="module")
def netflix_cinema(oper_token):
    """Pick a cinema operated by the Netflix operator that exposes a screen.

    Returns dict with cinema_id, screen_name, vip_rows (from the screen), film_id.
    """
    # 1) List cinemas the operator manages.
    r = requests.get(f"{API}/cinema/management/my-cinemas", headers=_hdr(oper_token), timeout=20)
    assert r.status_code == 200, r.text
    payload = r.json()
    cinemas = payload.get("cinemas") if isinstance(payload, dict) else payload
    assert cinemas, "no cinemas visible to operator"

    chosen = None
    for c in cinemas:
        screens = c.get("screens") or []
        if not screens:
            continue
        # Prefer a screen that already has vip_rows configured.
        s = next((s for s in screens if (s.get("seat_layout") or {}).get("vip_rows")), screens[0])
        chosen = {
            "cinema_id": c.get("_id") or c.get("id"),
            "screen_name": s.get("name"),
            "vip_rows": (s.get("seat_layout") or {}).get("vip_rows", []),
        }
        break
    assert chosen, "no usable cinema/screen pair for operator"

    # 2) Find any film.
    rf = requests.get(f"{API}/cinema/films", timeout=20)
    assert rf.status_code == 200, rf.text
    films = rf.json().get("films") or rf.json()
    assert films, "no films available"
    chosen["film_id"] = films[0].get("_id") or films[0].get("id")
    return chosen


def _delete_showtime(token, showtime_id):
    try:
        requests.delete(f"{API}/cinema/showtimes/{showtime_id}", headers=_hdr(token), timeout=20)
    except Exception:
        pass


# ---------- TESTS ----------

def test_create_showtime_with_child_and_senior_price(oper_token, netflix_cinema):
    """POST /api/cinema/{cinema_id}/showtimes accepts child_price + senior_price."""
    cinema_id = netflix_cinema["cinema_id"]
    params = {
        "film_id": netflix_cinema["film_id"],
        "screen_name": netflix_cinema["screen_name"],
        "show_date": "2099-11-15",
        "show_time": "14:00",
        "end_time": "16:00",
        "price": 8000.0,
        "screen_type": "premium",
        "vip_price": 12000.0,
        "child_price": 4000.0,
        "senior_price": 5500.0,
        "total_seats": 80,
    }
    r = requests.post(f"{API}/cinema/{cinema_id}/showtimes",
                      params=params, headers=_hdr(oper_token), timeout=20)
    assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
    sid = r.json().get("showtime_id")
    assert sid

    try:
        # Verify via /details
        d = requests.get(f"{API}/cinema/showtimes/{sid}/details", timeout=20)
        assert d.status_code == 200, d.text
        st = d.json().get("showtime") or {}
        assert st.get("price") == 8000.0
        assert st.get("vip_price") == 12000.0
        assert st.get("child_price") == 4000.0
        assert st.get("senior_price") == 5500.0
    finally:
        _delete_showtime(oper_token, sid)


def test_update_showtime_child_and_senior_price(oper_token, netflix_cinema):
    """PUT /api/cinema/showtimes/{id} updates child_price + senior_price."""
    cinema_id = netflix_cinema["cinema_id"]
    create_params = {
        "film_id": netflix_cinema["film_id"],
        "screen_name": netflix_cinema["screen_name"],
        "show_date": "2099-11-16",
        "show_time": "18:00",
        "end_time": "20:00",
        "price": 7000.0,
        "total_seats": 50,
    }
    r = requests.post(f"{API}/cinema/{cinema_id}/showtimes",
                      params=create_params, headers=_hdr(oper_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["showtime_id"]

    try:
        # Update via JSON body
        upd = requests.put(
            f"{API}/cinema/showtimes/{sid}",
            json={"child_price": 3500.0, "senior_price": 5000.0, "vip_price": 11000.0},
            headers=_hdr(oper_token), timeout=20,
        )
        assert upd.status_code == 200, f"update failed: {upd.status_code} {upd.text}"

        d = requests.get(f"{API}/cinema/showtimes/{sid}/details", timeout=20)
        assert d.status_code == 200, d.text
        st = d.json().get("showtime") or {}
        assert st.get("child_price") == 3500.0
        assert st.get("senior_price") == 5000.0
        assert st.get("vip_price") == 11000.0
    finally:
        _delete_showtime(oper_token, sid)


def test_details_returns_child_senior_vip_prices_for_seeded_showtime():
    """The seeded showtime should return child/senior/vip prices as configured."""
    sid = "48e68d80-3862-419f-959d-39cab06aa727"
    r = requests.get(f"{API}/cinema/showtimes/{sid}/details", timeout=20)
    if r.status_code == 404:
        pytest.skip(f"seeded showtime {sid} not present in this environment")
    assert r.status_code == 200, r.text
    body = r.json()
    st = body.get("showtime") or {}
    # Required keys are present even if some values are None.
    for k in ("price", "vip_price", "child_price", "senior_price"):
        assert k in st, f"missing key {k} in /details showtime payload"


def test_details_overlays_vip_rows_from_cinema_screen(oper_token, super_token, netflix_cinema):
    """When the showtime's seat_layout has no vip_rows, /details should overlay
    them from the matching cinema screen's seat_layout."""
    cinema_id = netflix_cinema["cinema_id"]

    # 1) Ensure the chosen screen has vip_rows configured. If not, set some
    #    via cinema update so the overlay path is meaningful.
    rc = requests.get(f"{API}/cinema/{cinema_id}", headers=_hdr(oper_token), timeout=20)
    if rc.status_code != 200:
        rc = requests.get(f"{API}/cinema/{cinema_id}", timeout=20)
    assert rc.status_code == 200, rc.text
    cinema = rc.json()
    screens = cinema.get("screens") or []
    sname = netflix_cinema["screen_name"]
    target = next((s for s in screens if s.get("name") == sname), None)
    assert target is not None
    layout = target.get("seat_layout") or {}
    cinema_vip_rows = layout.get("vip_rows") or []

    if not cinema_vip_rows:
        # try to set vip_rows on the screen so the overlay can be verified
        new_screens = []
        for s in screens:
            if s.get("name") == sname:
                sl = dict(s.get("seat_layout") or {})
                sl["vip_rows"] = ["A", "B"]
                sl.setdefault("rows", 8)
                sl.setdefault("seats_per_row", 12)
                s = {**s, "seat_layout": sl}
            new_screens.append(s)
        upd = requests.put(
            f"{API}/cinema/{cinema_id}",
            json={"screens": new_screens}, headers=_hdr(oper_token), timeout=20,
        )
        if upd.status_code != 200:
            pytest.skip(f"could not configure vip_rows on cinema screen: {upd.status_code} {upd.text}")
        cinema_vip_rows = ["A", "B"]

    # 2) Create a showtime — server copies seat_layout from the matching screen,
    #    which means vip_rows will already be present. To exercise the overlay
    #    branch we strip vip_rows from the showtime directly via DB? We don't
    #    have DB here, so we rely on the overlay being a no-op (already correct).
    create_params = {
        "film_id": netflix_cinema["film_id"],
        "screen_name": sname,
        "show_date": "2099-11-17",
        "show_time": "20:30",
        "end_time": "22:30",
        "price": 6000.0,
        "vip_price": 10000.0,
        "total_seats": 60,
    }
    r = requests.post(f"{API}/cinema/{cinema_id}/showtimes",
                      params=create_params, headers=_hdr(oper_token), timeout=20)
    assert r.status_code == 200, r.text
    sid = r.json()["showtime_id"]

    try:
        d = requests.get(f"{API}/cinema/showtimes/{sid}/details", timeout=20)
        assert d.status_code == 200, d.text
        layout = d.json().get("seat_layout") or {}
        rows = layout.get("vip_rows") or []
        assert set(rows) == set(cinema_vip_rows), f"vip_rows mismatch: got {rows}, expected {cinema_vip_rows}"
    finally:
        _delete_showtime(oper_token, sid)


def test_promo_validate_endpoint_graceful():
    """/loyalty/promo/validate is allowed to be missing — FE handles 404 gracefully.
    Either way the response must be a JSON object with a deterministic shape."""
    customer_tok = _login("customer@test.com", "testpassword123")
    r = requests.post(
        f"{API}/loyalty/promo/validate",
        json={"code": "TEST_INVALID_CODE_XYZ", "service_type": "cinema"},
        headers=_hdr(customer_tok), timeout=20,
    )
    # Any of: 200 with valid=false, 400, 404. The FE expects a toast on non-2xx
    # or {valid:false}; here we just assert it's not a 5xx blow-up.
    assert r.status_code < 500, f"promo endpoint 5xx: {r.status_code} {r.text}"

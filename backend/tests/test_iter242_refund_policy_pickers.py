"""Iteration 242 - Verify refund_policy preset persists on Create + Update for:
- cinema showtime (POST query-param + PUT body)
- event showtime (POST/PUT body)
- car_rental (POST/PUT body)
- banquet (POST/PUT body)
- pressing/laundry (POST/PUT body)

Also verifies GET /api/refunds/presets?service_type=... returns 3 presets per type.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cinema-management-p0.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "superadmin@oryno.com"
ADMIN_PASSWORD = "testpassword123"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    token = r.json().get("access_token") or r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


# === Presets endpoint sanity (all 5 service types) ===
@pytest.mark.parametrize("svc", ["event", "cinema", "car_rental", "banquet", "laundry"])
def test_refund_presets_endpoint(admin, svc):
    r = admin.get(f"{BASE_URL}/api/refunds/presets?service_type={svc}", timeout=15)
    assert r.status_code == 200, f"{svc}: {r.status_code} {r.text[:200]}"
    data = r.json()
    presets = data.get("presets", {})
    for key in ["strict", "standard", "flexible"]:
        assert key in presets, f"{svc} missing {key}"
        assert isinstance(presets[key].get("tiers"), list) and len(presets[key]["tiers"]) >= 1


# === Banquet ===
def test_banquet_refund_policy_persistence(admin):
    payload = {
        "name": f"TEST_banquet_{uuid.uuid4().hex[:6]}",
        "operator_name": "TEST_op",
        "base_price": 100.0,
        "refund_policy": {"preset": "strict"},
    }
    r = admin.post(f"{BASE_URL}/api/banquets/", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create banquet: {r.status_code} {r.text[:400]}"
    bid = r.json().get("banquet_id") or r.json().get("id") or r.json().get("_id")
    assert bid, f"no id: {r.json()}"

    # GET to verify persistence
    g = admin.get(f"{BASE_URL}/api/banquets/{bid}", timeout=15)
    assert g.status_code == 200, f"get banquet: {g.status_code} {g.text[:200]}"
    rp = g.json().get("refund_policy") or {}
    assert rp.get("preset") == "strict", f"create did not persist refund_policy: {g.json().get('refund_policy')}"

    # UPDATE → flexible
    u = admin.put(f"{BASE_URL}/api/banquets/{bid}",
                  json={"refund_policy": {"preset": "flexible"}}, timeout=20)
    assert u.status_code in (200, 204), f"update banquet: {u.status_code} {u.text[:200]}"

    g2 = admin.get(f"{BASE_URL}/api/banquets/{bid}", timeout=15)
    assert (g2.json().get("refund_policy") or {}).get("preset") == "flexible", \
        f"update did not persist: {g2.json().get('refund_policy')}"

    admin.delete(f"{BASE_URL}/api/banquets/{bid}", timeout=10)


# === Pressing/Laundry ===
def test_pressing_refund_policy_persistence(admin):
    payload = {
        "name": f"TEST_press_{uuid.uuid4().hex[:6]}",
        "operator_name": "TEST_op",
        "city": "Douala",
        "address": "TEST address",
        "refund_policy": {"preset": "flexible"},
    }
    r = admin.post(f"{BASE_URL}/api/pressing/", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create pressing: {r.status_code} {r.text[:300]}"
    pid = r.json().get("pressing_id") or r.json().get("shop_id") or r.json().get("id")
    assert pid, f"no id: {r.json()}"

    g = admin.get(f"{BASE_URL}/api/pressing/{pid}", timeout=15)
    assert g.status_code == 200
    assert (g.json().get("refund_policy") or {}).get("preset") == "flexible", \
        f"create did not persist: {g.json().get('refund_policy')}"

    u = admin.put(f"{BASE_URL}/api/pressing/{pid}",
                  json={"refund_policy": {"preset": "standard"}}, timeout=20)
    assert u.status_code in (200, 204), f"update pressing: {u.status_code} {u.text[:200]}"

    g2 = admin.get(f"{BASE_URL}/api/pressing/{pid}", timeout=15)
    assert (g2.json().get("refund_policy") or {}).get("preset") == "standard"

    admin.delete(f"{BASE_URL}/api/pressing/{pid}", timeout=10)


# === Car Rental ===
def test_car_rental_refund_policy_persistence(admin):
    payload = {
        "make": "TEST_Toyota",
        "model": f"TEST_{uuid.uuid4().hex[:6]}",
        "year": 2024,
        "vehicle_type": "sedan",
        "seats": 5,
        "doors": 4,
        "transmission": "automatic",
        "fuel_type": "petrol",
        "price_per_day": 50.0,
        "city": "Douala",
        "refund_policy": {"preset": "standard"},
    }
    r = admin.post(f"{BASE_URL}/api/car-rental/", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create car: {r.status_code} {r.text[:400]}"
    cid = r.json().get("car_id") or r.json().get("id") or r.json().get("_id")
    assert cid, f"no id: {r.json()}"

    g = admin.get(f"{BASE_URL}/api/car-rental/{cid}", timeout=15)
    assert g.status_code == 200
    assert (g.json().get("refund_policy") or {}).get("preset") == "standard", \
        f"create did not persist: {g.json().get('refund_policy')}"

    u = admin.put(f"{BASE_URL}/api/car-rental/{cid}",
                  json={"refund_policy": {"preset": "strict"}}, timeout=20)
    assert u.status_code in (200, 204), f"update car: {u.status_code} {u.text[:200]}"

    g2 = admin.get(f"{BASE_URL}/api/car-rental/{cid}", timeout=15)
    assert (g2.json().get("refund_policy") or {}).get("preset") == "strict"

    admin.delete(f"{BASE_URL}/api/car-rental/{cid}", timeout=10)


# === Cinema Showtime ===
def test_cinema_showtime_refund_policy(admin):
    cinemas = admin.get(f"{BASE_URL}/api/cinema/", timeout=15)
    if cinemas.status_code != 200:
        pytest.skip(f"no cinemas: {cinemas.status_code}")
    clist = cinemas.json() if isinstance(cinemas.json(), list) else cinemas.json().get("cinemas", [])
    if not clist:
        pytest.skip("no cinemas seeded")
    cinema_id = clist[0].get("_id") or clist[0].get("id")

    films = admin.get(f"{BASE_URL}/api/cinema/films", timeout=15)
    if films.status_code != 200:
        films = admin.get(f"{BASE_URL}/api/films", timeout=15)
    flist = films.json() if isinstance(films.json(), list) else films.json().get("films", [])
    if not flist:
        pytest.skip("no films seeded")
    film_id = flist[0].get("_id") or flist[0].get("id")

    params = {
        "film_id": film_id,
        "show_date": "2030-12-31",
        "show_time": "20:00",
        "screen_id": f"TEST_{uuid.uuid4().hex[:4]}",
        "screen_name": f"TEST_Screen_{uuid.uuid4().hex[:4]}",
        "end_time": "22:00",
        "available_seats": 50,
        "price": 5.0,
        "refund_policy_preset": "strict",
    }
    r = admin.post(f"{BASE_URL}/api/cinema/{cinema_id}/showtimes", params=params, timeout=20)
    assert r.status_code in (200, 201), f"create showtime: {r.status_code} {r.text[:400]}"
    body = r.json()
    # POST query-param endpoint returns {showtime_id, ...} or echoes
    sid = body.get("showtime_id") or body.get("_id") or body.get("id")
    if not sid and isinstance(body.get("showtime"), dict):
        sid = body["showtime"].get("_id") or body["showtime"].get("id")
    assert sid, f"no showtime id: {body}"

    # GET via list-by-cinema (includes refund_policy in full doc — /showtimes/{id}/details
    # builds a hand-curated dict that strips refund_policy, so we use the cinema listing instead)
    g = admin.get(f"{BASE_URL}/api/cinema/{cinema_id}/showtimes", timeout=15)
    assert g.status_code == 200, f"get showtime: {g.status_code}"
    matching = [s for s in g.json().get("showtimes", []) if s.get("id") == sid]
    assert matching, f"showtime not found in listing: {sid}"
    rp = (matching[0].get("refund_policy") or {})
    assert rp.get("preset") == "strict", f"create did not persist (preset query param): {matching[0]}"

    # UPDATE PUT /cinema/showtimes/{id}
    u = admin.put(f"{BASE_URL}/api/cinema/showtimes/{sid}",
                  json={"refund_policy": {"preset": "flexible"}}, timeout=20)
    assert u.status_code in (200, 204), f"update showtime: {u.status_code} {u.text[:300]}"

    g2 = admin.get(f"{BASE_URL}/api/cinema/{cinema_id}/showtimes", timeout=15)
    matching2 = [s for s in g2.json().get("showtimes", []) if s.get("id") == sid]
    assert matching2
    rp2 = (matching2[0].get("refund_policy") or {})
    assert rp2.get("preset") == "flexible", f"update did not persist: {matching2[0]}"

    admin.delete(f"{BASE_URL}/api/cinema/showtimes/{sid}", timeout=10)


# === Event Showtime ===
def test_event_showtime_refund_policy(admin):
    evts = admin.get(f"{BASE_URL}/api/events/", timeout=15)
    if evts.status_code != 200:
        pytest.skip(f"no /api/events: {evts.status_code}")
    arr = evts.json() if isinstance(evts.json(), list) else evts.json().get("events", [])
    if not arr:
        # Create a minimal event for the test
        ev_payload = {
            "title": f"TEST_event_{uuid.uuid4().hex[:6]}",
            "description": "test",
            "category": "concert",
            "city": "Douala",
        }
        cr = admin.post(f"{BASE_URL}/api/events/", json=ev_payload, timeout=20)
        if cr.status_code not in (200, 201):
            pytest.skip(f"can't seed event: {cr.status_code} {cr.text[:200]}")
        event_id = cr.json().get("event_id") or cr.json().get("id") or cr.json().get("_id")
        if not event_id:
            pytest.skip(f"no event id from seed: {cr.json()}")
    else:
        event_id = arr[0].get("_id") or arr[0].get("id")

    payload = {
        "event_id": event_id,
        "show_date": "2030-12-31",
        "show_time": "19:00",
        "venue_name": "TEST_venue",
        "city": "Douala",
        "ticket_classes": [{"name": "GA", "price": 10.0, "capacity": 100}],
        "refund_policy": {"preset": "strict"},
    }
    r = admin.post(f"{BASE_URL}/api/event-showtimes/", json=payload, timeout=20)
    if r.status_code == 404:
        r = admin.post(f"{BASE_URL}/api/event-showtimes", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create event showtime: {r.status_code} {r.text[:400]}"
    body = r.json()
    sid = body.get("showtime_id") or body.get("id") or body.get("_id")
    assert sid, f"no id: {body}"

    g = admin.get(f"{BASE_URL}/api/event-showtimes/{sid}", timeout=15)
    assert g.status_code == 200, f"get event showtime: {g.status_code}"
    assert (g.json().get("refund_policy") or {}).get("preset") == "strict", \
        f"create did not persist: {g.json().get('refund_policy')}"

    u = admin.put(f"{BASE_URL}/api/event-showtimes/{sid}",
                  json={"refund_policy": {"preset": "standard"}}, timeout=20)
    assert u.status_code in (200, 204), f"update event showtime: {u.status_code} {u.text[:300]}"

    g2 = admin.get(f"{BASE_URL}/api/event-showtimes/{sid}", timeout=15)
    assert (g2.json().get("refund_policy") or {}).get("preset") == "standard"

    admin.delete(f"{BASE_URL}/api/event-showtimes/{sid}", timeout=10)

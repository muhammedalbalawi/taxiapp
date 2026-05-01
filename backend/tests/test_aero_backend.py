"""Aero Ride backend pytest suite."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://luxury-rides-59.preview.emergentagent.com").rstrip("/")
CUSTOMER = "test_session_aero_customer"
DRIVER = "test_session_aero_driver"
ADMIN = "test_session_aero_admin"


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root_ok():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_auth_me_customer():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER))
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "customer"
    assert data["user_id"] == "user_test_customer"


def test_auth_me_unauth():
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_auth_role_switch_and_revert():
    # switch customer -> driver
    r = requests.post(f"{BASE_URL}/api/auth/role", headers=H(CUSTOMER), json={"role": "driver"})
    assert r.status_code == 200
    assert r.json()["role"] == "driver"
    # revert
    r2 = requests.post(f"{BASE_URL}/api/auth/role", headers=H(CUSTOMER), json={"role": "customer"})
    assert r2.status_code == 200
    assert r2.json()["role"] == "customer"


def test_auth_role_admin_forbidden():
    r = requests.post(f"{BASE_URL}/api/auth/role", headers=H(CUSTOMER), json={"role": "admin"})
    assert r.status_code == 403


# ---------- Estimate (public) ----------
def test_estimate_public():
    body = {
        "pickup": {"lat": 25.2048, "lng": 55.2708},
        "destination": {"lat": 25.1972, "lng": 55.2744},
        "ride_type": "comfort",
    }
    r = requests.post(f"{BASE_URL}/api/rides/estimate", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["distance_km"] > 0
    assert d["price"] > 0
    assert d["ride_type"] == "comfort"


# ---------- Ride lifecycle ----------
@pytest.fixture(scope="module")
def trip_id():
    body = {
        "pickup": {"lat": 25.2048, "lng": 55.2708, "address": "TEST_PICKUP"},
        "destination": {"lat": 25.1972, "lng": 55.2744, "address": "TEST_DEST"},
        "ride_type": "economy",
    }
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "searching"
    assert t["customer_id"] == "user_test_customer"
    return t["trip_id"]


def test_assign_driver(trip_id):
    r = requests.post(f"{BASE_URL}/api/rides/{trip_id}/assign", headers=H(CUSTOMER))
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "accepted"
    assert d.get("driver_id")
    assert "driver" in d and d["driver"].get("name")


def test_status_on_trip(trip_id):
    r = requests.post(f"{BASE_URL}/api/rides/{trip_id}/status?status=on_trip", headers=H(CUSTOMER))
    assert r.status_code == 200
    assert r.json()["status"] == "on_trip"


def test_status_completed(trip_id):
    r = requests.post(f"{BASE_URL}/api/rides/{trip_id}/status?status=completed", headers=H(CUSTOMER))
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_rate_trip(trip_id):
    r = requests.post(f"{BASE_URL}/api/rides/{trip_id}/rate", headers=H(CUSTOMER), json={"rating": 5})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/rides/{trip_id}", headers=H(CUSTOMER))
    assert g.status_code == 200
    assert g.json()["rating"] == 5


def test_status_invalid():
    r = requests.post(f"{BASE_URL}/api/rides/x/status?status=bogus", headers=H(CUSTOMER))
    assert r.status_code == 400


def test_my_trips_customer(trip_id):
    r = requests.get(f"{BASE_URL}/api/rides/mine", headers=H(CUSTOMER))
    assert r.status_code == 200
    trips = r.json()
    assert any(t["trip_id"] == trip_id for t in trips)


def test_request_ride_requires_customer():
    body = {
        "pickup": {"lat": 25.2, "lng": 55.27},
        "destination": {"lat": 25.19, "lng": 55.27},
        "ride_type": "economy",
    }
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(DRIVER), json=body)
    assert r.status_code == 403


# ---------- Driver ----------
def test_driver_status():
    r = requests.post(f"{BASE_URL}/api/driver/status", headers=H(DRIVER),
                      json={"online": True, "lat": 25.2, "lng": 55.27})
    assert r.status_code == 200
    assert r.json()["online"] is True


def test_driver_earnings():
    r = requests.get(f"{BASE_URL}/api/driver/earnings", headers=H(DRIVER))
    assert r.status_code == 200
    d = r.json()
    for k in ("total_earnings", "total_trips", "today_earnings", "today_trips"):
        assert k in d


def test_driver_endpoints_forbidden_for_customer():
    r = requests.get(f"{BASE_URL}/api/driver/earnings", headers=H(CUSTOMER))
    assert r.status_code == 403


# ---------- Admin ----------
def test_admin_stats():
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=H(ADMIN))
    assert r.status_code == 200
    d = r.json()
    for k in ("users", "drivers", "customers", "trips", "completed", "revenue"):
        assert k in d


def test_admin_users():
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(ADMIN))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_trips():
    r = requests.get(f"{BASE_URL}/api/admin/trips", headers=H(ADMIN))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_forbidden_for_customer():
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=H(CUSTOMER))
    assert r.status_code == 403

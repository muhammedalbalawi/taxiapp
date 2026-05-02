"""Aero Ride backend pytest suite - iteration 2 (SAR, real matching, notifications)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://luxury-rides-59.preview.emergentagent.com").rstrip("/")
CUSTOMER = "test_session_aero_customer"
DRIVER = "test_session_aero_driver"
ADMIN = "test_session_aero_admin"

# Riyadh test coords (driver seeded near this point)
PICKUP = {"lat": 24.7136, "lng": 46.6753, "address": "TEST_PICKUP"}
DEST = {"lat": 24.7200, "lng": 46.6900, "address": "TEST_DEST"}


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def ensure_driver_online():
    """Force driver online + near pickup before tests that need matching."""
    r = requests.post(
        f"{BASE_URL}/api/driver/status",
        headers=H(DRIVER),
        json={"online": True, "lat": PICKUP["lat"], "lng": PICKUP["lng"]},
    )
    assert r.status_code == 200, r.text


# ---------- Health ----------
def test_root_ok():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "ok"
    assert d.get("currency") == "SAR"


# ---------- Auth ----------
def test_auth_me_customer():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER))
    assert r.status_code == 200
    assert r.json()["role"] == "customer"


def test_auth_me_driver_role():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(DRIVER))
    assert r.status_code == 200
    assert r.json()["role"] == "driver"


def test_auth_me_unauth():
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# ---------- Estimate ----------
def test_estimate_sar_with_breakdown():
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "comfort"}
    r = requests.post(f"{BASE_URL}/api/rides/estimate", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["currency"] == "SAR"
    assert d["ride_type"] == "comfort"
    assert d["distance_km"] > 0
    assert d["price"] > 0
    b = d["breakdown"]
    for k in ("base", "distance", "time"):
        assert k in b and b[k] >= 0
    # breakdown sum should be close to price (before min-fare bump)
    total = round(b["base"] + b["distance"] + b["time"], 2)
    assert abs(total - d["price"]) < 0.05 or d["price"] == 10.0


# ---------- Ride lifecycle ----------
@pytest.fixture(scope="module")
def trip():
    ensure_driver_online()
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy", "payment_method": "card"}
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    assert r.status_code == 200, r.text
    t = r.json()
    return t


def test_request_ride_offered_with_driver(trip):
    assert trip["customer_id"] == "user_test_customer"
    assert trip["currency"] == "SAR"
    assert trip["payment_method"] == "card"
    assert "breakdown" in trip
    # Should be auto-matched since driver is online at pickup
    assert trip["status"] == "offered", f"Expected offered, got {trip['status']}"
    assert trip["driver_id"] == "user_test_driver"
    assert trip["driver"] and trip["driver"].get("name")
    assert trip["driver"].get("eta_min", 0) >= 2


def test_request_ride_requires_customer():
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy"}
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(DRIVER), json=body)
    assert r.status_code == 403


def test_driver_incoming_shows_trip(trip):
    r = requests.get(f"{BASE_URL}/api/driver/incoming", headers=H(DRIVER))
    assert r.status_code == 200
    d = r.json()
    assert d is not None
    assert d["trip_id"] == trip["trip_id"]
    assert d["status"] == "offered"


def test_driver_accept(trip):
    r = requests.post(f"{BASE_URL}/api/rides/{trip['trip_id']}/accept", headers=H(DRIVER))
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"


def test_stranger_cannot_change_status(trip):
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/status?status=on_trip",
        headers=H(ADMIN),
    )
    assert r.status_code == 403


def test_status_on_trip_by_driver(trip):
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/status?status=on_trip",
        headers=H(DRIVER),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "on_trip"


def test_driver_location_update(trip):
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/location",
        headers=H(DRIVER),
        json={"lat": 24.7150, "lng": 46.6800},
    )
    assert r.status_code == 200
    # Verify driver.lat is updated on trip
    g = requests.get(f"{BASE_URL}/api/rides/{trip['trip_id']}", headers=H(CUSTOMER))
    assert g.status_code == 200
    assert abs(g.json()["driver"]["lat"] - 24.7150) < 0.001


def test_status_completed_by_customer(trip):
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/status?status=completed",
        headers=H(CUSTOMER),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_rate_customer_to_driver_updates_user_rating(trip):
    # Fetch current driver rating
    before = requests.get(f"{BASE_URL}/api/auth/me", headers=H(DRIVER)).json()
    before_count = before.get("rating_count", 0)
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/rate",
        headers=H(CUSTOMER),
        json={"rating": 5},
    )
    assert r.status_code == 200
    after = requests.get(f"{BASE_URL}/api/auth/me", headers=H(DRIVER)).json()
    assert after["rating_count"] == before_count + 1


def test_rate_driver_to_customer(trip):
    before = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    before_count = before.get("rating_count", 0)
    r = requests.post(
        f"{BASE_URL}/api/rides/{trip['trip_id']}/rate",
        headers=H(DRIVER),
        json={"rating": 4},
    )
    assert r.status_code == 200
    after = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert after["rating_count"] == before_count + 1


def test_status_invalid():
    # Need real trip id to pass 404 check; use completed trip id
    # Create a new trip to have one
    ensure_driver_online()
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy"}
    r0 = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    tid = r0.json()["trip_id"]
    r = requests.post(f"{BASE_URL}/api/rides/{tid}/status?status=bogus", headers=H(CUSTOMER))
    assert r.status_code == 400


# ---------- Reject + rematch ----------
def test_reject_goes_back_to_searching_or_no_driver():
    ensure_driver_online()
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy"}
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    assert r.status_code == 200
    t = r.json()
    assert t["status"] == "offered"
    tid = t["trip_id"]
    # Driver rejects - with only one seeded driver, should fall to no_driver
    r2 = requests.post(f"{BASE_URL}/api/rides/{tid}/reject", headers=H(DRIVER))
    assert r2.status_code == 200
    # Re-match happens synchronously; rejected driver excluded -> no_driver
    final = r2.json()
    assert final["status"] in ("searching", "no_driver")
    # If only one driver, should be no_driver
    assert final["status"] == "no_driver"
    assert final["driver"] is None


# ---------- Driver endpoints ----------
def test_driver_earnings_sar():
    r = requests.get(f"{BASE_URL}/api/driver/earnings", headers=H(DRIVER))
    assert r.status_code == 200
    d = r.json()
    assert d["currency"] == "SAR"
    for k in ("total_earnings", "total_trips", "today_earnings", "today_trips"):
        assert k in d


def test_driver_endpoints_forbidden_for_customer():
    r = requests.get(f"{BASE_URL}/api/driver/earnings", headers=H(CUSTOMER))
    assert r.status_code == 403


# ---------- Notifications ----------
def test_notifications_list_for_driver():
    r = requests.get(f"{BASE_URL}/api/notifications", headers=H(DRIVER))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Driver should have at least one ride_offer after matching flows above
    assert any(n["kind"] == "ride_offer" for n in data)


def test_notifications_mark_read():
    r = requests.post(f"{BASE_URL}/api/notifications/read", headers=H(DRIVER))
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # All should now be read
    after = requests.get(f"{BASE_URL}/api/notifications", headers=H(DRIVER)).json()
    assert all(n["read"] for n in after)


def test_notifications_customer_has_accepted():
    r = requests.get(f"{BASE_URL}/api/notifications", headers=H(CUSTOMER))
    assert r.status_code == 200
    data = r.json()
    # Customer should have a driver_accepted or trip_status entry after our flows
    kinds = [n["kind"] for n in data]
    assert any(k in ("driver_accepted", "trip_status", "ride_failed") for k in kinds)


# ---------- Admin ----------
def test_admin_stats_has_online_and_sar():
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=H(ADMIN))
    assert r.status_code == 200
    d = r.json()
    assert d["currency"] == "SAR"
    assert "online_drivers" in d
    for k in ("users", "drivers", "customers", "trips", "completed", "revenue"):
        assert k in d


def test_admin_drivers_list_with_online():
    ensure_driver_online()
    r = requests.get(f"{BASE_URL}/api/admin/drivers", headers=H(ADMIN))
    assert r.status_code == 200
    drivers = r.json()
    assert isinstance(drivers, list)
    assert len(drivers) >= 1
    seeded = next((d for d in drivers if d["user_id"] == "user_test_driver"), None)
    assert seeded is not None
    assert seeded["online"] is True
    assert "lat" in seeded and "lng" in seeded


def test_admin_forbidden_for_customer():
    r = requests.get(f"{BASE_URL}/api/admin/stats", headers=H(CUSTOMER))
    assert r.status_code == 403
    r2 = requests.get(f"{BASE_URL}/api/admin/drivers", headers=H(CUSTOMER))
    assert r2.status_code == 403


def test_admin_users():
    r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(ADMIN))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_trips_include_payment_method():
    r = requests.get(f"{BASE_URL}/api/admin/trips", headers=H(ADMIN))
    assert r.status_code == 200
    trips = r.json()
    # At least one trip should have payment_method set
    assert any(t.get("payment_method") in ("cash", "card", "apple_pay") for t in trips)

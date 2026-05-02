"""Aero Ride backend pytest suite — iteration 3.

Covers profile, OTP, PIN, 2FA, sessions, SOS, share, block, support, payments,
currency, driver earnings breakdown, withdrawal.

NOTE: logout-all is destructive; it runs LAST and re-seeds test sessions afterwards.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://luxury-rides-59.preview.emergentagent.com"
).rstrip("/")
CUSTOMER = "test_session_aero_customer"
DRIVER = "test_session_aero_driver"
ADMIN = "test_session_aero_admin"

PICKUP = {"lat": 24.7136, "lng": 46.6753, "address": "TEST_PICKUP"}
DEST = {"lat": 24.7200, "lng": 46.6900, "address": "TEST_DEST"}

# Direct mongo for re-seeding sessions after logout-all destructive tests
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def reseed_sessions():
    """Re-insert the canonical test sessions if missing/expired."""
    for uid, tok in [
        ("user_test_customer", CUSTOMER),
        ("user_test_driver", DRIVER),
        ("user_test_admin", ADMIN),
    ]:
        _db.user_sessions.update_one(
            {"session_token": tok},
            {
                "$set": {
                    "user_id": uid,
                    "session_token": tok,
                    "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )


@pytest.fixture(scope="session", autouse=True)
def _ensure_sessions():
    reseed_sessions()
    yield
    reseed_sessions()


# ---------------- Profile ----------------
def test_profile_update_persists():
    body = {"name": "TEST_Customer", "phone": "+966500000001",
            "currency": "USD", "notif_prefs": {"rides": True, "promos": True, "payments": False, "security": True}}
    r = requests.post(f"{BASE_URL}/api/profile/update", headers=H(CUSTOMER), json=body)
    assert r.status_code == 200, r.text
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert me["name"] == "TEST_Customer"
    assert me["phone"] == "+966500000001"
    assert me["currency"] == "USD"
    assert me["notif_prefs"]["promos"] is True
    # restore SAR for later tests
    requests.post(f"{BASE_URL}/api/profile/update", headers=H(CUSTOMER), json={"currency": "SAR"})


def test_profile_update_rejects_bad_currency():
    r = requests.post(f"{BASE_URL}/api/profile/update", headers=H(CUSTOMER),
                      json={"currency": "JPY"})
    assert r.status_code == 400


def test_profile_driver_sets_verified():
    body = {"car_make": "Lexus", "car_model": "ES", "plate": "ريـ 2468",
            "license_image": "data:image/png;base64,AAA", "id_image": "data:image/png;base64,BBB"}
    r = requests.post(f"{BASE_URL}/api/profile/driver", headers=H(DRIVER), json=body)
    assert r.status_code == 200, r.text
    assert r.json()["verified"] is True
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(DRIVER)).json()
    assert me["car_make"] == "Lexus"
    assert me["plate"] == "ريـ 2468"
    assert me["verified"] is True


def test_profile_driver_forbidden_for_customer():
    r = requests.post(f"{BASE_URL}/api/profile/driver", headers=H(CUSTOMER),
                      json={"car_make": "X"})
    assert r.status_code == 403


# ---------------- OTP (simulated) ----------------
def test_otp_send_returns_dev_code_and_verify():
    r = requests.post(f"{BASE_URL}/api/auth/otp/send", headers=H(CUSTOMER),
                      json={"channel": "phone"})
    assert r.status_code == 200
    code = r.json().get("dev_code")
    assert code and len(code) == 6
    r2 = requests.post(f"{BASE_URL}/api/auth/otp/verify", headers=H(CUSTOMER),
                       json={"channel": "phone", "code": code})
    assert r2.status_code == 200
    assert r2.json()["verified"] is True
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert me["phone_verified"] is True


def test_otp_verify_wrong_code():
    requests.post(f"{BASE_URL}/api/auth/otp/send", headers=H(CUSTOMER),
                  json={"channel": "phone"})
    r = requests.post(f"{BASE_URL}/api/auth/otp/verify", headers=H(CUSTOMER),
                     json={"channel": "phone", "code": "000000"})
    assert r.status_code == 400


# ---------------- PIN ----------------
def test_pin_set_and_verify():
    r = requests.post(f"{BASE_URL}/api/auth/pin/set", headers=H(CUSTOMER),
                     json={"pin": "1234"})
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert me["pin_set"] is True
    ok = requests.post(f"{BASE_URL}/api/auth/pin/verify", headers=H(CUSTOMER),
                       json={"pin": "1234"})
    assert ok.status_code == 200
    bad = requests.post(f"{BASE_URL}/api/auth/pin/verify", headers=H(CUSTOMER),
                        json={"pin": "9999"})
    assert bad.status_code == 401


def test_pin_too_short():
    r = requests.post(f"{BASE_URL}/api/auth/pin/set", headers=H(CUSTOMER),
                     json={"pin": "12"})
    assert r.status_code == 400


# ---------------- 2FA ----------------
def test_2fa_toggle():
    r = requests.post(f"{BASE_URL}/api/auth/2fa", headers=H(CUSTOMER),
                     json={"enabled": True})
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert me["two_factor"] is True
    requests.post(f"{BASE_URL}/api/auth/2fa", headers=H(CUSTOMER), json={"enabled": False})


# ---------------- Sessions list (no token leak) ----------------
def test_sessions_list_does_not_leak_token():
    r = requests.get(f"{BASE_URL}/api/auth/sessions", headers=H(CUSTOMER))
    assert r.status_code == 200
    out = r.json()
    assert isinstance(out, list)
    assert len(out) >= 1
    for s in out:
        assert "session_token" not in s
        assert s.get("user_id") == "user_test_customer"


# ---------------- Safety / SOS / share / block ----------------
def test_sos_creates_alert():
    r = requests.post(f"{BASE_URL}/api/safety/sos", headers=H(CUSTOMER),
                     json={"lat": PICKUP["lat"], "lng": PICKUP["lng"]})
    assert r.status_code == 200
    aid = r.json().get("alert_id")
    assert aid and aid.startswith("sos_")


@pytest.fixture(scope="module")
def shared_trip():
    # ensure driver online + create a fresh trip
    requests.post(f"{BASE_URL}/api/driver/status", headers=H(DRIVER),
                  json={"online": True, "lat": PICKUP["lat"], "lng": PICKUP["lng"]})
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy", "payment_method": "card"}
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_share_trip_for_participant(shared_trip):
    tid = shared_trip["trip_id"]
    r = requests.get(f"{BASE_URL}/api/rides/{tid}/share", headers=H(CUSTOMER))
    assert r.status_code == 200
    d = r.json()
    assert d.get("share_token") and len(d["share_token"]) >= 8


def test_share_trip_forbidden_for_stranger(shared_trip):
    tid = shared_trip["trip_id"]
    r = requests.get(f"{BASE_URL}/api/rides/{tid}/share", headers=H(ADMIN))
    assert r.status_code == 404  # treated as not-your-trip


def test_block_user_recorded():
    r = requests.post(f"{BASE_URL}/api/users/block", headers=H(CUSTOMER),
                     json={"user_id": "user_test_driver", "reason": "TEST_block"})
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER)).json()
    assert "user_test_driver" in me.get("blocked_users", [])


# ---------------- Support ----------------
def test_faqs_returns_5_with_en_ar():
    r = requests.get(f"{BASE_URL}/api/support/faqs")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    for f in data:
        for k in ("q_en", "a_en", "q_ar", "a_ar"):
            assert k in f and f[k]


def test_ticket_create_list_reply():
    r = requests.post(f"{BASE_URL}/api/support/ticket", headers=H(CUSTOMER),
                     json={"subject": "TEST_Subject", "message": "Help me", "kind": "ride"})
    assert r.status_code == 200, r.text
    tk = r.json()
    assert tk["status"] == "open"
    tid = tk["ticket_id"]

    lst = requests.get(f"{BASE_URL}/api/support/tickets", headers=H(CUSTOMER)).json()
    assert any(t["ticket_id"] == tid for t in lst)

    rep = requests.post(f"{BASE_URL}/api/support/tickets/{tid}/reply",
                        headers=H(CUSTOMER), json={"text": "follow-up"})
    assert rep.status_code == 200
    # Verify both user reply + auto-agent reply were appended
    lst2 = requests.get(f"{BASE_URL}/api/support/tickets", headers=H(CUSTOMER)).json()
    target = next(t for t in lst2 if t["ticket_id"] == tid)
    msgs = target.get("messages", [])
    senders = [m["from"] for m in msgs]
    assert senders.count("user") >= 2
    assert "agent" in senders


# ---------------- Payment methods ----------------
def test_payment_methods_crud():
    # Add card
    r = requests.post(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER),
                     json={"kind": "card", "label": "TEST_Visa", "last4": "4242", "brand": "Visa"})
    assert r.status_code == 200, r.text
    mid = r.json()["method_id"]
    # Add apple_pay
    r2 = requests.post(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER),
                      json={"kind": "apple_pay", "label": "TEST_Apple"})
    assert r2.status_code == 200
    # Add stc_pay
    r3 = requests.post(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER),
                      json={"kind": "stc_pay", "label": "TEST_STC"})
    assert r3.status_code == 200
    lst = requests.get(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER)).json()
    kinds = {m["kind"] for m in lst}
    assert {"card", "apple_pay", "stc_pay"} <= kinds
    # Delete the card
    d = requests.delete(f"{BASE_URL}/api/payments/methods/{mid}", headers=H(CUSTOMER))
    assert d.status_code == 200
    lst2 = requests.get(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER)).json()
    assert all(m["method_id"] != mid for m in lst2)


def test_payment_methods_rejects_invalid_kind():
    r = requests.post(f"{BASE_URL}/api/payments/methods", headers=H(CUSTOMER),
                     json={"kind": "bitcoin", "label": "X"})
    assert r.status_code == 422  # pydantic literal


# ---------------- Payment history / refund / invoice ----------------
@pytest.fixture(scope="module")
def completed_trip():
    # create + drive a trip to completion
    requests.post(f"{BASE_URL}/api/driver/status", headers=H(DRIVER),
                  json={"online": True, "lat": PICKUP["lat"], "lng": PICKUP["lng"]})
    body = {"pickup": PICKUP, "destination": DEST, "ride_type": "economy", "payment_method": "card"}
    r = requests.post(f"{BASE_URL}/api/rides/request", headers=H(CUSTOMER), json=body)
    t = r.json()
    tid = t["trip_id"]
    if t["status"] == "offered":
        requests.post(f"{BASE_URL}/api/rides/{tid}/accept", headers=H(DRIVER))
        requests.post(f"{BASE_URL}/api/rides/{tid}/status?status=on_trip", headers=H(DRIVER))
        requests.post(f"{BASE_URL}/api/rides/{tid}/status?status=completed", headers=H(CUSTOMER))
    return tid


def test_payment_history_includes_completed(completed_trip):
    r = requests.get(f"{BASE_URL}/api/payments/history", headers=H(CUSTOMER))
    assert r.status_code == 200
    hist = r.json()
    assert any(t["trip_id"] == completed_trip for t in hist)


def test_refund_creates_pending(completed_trip):
    r = requests.post(f"{BASE_URL}/api/payments/refund", headers=H(CUSTOMER),
                     json={"trip_id": completed_trip, "reason": "TEST_overcharged"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "pending"
    assert d["currency"] == "SAR"
    assert d["amount"] > 0


def test_invoice(completed_trip):
    r = requests.get(f"{BASE_URL}/api/payments/invoice/{completed_trip}", headers=H(CUSTOMER))
    assert r.status_code == 200
    inv = r.json()
    assert inv["invoice_no"].startswith("INV-")
    assert inv["currency"] == "SAR"
    assert inv["total"] > 0
    assert "breakdown" in inv


# ---------------- Currency ----------------
def test_currency_rates():
    r = requests.get(f"{BASE_URL}/api/currency/rates")
    assert r.status_code == 200
    d = r.json()
    assert d["base"] == "SAR"
    for c in ("SAR", "USD", "EUR", "AED", "GBP"):
        assert c in d["rates"]


def test_currency_convert_sar_to_usd():
    r = requests.post(f"{BASE_URL}/api/currency/convert",
                     json={"amount": 100, "from_currency": "SAR", "to_currency": "USD"})
    assert r.status_code == 200
    d = r.json()
    assert d["currency"] == "USD"
    # 100 SAR * 0.267 = 26.7
    assert 25 < d["amount"] < 30


def test_currency_convert_invalid():
    r = requests.post(f"{BASE_URL}/api/currency/convert",
                     json={"amount": 100, "from_currency": "SAR", "to_currency": "JPY"})
    assert r.status_code == 400


# ---------------- Driver earnings breakdown / withdraw ----------------
def test_driver_earnings_breakdown():
    r = requests.get(f"{BASE_URL}/api/driver/earnings/breakdown", headers=H(DRIVER))
    assert r.status_code == 200
    d = r.json()
    for k in ("today", "week", "month", "total", "trips", "currency"):
        assert k in d
    assert d["currency"] == "SAR"


def test_driver_earnings_breakdown_forbidden_customer():
    r = requests.get(f"{BASE_URL}/api/driver/earnings/breakdown", headers=H(CUSTOMER))
    assert r.status_code == 403


def test_driver_withdraw():
    r = requests.post(f"{BASE_URL}/api/driver/withdraw", headers=H(DRIVER),
                     json={"amount": 50.0, "method": "bank", "account": "TEST_IBAN"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "pending"
    assert d["currency"] == "SAR"


# ---------------- Logout-all (DESTRUCTIVE — runs LAST via zzz_ prefix) ----------------
def test_zzz_logout_all_revokes_sessions():
    """Use a temp session for the customer so the canonical token survives."""
    tmp_token = f"tmp_logoutall_{uuid.uuid4().hex[:10]}"
    _db.user_sessions.insert_one({
        "user_id": "user_test_customer",
        "session_token": tmp_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    # logout-all on this user — should kill ALL sessions including tmp + canonical
    r = requests.post(f"{BASE_URL}/api/auth/logout-all", headers=H(tmp_token))
    assert r.status_code == 200
    # Confirm tmp token now 401
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(tmp_token))
    assert me.status_code == 401
    # Confirm canonical customer also revoked
    me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER))
    assert me2.status_code == 401
    # Re-seed canonical sessions for downstream agents
    reseed_sessions()
    me3 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(CUSTOMER))
    assert me3.status_code == 200

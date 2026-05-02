"""Aero Ride API — production-grade ride-hailing backend (SAR, real matching, notifications)."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, math, asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Aero Ride API")
api_router = APIRouter(prefix="/api")

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
DRIVER_RESPONSE_TIMEOUT_SEC = 15

Role = Literal["customer", "driver", "admin"]
PaymentMethod = Literal["cash", "card", "apple_pay", "stc_pay"]

# Currency conversion (fixed rates for demo — SAR base)
FX_RATES = {"SAR": 1.0, "USD": 0.267, "EUR": 0.243, "AED": 0.98, "GBP": 0.209}


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = "customer"
    rating: float = 5.0
    rating_count: int = 0
    phone: Optional[str] = None
    phone_verified: bool = False
    email_verified: bool = False
    currency: str = "SAR"
    notif_prefs: Dict[str, bool] = Field(default_factory=lambda: {"rides": True, "payments": True, "security": True, "promos": False})
    two_factor: bool = False
    pin_set: bool = False
    blocked_users: List[str] = Field(default_factory=list)
    # Driver fields
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    plate: Optional[str] = None
    license_image: Optional[str] = None  # base64
    id_image: Optional[str] = None  # base64
    verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LocationIn(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class FareEstimateIn(BaseModel):
    pickup: LocationIn
    destination: LocationIn
    ride_type: Literal["economy", "comfort", "premium"] = "economy"


# Pricing in SAR (Saudi market)
RIDE_MULTI = {"economy": 1.0, "comfort": 1.4, "premium": 2.0}
BASE_SAR = 6.0       # base fare
PER_KM_SAR = 2.5     # per kilometer
PER_MIN_SAR = 0.6    # per minute (time-based)
MIN_FARE_SAR = 10.0


def haversine(a: LocationIn, b: LocationIn) -> float:
    R = 6371.0
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def compute_fare(p: LocationIn, d: LocationIn, ride_type: str) -> Dict[str, Any]:
    distance = max(haversine(p, d), 0.5)
    duration = max(int(distance * 2.8), 3)
    multi = RIDE_MULTI.get(ride_type, 1.0)
    base = BASE_SAR * multi
    distance_fare = round(distance * PER_KM_SAR * multi, 2)
    time_fare = round(duration * PER_MIN_SAR * multi, 2)
    total = max(round(base + distance_fare + time_fare, 2), MIN_FARE_SAR)
    return {
        "distance_km": round(distance, 2),
        "duration_min": duration,
        "ride_type": ride_type,
        "currency": "SAR",
        "breakdown": {
            "base": round(base, 2),
            "distance": distance_fare,
            "time": time_fare,
        },
        "price": total,
    }


async def get_token(req: Request) -> Optional[str]:
    t = req.cookies.get("session_token")
    if t: return t
    a = req.headers.get("Authorization") or req.headers.get("authorization")
    if a and a.startswith("Bearer "): return a[7:]
    return None


async def current_user(req: Request) -> User:
    tok = await get_token(req)
    if not tok: raise HTTPException(401, "Not authenticated")
    s = await db.user_sessions.find_one({"session_token": tok}, {"_id": 0})
    if not s: raise HTTPException(401, "Invalid session")
    exp = s["expires_at"]
    if isinstance(exp, str): exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc): raise HTTPException(401, "Session expired")
    u = await db.users.find_one({"user_id": s["user_id"]}, {"_id": 0})
    if not u: raise HTTPException(401, "User not found")
    u.setdefault("rating", 5.0); u.setdefault("rating_count", 0)
    u.setdefault("currency", "SAR")
    u.setdefault("notif_prefs", {"rides": True, "payments": True, "security": True, "promos": False})
    u.setdefault("blocked_users", [])
    u.setdefault("phone_verified", False); u.setdefault("email_verified", False)
    u.setdefault("two_factor", False); u.setdefault("pin_set", False); u.setdefault("verified", False)
    return User(**u)


async def notify(user_id: str, kind: str, title: str, body: str, data: dict = None):
    await db.notifications.insert_one({
        "notif_id": f"n_{uuid.uuid4().hex[:10]}",
        "user_id": user_id, "kind": kind, "title": title, "body": body,
        "data": data or {}, "read": False,
        "created_at": datetime.now(timezone.utc),
    })


# ---------- Auth ----------
@api_router.post("/auth/session")
async def create_session(response: Response, x_session_id: str = Header(..., alias="X-Session-ID")):
    async with httpx.AsyncClient(timeout=15) as h:
        r = await h.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": x_session_id})
        if r.status_code != 200: raise HTTPException(401, "Failed to verify")
        data = r.json()
    email = data["email"]
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        u = {"user_id": uid, "email": email, "name": data.get("name", email.split("@")[0]),
             "picture": data.get("picture"), "role": "customer", "rating": 5.0, "rating_count": 0,
             "created_at": datetime.now(timezone.utc)}
        await db.users.insert_one(u); u.pop("_id", None)
    else:
        await db.users.update_one({"email": email},
            {"$set": {"name": data.get("name", u["name"]), "picture": data.get("picture")}})
    tok = data["session_token"]
    await db.user_sessions.insert_one({"user_id": u["user_id"], "session_token": tok,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)})
    response.set_cookie("session_token", tok, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return {"user": User(**u).model_dump(mode="json"), "session_token": tok}


@api_router.get("/auth/me")
async def auth_me(req: Request):
    return (await current_user(req)).model_dump(mode="json")


@api_router.post("/auth/logout")
async def logout(req: Request, resp: Response):
    tok = await get_token(req)
    if tok: await db.user_sessions.delete_one({"session_token": tok})
    resp.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.post("/auth/role")
async def set_role(body: dict, req: Request):
    u = await current_user(req)
    role = body.get("role")
    if role not in ("customer", "driver"): raise HTTPException(400, "Invalid role")
    await db.users.update_one({"user_id": u.user_id}, {"$set": {"role": role}})
    upd = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    upd.setdefault("rating", 5.0); upd.setdefault("rating_count", 0)
    return User(**upd).model_dump(mode="json")


# ---------- Ride ----------
@api_router.post("/rides/estimate")
async def estimate(body: FareEstimateIn):
    return compute_fare(body.pickup, body.destination, body.ride_type)


class TripCreate(BaseModel):
    pickup: LocationIn
    destination: LocationIn
    ride_type: Literal["economy", "comfort", "premium"] = "economy"
    payment_method: PaymentMethod = "cash"


@api_router.post("/rides/request")
async def request_ride(body: TripCreate, req: Request):
    u = await current_user(req)
    if u.role != "customer": raise HTTPException(403, "Customers only")
    f = compute_fare(body.pickup, body.destination, body.ride_type)
    tid = f"trip_{uuid.uuid4().hex[:12]}"
    trip = {
        "trip_id": tid, "customer_id": u.user_id, "customer_name": u.name,
        "driver_id": None, "driver": None,
        "pickup": body.pickup.model_dump(), "destination": body.destination.model_dump(),
        "ride_type": body.ride_type, "payment_method": body.payment_method,
        "distance_km": f["distance_km"], "duration_min": f["duration_min"],
        "price": f["price"], "currency": "SAR", "breakdown": f["breakdown"],
        "status": "searching", "rejected_by": [],
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    }
    await db.trips.insert_one(trip)
    await match_driver(tid)
    out = await db.trips.find_one({"trip_id": tid}, {"_id": 0})
    return out


async def match_driver(trip_id: str):
    """Find nearest online driver (excluding rejecters); set driver and offer."""
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip or trip["status"] not in ("searching", "rejected"): return
    rejected = trip.get("rejected_by", [])
    online_drivers = await db.driver_state.find({"online": True}, {"_id": 0}).to_list(200)
    candidates = []
    for d in online_drivers:
        if d["user_id"] in rejected: continue
        if d.get("lat") is None or d.get("lng") is None: continue
        dist = haversine(LocationIn(**trip["pickup"]), LocationIn(lat=d["lat"], lng=d["lng"]))
        candidates.append((dist, d))
    candidates.sort(key=lambda x: x[0])
    if not candidates:
        await db.trips.update_one({"trip_id": trip_id},
            {"$set": {"status": "no_driver", "updated_at": datetime.now(timezone.utc)}})
        await notify(trip["customer_id"], "ride_failed", "No drivers available", "Please try again shortly.")
        return
    dist_km, drv = candidates[0]
    user = await db.users.find_one({"user_id": drv["user_id"]}, {"_id": 0})
    eta = max(2, int(dist_km * 2.5))
    driver_obj = {
        "driver_id": drv["user_id"], "name": user.get("name", "Driver") if user else "Driver",
        "rating": round(user.get("rating", 5.0), 2) if user else 5.0,
        "lat": drv["lat"], "lng": drv["lng"], "eta_min": eta,
        "car": user.get("car", "Toyota Camry") if user else "Toyota Camry",
        "plate": user.get("plate", "AER-001") if user else "AER-001",
    }
    await db.trips.update_one({"trip_id": trip_id},
        {"$set": {"status": "offered", "driver_id": drv["user_id"], "driver": driver_obj,
                  "offered_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await notify(drv["user_id"], "ride_offer", "New ride request",
                 f"{trip['distance_km']} km • {trip['price']} SAR", {"trip_id": trip_id})
    asyncio.create_task(driver_response_timeout(trip_id, drv["user_id"]))


async def driver_response_timeout(trip_id: str, driver_id: str):
    await asyncio.sleep(DRIVER_RESPONSE_TIMEOUT_SEC)
    t = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if t and t["status"] == "offered" and t.get("driver_id") == driver_id:
        await db.trips.update_one({"trip_id": trip_id},
            {"$push": {"rejected_by": driver_id},
             "$set": {"status": "searching", "driver_id": None, "driver": None,
                      "updated_at": datetime.now(timezone.utc)}})
        await match_driver(trip_id)


@api_router.post("/rides/{trip_id}/accept")
async def driver_accept(trip_id: str, req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    t = await db.trips.find_one({"trip_id": trip_id, "driver_id": u.user_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    if t["status"] != "offered": raise HTTPException(400, "Not offered")
    await db.trips.update_one({"trip_id": trip_id},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc)}})
    await notify(t["customer_id"], "driver_accepted", "Driver assigned",
                 f"{t['driver']['name']} • ETA {t['driver']['eta_min']} min", {"trip_id": trip_id})
    return await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})


@api_router.post("/rides/{trip_id}/reject")
async def driver_reject(trip_id: str, req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    t = await db.trips.find_one({"trip_id": trip_id, "driver_id": u.user_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    await db.trips.update_one({"trip_id": trip_id},
        {"$push": {"rejected_by": u.user_id},
         "$set": {"status": "searching", "driver_id": None, "driver": None,
                  "updated_at": datetime.now(timezone.utc)}})
    await match_driver(trip_id)
    return await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})


@api_router.post("/rides/{trip_id}/status")
async def update_status(trip_id: str, status: str, req: Request):
    u = await current_user(req)
    allowed = ["arriving", "on_trip", "completed", "cancelled"]
    if status not in allowed: raise HTTPException(400, "Invalid")
    t = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    if u.user_id not in (t.get("customer_id"), t.get("driver_id")):
        raise HTTPException(403, "Not your trip")
    await db.trips.update_one({"trip_id": trip_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}})
    if status in ("arriving", "on_trip", "completed"):
        await notify(t["customer_id"], "trip_status", f"Trip {status.replace('_',' ')}", "", {"trip_id": trip_id})
    return await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})


@api_router.post("/rides/{trip_id}/location")
async def update_driver_location(trip_id: str, body: LocationIn, req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    t = await db.trips.find_one({"trip_id": trip_id, "driver_id": u.user_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    await db.trips.update_one({"trip_id": trip_id},
        {"$set": {"driver.lat": body.lat, "driver.lng": body.lng,
                  "updated_at": datetime.now(timezone.utc)}})
    await db.driver_state.update_one({"user_id": u.user_id},
        {"$set": {"lat": body.lat, "lng": body.lng, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}


@api_router.post("/rides/{trip_id}/rate")
async def rate(trip_id: str, body: dict, req: Request):
    u = await current_user(req)
    rating = int(body.get("rating", 0))
    if not 1 <= rating <= 5: raise HTTPException(400, "Invalid")
    t = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    if u.user_id == t.get("customer_id"):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"customer_rating": rating}})
        target = t.get("driver_id")
    elif u.user_id == t.get("driver_id"):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"driver_rating": rating}})
        target = t.get("customer_id")
    else:
        raise HTTPException(403, "Not your trip")
    if target:
        tu = await db.users.find_one({"user_id": target}, {"_id": 0})
        if tu:
            cnt = tu.get("rating_count", 0); avg = tu.get("rating", 5.0)
            new_avg = round(((avg * cnt) + rating) / (cnt + 1), 2)
            await db.users.update_one({"user_id": target},
                {"$set": {"rating": new_avg, "rating_count": cnt + 1}})
    return {"ok": True}


@api_router.get("/rides/mine")
async def my_trips(req: Request):
    u = await current_user(req)
    q = {"customer_id": u.user_id} if u.role == "customer" else {"driver_id": u.user_id}
    return await db.trips.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.get("/rides/{trip_id}")
async def get_trip(trip_id: str, req: Request):
    await current_user(req)
    t = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    return t


# ---------- Driver ----------
@api_router.post("/driver/status")
async def driver_status(body: dict, req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    await db.driver_state.update_one({"user_id": u.user_id},
        {"$set": {"user_id": u.user_id, "online": bool(body.get("online")),
                  "lat": body.get("lat"), "lng": body.get("lng"),
                  "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return {"ok": True, "online": bool(body.get("online"))}


@api_router.get("/driver/incoming")
async def driver_incoming(req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    t = await db.trips.find_one({"driver_id": u.user_id, "status": "offered"}, {"_id": 0})
    return t


@api_router.get("/driver/earnings")
async def earnings(req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    trips = await db.trips.find({"driver_id": u.user_id, "status": "completed"}, {"_id": 0}).to_list(500)
    total = sum(t.get("price", 0) for t in trips)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    def _dt(v):
        if isinstance(v, datetime): return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc)
    today = [t for t in trips if _dt(t.get("created_at")) >= today_start]
    return {
        "total_earnings": round(total, 2), "total_trips": len(trips),
        "today_earnings": round(sum(t.get("price", 0) for t in today), 2),
        "today_trips": len(today), "currency": "SAR",
    }


# ---------- Notifications ----------
@api_router.get("/notifications")
async def my_notifs(req: Request):
    u = await current_user(req)
    return await db.notifications.find({"user_id": u.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)


@api_router.post("/notifications/read")
async def read_all(req: Request):
    u = await current_user(req)
    await db.notifications.update_many({"user_id": u.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Admin ----------
@api_router.get("/admin/stats")
async def admin_stats(req: Request):
    u = await current_user(req)
    if u.role != "admin": raise HTTPException(403, "Admin only")
    users = await db.users.count_documents({})
    drivers = await db.users.count_documents({"role": "driver"})
    customers = await db.users.count_documents({"role": "customer"})
    online = await db.driver_state.count_documents({"online": True})
    trips = await db.trips.count_documents({})
    completed = await db.trips.count_documents({"status": "completed"})
    revs = await db.trips.find({"status": "completed"}, {"_id": 0, "price": 1}).to_list(2000)
    revenue = round(sum(t.get("price", 0) for t in revs), 2)
    return {"users": users, "drivers": drivers, "customers": customers, "online_drivers": online,
            "trips": trips, "completed": completed, "revenue": revenue, "currency": "SAR"}


@api_router.get("/admin/users")
async def admin_users(req: Request):
    u = await current_user(req)
    if u.role != "admin": raise HTTPException(403, "Admin only")
    return await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/drivers")
async def admin_drivers(req: Request):
    u = await current_user(req)
    if u.role != "admin": raise HTTPException(403, "Admin only")
    drivers = await db.users.find({"role": "driver"}, {"_id": 0}).to_list(500)
    states = {s["user_id"]: s async for s in db.driver_state.find({}, {"_id": 0})}
    out = []
    for d in drivers:
        st = states.get(d["user_id"], {})
        out.append({**d, "online": bool(st.get("online")), "lat": st.get("lat"), "lng": st.get("lng")})
    return out


@api_router.get("/admin/trips")
async def admin_trips(req: Request):
    u = await current_user(req)
    if u.role != "admin": raise HTTPException(403, "Admin only")
    return await db.trips.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ---------- Profile ----------
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    picture: Optional[str] = None  # base64
    currency: Optional[str] = None
    notif_prefs: Optional[Dict[str, bool]] = None


@api_router.post("/profile/update")
async def profile_update(body: ProfileUpdate, req: Request):
    u = await current_user(req)
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "currency" in upd and upd["currency"] not in FX_RATES:
        raise HTTPException(400, "Unsupported currency")
    if upd:
        await db.users.update_one({"user_id": u.user_id}, {"$set": upd})
    return {"ok": True}





class DriverProfileIn(BaseModel):
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    plate: Optional[str] = None
    license_image: Optional[str] = None
    id_image: Optional[str] = None


@api_router.post("/profile/driver")
async def update_driver_profile(body: DriverProfileIn, req: Request):
    u = await current_user(req)
    if u.role != "driver":
        raise HTTPException(403, "Driver only")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    # Consider verified when essentials present
    if "license_image" in upd and "id_image" in upd:
        upd["verified"] = True
    await db.users.update_one({"user_id": u.user_id}, {"$set": upd})
    return {"ok": True, "verified": upd.get("verified", u.verified)}


# ---------- OTP (simulated) ----------
@api_router.post("/auth/otp/send")
async def otp_send(body: dict, req: Request):
    u = await current_user(req)
    channel = body.get("channel", "phone")
    code = f"{uuid.uuid4().int % 1000000:06d}"
    await db.otp_codes.update_one(
        {"user_id": u.user_id, "channel": channel},
        {"$set": {"user_id": u.user_id, "channel": channel, "code": code,
                  "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5)}},
        upsert=True,
    )
    # Dev: return code (in prod, SMS/email it)
    return {"ok": True, "dev_code": code, "message": "OTP sent"}


@api_router.post("/auth/otp/verify")
async def otp_verify(body: dict, req: Request):
    u = await current_user(req)
    channel = body.get("channel", "phone")
    code = body.get("code", "")
    rec = await db.otp_codes.find_one({"user_id": u.user_id, "channel": channel}, {"_id": 0})
    if not rec or rec["code"] != code:
        raise HTTPException(400, "Invalid code")
    exp = rec["expires_at"]
    if isinstance(exp, str): exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Code expired")
    field = "phone_verified" if channel == "phone" else "email_verified"
    await db.users.update_one({"user_id": u.user_id}, {"$set": {field: True}})
    await db.otp_codes.delete_one({"user_id": u.user_id, "channel": channel})
    return {"ok": True, "verified": True}


# ---------- Security ----------
import hashlib


class PinIn(BaseModel):
    pin: str


@api_router.post("/auth/pin/set")
async def set_pin(body: PinIn, req: Request):
    u = await current_user(req)
    if len(body.pin) < 4: raise HTTPException(400, "PIN too short")
    h = hashlib.sha256(body.pin.encode()).hexdigest()
    await db.users.update_one({"user_id": u.user_id}, {"$set": {"pin_hash": h, "pin_set": True}})
    return {"ok": True}


@api_router.post("/auth/pin/verify")
async def verify_pin(body: PinIn, req: Request):
    u = await current_user(req)
    user_doc = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    if not user_doc.get("pin_hash"): raise HTTPException(400, "PIN not set")
    if user_doc["pin_hash"] != hashlib.sha256(body.pin.encode()).hexdigest():
        await db.security_events.insert_one({
            "user_id": u.user_id, "kind": "pin_failed",
            "at": datetime.now(timezone.utc),
        })
        raise HTTPException(401, "Invalid PIN")
    return {"ok": True}


@api_router.post("/auth/2fa")
async def toggle_2fa(body: dict, req: Request):
    u = await current_user(req)
    await db.users.update_one({"user_id": u.user_id}, {"$set": {"two_factor": bool(body.get("enabled"))}})
    return {"ok": True, "two_factor": bool(body.get("enabled"))}


@api_router.post("/auth/logout-all")
async def logout_all(req: Request, resp: Response):
    u = await current_user(req)
    await db.user_sessions.delete_many({"user_id": u.user_id})
    resp.delete_cookie("session_token", path="/")
    await notify(u.user_id, "security", "Logged out everywhere", "All devices have been signed out.")
    return {"ok": True}


@api_router.get("/auth/sessions")
async def sessions(req: Request):
    u = await current_user(req)
    out = await db.user_sessions.find({"user_id": u.user_id}, {"_id": 0, "session_token": 0}).to_list(50)
    return out


# ---------- Safety ----------
class SOSIn(BaseModel):
    trip_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@api_router.post("/safety/sos")
async def sos(body: SOSIn, req: Request):
    u = await current_user(req)
    alert = {
        "alert_id": f"sos_{uuid.uuid4().hex[:10]}",
        "user_id": u.user_id, "user_name": u.name, "role": u.role,
        "trip_id": body.trip_id, "lat": body.lat, "lng": body.lng,
        "status": "active", "created_at": datetime.now(timezone.utc),
    }
    await db.sos_alerts.insert_one(alert)
    await notify(u.user_id, "security", "SOS sent", "Support has been notified.")
    return {"ok": True, "alert_id": alert["alert_id"]}


@api_router.get("/rides/{trip_id}/share")
async def share_trip(trip_id: str, req: Request):
    u = await current_user(req)
    t = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not t or u.user_id not in (t.get("customer_id"), t.get("driver_id")):
        raise HTTPException(404, "Not found")
    token = uuid.uuid4().hex[:12]
    await db.trip_shares.insert_one({"token": token, "trip_id": trip_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)})
    return {"share_token": token, "url": f"/share/{token}"}


class BlockIn(BaseModel):
    user_id: str
    reason: Optional[str] = None


@api_router.post("/users/block")
async def block_user(body: BlockIn, req: Request):
    u = await current_user(req)
    await db.users.update_one({"user_id": u.user_id}, {"$addToSet": {"blocked_users": body.user_id}})
    await db.reports.insert_one({
        "report_id": f"rep_{uuid.uuid4().hex[:8]}", "by": u.user_id, "target": body.user_id,
        "reason": body.reason, "kind": "block", "at": datetime.now(timezone.utc),
    })
    return {"ok": True}


# ---------- Support / Help ----------
FAQS = [
    {"q_en": "How do I book a ride?", "a_en": "Open the app, set your pickup and destination, pick a ride type, and tap Confirm.",
     "q_ar": "كيف أطلب رحلة؟", "a_ar": "افتح التطبيق، حدد نقطة الانطلاق والوجهة، اختر نوع الرحلة، ثم اضغط تأكيد."},
    {"q_en": "What payment methods are supported?", "a_en": "Cash, Card, Apple Pay, and STC Pay.",
     "q_ar": "ما طرق الدفع المتاحة؟", "a_ar": "نقداً، بطاقة، Apple Pay، و STC Pay."},
    {"q_en": "How can I report a safety concern?", "a_en": "Tap the SOS button during a trip or go to Help Center → Report.",
     "q_ar": "كيف أبلغ عن مشكلة أمان؟", "a_ar": "اضغط زر SOS خلال الرحلة أو اذهب إلى مركز المساعدة → إبلاغ."},
    {"q_en": "How do I become a driver?", "a_en": "Sign up, choose Drive with Aero, and complete vehicle & license verification.",
     "q_ar": "كيف أصبح سائقاً؟", "a_ar": "سجّل، اختر قد مع إيرو، وأكمل توثيق المركبة والرخصة."},
    {"q_en": "How are fares calculated?", "a_en": "Base fare + distance + time, shown as a breakdown before you confirm.",
     "q_ar": "كيف تُحسب الأجرة؟", "a_ar": "أجرة أساسية + المسافة + الوقت، تظهر كتفاصيل قبل التأكيد."},
]


@api_router.get("/support/faqs")
async def get_faqs():
    return FAQS


class TicketIn(BaseModel):
    subject: str
    message: str
    kind: Literal["ride", "payment", "account", "other"] = "other"
    trip_id: Optional[str] = None


@api_router.post("/support/ticket")
async def create_ticket(body: TicketIn, req: Request):
    u = await current_user(req)
    tk = {
        "ticket_id": f"tkt_{uuid.uuid4().hex[:10]}",
        "user_id": u.user_id, "user_name": u.name,
        "subject": body.subject, "message": body.message, "kind": body.kind,
        "trip_id": body.trip_id, "status": "open", "messages": [
            {"from": "user", "text": body.message, "at": datetime.now(timezone.utc)}
        ],
        "created_at": datetime.now(timezone.utc),
    }
    await db.tickets.insert_one(tk)
    tk.pop("_id", None)
    await notify(u.user_id, "support", "Ticket received",
                 f"We'll reply soon. Ticket {tk['ticket_id'][-6:]}")
    return tk


@api_router.get("/support/tickets")
async def my_tickets(req: Request):
    u = await current_user(req)
    return await db.tickets.find({"user_id": u.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


class TicketMsg(BaseModel):
    text: str


@api_router.post("/support/tickets/{ticket_id}/reply")
async def ticket_reply(ticket_id: str, body: TicketMsg, req: Request):
    u = await current_user(req)
    tk = await db.tickets.find_one({"ticket_id": ticket_id, "user_id": u.user_id}, {"_id": 0})
    if not tk: raise HTTPException(404, "Not found")
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"messages": {"from": "user", "text": body.text, "at": datetime.now(timezone.utc)}}},
    )
    # Auto-response (simulated agent)
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"messages": {"from": "agent", "text": "Thanks for your message — our team will get back to you shortly.",
                                "at": datetime.now(timezone.utc)}}},
    )
    return {"ok": True}


# ---------- Payment methods ----------
class PayMethodIn(BaseModel):
    kind: PaymentMethod
    label: str
    last4: Optional[str] = None
    brand: Optional[str] = None


@api_router.get("/payments/methods")
async def list_methods(req: Request):
    u = await current_user(req)
    return await db.pay_methods.find({"user_id": u.user_id}, {"_id": 0}).to_list(20)


@api_router.post("/payments/methods")
async def add_method(body: PayMethodIn, req: Request):
    u = await current_user(req)
    m = {"method_id": f"pm_{uuid.uuid4().hex[:10]}", "user_id": u.user_id,
         "kind": body.kind, "label": body.label, "last4": body.last4, "brand": body.brand,
         "created_at": datetime.now(timezone.utc)}
    await db.pay_methods.insert_one(m); m.pop("_id", None)
    return m


@api_router.delete("/payments/methods/{method_id}")
async def del_method(method_id: str, req: Request):
    u = await current_user(req)
    await db.pay_methods.delete_one({"method_id": method_id, "user_id": u.user_id})
    return {"ok": True}


@api_router.get("/payments/history")
async def pay_history(req: Request):
    u = await current_user(req)
    trips = await db.trips.find(
        {"customer_id": u.user_id, "status": "completed"},
        {"_id": 0, "trip_id": 1, "price": 1, "currency": 1, "payment_method": 1, "created_at": 1, "pickup": 1, "destination": 1},
    ).sort("created_at", -1).to_list(200)
    return trips


class RefundIn(BaseModel):
    trip_id: str
    reason: str


@api_router.post("/payments/refund")
async def request_refund(body: RefundIn, req: Request):
    u = await current_user(req)
    t = await db.trips.find_one({"trip_id": body.trip_id, "customer_id": u.user_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    rf = {"refund_id": f"rf_{uuid.uuid4().hex[:10]}", "user_id": u.user_id, "trip_id": body.trip_id,
          "amount": t["price"], "currency": t.get("currency", "SAR"), "reason": body.reason,
          "status": "pending", "created_at": datetime.now(timezone.utc)}
    await db.refunds.insert_one(rf); rf.pop("_id", None)
    await notify(u.user_id, "payments", "Refund requested", f"We're reviewing trip {body.trip_id[-6:]}.")
    return rf


@api_router.get("/payments/invoice/{trip_id}")
async def invoice(trip_id: str, req: Request):
    u = await current_user(req)
    t = await db.trips.find_one({"trip_id": trip_id, "customer_id": u.user_id}, {"_id": 0})
    if not t: raise HTTPException(404, "Not found")
    return {
        "invoice_no": f"INV-{trip_id[-8:].upper()}",
        "date": t.get("created_at"),
        "customer": u.name,
        "from": t.get("pickup", {}).get("address"),
        "to": t.get("destination", {}).get("address"),
        "distance_km": t.get("distance_km"),
        "duration_min": t.get("duration_min"),
        "breakdown": t.get("breakdown"),
        "total": t.get("price"),
        "currency": t.get("currency", "SAR"),
        "payment_method": t.get("payment_method", "cash"),
    }


# ---------- Currency conversion ----------
@api_router.get("/currency/rates")
async def rates():
    return {"base": "SAR", "rates": FX_RATES}


class ConvertIn(BaseModel):
    amount: float
    from_currency: str = "SAR"
    to_currency: str


@api_router.post("/currency/convert")
async def convert(body: ConvertIn):
    if body.from_currency not in FX_RATES or body.to_currency not in FX_RATES:
        raise HTTPException(400, "Unsupported currency")
    # Convert via SAR base
    sar_amount = body.amount / FX_RATES[body.from_currency]
    converted = sar_amount * FX_RATES[body.to_currency]
    return {"amount": round(converted, 2), "currency": body.to_currency}


# ---------- Driver earnings breakdown ----------
@api_router.get("/driver/earnings/breakdown")
async def earnings_breakdown(req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    trips = await db.trips.find({"driver_id": u.user_id, "status": "completed"}, {"_id": 0}).to_list(500)
    def _dt(v):
        if isinstance(v, datetime): return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        return now
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    def sum_since(s): return round(sum(t["price"] for t in trips if _dt(t.get("created_at")) >= s), 2)
    return {
        "today": sum_since(today_start),
        "week": sum_since(week_start),
        "month": sum_since(month_start),
        "total": round(sum(t["price"] for t in trips), 2),
        "trips": len(trips),
        "currency": "SAR",
    }


class WithdrawIn(BaseModel):
    amount: float
    method: Literal["bank", "stc_pay"] = "bank"
    account: Optional[str] = None


@api_router.post("/driver/withdraw")
async def withdraw(body: WithdrawIn, req: Request):
    u = await current_user(req)
    if u.role != "driver": raise HTTPException(403, "Driver only")
    w = {"withdraw_id": f"wd_{uuid.uuid4().hex[:10]}", "user_id": u.user_id,
         "amount": body.amount, "method": body.method, "account": body.account,
         "status": "pending", "currency": "SAR", "created_at": datetime.now(timezone.utc)}
    await db.withdrawals.insert_one(w); w.pop("_id", None)
    await notify(u.user_id, "payments", "Withdrawal requested", f"{body.amount} SAR via {body.method}")
    return w


app.include_router(api_router)


@app.get("/api/")
async def root(): return {"message": "Aero Ride API", "status": "ok", "currency": "SAR"}
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown(): client.close()

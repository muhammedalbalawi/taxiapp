"""Premium Ride-Hailing Backend - FastAPI + MongoDB + Emergent Google Auth."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Aero Ride API")
api_router = APIRouter(prefix="/api")

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ---------- Models ----------
Role = Literal["customer", "driver", "admin"]


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = "customer"
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UpdateRoleIn(BaseModel):
    role: Role


class LocationIn(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class FareEstimateIn(BaseModel):
    pickup: LocationIn
    destination: LocationIn
    ride_type: Literal["economy", "comfort", "premium"] = "economy"


class FareEstimate(BaseModel):
    distance_km: float
    duration_min: int
    price: float
    currency: str = "USD"
    ride_type: str


class Trip(BaseModel):
    trip_id: str
    customer_id: str
    driver_id: Optional[str] = None
    pickup: LocationIn
    destination: LocationIn
    ride_type: str
    distance_km: float
    duration_min: int
    price: float
    currency: str = "USD"
    status: Literal["searching", "accepted", "arriving", "on_trip", "completed", "cancelled"] = "searching"
    rating: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TripCreate(BaseModel):
    pickup: LocationIn
    destination: LocationIn
    ride_type: Literal["economy", "comfort", "premium"] = "economy"


class RatingIn(BaseModel):
    rating: int


class DriverStatus(BaseModel):
    online: bool
    lat: Optional[float] = None
    lng: Optional[float] = None


# ---------- Helpers ----------
RIDE_MULTIPLIERS = {"economy": 1.0, "comfort": 1.35, "premium": 1.9}
BASE_FARE = 2.5
PER_KM = 1.2
PER_MIN = 0.25


def haversine(a: LocationIn, b: LocationIn) -> float:
    R = 6371.0
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def compute_fare(pickup: LocationIn, destination: LocationIn, ride_type: str) -> FareEstimate:
    distance = max(haversine(pickup, destination), 0.5)
    duration = max(int(distance * 2.8), 3)
    price = (BASE_FARE + distance * PER_KM + duration * PER_MIN) * RIDE_MULTIPLIERS.get(ride_type, 1.0)
    return FareEstimate(
        distance_km=round(distance, 2),
        duration_min=duration,
        price=round(price, 2),
        ride_type=ride_type,
    )


async def get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]
    return None


async def current_user(request: Request) -> User:
    token = await get_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


# ---------- Auth Routes ----------
@api_router.post("/auth/session")
async def create_session(response: Response, x_session_id: str = Header(..., alias="X-Session-ID")):
    """Exchange session_id from URL fragment for a session_token."""
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": x_session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to verify session")
        data = r.json()

    email = data["email"]
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "role": "customer",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(new_user)
        new_user.pop("_id", None)
        user_doc = new_user
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": data.get("name", user_doc["name"]), "picture": data.get("picture")}},
        )

    session_token = data["session_token"]
    await db.user_sessions.insert_one(
        {
            "user_id": user_doc["user_id"],
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        }
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    return {"user": User(**user_doc).model_dump(mode="json"), "session_token": session_token}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await current_user(request)
    return user.model_dump(mode="json")


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await get_session_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.post("/auth/role")
async def set_role(body: UpdateRoleIn, request: Request):
    user = await current_user(request)
    if body.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot self-assign admin")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"role": body.role}})
    updated = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**updated).model_dump(mode="json")


# ---------- Ride routes ----------
@api_router.post("/rides/estimate", response_model=FareEstimate)
async def estimate_fare(body: FareEstimateIn):
    return compute_fare(body.pickup, body.destination, body.ride_type)


@api_router.post("/rides/request", response_model=Trip)
async def request_ride(body: TripCreate, request: Request):
    user = await current_user(request)
    if user.role != "customer":
        raise HTTPException(status_code=403, detail="Only customers can request rides")
    est = compute_fare(body.pickup, body.destination, body.ride_type)
    trip_id = f"trip_{uuid.uuid4().hex[:12]}"
    trip = Trip(
        trip_id=trip_id,
        customer_id=user.user_id,
        pickup=body.pickup,
        destination=body.destination,
        ride_type=body.ride_type,
        distance_km=est.distance_km,
        duration_min=est.duration_min,
        price=est.price,
        status="searching",
    )
    await db.trips.insert_one(trip.model_dump(mode="json"))
    return trip


@api_router.post("/rides/{trip_id}/assign")
async def assign_mock_driver(trip_id: str, request: Request):
    """Mock: auto-assign a simulated driver after short delay."""
    user = await current_user(request)
    trip = await db.trips.find_one({"trip_id": trip_id, "customer_id": user.user_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Mock driver near pickup
    driver_names = ["Ahmed Al-Farsi", "Omar Khalid", "Liam Chen", "Noah Kim", "Yusuf Hassan"]
    driver_id = f"drv_{uuid.uuid4().hex[:8]}"
    driver = {
        "driver_id": driver_id,
        "name": random.choice(driver_names),
        "rating": round(random.uniform(4.6, 5.0), 2),
        "car": random.choice(["Toyota Camry", "Honda Accord", "Tesla Model 3", "BMW 3 Series"]),
        "plate": f"{random.randint(100,999)}-{random.choice(['ABC','XYZ','LMN','KRT'])}",
        "lat": trip["pickup"]["lat"] + random.uniform(-0.01, 0.01),
        "lng": trip["pickup"]["lng"] + random.uniform(-0.01, 0.01),
        "eta_min": random.randint(2, 7),
    }
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {"driver_id": driver_id, "driver": driver, "status": "accepted",
                  "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    return updated


@api_router.post("/rides/{trip_id}/status")
async def update_status(trip_id: str, status: str, request: Request):
    await current_user(request)
    allowed = ["arriving", "on_trip", "completed", "cancelled"]
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@api_router.post("/rides/{trip_id}/rate")
async def rate_trip(trip_id: str, body: RatingIn, request: Request):
    user = await current_user(request)
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=400, detail="Invalid rating")
    await db.trips.update_one(
        {"trip_id": trip_id, "customer_id": user.user_id},
        {"$set": {"rating": body.rating}},
    )
    return {"ok": True}


@api_router.get("/rides/mine")
async def my_trips(request: Request):
    user = await current_user(request)
    query = {"customer_id": user.user_id} if user.role == "customer" else {"driver_id": user.user_id}
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return trips


@api_router.get("/rides/{trip_id}")
async def get_trip(trip_id: str, request: Request):
    await current_user(request)
    trip = await db.trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Not found")
    return trip


# ---------- Driver routes ----------
@api_router.post("/driver/status")
async def driver_status(body: DriverStatus, request: Request):
    user = await current_user(request)
    if user.role != "driver":
        raise HTTPException(status_code=403, detail="Driver only")
    await db.driver_state.update_one(
        {"user_id": user.user_id},
        {"$set": {"user_id": user.user_id, "online": body.online, "lat": body.lat, "lng": body.lng,
                  "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True, "online": body.online}


@api_router.get("/driver/earnings")
async def driver_earnings(request: Request):
    user = await current_user(request)
    if user.role != "driver":
        raise HTTPException(status_code=403, detail="Driver only")
    trips = await db.trips.find({"driver_id": user.user_id, "status": "completed"}, {"_id": 0}).to_list(500)
    total = sum(t.get("price", 0) for t in trips)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_trips = [t for t in trips if _ensure_dt(t.get("created_at")) >= today_start]
    return {
        "total_earnings": round(total, 2),
        "total_trips": len(trips),
        "today_earnings": round(sum(t.get("price", 0) for t in today_trips), 2),
        "today_trips": len(today_trips),
    }


def _ensure_dt(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            d = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


# ---------- Admin routes ----------
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    user = await current_user(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    users = await db.users.count_documents({})
    drivers = await db.users.count_documents({"role": "driver"})
    customers = await db.users.count_documents({"role": "customer"})
    trips = await db.trips.count_documents({})
    completed = await db.trips.count_documents({"status": "completed"})
    revenue_docs = await db.trips.find({"status": "completed"}, {"_id": 0, "price": 1}).to_list(1000)
    revenue = round(sum(t.get("price", 0) for t in revenue_docs), 2)
    return {
        "users": users, "drivers": drivers, "customers": customers,
        "trips": trips, "completed": completed, "revenue": revenue,
    }


@api_router.get("/admin/users")
async def admin_users(request: Request):
    user = await current_user(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return users


@api_router.get("/admin/trips")
async def admin_trips(request: Request):
    user = await current_user(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    trips = await db.trips.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return trips


# ---------- Seed admin ----------
@api_router.post("/admin/seed")
async def seed_admin(email: str):
    """Promote a user to admin. Called once to set up first admin."""
    result = await db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "email": email, "role": "admin"}


@api_router.get("/")
async def root():
    return {"message": "Aero Ride API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

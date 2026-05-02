# Aero — Production-Ready Ride-Hailing (PRD v2)

## Vision
A VC-grade bilingual ride-hailing app for Saudi Arabia (Riyadh-ready). Customer, Driver & Admin in one role-based Expo app. Premium UI (glassmorphism, dark/light, RTL).

## V2 Upgrades (Production-grade business logic)
- **Currency**: SAR (Saudi Riyal) throughout. Arabic format `٢٧.٥٠ ر.س` / English `SAR 27.50`.
- **Pricing**: Base 6 SAR + 2.5 SAR/km + 0.6 SAR/min, with premium/comfort multipliers. Min fare 10 SAR. Shown as **Price Breakdown** (base / distance / time / total).
- **Payments**: Cash, Card, Apple Pay selector — `payment_method` persisted on trip; gateway-ready.
- **Nearest-driver matching**: Haversine distance over online drivers. Rejecters are excluded from rematch.
- **Reject + Timeout fallback**: 15-second driver response window; auto-reassigns to next closest driver.
- **Full status machine**: `searching → offered → accepted → on_trip → completed` (+ `no_driver`, `cancelled`). Backend enforces trip ownership on status updates.
- **Bidirectional ratings**: Customer rates driver AND driver rates customer. Rolling average stored on user.
- **Live location**: `POST /rides/{id}/location` — driver app can push coords every N seconds.
- **Notifications**: In-app store (`/api/notifications`) + mark-all-read. Push-ready.
- **Admin**: Drivers tab with online/offline status chips; stats include `online_drivers`, revenue in SAR.
- **Tap-to-pick map**: Customer can tap the map to set pickup or destination coordinates.
- **Polling**: Customer home (2.5s) and driver dashboard (3s) for real-time UX without WebSockets.

## API additions/changes
- `POST /api/rides/request` now auto-matches driver and returns `status=offered` (or `no_driver`)
- `POST /api/rides/{id}/accept` / `/reject` (driver)
- `POST /api/rides/{id}/location` (driver live location)
- `GET /api/driver/incoming` (driver's pending offer)
- `GET /api/notifications` / `POST /api/notifications/read`
- `GET /api/admin/drivers` (drivers + online state)
- All responses carry `currency: "SAR"`.

## Known (as-designed) mocks
- Payment gateways NOT wired — `payment_method` is stored-only.
- Notifications are POLLED not pushed.

## Business Enhancement (recommend for v3)
- In-app tipping after rating (+10–15% driver retention, higher GMV)
- Stripe (card) + Apple Pay tokenization when ready for real money
- Surge pricing multiplier for peak hours
- WebSocket channel for true real-time instead of polling

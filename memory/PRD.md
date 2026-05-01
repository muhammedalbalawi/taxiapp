# Aero — Premium Bilingual Ride-Hailing App (PRD)

## Vision
A premium, VC-grade ride-hailing mobile app (Expo React Native) inspired by Uber/Careem. Supports English + Arabic (full RTL), dark/light mode, and a unified app containing Customer, Driver, and Admin role-based experiences.

## Tech Stack
- Frontend: Expo Router, React Native 0.81, TypeScript, Leaflet-in-WebView (OpenStreetMap), AsyncStorage, react-native-reanimated, @expo/vector-icons
- Backend: FastAPI + Motor/MongoDB, Emergent Google OAuth, httpx
- Auth: Emergent-managed Google Auth (session_token cookie + Bearer header)
- Map: OpenStreetMap via CARTO dark/light tiles (no API key)
- Payment: Cash-only (mock) for V1

## Core Features (V1)
- Splash + auto-route based on session/role
- Emergent Google login (web redirect flow)
- Role selection (customer/driver) with self-serve promotion
- **Customer**: full-screen map, pickup/destination, 3 ride types (Economy/Comfort/Premium), fare estimate, request → searching → matched → on-trip → completed → rate (1-5)
- **Driver**: online/offline toggle, mock incoming request sheet, earnings dashboard (today/total)
- **Admin**: revenue + stats, users list, trips list
- Bilingual EN/AR with full RTL flipping (native I18nManager), language switcher
- Dark/Light mode toggle with persistence
- Trip history with pull-to-refresh

## API
- POST /api/auth/session (X-Session-ID) — exchange Google session for app session
- GET /api/auth/me, POST /api/auth/logout, POST /api/auth/role
- POST /api/rides/estimate, /api/rides/request, /api/rides/{id}/assign, /api/rides/{id}/status, /api/rides/{id}/rate
- GET /api/rides/mine, /api/rides/{id}
- POST /api/driver/status, GET /api/driver/earnings
- GET /api/admin/stats, /api/admin/users, /api/admin/trips, POST /api/admin/seed

## Design
- Archetype: Swiss High-Contrast + Premium Fusion
- Accent: Electric Blue (#0066FF / #2563EB dark)
- Typography: Inter/SF (EN), Tajawal/Cairo (AR)
- Glassmorphic overlays, large rounded corners (24–32px), soft shadows
- Micro-interactions (press scale 0.98), pulse animation on searching

## Business Enhancement (Next iteration)
- In-app tipping after rating (increases driver retention + GMV)
- Surge pricing multiplier on peak hours
- Referral rewards for both customer and driver roles

## Known Limitations (V1)
- Driver auto-assignment is mocked (no real matching engine)
- Payment is cash-only / mock
- Map uses Leaflet + OSM tiles inside WebView (no native react-native-maps)

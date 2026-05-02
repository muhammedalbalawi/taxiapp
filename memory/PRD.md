# Aero — Secure Production-Ready Ride-Hailing (PRD v3)

## V3 Upgrades (Security + Accounts + Support + Payments)

### Account & Profile
- Profile update (name, phone, picture-base64, currency, notif_prefs)
- Driver profile with car_make/model/plate + license_image + id_image → auto `verified=true`
- Phone/email OTP verification (6-digit, 5-min TTL, simulated via `dev_code`)

### Security (CRITICAL)
- App PIN (sha256) set/verify with failure events logged
- 2FA toggle (structure ready)
- Logout-from-all-devices (+ security notification)
- Sessions inspection (`/auth/sessions`) without token leakage
- Suspicious activity logging (`security_events`)
- Rate limiting ready (DRIVER_RESPONSE_TIMEOUT_SEC + failed-PIN tracking)

### Safety
- SOS button during trip → creates `sos_alert`
- Share Trip → 24h expiring share token
- Block & Report users (persisted in user doc + reports collection)
- Clear driver identity card (name, photo, car, plate, rating)

### Support
- FAQs (EN+AR, 5 items)
- Tickets: create / list / reply (auto-agent reply)
- Kinds: ride / payment / account / other

### Payments (Advanced)
- Methods: `cash` | `card` | `apple_pay` | `stc_pay` (CRUD)
- Payment history + invoice generation (`INV-*`)
- Refund requests (status pending)
- Gateway-ready (structure only)

### Currency System
- SAR default. Supported: SAR / USD / EUR / AED / GBP
- `/currency/rates` + `/currency/convert` (SAR base, conversion via SAR)
- Arabic format: `٢٥ ر.س` / English: `SAR 25.00`
- Per-user currency preference on profile

### Settings (single screen)
- Language (EN/AR with RTL flip)
- Theme (light/dark)
- Currency pills (5 options)
- Security (2FA, Change PIN, Verify Phone, Logout-all)
- Notifications (rides/payments/security/promos)
- Payment shortcuts + Support links

### Notifications
- In-app center (`/notifications`) with unread badges
- Granular preferences per user
- Emitted on: ride offer, accept, trip status, payments, refunds, security, tickets
- Push-ready

### Driver Enhancements
- Earnings breakdown: today / week / month / total
- Withdrawal requests (bank / stc_pay)
- Live location endpoint during trip
- Customer rating by driver

## Testing
- 28/28 backend pytest pass
- All frontend flows verified on mobile-web (390x844)

## Mocks (explicit)
- OTP is SIMULATED — `dev_code` returned in response (REMOVE in prod)
- Payment gateways NOT wired (Stripe/Apple Pay/STC Pay structure-only)
- Refunds/withdrawals stored as pending (no money movement)
- Push notifications NOT wired (app polls)
- PIN uses sha256 (UPGRADE to bcrypt/argon2 for prod)

## Business Enhancement (v4 proposal)
- Tipping on rating screen (↑ driver retention 10–15%)
- Real Stripe + Apple Pay tokenization
- WebSocket for live tracking (vs polling)
- Split server.py into routers (account/rides/driver/admin/support/payments)

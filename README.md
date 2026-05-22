# AUCTIONSITE

End-to-end starter for an auction platform with:
- Postgres database schema
- PostgREST API layer
- pgAdmin UI
- Connected web frontend
- Flutter mobile starter

## Top U.S. auction UX references (research)
- HiBid
- ShopGoodwill
- EstateSales.net

See: `research/top-3-us-auction-sites.md`.

## Stack Ports (AUCTIONSITE local stack)
- Postgres: `127.0.0.1:55432`
- PostgREST: `http://127.0.0.1:33001`
- pgAdmin: `http://127.0.0.1:55050`

## Start Stack
```powershell
cd C:\AI_WORKSPACE\AUCTIONSITE\infra
docker compose up -d
```

## Database
Schema + seed SQL:
- `db/001_auctionsite_schema.sql`

Apply manually (if needed):
```powershell
powershell -ExecutionPolicy Bypass -File C:\AI_WORKSPACE\AUCTIONSITE\scripts\apply_db.ps1
```

## API quick checks
```powershell
powershell -ExecutionPolicy Bypass -File C:\AI_WORKSPACE\AUCTIONSITE\scripts\test_api.ps1
```

## Web frontend
Open:
- `web/index.html`

The frontend auto-detects PostgREST at `33001` then fallback `3001`.

## Security + Payments Gateway (VPS service)
The `upload_service` now handles:
- image optimization uploads
- auth login/register/refresh/logout
- server-time endpoint for accurate countdowns
- Fygaro checkout-link creation

Required service env vars:
- `AUCTIONSITE_DB_DSN` (example: `postgresql://auction_admin:auction_admin_pass@127.0.0.1:55432/auctionsite`)
- `AUCTIONSITE_JWT_SECRET` (must match PostgREST `PGRST_JWT_SECRET`)
- `FYGARO_BUTTON_URL` (your Fygaro button URL)

Optional Fygaro JWT mode (locked amount):
- `FYGARO_API_PUBLIC_KEY`
- `FYGARO_API_SECRET_KEY`
- `FYGARO_JWT_KID`

## Flutter mobile
```powershell
cd C:\AI_WORKSPACE\AUCTIONSITE\mobile_flutter
flutter pub get
flutter run
```

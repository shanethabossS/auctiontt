# DealzTT

DealzTT is Trinidad & Tobago's developing local auction marketplace, positioned first around vehicles, machinery, repossessions, liquidations, and selected general goods.

Production: [dealztt.com](https://dealztt.com/)

## Current architecture

- Static web frontend: `web/`, hosted by Vercel
- Central API: `https://api.sovdigitalgroup.com` Express service
- Database: DigitalOcean Managed Postgres
- Production route rewrites and security headers: `web/vercel.json`

The retired AUCTIONSITE Docker/PostgREST stack is not the production deployment model. Do not deploy Docker, PostgREST, or local database changes as part of DealzTT web work.

## Web pages

- `index.html` — launch state and published marketplace overview
- `browse.html` — live-feed discovery by category, location, ending time, and vehicle-focused inventory
- `categories.html` — live category catalogue
- `lot.html` — published lot detail and reporting route
- `buyer.html` — buyer account preparation hub
- `sell.html` — consignment preparation hub
- `how-it-works.html` — public buyer, fee, and trust guidance
- `signin.html`, `signup.html`, `feedback.html` — account and feedback routes

## Local preview

From the repository root:

```powershell
python -m http.server 4173 --directory web
```

Then open `http://127.0.0.1:4173/`. The local preview is for static layout and link testing. Live marketplace data comes from the central API in production.

## Validation

```powershell
node --check web\js\home.js
node --check web\js\browse.js
node --check web\js\lot.js
git diff --check
```

Run a local link crawl before release so every internal navigation, footer, and CTA route resolves to an existing useful page.

## Release status

The frontend only renders the real live feed and never substitutes preview inventory. Buyer activity, seller operations, auction schedules, bid rules, auction closing, orders, fees, payments, pickup, settlement, and disputes still require central API and database work.

The central API deploy is currently held because its working tree contains unrelated, intentionally undeployed TTPay changes. Keep future DealzTT backend work isolated and separately reviewed until Shane explicitly approves a release.

See [DEALZTT_FINISH_PLAN.md](./DEALZTT_FINISH_PLAN.md) for the product roadmap and remaining backend milestones.

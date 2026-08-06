# DealzTT

DealzTT is Trinidad & Tobago's developing local auction marketplace for vehicles, machinery, repossessions, liquidations, electronics, and home and business equipment.

Production: [dealztt.com](https://dealztt.com/)

## Current architecture

- Static web frontend: `web/`, hosted by Vercel
- Central API: `https://api.sovdigitalgroup.com` Express service
- Database: DigitalOcean Managed Postgres
- Production route rewrites and security headers: `web/vercel.json`

The retired AUCTIONSITE Docker/PostgREST stack is not the production deployment model. Do not deploy Docker, PostgREST, or local database changes as part of DealzTT web work.

## Web pages

- `index.html` — launch state and published marketplace overview
- `browse.html` — real-feed discovery by category, location, ending time, and vehicle-focused inventory
- `categories.html` — live category catalogue
- `lot.html` — published lot detail, reporting, and real-feed related lots
- `buyer.html`, `sell.html` — buyer and consignment preparation hubs
- `how-it-works.html`, `fees.html`, `calendar.html`, `rules.html` — marketplace guidance and planning disclosures
- `buyer-rules.html`, `seller-rules.html`, `support.html`, `prohibited-items.html` — responsibilities and safety guidance
- `privacy.html`, `terms.html` — truthful pre-launch notices pending final legal approval
- `signin.html`, `signup.html` — SOV ID handoff fallbacks; production redirects directly to `id.sovdigitalgroup.com`
- `feedback.html` — native DealzTT feedback form backed by the private central support queue

## Local preview

From the repository root:

```powershell
python -m http.server 4173 --directory web
```

Then open `http://127.0.0.1:4173/`. The local preview is for static layout and link testing. Live marketplace data comes from the central API in production.

## Validation

```powershell
Get-ChildItem web\js\*.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

Run a local link crawl before release so every internal navigation, footer, and CTA route resolves to an existing useful page.

## Release status

The frontend only renders the real live feed and never substitutes preview inventory. It publishes the locked planning model for all six categories: category-tiered fees, manual or proxy mode per auction, no reserves, seven-day default auctions, repeatable two-minute soft close, 48-hour payment deadline, and five-business-day pickup deadline. These are explicitly marked as planned until the backend enforces them.

Buyer activity, seller operations, scheduled-auction data, bidding, auction closing, orders, TTPay collection, pickup or delivery confirmation, settlement, and disputes still require central API and database work.

The central API release remains held because TTPay money work has separate production guardrails. Keep DealzTT backend work isolated and separately reviewed until Shane explicitly approves that release.

See [DEALZTT_FINISH_PLAN.md](./DEALZTT_FINISH_PLAN.md) for the product roadmap and remaining backend milestones.

# DealzTT Finish Plan

Updated: 2026-08-05

## Current implementation progress

- [x] Production-empty inventory now has an honest launch state with real buyer-account and consignment routes; no preview lots, activity counters, or notification claims are shown.
- [x] Browse, buyer hub, seller hub, and public buyer guidance are available in the static frontend. Discovery supports current feed fields only: text, category, location, ending-soon, and vehicle-focused inventory.
- [x] The seller hub is intentionally limited to consignment preparation and feedback routing until the submission, scheduling, payment, pickup, and settlement workflows work end to end.
- [ ] Central SSO/auth convergence, buyer activity read APIs, seller operations, scheduled-auction publishing, final fee/rules matrix, vehicle records, and the timed-auction lifecycle remain backend work.

## Product decision

DealzTT should launch as Trinidad and Tobago's trusted local auction marketplace, with vehicles, machinery, repossessions, and liquidation inventory as the wedge. General merchandise remains supported, but the first serious supply push should be vehicle-led because high-value local inventory creates stronger fees, repeat professional buyers, and a clear reason to use an auction platform instead of a classifieds site.

The product should combine proven marketplace mechanics in an original DealzTT experience. We can reproduce ideas and workflows, but should not copy another company's wording, artwork, page composition, proprietary data, or branding.

## What exists now

### Live-site audit

The production homepage at [dealztt.com](https://dealztt.com/index.html) loads and has a polished responsive shell, search fields, marketplace statistics, trust copy, spotlight sections, and routes for categories, selling, feedback, sign-in, sign-up, and lot details.

As of this audit, production displays:

- 0 live lots
- 0 hot lots
- 13 seeded categories, with no live lots
- No listing cards or listing imagery

The API returns a valid empty result, so the frontend does not enter its demo-data fallback. This makes the site look operational but empty.

### Repository audit

Already present:

- Static responsive web frontend with home, category, sell, auth, feedback, and lot-detail pages
- Central Express API routes for categories, lot feed, local account creation, Google exchange, seller profiles, submissions, bidding, watchlists, time sync, and image upload
- Managed-Postgres migration `015_auctiontt_schema.sql` with categories, sellers, auctions, lots, bids, watchlists, users, seller profiles, submissions, and payment orders
- Secure server-side bid transaction with row locking
- Fygaro-oriented payment scaffolding
- SEO metadata, sitemap, robots file, CSP, and Vercel rewrites

Incomplete or risky:

- Production has no marketplace supply or visible launch inventory
- The frontend is a static multi-page app with buyer and seller preparation hubs; authenticated activity, seller operations, and admin dashboards still require backend read and workflow APIs
- There is no end-to-end auction lifecycle: approve submission, publish lot, close auction, create order, collect payment, hand off item, settle seller, dispute, refund, relist
- Vehicle records lack the structured fields buyers need
- No proxy/max bidding, bid increments by price band, anti-sniping extensions, reserve-state logic, or winner finalization job
- Watchlists exist, but saved searches, alerts, notification preferences, and outbid/ending-soon delivery do not
- Payments are scaffolding, not a complete protected transaction ledger
- There is no public fee schedule, seller agreement, buyer rules, prohibited-items policy, privacy policy, dispute policy, or vehicle condition standard
- Current auction code uses `auctiontt_session`; the platform standard is the central HttpOnly `auth_token` cookie plus the `auth_state` SSO gate. DealzTT should converge on central SSO before launch rather than create a parallel identity system.
- The repo still contains an old Docker/PostgREST topology. Production must remain Vercel for the web app, the central Express API at `api.sovdigitalgroup.com`, and the managed Postgres database. Do not deploy or rebuild the retired multi-container VPS stack.
- The central `api-server` working tree contains a large unrelated, intentionally undeployed TTPay bundle. DealzTT backend changes must be isolated and must not trigger a broad API deployment until Shane explicitly approves it.

## Revenue-leader comparison

The latest comparable public annual reports make the scale order clear. Revenue is not perfectly apples-to-apples because some companies report marketplace fees while others also recognize owned-inventory sales.

| Marketplace | Latest public scale | What creates revenue | Best mechanic to adapt for DealzTT |
|---|---:|---|---|
| eBay | 2025 net revenue: $11.1B; GMV: $79.6B | Marketplace take rate, advertising, listing features, store subscriptions, shipping and other fees | Proxy bidding, watchlists, broad search, seller hub, auction plus Buy Now, promoted inventory |
| Copart | FY2025 revenue: $4.647B | Buyer/seller transaction fees, memberships, transport, title processing, storage, bidding and loading fees, plus some owned inventory | Deep vehicle filters, vehicle alerts, deposits/buying power, live lanes, status-rich lot cards |
| RB Global / Ritchie Bros. / IAA | 2025 revenue: $4.6B; GTV: $16.2B | Buyer and seller fees, ancillary services, inventory sales, logistics and marketplace services | Inspection reports, operational videos, live and timed auctions, enterprise consignor workflows |
| Bring a Trailer | Private; reported marketplace scale rather than audited public revenue | Seller service tiers and buyer fees | Curated vehicle presentation, editorial-quality listings, public seller Q&A, viewing/test-drive coordination |
| Catawiki | Private; over 75,000 objects offered weekly | Seller success fee and buyer-protection fee | Submission review, seller verification, reserve guidance, automatic bids, held payments and dispute window |
| Whatnot | Private; live-commerce scale rather than audited public revenue | Transaction and payment fees from live and fixed-price commerce | Livestream auctions, pre-bids, quick bid controls, countdown extensions, pinned item and real-time activity |

Sources:

- [eBay 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1065088/000106508826000027/ebay-20251231.htm)
- [Copart FY2025 annual report](https://www.sec.gov/Archives/edgar/data/900075/000119312525249656/d70361dars.pdf)
- [RB Global 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1046102/000162828026011682/rba-20251231.htm)
- [eBay automatic bidding](https://www.ebay.com/help/buying/bidding/bidding?id=4014)
- [Copart vehicle discovery and watchlists](https://www.copart.com/content/us/en/new-member-welcome)
- [Copart live auction dashboard](https://www.copart.com/content/us/en/landing-page/copart-live-auction-dashboard)
- [Ritchie Bros. bidding and inspection workflow](https://help.ritchiebros.com/ritchie-bros-auctioneers-how-to-bid-buy/)
- [Bring a Trailer seller and community workflow](https://bringatrailer.com/how-bat-works/)
- [Catawiki curation, automatic bids, and protected payments](https://www.catawiki.com/en/help/about)
- [Whatnot live-auction formats](https://help.whatnot.com/hc/en-us/articles/360061194792-How-to-buy-on-Whatnot)

## The DealzTT version

### Buyer promise

"Find it locally, understand exactly what you are bidding on, and complete the purchase safely."

Every live lot should answer five questions above the fold:

1. What exactly is it?
2. What is its verified condition and ownership status?
3. What will my total cost be?
4. Where is it and how do I inspect or collect it?
5. What happens after I win?

### Seller promise

"Turn vehicles and surplus inventory into a competitive, time-bound sale without building your own audience or payment process."

Priority seller segments:

- Used-car dealers
- Banks and credit unions with repossessions
- Insurance and salvage operators
- Rental fleets
- Contractors and equipment owners
- Retailers liquidating overstock, returns, or closing inventory
- Government and corporate surplus teams
- Individual verified sellers

### Original visual and interaction direction

- Keep DealzTT's dark/gold identity, but make inventory the hero instead of marketing copy.
- Desktop: compact search/header, category rail, live/ending-soon inventory, upcoming auctions, vehicle finder, and trust strip.
- Mobile: persistent Watch and Bid actions, thumb-friendly amount controls, short checkout path, and clear collection status.
- Lot page: large media gallery, vehicle/condition facts, fees and total-cost calculator, seller/inspection panel, bid module, history, Q&A, and pickup map area.
- Live room: stream or seller video at top, pinned lot, current price, next valid bid, bidder state, countdown, chat/Q&A, upcoming-lot carousel, and connection status.

## Monetization to design before launch

Start with a transparent fee model and keep pricing configurable in the database.

Recommended launch model:

- Free buyer registration
- Seller success fee: category-based percentage with minimum fee
- Buyer protection fee: smaller category-based percentage, shown before every bid and included in the total-cost preview
- Optional featured listing fee
- Optional professional seller subscription for storefront, bulk upload, analytics, and lower success fees
- Vehicle document-processing and inspection coordination fees where DealzTT actually provides the service
- Late pickup/storage fee only when disclosed before bidding
- Live-auction production package for enterprise sellers

Do not launch paid promotions until organic ranking rules and inventory quality controls are stable. Never allow promotion spend to hide a listing's risk signals.

## Delivery roadmap

### Phase 0 - Make production honest and choose the launch rules

Goal: remove the empty-market illusion and lock the operating model.

- Confirm the production API status, database migration state, category seed state, and why `v_lot_feed` is empty.
- Add a real empty state with "Auctions launching soon," seller-consignment CTA, notification signup, and no fake activity counters.
- Remove duplicate frontend/demo and backend/preview data sources after real seed inventory is approved.
- Decide initial categories: Vehicles, Machinery & Tools, Repossessions, Liquidations, Electronics, Home & Business Equipment.
- Decide fee schedule, bid deposit rules, reserve rules, auction extension window, payment deadline, pickup deadline, cancellation rules, and dispute window.
- Decide whether DealzTT holds buyer funds through a supported payment flow or only collects platform/deposit fees. Get legal and payment-provider confirmation before promising escrow.
- Define launch geography and physical inspection/pickup process for Trinidad and Tobago.
- Converge auth on central SSO using `auth_state` and the HttpOnly `auth_token`; remove the parallel DealzTT password/session path once migration is verified.

Acceptance criteria:

- Production never shows fabricated activity.
- Health checks distinguish API unavailable, schema unavailable, and valid empty inventory.
- One written, approved fee/rules matrix drives UI and backend validation.
- One central account can browse publicly and sign in to watch, bid, sell, and manage purchases.

### Phase 1 - Complete the core timed-auction engine

Goal: one real seller can publish a lot and one real buyer can win it safely.

Backend and database:

- Add auction and lot state machines: draft, review, scheduled, live, ended, sold, reserve_not_met, unpaid, paid, ready_for_pickup, collected, disputed, refunded, cancelled, relisted.
- Add proxy/max bidding with server-calculated price increments.
- Add configurable anti-sniping: a bid inside the final window extends the auction by a configured duration.
- Add reserve-met state without exposing the reserve amount.
- Add an idempotent auction closer that selects the winner, creates an order, and prevents bids after close.
- Add bid idempotency keys, immutable bid audit records, server timestamps, and rate limits.
- Add order, payment, fee, settlement, pickup, dispute, and refund records.
- Add notification outbox events for outbid, ending soon, won, payment due, pickup ready, seller paid, dispute updates, and relist.
- Add admin endpoints to review submissions, publish/schedule lots, suspend users/lots, resolve disputes, and see the audit trail.

Frontend:

- Replace inline bidding on homepage cards with a clean lot-detail flow.
- Add buyer dashboard: watching, bids, wins, payments, pickups, messages, saved searches.
- Add seller dashboard: draft/submitted/live/ended lots, orders, pickups, payouts, performance.
- Add admin operations UI or integrate DealzTT operations into `admin.sovdigitalgroup.com`.
- Show the next valid bid, max-bid explanation, reserve status, extension rules, total payable estimate, and bid confirmation.

Acceptance criteria:

- Concurrent-bid tests prove there is one valid price and winner.
- Auction close is deterministic and idempotent.
- A staged transaction completes from seller submission through winner collection and seller settlement.
- All material state changes appear in an admin audit trail.

### Phase 2 - Vehicle, machinery, repo, and liquidation specialization

Goal: make DealzTT meaningfully better than a general classifieds listing for high-value assets.

Vehicle data:

- VIN/chassis number with masked public display
- Make, model, year, trim, body type, fuel, transmission, drive type, color
- Mileage and mileage-status declaration
- Registration status, ownership-document type, transfer requirements, and known liens
- Condition grade, starts/runs/drives flags, keys, accident/damage areas, flood/fire status
- Inspection date, inspector, checklist, diagnostic notes, and downloadable report
- Photo checklist: all sides, cabin, odometer, engine bay, tyres, defects, chassis/VIN plate, documents with private data redacted
- Cold-start, walk-around, and operational videos
- Location, viewing windows, pickup deadline, delivery/transport options

Discovery:

- Vehicle Finder filters for year, make, model, price, mileage, condition, damage, location, seller type, sale date, auction type, and pickup/delivery.
- Saved searches and instant/daily alerts.
- Auction calendar and seller/fleet event pages.
- Comparable sold results when enough DealzTT history exists.

Enterprise consignment:

- CSV bulk upload with validation preview
- Multi-user seller accounts and roles
- Batch photo/document upload
- Reserve approval and scheduling workflow
- Inventory, sell-through, average price, days-to-sale, fee, and settlement reports

Acceptance criteria:

- A buyer can evaluate a vehicle without contacting support for basic facts.
- A bank, dealer, or fleet can submit and track a batch without manual re-entry by DealzTT staff.
- Document visibility is permissioned and personal data is redacted.

### Phase 3 - Trust, payment protection, and local fulfillment

Goal: make winning feel safer than arranging a purchase through social media.

- Identity verification for bidders above configurable thresholds and all sellers.
- Seller tiers: New, Identity Verified, Business Verified, Dealer/Fleet Partner.
- Bid deposit or buying-power hold for high-value categories.
- Risk checks for new accounts, velocity, device/session anomalies, payment mismatch, collusion patterns, and self-bidding.
- Seller and bidder reputation based on completed transactions, not only star ratings.
- Structured inspection/viewing booking.
- QR or one-time pickup code requiring buyer and seller confirmation.
- Pickup evidence, handoff timestamp, and item/document checklist.
- In-platform Q&A with moderation, preserved history, and no public contact details.
- Formal dispute intake with evidence upload, deadlines, resolution states, and refund/settlement holds.

Acceptance criteria:

- High-value bids cannot exceed verified buying power.
- Seller payout cannot release before the configured handoff/dispute conditions.
- Every dispute can be reconstructed from records and evidence.

### Phase 4 - DealzTT Live Auctions

Goal: give professional sellers a high-energy live selling format without weakening auction integrity.

Build only after timed auctions, orders, payments, and trust controls are stable.

- Scheduled live events with shareable landing pages and reminders.
- Seller camera/stream plus pinned lot and upcoming-lot queue.
- Pre-bids that feed the live auction.
- Server-authoritative current price, bidder state, sequence number, and countdown.
- Configurable soft-close extension; do not default to sudden-death bidding for high-value assets.
- Moderator controls: pause event, hide chat, remove participant, skip lot, technical hold, and cancel before first accepted bid.
- Stream health, reconnect, and low-bandwidth modes.
- Live Q&A/chat separated from the immutable bid ledger.
- Event replay with sold price and chapter markers after private data is removed.

Acceptance criteria:

- Reconnection does not lose bidder state or accept stale bids.
- The bid ledger remains authoritative when video is delayed.
- A moderator can safely stop an event without editing bid history.

### Phase 5 - Growth and revenue expansion

Goal: compound supply, buyer liquidity, and repeat transactions.

- Seller storefronts and follow-seller alerts
- Featured placements clearly labeled as promoted
- Professional seller plans and bulk tools
- Referral credits tied to completed transactions
- Sold-price content pages for SEO where legally and contractually permitted
- Abandoned-watch and saved-search lifecycle messaging
- Second-chance offer for reserve failures or defaulted winners, with audit and seller approval
- Recommendation feed based on category, location, price band, and watch/bid history
- Partner services: inspections, transport, financing introductions, document processing, and insurance referrals

## Suggested implementation slices

Each slice should be independently testable and deployable.

1. Production API/data diagnosis and honest empty state
2. Central SSO and account convergence
3. Categories, approved launch inventory, and complete lot detail
4. Auction state machine, proxy bidding, increments, and anti-sniping
5. Auction closer, orders, fee calculation, and winner flow
6. Payment/deposit integration and protected settlement rules
7. Buyer, seller, and admin dashboards
8. Vehicle schema, media checklist, reports, and Vehicle Finder
9. Alerts, saved searches, Q&A, viewing, pickup, and disputes
10. Enterprise bulk consignment
11. Live-auction room and moderation
12. Promotions, subscriptions, partner services, and analytics

## Technical boundaries

- Web hosting stays on Vercel.
- Backend stays in the central Express API on `api.sovdigitalgroup.com`, managed by PM2 on the existing VPS.
- Postgres stays on DigitalOcean Managed Database.
- Use the central `auth_state` SSO gate and HttpOnly `auth_token` cookie. Never store JWTs in `localStorage`.
- Use database transactions and row locks for all bid, close, order, payment, refund, settlement, and pickup state transitions.
- Treat the server clock as authoritative.
- Keep livestream media transport separate from auction truth; video delay must never determine bid validity.
- Keep all fees and timing rules configurable and versioned so an old auction retains the rules shown when bidding opened.
- Store monetary values as integer minor units or exact numerics with explicit currency; never use JavaScript floating-point math for totals.
- No DealzTT deploy may include the unrelated in-flight TTPay bundle without Shane's explicit approval.

## Required tests before public launch

- Concurrent bids at the same amount
- Two bids arriving at close time
- Anti-sniping extension under load
- Max-bid tie behavior and increment boundaries
- Reserve met/not met
- Duplicate bid and payment requests
- Winner fails to pay
- Seller cancels before and after first bid
- Payment succeeds but callback is delayed or repeated
- Buyer and seller disagree at pickup
- User loses network during a bid or live auction
- Mobile layout at common low-end Android widths
- Keyboard-only, screen-reader labels, focus order, contrast, reduced motion
- Broken/slow images and large video uploads
- Search, filtering, pagination, and empty/error states
- Authorization checks across buyer, seller, admin, and enterprise roles
- PII/document access, redaction, logging, and retention
- Rate limits, abuse reporting, self-bidding/collusion signals, and account suspension

## Launch scorecard

Do not call the marketplace launched until all P0 measures are true.

| Measure | P0 launch target |
|---|---:|
| Approved real lots | At least 50 across at least 3 launch categories |
| Vehicle/machinery anchor sellers | At least 3 |
| Listings with required media and condition data | 100% |
| Bid-to-order integrity tests | 100% pass |
| Payment/order reconciliation | 100% in staging and launch pilot |
| Critical accessibility/security defects | 0 open |
| Auction-ending notifications | Delivered within 60 seconds |
| Mobile core-flow completion | Browse, watch, bid, pay, and pickup status all usable |
| Public policies and fees | Published and linked before account/bid confirmation |
| Support ownership | Named operator and escalation path for every live auction window |

Track after launch:

- Approved-lot supply and active sellers
- Watch-to-bid and bid-to-win conversion
- Unique bidders per lot
- Sell-through rate and reserve-failure rate
- Gross merchandise value and net take rate
- Payment completion time and default rate
- Pickup completion time
- Dispute, refund, and suspected-fraud rates
- Repeat buyer and seller rate
- Notification delivery and live-room reliability

## Decisions Shane needs to lock before Phase 1 is complete

1. Does DealzTT handle the full purchase amount, a deposit only, or platform fees only at launch?
2. What are the buyer fee, seller fee, minimum fee, listing fee, and featured fee by category?
3. Which seller segment provides the first 50 real lots?
4. Are individual vehicle sellers allowed at launch, or only verified dealers/fleets/repo partners?
5. What are the default auction length, soft-close window, extension duration, payment deadline, and pickup deadline?
6. Who performs vehicle inspections and document checks?
7. Who operates support and dispute resolution during launch auctions?
8. Should the first public release include general goods, or lead with vehicles/machinery/repossessions only?

## Recommended immediate next move

After the unrelated held TTPay bundle is safely deployed or otherwise isolated, implement DealzTT central SSO convergence and the timed-auction lifecycle in a clean, separately reviewed api-server release. That release must add the state machine, authenticated buyer/seller read APIs, bid rules, closing, orders, fees, and audit trail before any public bid, payment, pickup, or settlement action is enabled.

# DealzTT Frontend Contract

## Scope

The static frontend in `web/` presents DealzTT's public marketplace and account-preparation surfaces. It is hosted on Vercel and reads the central Express API through the existing Vercel rewrites.

## Data and truthfulness

- Render only data returned by the live auction feed and categories API.
- Never show demo lots, invented counters, fabricated bids, notification promises, or unpublished auction schedules.
- When inventory is empty or unavailable, show an intentional launch or error state with real Browse, buyer-account, seller-preparation, or feedback routes.
- Vehicle, machinery, repossession, and liquidation discovery may use only the title, description, category, location, price, bid count, seller label, and end-time fields currently exposed by the feed.

## Public pages

Home, Browse, Categories, lot detail, Buyer Hub, Seller Hub, How It Works, account routes, and feedback must all have static navigation and footer links that resolve without JavaScript enhancement.

## Backend-dependent flows

The frontend must not claim that bidding, proxy bidding, reserve handling, payments, escrow, orders, pickup, settlement, disputes, inspections, alerts, saved searches, seller publishing, or live auctions work until the central API provides the full lifecycle.

Seller Hub is consignment preparation only. Buyer Hub is account preparation only. Public fee and trust guidance must state when final rules are not published.

## Auth target

DealzTT must converge on the central `auth_state` SSO gate and HttpOnly `auth_token` cookie. Do not add localStorage JWTs or a parallel account system.

## Release acceptance

- All internal links, navigation, footers, cards, and CTAs resolve to useful pages or intentionally non-interactive coming-next states.
- JavaScript syntax and `git diff --check` pass.
- Empty, error, and missing-lot states are user-friendly and do not expose technical errors.
- The homepage and browse views remain accurate when the live API returns zero lots.
- No web deployment includes the held, unrelated TTPay API bundle.

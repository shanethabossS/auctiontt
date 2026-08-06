# DealzTT Frontend Contract

## Scope

The static frontend in `web/` presents DealzTT's public marketplace and account-preparation surfaces. It is hosted on Vercel and reads the central Express API through the existing Vercel rewrites.

## Data and truthfulness

- Render only data returned by the live auction feed and categories API.
- Never show demo lots, invented counters, fabricated bids, notification promises, or unpublished auction schedules.
- When inventory is empty or unavailable, show an intentional launch or error state with real Browse, buyer-account, seller-preparation, or feedback routes.
- Discovery and related-lot recommendations may use only fields exposed by the current live feed and must not claim personalization.

## Public pages

Home, Browse, Categories, lot detail, Buyer Hub, Seller Hub, How It Works, Fees, Calendar, Auction Rules, Buyer Rules, Seller Rules, Support and Safety, Prohibited Items, Privacy, Terms, account routes, and feedback must resolve through static links without JavaScript enhancement.

## Locked planning model

The rules apply to every approved category. Vehicles and machinery use a 3% buyer fee and 5% seller fee; other categories use a 5% buyer fee and 7.5% seller fee. Each auction selects manual or proxy bidding, uses no reserve, defaults to seven days, repeats a two-minute soft close, requires payment in 48 hours, and requires pickup in five business days. TTPay collection and seller release after confirmed pickup or delivery remain disabled until the cross-system payment bridge is approved and deployed.

## Backend-dependent flows

The frontend must not claim that bidding, proxy bidding, payments, orders, pickup, settlement, disputes, inspections, alerts, saved searches, seller publishing, or live auctions work until the central API provides the full lifecycle.

Seller Hub is consignment preparation only. Buyer Hub is account preparation only. Public guidance must distinguish the locked implementation model from live enforceable transaction terms.

## Auth target

DealzTT must converge on the central `auth_state` SSO gate and HttpOnly `auth_token` cookie. Do not add localStorage JWTs or a parallel account system.

## Release acceptance

- All internal links, navigation, footers, cards, and CTAs resolve to useful pages or intentionally non-interactive coming-next states.
- JavaScript syntax and `git diff --check` pass.
- Empty, error, and missing-lot states are user-friendly and do not expose technical errors.
- The homepage and browse views remain accurate when the live API returns zero lots.
- No web deployment includes the held TTPay API bundle.

'use strict';

// DealzTT auction engine: the locked rules as pure functions, no database and no I/O.
// Money is whole cents (TTD). The API layer loads a lot row FOR UPDATE, calls resolveBid or
// finalizeLot, and writes the result back inside the same transaction, so every rule below is
// tested here without a server.
//
// Locked rules (DEALZTT_FINISH_PLAN.md): no reserve, manual or proxy bidding chosen per auction,
// seven-day default, a valid bid in the last two minutes pushes the end out two minutes (repeatable),
// payment due in 48 hours, tiered fees. The increment table is the one open decision: it is a
// proposal until Shane confirms it.

const SOFT_CLOSE_MS = 2 * 60 * 1000;
const PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// [price below (cents), increment (cents)] in ascending order; the last row has no upper bound.
const INCREMENT_BANDS = [
  [10000, 500], //        under $100 -> $5
  [50000, 1000], //       under $500 -> $10
  [100000, 2500], //      under $1,000 -> $25
  [500000, 5000], //      under $5,000 -> $50
  [2500000, 10000], //    under $25,000 -> $100
  [10000000, 25000], //   under $100,000 -> $250
  [Infinity, 50000], //   $100,000 and over -> $500
];

// Vehicles and machinery: 3% buyer / 5% seller. Everything else: 5% buyer / 7.5% seller.
const FEE_TIERS = {
  heavy: { buyerBps: 300, sellerBps: 500 },
  standard: { buyerBps: 500, sellerBps: 750 },
};
const HEAVY_CATEGORIES = new Set(['vehicles', 'machinery']);

function minIncrementCents(currentCents) {
  for (const [below, increment] of INCREMENT_BANDS) {
    if (currentCents < below) return increment;
  }
  return INCREMENT_BANDS[INCREMENT_BANDS.length - 1][1];
}

function isCents(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Half-up rounding on basis points, in integers only.
function feeCents(amountCents, bps) {
  return Math.floor((amountCents * bps + 5000) / 10000);
}

function feesFor(category, hammerCents) {
  const tier = HEAVY_CATEGORIES.has(String(category || '').toLowerCase()) ? FEE_TIERS.heavy : FEE_TIERS.standard;
  const buyerFeeCents = feeCents(hammerCents, tier.buyerBps);
  const sellerFeeCents = feeCents(hammerCents, tier.sellerBps);
  return {
    buyerFeeCents,
    sellerFeeCents,
    buyerTotalCents: hammerCents + buyerFeeCents,
    sellerNetCents: hammerCents - sellerFeeCents,
  };
}

/**
 * state: { status, mode: 'manual'|'proxy', startCents, currentCents, leaderUserId, leaderMaxCents,
 *          bidCount, endsAt (ms), sellerUserId }
 * bid:   { userId, amountCents }   // the bid in manual mode, the maximum in proxy mode
 * Returns { ok: false, code, message, minimumCents? } or { ok: true, state, events }.
 */
function resolveBid(state, bid, now) {
  const refuse = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

  if (state.status !== 'live') return refuse('not_live', 'This auction is not currently live.');
  if (now >= state.endsAt) return refuse('ended', 'Bidding has ended for this lot.');
  if (!bid || !bid.userId) return refuse('no_bidder', 'Sign in to bid.');
  if (!isCents(bid.amountCents)) return refuse('bad_amount', 'Bid amount must be a positive whole number of cents.');
  if (state.sellerUserId && state.sellerUserId === bid.userId) return refuse('own_lot', 'You cannot bid on your own lot.');

  const hasBids = state.bidCount > 0;
  const increment = minIncrementCents(hasBids ? state.currentCents : 0);
  const minimumCents = hasBids ? state.currentCents + increment : state.startCents;
  const next = { ...state };
  const events = [];
  const previousLeader = hasBids ? state.leaderUserId : null;

  if (state.mode === 'manual') {
    if (hasBids && previousLeader === bid.userId) {
      return refuse('already_leading', 'You are already the high bidder.');
    }
    if (bid.amountCents < minimumCents) {
      return refuse('too_low', 'Bid is below the minimum.', { minimumCents });
    }
    next.currentCents = bid.amountCents;
    next.leaderUserId = bid.userId;
    next.leaderMaxCents = bid.amountCents;
  } else {
    if (!hasBids) {
      if (bid.amountCents < state.startCents) return refuse('too_low', 'Bid is below the starting price.', { minimumCents });
      next.currentCents = state.startCents;
      next.leaderUserId = bid.userId;
      next.leaderMaxCents = bid.amountCents;
    } else if (previousLeader === bid.userId) {
      // The leader can only raise their own ceiling; the price does not move.
      if (bid.amountCents <= state.leaderMaxCents) return refuse('too_low', 'Your maximum is already higher.', { minimumCents: state.leaderMaxCents + 1 });
      next.leaderMaxCents = bid.amountCents;
    } else {
      if (bid.amountCents < minimumCents) return refuse('too_low', 'Bid is below the minimum.', { minimumCents });
      const leaderMax = state.leaderMaxCents;
      if (bid.amountCents > leaderMax) {
        // Challenger takes the lead at one increment over the old ceiling, never above their own maximum.
        next.leaderUserId = bid.userId;
        next.currentCents = Math.min(bid.amountCents, leaderMax + minIncrementCents(leaderMax));
        next.leaderMaxCents = bid.amountCents;
      } else {
        // Equal or lower: the existing leader stays (a tie goes to whoever bid first) and the price
        // rises to meet the challenger, never above the leader's own maximum.
        next.currentCents = bid.amountCents === leaderMax
          ? leaderMax
          : Math.min(leaderMax, bid.amountCents + minIncrementCents(bid.amountCents));
      }
    }
  }

  next.bidCount = state.bidCount + 1;
  events.push({ type: 'bid', userId: bid.userId, priceCents: next.currentCents });
  if (next.leaderUserId !== previousLeader && previousLeader) {
    events.push({ type: 'outbid', userId: previousLeader, priceCents: next.currentCents });
  } else if (next.leaderUserId === previousLeader && bid.userId !== previousLeader) {
    events.push({ type: 'outbid', userId: bid.userId, priceCents: next.currentCents });
  }

  // A valid bid in the final window pushes the end out; it repeats for every such bid.
  if (state.endsAt - now <= SOFT_CLOSE_MS) {
    next.endsAt = now + SOFT_CLOSE_MS;
    events.push({ type: 'extended', endsAt: next.endsAt });
  }
  return { ok: true, state: next, events };
}

/** Closes a lot whose time has run out: sold with fees and a payment deadline, or unsold. */
function finalizeLot(state, category, now) {
  if (state.status !== 'live') return { changed: false, reason: 'not_live' };
  if (now < state.endsAt) return { changed: false, reason: 'still_running' };
  if (!state.bidCount) return { changed: true, status: 'unsold' };
  const fees = feesFor(category, state.currentCents);
  return {
    changed: true,
    status: 'sold',
    winnerUserId: state.leaderUserId,
    hammerCents: state.currentCents,
    paymentDueAt: now + PAYMENT_WINDOW_MS,
    ...fees,
  };
}

module.exports = {
  SOFT_CLOSE_MS,
  PAYMENT_WINDOW_MS,
  DEFAULT_DURATION_MS,
  INCREMENT_BANDS,
  minIncrementCents,
  feesFor,
  resolveBid,
  finalizeLot,
};

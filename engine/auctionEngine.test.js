'use strict';
// Run: node --test engine/auctionEngine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./auctionEngine');

const NOW = 1_800_000_000_000;
const lot = (over = {}) => ({
  status: 'live', mode: 'manual', startCents: 10000, currentCents: 0, leaderUserId: null,
  leaderMaxCents: 0, bidCount: 0, endsAt: NOW + 3 * 3600_000, sellerUserId: 'seller', ...over,
});

test('increment bands change exactly at each boundary', () => {
  assert.equal(E.minIncrementCents(0), 500);
  assert.equal(E.minIncrementCents(9999), 500);
  assert.equal(E.minIncrementCents(10000), 1000);
  assert.equal(E.minIncrementCents(49999), 1000);
  assert.equal(E.minIncrementCents(50000), 2500);
  assert.equal(E.minIncrementCents(99999), 2500);
  assert.equal(E.minIncrementCents(100000), 5000);
  assert.equal(E.minIncrementCents(499999), 5000);
  assert.equal(E.minIncrementCents(500000), 10000);
  assert.equal(E.minIncrementCents(2499999), 10000);
  assert.equal(E.minIncrementCents(2500000), 25000);
  assert.equal(E.minIncrementCents(10000000), 50000);
  assert.equal(E.minIncrementCents(999999999), 50000);
});

test('fees: vehicles and machinery 3%/5%, everything else 5%/7.5%, rounded half up', () => {
  assert.deepEqual(E.feesFor('vehicles', 1000000), { buyerFeeCents: 30000, sellerFeeCents: 50000, buyerTotalCents: 1030000, sellerNetCents: 950000 });
  assert.equal(E.feesFor('Machinery', 1000000).buyerFeeCents, 30000);
  assert.deepEqual(E.feesFor('electronics', 1000000), { buyerFeeCents: 50000, sellerFeeCents: 75000, buyerTotalCents: 1050000, sellerNetCents: 925000 });
  assert.equal(E.feesFor('electronics', 10).buyerFeeCents, 1); // 0.5 rounds up
  assert.equal(E.feesFor('electronics', 9).buyerFeeCents, 0); // 0.45 rounds down
});

test('manual: first bid must meet the starting price, later bids one increment over', () => {
  let r = E.resolveBid(lot(), { userId: 'a', amountCents: 9999 }, NOW);
  assert.equal(r.ok, false); assert.equal(r.code, 'too_low'); assert.equal(r.minimumCents, 10000);
  r = E.resolveBid(lot(), { userId: 'a', amountCents: 10000 }, NOW);
  assert.equal(r.ok, true); assert.equal(r.state.currentCents, 10000); assert.equal(r.state.leaderUserId, 'a');
  const s = r.state;
  r = E.resolveBid(s, { userId: 'b', amountCents: 10999 }, NOW);
  assert.equal(r.ok, false); assert.equal(r.minimumCents, 11000);
  r = E.resolveBid(s, { userId: 'b', amountCents: 11000 }, NOW);
  assert.equal(r.ok, true); assert.equal(r.state.leaderUserId, 'b');
  assert.deepEqual(r.events.map((e) => e.type), ['bid', 'outbid']);
  assert.equal(r.events[1].userId, 'a');
});

test('manual: the high bidder cannot bid against themselves', () => {
  const s = E.resolveBid(lot(), { userId: 'a', amountCents: 10000 }, NOW).state;
  const r = E.resolveBid(s, { userId: 'a', amountCents: 20000 }, NOW);
  assert.equal(r.ok, false); assert.equal(r.code, 'already_leading');
});

test('refuses: seller bidding, ended, not live, junk amounts', () => {
  assert.equal(E.resolveBid(lot(), { userId: 'seller', amountCents: 10000 }, NOW).code, 'own_lot');
  assert.equal(E.resolveBid(lot({ endsAt: NOW }), { userId: 'a', amountCents: 10000 }, NOW).code, 'ended');
  assert.equal(E.resolveBid(lot({ status: 'closed' }), { userId: 'a', amountCents: 10000 }, NOW).code, 'not_live');
  for (const amountCents of [0, -5, 10.5, NaN, '10000', null, Infinity]) {
    assert.equal(E.resolveBid(lot(), { userId: 'a', amountCents }, NOW).code, 'bad_amount', String(amountCents));
  }
  assert.equal(E.resolveBid(lot(), { amountCents: 10000 }, NOW).code, 'no_bidder');
});

test('proxy: first bid sets the price at the start, ceiling stays hidden', () => {
  const r = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW);
  assert.equal(r.state.currentCents, 10000);
  assert.equal(r.state.leaderMaxCents, 50000);
});

test('proxy: a higher challenger wins at one increment over the old ceiling', () => {
  let s = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW).state;
  const r = E.resolveBid(s, { userId: 'b', amountCents: 80000 }, NOW);
  assert.equal(r.state.leaderUserId, 'b');
  assert.equal(r.state.currentCents, 52500); // 50000 + 2500 (band for 50000)
  assert.equal(r.state.leaderMaxCents, 80000);
  assert.deepEqual(r.events.map((e) => e.type), ['bid', 'outbid']);
});

test('proxy: the price never exceeds the winner\'s own maximum', () => {
  const s = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW).state;
  const r = E.resolveBid(s, { userId: 'b', amountCents: 51000 }, NOW);
  assert.equal(r.state.leaderUserId, 'b');
  assert.equal(r.state.currentCents, 51000);
});

test('proxy: a lower challenger loses and only pushes the price up', () => {
  const s = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW).state;
  const r = E.resolveBid(s, { userId: 'b', amountCents: 30000 }, NOW);
  assert.equal(r.state.leaderUserId, 'a');
  assert.equal(r.state.currentCents, 31000); // 30000 + 1000 (the $10 band)
  assert.equal(r.state.leaderMaxCents, 50000);
  assert.deepEqual(r.events.map((e) => e.type), ['bid', 'outbid']);
  assert.equal(r.events[1].userId, 'b');
});

test('proxy: a tie goes to the earlier bidder at the tied price', () => {
  const s = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW).state;
  const r = E.resolveBid(s, { userId: 'b', amountCents: 50000 }, NOW);
  assert.equal(r.state.leaderUserId, 'a');
  assert.equal(r.state.currentCents, 50000);
});

test('proxy: a challenger below the minimum is refused; the leader may raise their own ceiling', () => {
  const s = E.resolveBid(lot({ mode: 'proxy' }), { userId: 'a', amountCents: 50000 }, NOW).state;
  assert.equal(E.resolveBid(s, { userId: 'b', amountCents: 10000 }, NOW).code, 'too_low');
  assert.equal(E.resolveBid(s, { userId: 'a', amountCents: 50000 }, NOW).code, 'too_low');
  const r = E.resolveBid(s, { userId: 'a', amountCents: 90000 }, NOW);
  assert.equal(r.state.leaderMaxCents, 90000);
  assert.equal(r.state.currentCents, 10000); // price unchanged
  assert.deepEqual(r.events.map((e) => e.type), ['bid']);
});

test('soft close: a bid in the last two minutes extends by two minutes, every time', () => {
  let s = lot({ endsAt: NOW + 90_000 });
  let r = E.resolveBid(s, { userId: 'a', amountCents: 10000 }, NOW);
  assert.equal(r.state.endsAt, NOW + E.SOFT_CLOSE_MS);
  assert.ok(r.events.some((e) => e.type === 'extended'));
  const later = r.state.endsAt - 30_000;
  r = E.resolveBid(r.state, { userId: 'b', amountCents: 11000 }, later);
  assert.equal(r.state.endsAt, later + E.SOFT_CLOSE_MS);
});

test('soft close: exactly two minutes out extends, one millisecond more does not', () => {
  assert.equal(E.resolveBid(lot({ endsAt: NOW + E.SOFT_CLOSE_MS }), { userId: 'a', amountCents: 10000 }, NOW).state.endsAt, NOW + E.SOFT_CLOSE_MS);
  const far = lot({ endsAt: NOW + E.SOFT_CLOSE_MS + 1 });
  assert.equal(E.resolveBid(far, { userId: 'a', amountCents: 10000 }, NOW).state.endsAt, far.endsAt);
});

test('soft close: a refused bid never extends anything', () => {
  const s = lot({ endsAt: NOW + 30_000 });
  const r = E.resolveBid(s, { userId: 'a', amountCents: 1 }, NOW);
  assert.equal(r.ok, false);
  assert.equal(s.endsAt, NOW + 30_000);
});

test('resolveBid never mutates the state it is given', () => {
  const s = Object.freeze(lot());
  assert.doesNotThrow(() => E.resolveBid(s, { userId: 'a', amountCents: 10000 }, NOW));
});

test('finalize: sold with fees and a 48-hour payment deadline', () => {
  const s = lot({ bidCount: 3, currentCents: 1000000, leaderUserId: 'w', endsAt: NOW - 1 });
  const f = E.finalizeLot(s, 'vehicles', NOW);
  assert.equal(f.status, 'sold'); assert.equal(f.winnerUserId, 'w'); assert.equal(f.hammerCents, 1000000);
  assert.equal(f.buyerTotalCents, 1030000); assert.equal(f.sellerNetCents, 950000);
  assert.equal(f.paymentDueAt, NOW + E.PAYMENT_WINDOW_MS);
});

test('finalize: unsold with no bids, nothing while running, nothing twice', () => {
  assert.equal(E.finalizeLot(lot({ endsAt: NOW - 1 }), 'vehicles', NOW).status, 'unsold');
  assert.equal(E.finalizeLot(lot({ bidCount: 1, endsAt: NOW + 1 }), 'vehicles', NOW).changed, false);
  assert.equal(E.finalizeLot(lot({ status: 'sold', endsAt: NOW - 1 }), 'vehicles', NOW).changed, false);
});

test('a 1,000-bid proxy war keeps every invariant', () => {
  let s = lot({ mode: 'proxy' }); let t = NOW; let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 1000; i += 1) {
    const userId = `u${Math.floor(rnd() * 6)}`;
    const amountCents = 10000 + Math.floor(rnd() * 5_000_000);
    t += 1000;
    const r = E.resolveBid(s, { userId, amountCents }, t);
    if (!r.ok) continue;
    assert.ok(r.state.currentCents <= r.state.leaderMaxCents, 'price never above the leader ceiling');
    assert.ok(r.state.currentCents >= s.currentCents, 'price never falls');
    assert.ok(r.state.endsAt >= s.endsAt, 'end time never moves earlier');
    s = r.state; s.endsAt = Math.max(s.endsAt, t + 3600_000);
  }
});

const API_BASE_CANDIDATES = [
  "/postgrest",
  "https://api.sovdigitalgroup.com/auction",
  "http://127.0.0.1:33001",
  "http://127.0.0.1:3001",
];

let apiBasePromise = null;

async function detectApiBase() {
  for (const base of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${base}/`, { method: "GET" });
      if (response.ok) return base;
    } catch {}
  }
  throw new Error("Auction API is unavailable right now.");
}

async function getApiBase() {
  if (!apiBasePromise) apiBasePromise = detectApiBase();
  return apiBasePromise;
}

async function apiFetch(path, options = {}) {
  const base = await getApiBase();
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error("The auction service could not complete this request.");
  }

  if (response.status === 204) return null;
  return response.json();
}

/* ── Live DealzTT API (central auth) ─────────────────────────────────────
   Same-origin: vercel.json rewrites /dealztt/* to api.sovdigitalgroup.com/api/dealztt/*, so the
   HttpOnly sign-in cookie is first-party and page script never touches the token. Money is whole
   cents on the wire; the pages show dollars. */
const LIVE_BASE = "/dealztt";
const CATEGORY_NAMES = {
  vehicles: "Vehicles", machinery: "Machinery & Equipment", repossessions: "Repossessions",
  liquidations: "Liquidations", electronics: "Electronics", "home-business": "Home & Business",
};

async function liveFetch(path, options = {}) {
  const response = await fetch(`${LIVE_BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "The auction service could not complete this request.");
    error.status = response.status;
    error.gate = data.gate || null;
    error.code = data.error || null;
    throw error;
  }
  return data;
}

/* The sign-in wall: signed-out and not-yet-verified viewers only get the labelled sample lots. */
function reportWall(gate, hidden) {
  window.AuctionApi.wall = { gate: gate || null, hidden: Number(hidden || 0) };
  document.dispatchEvent(new CustomEvent("dealztt:wall", { detail: window.AuctionApi.wall }));
}

function toUiLot(l) {
  const current = l.bidCount ? l.currentCents : l.startCents;
  return {
    id: l.id,
    category_slug: l.category,
    category_name: CATEGORY_NAMES[l.category] || l.category,
    title: l.title,
    description: l.description,
    image_url: (l.images || [])[0] || null,
    images: l.images || [],
    starting_bid: l.startCents / 100,
    current_bid: current / 100,
    bid_count: l.bidCount,
    ends_at: l.endsAt,
    city: l.location || "",
    state: "",
    seller_name: "",
    seller_verified: false,
    is_demo: /\[demo\]/i.test(l.title),
    min_next: l.minimumNextBidCents ? l.minimumNextBidCents / 100 : null,
  };
}

/* ── Unified data source ──────────────────────────────────────────────────
   In DEMO_MODE the whole experience runs on the sample lots in demo-data.js
   (each visibly DEMO-badged). Set window.DEALZTT_DEMO_MODE = false to render
   ONLY the real live feed — no invented inventory, per SPEC.md. Demo bids
   mutate an in-memory copy so the instant-bid flow is fully clickable. */
function demoMode() { return Boolean(window.DEALZTT_DEMO_MODE); }

let demoLotsCache = null;
function demoLots() {
  if (!demoLotsCache) demoLotsCache = (window.DEALZTT_DEMO_LOTS || []).map((l) => ({ ...l, is_demo: true }));
  return demoLotsCache;
}

const AuctionData = {
  isDemo: demoMode,

  async getCategories() {
    return (window.DEALZTT_CATEGORIES || []).map((c) => ({ ...c }));
  },

  async getLots() {
    if (demoMode()) return demoLots();
    const data = await liveFetch("/lots?limit=50");
    reportWall(data.gate, data.hidden_total);
    return (data.lots || []).map(toUiLot);
  },

  async getLot(id) {
    if (demoMode()) return demoLots().find((l) => String(l.id) === String(id)) || null;
    try {
      const data = await liveFetch(`/lots/${encodeURIComponent(id)}`);
      return data.lot ? toUiLot(data.lot) : null;
    } catch (error) {
      if (error.gate) { reportWall(error.gate, 1); return null; } // a real lot behind the wall
      if (error.status === 404) return null;
      throw error;
    }
  },

  /* Place a bid. Demo: mutate in-memory + return the new state instantly.
     Live: POST to the real /bids/place endpoint (wired for when the auction
     backend deploys). Throws on an invalid/low bid. */
  async placeBid(id, amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid bid amount.");

    if (demoMode()) {
      const lot = demoLots().find((l) => String(l.id) === String(id));
      if (!lot) throw new Error("Lot not found.");
      const floor = Number(lot.current_bid || lot.starting_bid || 0);
      const minNext = floor + minIncrement(floor);
      if (value < minNext) throw new Error(`Bid must be at least ${minNext.toLocaleString("en-TT")}.`);
      lot.current_bid = value;
      lot.bid_count = Number(lot.bid_count || 0) + 1;
      return { ok: true, lot: { ...lot }, min_next: value + minIncrement(value) };
    }

    const outcome = await liveFetch(`/lots/${encodeURIComponent(id)}/bids`, {
      method: "POST",
      body: JSON.stringify({ amount_cents: Math.round(value * 100), idempotency_key: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random() }),
    });
    const lot = toUiLot(outcome.lot);
    return { ok: true, lot, leading: outcome.leading, extended: outcome.extended, min_next: lot.min_next };
  },
};

/* Smallest raise the server accepts, by price band (matches /api/dealztt/rules). */
function minIncrement(price) {
  if (price < 100) return 5;
  if (price < 500) return 10;
  if (price < 1000) return 25;
  if (price < 5000) return 50;
  if (price < 25000) return 100;
  if (price < 100000) return 250;
  return 500;
}

window.AuctionApi = { apiFetch, liveFetch, AuctionData, minIncrement, categoryNames: CATEGORY_NAMES, wall: { gate: null, hidden: 0 } };

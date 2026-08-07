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

const LOT_SELECT =
  "id,title,description,image_url,current_bid,starting_bid,bid_count,is_hot,is_featured,ends_at,city,state,seller_name,seller_verified,category_slug,category_name";

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
    if (demoMode()) return (window.DEALZTT_CATEGORIES || []).map((c) => ({ ...c }));
    return apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc");
  },

  async getLots() {
    if (demoMode()) return demoLots();
    return apiFetch(`/v_lot_feed?select=${LOT_SELECT}&order=ends_at.asc`);
  },

  async getLot(id) {
    if (demoMode()) return demoLots().find((l) => String(l.id) === String(id)) || null;
    const rows = await apiFetch(`/v_lot_feed?select=${LOT_SELECT}&id=eq.${encodeURIComponent(id)}`);
    return Array.isArray(rows) ? rows[0] : null;
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

    return apiFetch("/bids/place", { method: "POST", body: JSON.stringify({ lot_id: id, amount: value }) });
  },
};

/* Suggested minimum bid increment, scaled to price. */
function minIncrement(price) {
  if (price >= 100000) return 2500;
  if (price >= 20000) return 1000;
  if (price >= 5000) return 250;
  if (price >= 1000) return 100;
  return 25;
}

window.AuctionApi = { apiFetch, AuctionData, minIncrement };

/* ===========================================================================
   DealzTT — Demo data layer (PREVIEW ONLY)
   ---------------------------------------------------------------------------
   Purpose: let Shane see and click the full auction experience before the
   held auction backend is deployed. Every lot here is clearly DEMO-badged in
   the UI so it can never be mistaken for real published inventory.

   TO GO LIVE: set DEMO_MODE = false (or seed real lots into the API). When
   DEMO_MODE is false, the JS falls back to the real /v_lot_feed API only and
   renders nothing invented — matching SPEC.md truthfulness rules.
   =========================================================================== */

window.DEALZTT_DEMO_MODE = true;

/* --- Canonical category taxonomy (shared shape for all SOV sites) ----------
   6 top-level auction categories. Vehicles + Machinery are the high-value fee
   tier (3% buyer / 5% seller); the rest are 5% / 7.5%. Keep this list in sync
   with the central `auction_categories` seed when the backend is populated. */
window.DEALZTT_CATEGORIES = [
  { slug: "vehicles",       name: "Vehicles",              icon: "🚗", tier: "high" },
  { slug: "machinery",      name: "Machinery & Equipment", icon: "🏗️", tier: "high" },
  { slug: "repossessions",  name: "Repossessions",         icon: "🏦", tier: "std"  },
  { slug: "liquidations",   name: "Liquidations",          icon: "📦", tier: "std"  },
  { slug: "electronics",    name: "Electronics",           icon: "💻", tier: "std"  },
  { slug: "home-business",  name: "Home & Business",       icon: "🏠", tier: "std"  },
];

const H = 3600 * 1000;
const M = 60 * 1000;
const now = Date.now();
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

/* is_major = big-ticket lot surfaced on the home page "major purchases" band. */
window.DEALZTT_DEMO_LOTS = [
  {
    id: "demo-veh-01", category_slug: "vehicles", category_name: "Vehicles",
    title: "2018 Toyota Hilux 2.4L 4x4 — Single Owner",
    description: "Repossessed unit. 96,000 km, full service history, new tyres, minor tray wear. Sold as-is, no reserve. Inspection by appointment in Chaguanas.",
    image_url: img("1503376780353-7e6692767b70"),
    starting_bid: 78000, current_bid: 112500, bid_count: 27,
    is_hot: true, is_featured: true, is_major: true,
    ends_at: new Date(now + 5 * H + 12 * M).toISOString(),
    city: "Chaguanas", state: "Trinidad", seller_name: "AutoRepo T&T", seller_verified: true,
  },
  {
    id: "demo-mac-01", category_slug: "machinery", category_name: "Machinery & Equipment",
    title: "CAT 320D Hydraulic Excavator (2016)",
    description: "8,400 hours. Starts and operates. Tracks 70%. Bank liquidation asset. Located San Fernando. Buyer arranges transport.",
    image_url: img("1581094794329-c8112a89af12"),
    starting_bid: 210000, current_bid: 285000, bid_count: 14,
    is_hot: true, is_featured: true, is_major: true,
    ends_at: new Date(now + 1 * H + 40 * M).toISOString(),
    city: "San Fernando", state: "Trinidad", seller_name: "South Liquidators", seller_verified: true,
  },
  {
    id: "demo-veh-02", category_slug: "vehicles", category_name: "Vehicles",
    title: "2020 Nissan Kicks SR — Low Mileage",
    description: "41,000 km, one owner, clean interior, reverse camera. Financing default recovery. No reserve.",
    image_url: img("1552519507-da3b142c6e3d"),
    starting_bid: 62000, current_bid: 74250, bid_count: 19,
    is_hot: true, is_featured: false, is_major: true,
    ends_at: new Date(now + 22 * H).toISOString(),
    city: "Port of Spain", state: "Trinidad", seller_name: "Island Motors Recovery", seller_verified: true,
  },
  {
    id: "demo-rep-01", category_slug: "repossessions", category_name: "Repossessions",
    title: "Repossessed 40ft Shipping Container + Contents",
    description: "Assorted commercial fixtures and shelving from a closed retail unit. Full manifest available to registered bidders. Scarborough yard.",
    image_url: img("1605902711622-cfb43c4437b5"),
    starting_bid: 18000, current_bid: 24500, bid_count: 8,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 3 * H + 5 * M).toISOString(),
    city: "Scarborough", state: "Tobago", seller_name: "Tobago Trade House", seller_verified: true,
  },
  {
    id: "demo-elec-01", category_slug: "electronics", category_name: "Electronics",
    title: "MacBook Pro 14\" M3 Pro (2024) — Sealed",
    description: "Overstock from a liquidation lot. 18GB / 512GB, Space Black, factory sealed. Warranty applies.",
    image_url: img("1517336714731-489689fd1ca8"),
    starting_bid: 9500, current_bid: 13200, bid_count: 33,
    is_hot: true, is_featured: false, is_major: false,
    ends_at: new Date(now + 46 * M).toISOString(),
    city: "Chaguanas", state: "Trinidad", seller_name: "Chaguanas Deals Hub", seller_verified: true,
  },
  {
    id: "demo-elec-02", category_slug: "electronics", category_name: "Electronics",
    title: "Samsung 65\" QLED 4K Smart TV — Open Box",
    description: "Display model, fully working, remote and stand included. Minor box wear. Pickup San Fernando.",
    image_url: img("1593359677879-a4bb92f829d1"),
    starting_bid: 3200, current_bid: 4650, bid_count: 21,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 8 * H).toISOString(),
    city: "San Fernando", state: "Trinidad", seller_name: "South Liquidators", seller_verified: true,
  },
  {
    id: "demo-liq-01", category_slug: "liquidations", category_name: "Liquidations",
    title: "Pallet Lot — Assorted Power Tools (Mixed Brands)",
    description: "Approx. 40 units: drills, grinders, saws. Untested clearance stock sold by the pallet. No reserve.",
    image_url: img("1504148455328-c376907d081c"),
    starting_bid: 4000, current_bid: 6100, bid_count: 12,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 27 * H).toISOString(),
    city: "Arima", state: "Trinidad", seller_name: "Chaguanas Deals Hub", seller_verified: false,
  },
  {
    id: "demo-mac-02", category_slug: "machinery", category_name: "Machinery & Equipment",
    title: "Commercial Diesel Generator 100kVA (Perkins)",
    description: "Standby unit, 1,200 running hours, weatherproof canopy. Business closure asset. Located Couva.",
    image_url: img("1620714223084-8fcacc6dfd8d"),
    starting_bid: 45000, current_bid: 58000, bid_count: 9,
    is_hot: false, is_featured: false, is_major: true,
    ends_at: new Date(now + 13 * H + 30 * M).toISOString(),
    city: "Couva", state: "Trinidad", seller_name: "South Liquidators", seller_verified: true,
  },
  {
    id: "demo-home-01", category_slug: "home-business", category_name: "Home & Business",
    title: "Restaurant Kitchen Package — 6-Burner Range + Fridge",
    description: "Complete commercial kitchen set from a closed diner. Stainless prep tables, range, double-door chiller. San Juan.",
    image_url: img("1556910103-1c02745aae4d"),
    starting_bid: 12000, current_bid: 17800, bid_count: 6,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 34 * H).toISOString(),
    city: "San Juan", state: "Trinidad", seller_name: "Island Motors Recovery", seller_verified: true,
  },
  {
    id: "demo-home-02", category_slug: "home-business", category_name: "Home & Business",
    title: "Office Fit-Out — 12 Desks, 12 Ergonomic Chairs",
    description: "Corporate downsizing. Matching desks and chairs, good condition. Sold as one lot. Port of Spain.",
    image_url: img("1497366216548-37526070297c"),
    starting_bid: 8000, current_bid: 9400, bid_count: 4,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 51 * H).toISOString(),
    city: "Port of Spain", state: "Trinidad", seller_name: "Tobago Trade House", seller_verified: false,
  },
  {
    id: "demo-veh-03", category_slug: "vehicles", category_name: "Vehicles",
    title: "2015 Toyota Corolla — Runs, Needs Body Work",
    description: "Recovery unit. Mechanically sound, cosmetic damage front-left. Great parts or project car. No reserve.",
    image_url: img("1590362891991-f776e747a588"),
    starting_bid: 22000, current_bid: 28900, bid_count: 16,
    is_hot: false, is_featured: false, is_major: false,
    ends_at: new Date(now + 2 * H + 20 * M).toISOString(),
    city: "Marabella", state: "Trinidad", seller_name: "AutoRepo T&T", seller_verified: true,
  },
  {
    id: "demo-elec-03", category_slug: "electronics", category_name: "Electronics",
    title: "iPhone 15 Pro 256GB — Certified Refurbished",
    description: "Grade A refurbished, new battery, unlocked. 90-day warranty. Overstock clearance.",
    image_url: img("1592286927505-1def25e3a5c8"),
    starting_bid: 4500, current_bid: 6250, bid_count: 24,
    is_hot: true, is_featured: false, is_major: false,
    ends_at: new Date(now + 18 * M).toISOString(),
    city: "Chaguanas", state: "Trinidad", seller_name: "Chaguanas Deals Hub", seller_verified: true,
  },
];

/* --- Seed activity for the live feed (relative timestamps) ------------------ */
window.DEALZTT_DEMO_ACTIVITY = [
  { type: "bid",   who: "kavir_868",   lot: "2018 Toyota Hilux 4x4",  amount: 112500, at: now - 40 * 1000 },
  { type: "new",   who: "AutoRepo T&T",lot: "2015 Toyota Corolla",    at: now - 4 * M },
  { type: "bid",   who: "sasha.m",     lot: "MacBook Pro 14\" M3",    amount: 13200, at: now - 6 * M },
  { type: "watch", who: "denzil_tt",   lot: "CAT 320D Excavator",     at: now - 9 * M },
  { type: "bid",   who: "rina_pos",    lot: "iPhone 15 Pro 256GB",    amount: 6250,  at: now - 12 * M },
  { type: "win",   who: "marlon.j",    lot: "Samsung 65\" QLED TV",   amount: 4650,  at: now - 20 * M },
  { type: "bid",   who: "trini_deals", lot: "100kVA Generator",       amount: 58000, at: now - 26 * M },
  { type: "new",   who: "South Liquidators", lot: "Power Tools Pallet Lot", at: now - 33 * M },
];

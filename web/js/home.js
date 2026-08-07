/* ===========================================================================
   DealzTT — Home: major purchases band, sortable marketplace, working search,
   live activity feed. Runs on demo data in DEMO_MODE; on the real feed live.
   =========================================================================== */

const majorGrid = document.getElementById("major-grid");
const majorSection = document.getElementById("major-section");
const lotGrid = document.getElementById("lot-grid");
const marketplaceSection = document.getElementById("marketplace-section");
const sortBar = document.getElementById("sort-bar");
const categoryInput = document.getElementById("category-search");
const categoryHint = document.getElementById("category-hint");
const locationInput = document.getElementById("location-search");
const searchForm = document.getElementById("search-form");
const resultNote = document.getElementById("results-note");
const launchState = document.getElementById("launch-state");
const launchStateTitle = document.getElementById("launch-state-title");
const launchStateMessage = document.getElementById("launch-state-message");
const statLive = document.getElementById("stat-live");
const statHot = document.getElementById("stat-hot");
const statCats = document.getElementById("stat-cats");
const feedList = document.getElementById("activity-list");

let categories = [];
let lots = [];
let activeCategorySlug = "";
let sortMode = "ending";

function isOpen(lot) {
  return new Date(lot.ends_at).getTime() > window.AuctionUi.nowMs();
}

function sortLots(rows) {
  const arr = [...rows];
  if (sortMode === "price-high") arr.sort((a, b) => bidVal(b) - bidVal(a));
  else if (sortMode === "price-low") arr.sort((a, b) => bidVal(a) - bidVal(b));
  else if (sortMode === "hot") arr.sort((a, b) => Number(b.bid_count || 0) - Number(a.bid_count || 0));
  else arr.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at)); // ending soonest
  return arr;
}
function bidVal(lot) { return Number(lot.current_bid || lot.starting_bid || 0); }

function renderMajor() {
  if (!majorSection) return;
  const majors = lots.filter((l) => l.is_major).sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at)).slice(0, 4);
  if (!majors.length) { majorSection.hidden = true; return; }
  majorSection.hidden = false;
  majorGrid.innerHTML = "";
  majors.forEach((lot) => {
    const a = document.createElement("article");
    a.className = "major-card";
    a.dataset.lotId = lot.id;
    a.innerHTML = `
      ${lot.is_demo ? '<span class="demo-ribbon">Demo</span>' : ""}
      <img class="mc-img" loading="lazy" src="${lot.image_url || window.AuctionCard.FALLBACK_IMG}" alt="${escapeAttr(lot.title)}" />
      <div class="mc-body">
        <p class="chip chip-pink">${escapeHtml(lot.category_name || "Major lot")}</p>
        <h3 class="mc-title"><a href="./lot.html?id=${encodeURIComponent(lot.id)}"></a></h3>
        <p class="subtle lot-seller"></p>
        <div class="mc-row">
          <span class="mc-price"></span>
          <span class="mc-time timer" data-ends="${lot.ends_at}"></span>
        </div>
      </div>`;
    a.querySelector(".mc-title a").textContent = lot.title;
    a.querySelector(".lot-seller").textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " · Verified" : ""} · ${lot.city || ""}`;
    a.querySelector(".mc-price").textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
    a.querySelector(".mc-time").textContent = window.AuctionUi.timeLeft(lot.ends_at);
    const img = a.querySelector(".mc-img");
    img.onerror = () => { img.onerror = null; img.src = window.AuctionCard.FALLBACK_IMG; };
    majorGrid.appendChild(a);
  });
}

function renderMarketplace() {
  const query = categoryInput.value.trim().toLowerCase();
  const location = locationInput.value.trim().toLowerCase();
  const filtered = lots.filter((lot) => {
    const matchesCategory = activeCategorySlug
      ? lot.category_slug === activeCategorySlug
      : !query || `${lot.category_name || ""} ${lot.title || ""}`.toLowerCase().includes(query);
    const matchesLocation = !location || `${lot.city || ""} ${lot.state || ""}`.toLowerCase().includes(location);
    return matchesCategory && matchesLocation;
  });
  const sorted = sortLots(filtered);
  lotGrid.innerHTML = "";
  sorted.forEach((lot) => lotGrid.appendChild(window.AuctionCard.buildLotCard(lot)));
  resultNote.textContent = `${sorted.length} live lot${sorted.length === 1 ? "" : "s"}${activeCategorySlug || query || location ? " match your search" : ""}`;
}

function updateStats() {
  if (statLive) statLive.textContent = String(lots.length);
  if (statHot) statHot.textContent = String(lots.filter((l) => l.is_hot).length);
  if (statCats) statCats.textContent = String(categories.length);
}

/* ── Search hints ─────────────────────────────────────────────────────────── */
function showCategoryHint(value) {
  const q = value.trim().toLowerCase();
  categoryHint.innerHTML = "";
  if (!q) return;
  categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)).slice(0, 8).forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hint-option"; b.textContent = `${c.icon || ""} ${c.name}`.trim();
    b.addEventListener("click", () => {
      categoryInput.value = c.name; activeCategorySlug = c.slug; categoryHint.innerHTML = ""; renderMarketplace();
    });
    categoryHint.appendChild(b);
  });
}

/* ── Live activity feed ───────────────────────────────────────────────────── */
const feedItems = [];
function feedIcon(type) { return { bid: "💸", new: "✨", win: "🏆", watch: "👁" }[type] || "🔔"; }
function feedText(ev) {
  const who = `<b>${escapeHtml(ev.who)}</b>`;
  const lot = `<b>${escapeHtml(ev.lot)}</b>`;
  if (ev.type === "bid") return `${who} bid <span class="amt">${window.AuctionUi.money(ev.amount)}</span> on ${lot}`;
  if (ev.type === "new") return `${who} listed a new lot: ${lot}`;
  if (ev.type === "win") return `${who} won ${lot} at <span class="amt">${window.AuctionUi.money(ev.amount)}</span>`;
  if (ev.type === "watch") return `${who} is watching ${lot}`;
  return `${who} · ${lot}`;
}
function renderFeed() {
  if (!feedList) return;
  feedList.innerHTML = "";
  feedItems.slice(0, 30).forEach((ev) => {
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-ic ${ev.type}">${feedIcon(ev.type)}</div>
      <div class="activity-body">
        <div class="activity-text">${feedText(ev)}</div>
        <div class="activity-meta">${window.AuctionUi.timeAgo(ev.at)}</div>
      </div>`;
    feedList.appendChild(item);
  });
}
function pushFeed(ev, toTop = true) {
  if (toTop) feedItems.unshift(ev); else feedItems.push(ev);
  renderFeed();
}

/* React to real bids placed anywhere on the page. */
document.addEventListener("dealztt:bid", (e) => {
  pushFeed({ type: "bid", who: e.detail.who, lot: e.detail.lot, amount: e.detail.amount, at: window.AuctionUi.nowMs() });
});

/* Simulated marketplace chatter (DEMO only) — makes the feed feel alive. */
const DEMO_ACTORS = ["kavir_868", "sasha.m", "denzil_tt", "rina_pos", "trini_deals", "marlon.j", "aaliyah_tt", "shivan_868"];
function simulateActivity() {
  if (!window.AuctionApi.AuctionData.isDemo() || !lots.length) return;
  const lot = lots[Math.floor(pseudo() * lots.length)];
  const who = DEMO_ACTORS[Math.floor(pseudo() * DEMO_ACTORS.length)];
  const bump = window.AuctionApi.minIncrement(bidVal(lot));
  lot.current_bid = bidVal(lot) + bump;
  lot.bid_count = Number(lot.bid_count || 0) + 1;
  pushFeed({ type: "bid", who, lot: lot.title, amount: lot.current_bid, at: window.AuctionUi.nowMs() });
  // reflect on any visible card for this lot
  const nextMin = lot.current_bid + window.AuctionApi.minIncrement(lot.current_bid);
  document.querySelectorAll(`[data-lot-id="${cssEscape(lot.id)}"]`).forEach((card) => {
    const p = card.querySelector('[data-price], .mc-price');
    const b = card.querySelector(".lot-bids");
    if (p) { p.textContent = window.AuctionUi.money(lot.current_bid); p.classList.remove("price-pop"); void p.offsetWidth; p.classList.add("price-pop"); }
    if (b) b.textContent = `${lot.bid_count} bids`;
    const input = card.querySelector(".js-bid-amount");
    if (input) { input.min = nextMin; input.placeholder = `${nextMin.toLocaleString("en-TT")}+`; }
    const hint = card.querySelector(".bid-hint");
    if (hint && !hint.textContent.startsWith("You")) hint.textContent = `Min next bid ${window.AuctionUi.money(nextMin)} · sign in required`;
  });
  updateStats();
}
let seed = Date.now() % 100000;
function pseudo() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

/* ── Empty / launch state ─────────────────────────────────────────────────── */
function showLaunch(unavailable = false) {
  if (majorSection) majorSection.hidden = true;
  marketplaceSection.hidden = true;
  if (sortBar) sortBar.hidden = true;
  searchForm.hidden = true;
  launchState.hidden = false;
  launchStateTitle.textContent = unavailable ? "Auction availability is being refreshed." : "The first DealzTT auctions are being prepared.";
  launchStateMessage.textContent = unavailable
    ? "We could not load the current auction list. Please check back shortly, or create a buyer account and submit a consignment in the meantime."
    : "There are no open lots right now. Create a buyer account so you are ready when lots open, or submit a consignment to help shape the first drops.";
  resultNote.textContent = unavailable ? "Auction availability is being refreshed." : "Auctions are launching soon.";
}

/* ── Events ───────────────────────────────────────────────────────────────── */
categoryInput.addEventListener("input", () => { activeCategorySlug = ""; showCategoryHint(categoryInput.value); renderMarketplace(); });
locationInput.addEventListener("input", renderMarketplace);
searchForm.addEventListener("submit", (e) => { e.preventDefault(); categoryHint.innerHTML = ""; renderMarketplace(); });
document.addEventListener("click", (e) => { if (categoryHint && !categoryHint.contains(e.target) && e.target !== categoryInput) categoryHint.innerHTML = ""; });
if (sortBar) sortBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]"); if (!btn) return;
  sortMode = btn.dataset.sort;
  sortBar.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn));
  renderMarketplace();
});

/* ── Boot ─────────────────────────────────────────────────────────────────── */
async function loadData() {
  const [cats, allLots] = await Promise.all([
    window.AuctionApi.AuctionData.getCategories(),
    window.AuctionApi.AuctionData.getLots(),
  ]);
  categories = cats || [];
  lots = (allLots || []).filter(isOpen);
  updateStats();
  if (!lots.length) { showLaunch(false); return; }
  launchState.hidden = true;
  renderMajor();
  renderMarketplace();
  // seed the feed
  (window.DEALZTT_DEMO_ACTIVITY || []).forEach((ev) => feedItems.push(ev));
  feedItems.sort((a, b) => b.at - a.at);
  renderFeed();
  setInterval(renderFeed, 15000);       // refresh "time ago"
  setInterval(simulateActivity, 9000);  // demo chatter
}

/* Small HTML-safety helpers */
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
function cssEscape(s) { return String(s).replace(/["\\]/g, "\\$&"); }

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    await loadData();
  } catch {
    showLaunch(true);
  }
})();

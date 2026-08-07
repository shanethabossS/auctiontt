/* ===========================================================================
   DealzTT — Lot detail: live bid panel, sign-in gating, watchlist, outbid
   notifications, share, report. Demo data in DEMO_MODE; real feed live.
   =========================================================================== */

const loadingNode = document.getElementById("lot-loading");
const detailNode = document.getElementById("lot-detail");
const errorNode = document.getElementById("lot-error");
const errorTitleNode = document.getElementById("lot-error-title");
const errorMessageNode = document.getElementById("lot-error-message");
const imageNode = document.getElementById("lot-image");
const categoryNode = document.getElementById("lot-category");
const titleNode = document.getElementById("lot-title");
const sellerNode = document.getElementById("lot-seller");
const priceNode = document.getElementById("lot-price");
const timeNode = document.getElementById("lot-time");
const locationNode = document.getElementById("lot-location");
const bidsNode = document.getElementById("lot-bids");
const descriptionNode = document.getElementById("lot-description");
const statusBadgeNode = document.getElementById("lot-status-badge");
const regionNode = document.getElementById("lot-region");
const urgencyNode = document.getElementById("lot-urgency");
const sellerStatusNode = document.getElementById("lot-seller-status");
const bidPanel = document.getElementById("bid-panel");
const watchButton = document.getElementById("watch-lot");
const shareButton = document.getElementById("share-lot");
const reportLink = document.getElementById("report-lot");
const jsonLdNode = document.getElementById("lot-jsonld");
const relatedNode = document.getElementById("related-lots");
const relatedGrid = document.getElementById("related-lots-grid");
const relatedCopy = document.getElementById("related-lots-copy");

const LOT_FALLBACK = window.AuctionCard.FALLBACK_IMG;
let outbidTimer = null;

/* ── eBay-style bidding state ────────────────────────────────────────────── */
let viewerMax = 0;          // proxy: bid for me up to this
let viewerWinning = false;  // am I currently the high bidder?
let watchers = 0;
const bidHistory = [];      // {name, you, amount, at}
const RIVALS = ["k***r", "s***a", "d***l", "r***a", "m***n", "a***h", "trini_***", "island_***"];
const fmtMoney = (v) => window.AuctionUi.money(v);
const incr = (v) => window.AuctionApi.minIncrement(v);

function seedHistory(lot) {
  bidHistory.length = 0;
  let amt = Number(lot.current_bid || lot.starting_bid || 0);
  const n = Math.min(Number(lot.bid_count || 0), 8);
  for (let i = 0; i < n; i++) {
    bidHistory.push({ name: RIVALS[i % RIVALS.length], you: false, amount: amt, at: window.AuctionUi.nowMs() - (i * 137 + 40) * 1000 });
    amt = Math.max(Number(lot.starting_bid || 0), amt - incr(amt));
  }
}
function pushHistory(entry) { bidHistory.unshift(entry); }

function statusBanner() {
  if (!bidHistory.length || !window.AuctionUi.isSignedIn()) {
    return `<div class="bid-status neutral"><span class="dot"></span> No bids from you yet — place one to take the lead.</div>`;
  }
  if (viewerWinning) {
    const proxy = viewerMax ? ` <span class="proxy-active">🤖 Auto-bidding up to ${fmtMoney(viewerMax)}</span>` : "";
    return `<div class="bid-status winning"><span class="dot"></span> You're the highest bidder!${proxy}</div>`;
  }
  return `<div class="bid-status outbid"><span class="dot"></span> You've been outbid — bid again to retake the lead.</div>`;
}

function renderBidPanel(lot) {
  if (window.AuctionUi.timeLeft(lot.ends_at) === "Ended") {
    bidPanel.innerHTML = `<div class="bid-locked">This auction has ended. <a class="btn btn-sm" href="./browse.html">Browse live lots</a></div>`;
    return;
  }
  const floor = Number(lot.current_bid || lot.starting_bid || 0);
  const step = incr(floor);
  const minNext = floor + step;
  const signedIn = window.AuctionUi.isSignedIn();

  bidPanel.innerHTML = `
    ${statusBanner()}
    <div class="bid-meta">
      <span>Current bid <b>${fmtMoney(floor)}</b></span>
      <span><b>${Number(lot.bid_count || 0)}</b> bids</span>
      <span>👁 <b>${watchers}</b> watching</span>
    </div>
    <div class="quick-bids">
      <button type="button" data-bid="${minNext}">${fmtMoney(minNext)}<small>min bid</small></button>
      <button type="button" data-bid="${floor + step * 2}">${fmtMoney(floor + step * 2)}<small>+${fmtMoney(step)}</small></button>
      <button type="button" data-bid="${floor + step * 5}">${fmtMoney(floor + step * 5)}<small>strong bid</small></button>
    </div>
    <form class="bid-inline" id="lot-bid-form">
      <input type="number" id="lot-bid-amount" min="${minNext}" step="1" placeholder="${minNext.toLocaleString("en-TT")}+ (TTD)" aria-label="Your bid" />
      <button class="btn" type="submit">Place bid</button>
    </form>
    <label class="maxbid-toggle"><input type="checkbox" id="maxbid-check" ${viewerMax ? "checked" : ""}/> Set a max bid — we'll bid for you automatically</label>
    <div class="maxbid-wrap ${viewerMax ? "open" : ""}" id="maxbid-wrap">
      <div class="bid-inline">
        <input type="number" id="maxbid-amount" min="${minNext}" step="1" value="${viewerMax || ""}" placeholder="Your max, e.g. ${(floor + step * 8).toLocaleString("en-TT")}" aria-label="Maximum bid" />
        <button class="btn ghost" type="button" id="maxbid-set">Set max</button>
      </div>
      <p class="maxbid-note">Proxy bidding: DealzTT bids the minimum needed to keep you in front, up to your max. You only pay one increment above the next-highest bidder.</p>
    </div>
    <p class="bid-hint">Minimum next bid ${fmtMoney(minNext)}${signedIn ? "" : " · sign in required"}</p>
    <div class="bid-history">
      <h3>Bid history <span class="subtle">${bidHistory.length} shown</span></h3>
      <div class="bid-history-list" id="bid-history-list"></div>
    </div>`;

  renderHistory();
  wireBidPanel(lot, minNext);
}

function renderHistory() {
  const list = document.getElementById("bid-history-list");
  if (!list) return;
  if (!bidHistory.length) { list.innerHTML = `<p class="subtle" style="padding:8px 4px;">No bids yet. Be the first!</p>`; return; }
  list.innerHTML = bidHistory.map((b, i) => `
    <div class="bh-row ${i === 0 ? "leading" : ""}">
      <span class="bh-bidder">${b.you ? '<span class="you">You</span>' : b.name}${i === 0 ? " · leading" : ""}</span>
      <span class="bh-amount">${fmtMoney(b.amount)}</span>
      <span class="bh-time">${window.AuctionUi.timeAgo(b.at)}</span>
    </div>`).join("");
}

function wireBidPanel(lot, minNext) {
  bidPanel.querySelectorAll(".quick-bids button[data-bid]").forEach((b) => {
    b.addEventListener("click", () => placeViewerBid(lot, Number(b.dataset.bid)));
  });
  const form = document.getElementById("lot-bid-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    placeViewerBid(lot, Number(document.getElementById("lot-bid-amount").value));
  });
  const check = document.getElementById("maxbid-check");
  const wrap = document.getElementById("maxbid-wrap");
  check?.addEventListener("change", () => {
    wrap.classList.toggle("open", check.checked);
    if (!check.checked) viewerMax = 0;
  });
  document.getElementById("maxbid-set")?.addEventListener("click", () => {
    if (!window.AuctionUi.requireSignIn("set a max bid")) return;
    const max = Number(document.getElementById("maxbid-amount").value);
    if (!Number.isFinite(max) || max < minNext) {
      window.AuctionUi.toast("err", "Max too low", `Your max must be at least ${fmtMoney(minNext)}.`);
      return;
    }
    viewerMax = max;
    window.DealzBadges?.record("maxbid");
    window.AuctionUi.toast("info", "Max bid set", `We'll auto-bid up to ${fmtMoney(max)} to keep you in front.`);
    // if we're not currently winning, immediately bid up to secure the lead
    if (!viewerWinning) placeViewerBid(lot, Math.min(max, Number(lot.current_bid) + incr(Number(lot.current_bid))), { fromProxy: true });
    else renderBidPanel(lot);
  });
}

/* Core: place the viewer's bid, update everything, arm a rival response. */
async function placeViewerBid(lot, amount, opts = {}) {
  if (!window.AuctionUi.requireSignIn("place a bid")) return;
  try {
    const result = await window.AuctionApi.AuctionData.placeBid(lot.id, amount);
    Object.assign(lot, result.lot);
    viewerWinning = true;
    const clutch = new Date(lot.ends_at).getTime() - window.AuctionUi.nowMs() < 120000;
    pushHistory({ name: "You", you: true, amount: lot.current_bid, at: window.AuctionUi.nowMs() });
    priceNode.textContent = fmtMoney(lot.current_bid);
    priceNode.classList.remove("price-pop"); void priceNode.offsetWidth; priceNode.classList.add("price-pop");
    bidsNode.textContent = `${lot.bid_count} bids`;
    renderBidPanel(lot);
    if (!opts.fromProxy) window.AuctionUi.toast("ok", "Bid placed!", `You lead ${lot.title} at ${fmtMoney(lot.current_bid)}.`);
    window.DealzBadges?.record("bid", { amount: lot.current_bid, clutch });
    document.dispatchEvent(new CustomEvent("dealztt:bid", { detail: { lot: lot.title, amount: lot.current_bid, who: window.AuctionUi.currentUserName() } }));
    scheduleRival(lot);
  } catch (err) {
    window.AuctionUi.toast("err", "Bid not placed", err.message || "Please try again.");
  }
}

/* Demo: a rival responds. If the viewer has proxy headroom, auto-rebid and
   stay winning; otherwise the viewer is outbid and notified. */
function scheduleRival(lot) {
  if (!window.AuctionApi.AuctionData.isDemo()) return;
  clearTimeout(outbidTimer);
  outbidTimer = setTimeout(async () => {
    if (window.AuctionUi.timeLeft(lot.ends_at) === "Ended") return;
    const rivalBid = Number(lot.current_bid) + incr(Number(lot.current_bid));

    // Proxy: if the rival is within our max, DealzTT bids for us and we stay ahead.
    if (viewerMax && rivalBid + incr(rivalBid) <= viewerMax) {
      lot.current_bid = rivalBid + incr(rivalBid);
      lot.bid_count = Number(lot.bid_count || 0) + 2;
      pushHistory({ name: RIVALS[0], you: false, amount: rivalBid, at: window.AuctionUi.nowMs() - 1000 });
      pushHistory({ name: "You", you: true, amount: lot.current_bid, at: window.AuctionUi.nowMs() });
      viewerWinning = true;
      priceNode.textContent = fmtMoney(lot.current_bid);
      bidsNode.textContent = `${lot.bid_count} bids`;
      renderBidPanel(lot);
      window.AuctionUi.toast("info", "Auto-bid kept you ahead", `A rival bid ${fmtMoney(rivalBid)} — DealzTT bid ${fmtMoney(lot.current_bid)} for you.`);
      scheduleRival(lot);
      return;
    }

    // Outbid.
    lot.current_bid = rivalBid;
    lot.bid_count = Number(lot.bid_count || 0) + 1;
    pushHistory({ name: RIVALS[Math.floor(bidHistory.length) % RIVALS.length], you: false, amount: rivalBid, at: window.AuctionUi.nowMs() });
    viewerWinning = false;
    priceNode.textContent = fmtMoney(lot.current_bid);
    priceNode.classList.remove("price-pop"); void priceNode.offsetWidth; priceNode.classList.add("price-pop");
    bidsNode.textContent = `${lot.bid_count} bids`;
    renderBidPanel(lot);
    window.AuctionUi.toast("warn", "You've been outbid!", `Someone bid ${fmtMoney(lot.current_bid)} on ${lot.title}. Bid again to retake the lead.`);
  }, 6500);
}

/* ── Related lots ─────────────────────────────────────────────────────────── */
function renderRelated(lot, rows) {
  const related = rows
    .filter((r) => r.id !== lot.id && new Date(r.ends_at).getTime() > window.AuctionUi.nowMs())
    .sort((a, b) => Number(b.category_slug === lot.category_slug) - Number(a.category_slug === lot.category_slug) || new Date(a.ends_at) - new Date(b.ends_at))
    .slice(0, 3);
  if (!related.length) return;
  relatedNode.hidden = false;
  relatedCopy.textContent = "Related by category, location, and ending time.";
  relatedGrid.innerHTML = "";
  related.forEach((r) => relatedGrid.appendChild(window.AuctionCard.buildLotCard(r)));
}

/* ── Report modal (dark theme) ────────────────────────────────────────────── */
function closeReportModal() { document.getElementById("report-modal-overlay")?.remove(); }
async function submitLotReport(lot, reason, details, contactEmail, form, statusNode, submitButton) {
  submitButton.disabled = true;
  statusNode.textContent = "Submitting report...";
  try {
    const response = await fetch("https://api.sovdigitalgroup.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "dealztt", target_type: "lot", target_id: String(lot.id), reason, details, contact_email: contactEmail }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not submit report.");
    statusNode.textContent = "Report submitted. Thank you.";
    form.reset();
    window.AuctionUi.toast("ok", "Report sent", "Thanks — the DealzTT team will review this lot.");
    window.setTimeout(closeReportModal, 900);
  } catch (err) {
    statusNode.textContent = err.message || "Could not submit report.";
    submitButton.disabled = false;
  }
}
function openReportModal(lot) {
  closeReportModal();
  const overlay = document.createElement("div");
  overlay.id = "report-modal-overlay";
  overlay.className = "gate-overlay";
  overlay.innerHTML = `
    <div class="gate-card" style="text-align:left;">
      <h3 style="margin-bottom:14px;">Report this lot</h3>
      <form id="report-form" style="display:flex;flex-direction:column;gap:12px;">
        <select id="rp-reason" required class="fi-select" aria-label="Report reason"
          style="padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border-md);color:var(--text);">
          <option value="" disabled selected>Select a reason</option>
          <option value="spam">Spam</option>
          <option value="scam">Scam or fraud</option>
          <option value="inappropriate">Inappropriate</option>
          <option value="illegal">Illegal / prohibited item</option>
          <option value="misleading">Misleading listing</option>
          <option value="other">Other</option>
        </select>
        <textarea id="rp-details" rows="4" maxlength="2000" placeholder="Additional details (optional)"
          style="padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border-md);color:var(--text);"></textarea>
        <input id="rp-email" type="email" placeholder="Your email (optional)"
          style="padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border-md);color:var(--text);" />
        <p id="rp-status" class="subtle" style="margin:0;"></p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" id="rp-cancel" class="btn ghost">Cancel</button>
          <button type="submit" id="rp-submit" class="btn">Submit report</button>
        </div>
      </form>
    </div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeReportModal(); });
  document.body.appendChild(overlay);
  document.getElementById("rp-cancel").onclick = closeReportModal;
  const form = document.getElementById("report-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitLotReport(lot, document.getElementById("rp-reason").value, document.getElementById("rp-details").value.trim(),
      document.getElementById("rp-email").value.trim().toLowerCase(), form, document.getElementById("rp-status"), document.getElementById("rp-submit"));
  });
}

/* ── SEO meta helpers ─────────────────────────────────────────────────────── */
function upsertMeta(selector, attr, value) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, selector.includes("property=") ? selector.match(/property="([^"]+)"/)[1] : selector.match(/name="([^"]+)"/)[1]);
    document.head.appendChild(node);
  }
  node.setAttribute("content", value);
}
function upsertCanonical(url) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) { node = document.createElement("link"); node.setAttribute("rel", "canonical"); document.head.appendChild(node); }
  node.setAttribute("href", url);
}
function lotHref(id) { return `${window.location.origin}/lot.html?id=${encodeURIComponent(id)}`; }

async function shareLot(lot) {
  const url = lotHref(lot.id);
  const text = `Check this lot on DealzTT: ${lot.title}`;
  if (navigator.share) { try { await navigator.share({ title: lot.title, text, url }); return; } catch {} }
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); window.AuctionUi.toast("info", "Link copied", "Lot link copied to clipboard."); return; }
  window.prompt("Copy lot URL:", url);
}

function getLotId() { return new URLSearchParams(window.location.search).get("id"); }
function showLotUnavailable(title, message) {
  loadingNode.style.display = "none";
  detailNode.style.display = "none";
  errorTitleNode.textContent = title;
  errorMessageNode.textContent = message;
  errorNode.hidden = false;
}

function renderLot(lot) {
  const url = lotHref(lot.id);
  const description = `${lot.title}${lot.category_name ? ` in ${lot.category_name}` : ""}${lot.city ? ` from ${lot.city}` : ""}. Current bid on DealzTT Trinidad & Tobago auctions.`;
  const bidCount = Number(lot.bid_count || 0);
  const timeText = window.AuctionUi.timeLeft(lot.ends_at);
  const fullDescription = lot.description?.trim() || "This lot is live in the DealzTT marketplace. Review the current bid, seller details, and location before bidding.";

  // wire the detail node for the shared delegated bid handler
  detailNode.dataset.lotId = lot.id;
  priceNode.dataset.price = "1";
  bidsNode.classList.add("lot-bids");

  imageNode.src = lot.image_url || LOT_FALLBACK;
  imageNode.onerror = () => { imageNode.onerror = null; imageNode.src = LOT_FALLBACK; };
  categoryNode.textContent = lot.category_name || "General";
  titleNode.textContent = lot.title;
  sellerNode.textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " · Verified" : ""}`;
  priceNode.textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  timeNode.textContent = timeText;
  timeNode.dataset.ends = lot.ends_at;
  locationNode.textContent = `${lot.city || ""} ${lot.state || ""}`.trim() || "Location not specified";
  bidsNode.textContent = `${bidCount} bids`;
  descriptionNode.textContent = fullDescription;
  statusBadgeNode.textContent = timeText === "Ended" ? "Auction ended" : (lot.is_demo ? "Demo lot" : "Live lot");
  statusBadgeNode.className = `chip ${timeText === "Ended" ? "chip-red" : (lot.is_demo ? "chip-pink" : "chip-green")}`;
  regionNode.textContent = `${lot.city || "Trinidad & Tobago"}${lot.state ? `, ${lot.state}` : ""}`;
  urgencyNode.textContent = `${bidCount} recorded bid${bidCount === 1 ? "" : "s"}`;
  sellerStatusNode.textContent = lot.seller_verified ? "Verified seller" : "Marketplace seller";

  watchers = Math.max(3, Math.round(bidCount * 1.4) + 5);
  seedHistory(lot);
  renderBidPanel(lot);

  let watching = false;
  watchButton.onclick = () => {
    if (!window.AuctionUi.requireSignIn("use your watchlist")) return;
    watching = !watching;
    watchButton.textContent = watching ? "✓ Watching" : "Add to watchlist";
    if (watching) {
      watchers += 1;
      window.DealzBadges?.record("watch");
      window.AuctionUi.toast("ok", "Added to watchlist", `We'll notify you before ${lot.title} ends.`);
    } else {
      watchers = Math.max(0, watchers - 1);
    }
    renderBidPanel(lot);
  };
  shareButton.onclick = () => shareLot(lot);
  reportLink.href = "#";
  reportLink.onclick = (e) => { e.preventDefault(); openReportModal(lot); };

  document.title = `${lot.title} | DealzTT Auctions`;
  upsertCanonical(url);
  upsertMeta('meta[name="description"]', "name", description);
  upsertMeta('meta[property="og:title"]', "property", `${lot.title} | DealzTT Auctions`);
  upsertMeta('meta[property="og:description"]', "property", description);
  upsertMeta('meta[property="og:url"]', "property", url);
  upsertMeta('meta[property="og:image"]', "property", imageNode.src);
  upsertMeta('meta[name="twitter:title"]', "name", `${lot.title} | DealzTT Auctions`);
  upsertMeta('meta[name="twitter:description"]', "name", description);
  upsertMeta('meta[name="twitter:image"]', "name", imageNode.src);

  if (jsonLdNode) {
    jsonLdNode.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "Product", name: lot.title, image: imageNode.src, description,
      category: lot.category_name || "Auction lot", brand: { "@type": "Brand", name: "DealzTT" },
      offers: { "@type": "Offer", priceCurrency: "TTD", price: Number(lot.current_bid || lot.starting_bid || 0), availability: "https://schema.org/InStock", url },
    });
  }
}

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    const id = getLotId();
    if (!id) { showLotUnavailable("Choose a published lot to view its details.", "Browse the published DealzTT catalogue to find available lots."); return; }
    const lot = await window.AuctionApi.AuctionData.getLot(id);
    if (!lot) { showLotUnavailable("This lot is no longer available.", "It may have ended or been removed from the catalogue. Browse current lots instead."); return; }
    renderLot(lot);
    try { renderRelated(lot, await window.AuctionApi.AuctionData.getLots()); } catch {}
    detailNode.style.display = "block";
    loadingNode.style.display = "none";
  } catch {
    showLotUnavailable("Lot details could not be loaded.", "Please try again shortly or return to the published auction catalogue.");
  }
})();

/* ===========================================================================
   DealzTT — Browse: filter + sort the live catalogue. Instant bidding and
   sign-in gating come from the shared lot-card. Demo data in DEMO_MODE.
   =========================================================================== */

const browseForm = document.getElementById("browse-form");
const searchField = document.getElementById("browse-search");
const categoryField = document.getElementById("browse-category");
const locationField = document.getElementById("browse-location");
const timingField = document.getElementById("browse-timing");
const sortBar = document.getElementById("browse-sort");
const statusNode = document.getElementById("browse-status");
const countNode = document.getElementById("browse-count");
const gridNode = document.getElementById("browse-grid");
const emptyNode = document.getElementById("browse-empty");
const emptyTitle = document.getElementById("browse-empty-title");
const emptyCopy = document.getElementById("browse-empty-copy");
const resultsSection = document.getElementById("browse-results-section");

let allLots = [];
let activeFocus = "";
let sortMode = "ending";

function isOpen(lot) { return new Date(lot.ends_at).getTime() > window.AuctionUi.nowMs(); }
function bidVal(lot) { return Number(lot.current_bid || lot.starting_bid || 0); }

function sortLots(rows) {
  const arr = [...rows];
  if (sortMode === "price-high") arr.sort((a, b) => bidVal(b) - bidVal(a));
  else if (sortMode === "price-low") arr.sort((a, b) => bidVal(a) - bidVal(b));
  else if (sortMode === "hot") arr.sort((a, b) => Number(b.bid_count || 0) - Number(a.bid_count || 0));
  else arr.sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at));
  return arr;
}

function showEmpty(title, copy) {
  emptyTitle.textContent = title;
  emptyCopy.textContent = copy;
  emptyNode.hidden = false;
  resultsSection.hidden = true;
}

function renderResults() {
  const query = searchField.value.trim().toLowerCase();
  const category = categoryField.value;
  const location = locationField.value.trim().toLowerCase();
  const timing = timingField.value;
  const now = window.AuctionUi.nowMs();

  const filtered = allLots.filter((lot) => {
    const searchable = `${lot.title || ""} ${lot.description || ""} ${lot.seller_name || ""} ${lot.category_name || ""}`.toLowerCase();
    const place = `${lot.city || ""} ${lot.state || ""}`.toLowerCase();
    const endsSoon = new Date(lot.ends_at).getTime() <= now + 24 * 60 * 60 * 1000;
    return (!activeFocus || lot.category_slug === activeFocus)
      && (!query || searchable.includes(query))
      && (!category || lot.category_slug === category)
      && (!location || place.includes(location))
      && (timing !== "ending" || endsSoon);
  });

  if (!filtered.length) {
    const copy = allLots.length
      ? "No active lots match these filters. Try another category, location, or timing view."
      : "DealzTT will show auction cards here as approved inventory is published. Create a buyer account now or submit a consignment for the launch catalogue.";
    statusNode.textContent = allLots.length ? "No lots match the current filters." : "No active lots are published yet.";
    showEmpty("No lots match this view.", copy);
    return;
  }

  emptyNode.hidden = true;
  resultsSection.hidden = false;
  gridNode.innerHTML = "";
  sortLots(filtered).forEach((lot) => gridNode.appendChild(window.AuctionCard.buildLotCard(lot)));
  countNode.textContent = `${filtered.length} active lot${filtered.length === 1 ? "" : "s"}`;
  statusNode.textContent = "Showing live auction inventory.";
}

function populateCategories(categories) {
  categories.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.slug;
    option.textContent = `${c.icon || ""} ${c.name}`.trim();
    categoryField.appendChild(option);
  });
}

function activateFocus(focus) {
  activeFocus = activeFocus === focus ? "" : focus;
  categoryField.value = activeFocus || "";
  document.querySelectorAll("[data-focus]").forEach((b) => b.classList.toggle("is-active", b.dataset.focus === activeFocus));
  renderResults();
}

browseForm.addEventListener("submit", (e) => { e.preventDefault(); renderResults(); });
[searchField, locationField].forEach((f) => f.addEventListener("input", renderResults));
[categoryField, timingField].forEach((f) => f.addEventListener("change", () => { activeFocus = categoryField.value ? activeFocus : activeFocus; renderResults(); }));
document.querySelectorAll("[data-focus]").forEach((b) => b.addEventListener("click", () => activateFocus(b.dataset.focus)));
if (sortBar) sortBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]"); if (!btn) return;
  sortMode = btn.dataset.sort;
  sortBar.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === btn));
  renderResults();
});

(async () => {
  window.AuctionUi.updateAuthPills();
  const categoryParam = new URLSearchParams(window.location.search).get("category");
  const qParam = new URLSearchParams(window.location.search).get("q");
  if (qParam) searchField.value = qParam;
  try {
    const [categories, lots] = await Promise.all([
      window.AuctionApi.AuctionData.getCategories(),
      window.AuctionApi.AuctionData.getLots(),
    ]);
    populateCategories(categories);
    if (categoryParam && categories.some((c) => c.slug === categoryParam)) categoryField.value = categoryParam;
    allLots = (lots || []).filter(isOpen);
    renderResults();
  } catch {
    statusNode.textContent = "Live auction inventory could not be loaded right now.";
    showEmpty("Auction availability could not be loaded.", "Please try again shortly.");
  }
})();

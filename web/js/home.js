const lotGrid = document.getElementById("lot-grid");
const spotlightGrid = document.getElementById("spotlight-grid");
const lotTemplate = document.getElementById("lot-card-template");
const categoryInput = document.getElementById("category-search");
const categoryHint = document.getElementById("category-hint");
const locationInput = document.getElementById("location-search");
const searchForm = document.getElementById("search-form");
const statsLive = document.getElementById("stat-live");
const statsHot = document.getElementById("stat-hot");
const statsCats = document.getElementById("stat-cats");
const resultNote = document.getElementById("results-note");
const launchState = document.getElementById("launch-state");
const launchStateTitle = document.getElementById("launch-state-title");
const launchStateMessage = document.getElementById("launch-state-message");
const spotlightSection = document.getElementById("spotlight-section");
const marketplaceSection = document.getElementById("marketplace-section");
const pulseEyebrow = document.getElementById("pulse-eyebrow");
const pulseTitle = document.getElementById("pulse-title");
const pulseMetrics = document.getElementById("pulse-metrics");
const trustPanel = document.getElementById("trust-panel");

let categories = [];
let lots = [];
let activeCategorySlug = "";
let launchMode = false;

function isLotOpen(lot) {
  return new Date(lot.ends_at).getTime() > window.AuctionUi.nowMs();
}

function buildCard(lot) {
  const node = lotTemplate.content.cloneNode(true);
  const image = node.querySelector(".lot-image");
  image.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
  image.alt = `${lot.title} lot image`;
  node.querySelector(".lot-category").textContent = lot.category_name || "General";

  const titleLink = document.createElement("a");
  titleLink.className = "lot-title-link";
  titleLink.href = `./lot.html?id=${encodeURIComponent(lot.id)}`;
  titleLink.dataset.testid = `listing-card-${lot.id}`;
  titleLink.textContent = lot.title;
  node.querySelector(".lot-title").appendChild(titleLink);
  node.querySelector(".lot-seller").textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " | Verified" : ""}`;
  node.querySelector(".lot-price").textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  node.querySelector(".lot-bids").textContent = `${Number(lot.bid_count || 0)} bids`;
  node.querySelector(".lot-time").textContent = window.AuctionUi.timeLeft(lot.ends_at);
  node.querySelector(".lot-location").textContent = `${lot.city || "Location to be confirmed"}${lot.state ? `, ${lot.state}` : ""}`;
  node.querySelector(".lot-actions").remove();
  return node;
}

function updateStats() {
  statsLive.textContent = String(lots.length);
  statsHot.textContent = String(lots.filter((lot) => lot.is_hot).length);
  statsCats.textContent = String(categories.length);
}

function setLaunchMode(isActive, isUnavailable = false) {
  launchMode = isActive;
  launchState.hidden = !isActive;
  spotlightSection.hidden = isActive;
  marketplaceSection.hidden = isActive;
  searchForm.hidden = isActive;

  if (isActive) {
    pulseEyebrow.textContent = "DealzTT launch";
    pulseTitle.textContent = categories.length ? `${categories.length} auction categories are in preparation.` : "A better way to sell is opening soon.";
    pulseMetrics.hidden = true;
    launchStateTitle.textContent = isUnavailable ? "Auction availability is being refreshed." : "The first DealzTT auctions are being prepared.";
    launchStateMessage.textContent = isUnavailable
      ? "We could not load the current auction list. Please check back shortly, or create a buyer account and submit a consignment in the meantime."
      : "There are no open lots right now. Create a buyer account so you are ready when lots open, or submit a consignment to help shape the first drops.";
    trustPanel.innerHTML = `<p class="trust-title">Get ready before the first lots open</p><p class="subtle">${categories.length ? `${categories.length} categories are ready for the launch catalogue. ` : ""}Buyer accounts make it easier to take part when auctions launch. Sellers can start with a consignment enquiry today.</p>`;
    return;
  }

  pulseEyebrow.textContent = "Published inventory";
  pulseTitle.textContent = "Browse the lots available now";
  pulseMetrics.hidden = false;
  launchStateTitle.textContent = "The first DealzTT auctions are being prepared.";
  launchStateMessage.textContent = "There are no open lots right now. Create a buyer account so you are ready when lots open, or submit a consignment to help shape the first drops.";
  trustPanel.innerHTML = "<p class=\"trust-title\">Browse with the details that are published</p><ul class=\"plain-list trust-list\"><li>Published seller labels and location details appear on each lot</li><li>Use the reporting route when public lot information needs review</li><li>Browse and lot records are designed for mobile screens</li></ul>";
}

function renderSpotlight() {
  spotlightGrid.innerHTML = "";
  const spotlight = lots.filter((lot) => lot.is_hot || lot.is_featured).slice(0, 3);
  (spotlight.length ? spotlight : lots.slice(0, 3)).forEach((lot) => spotlightGrid.appendChild(buildCard(lot)));
}

function showCategoryHint(value) {
  const query = value.trim().toLowerCase();
  categoryHint.innerHTML = "";
  if (!query) return;
  categories.filter((category) => category.name.toLowerCase().includes(query) || category.slug.toLowerCase().includes(query)).slice(0, 8).forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hint-option";
    button.textContent = category.name;
    button.addEventListener("click", () => {
      categoryInput.value = category.name;
      activeCategorySlug = category.slug;
      categoryHint.innerHTML = "";
      renderFilteredLots();
    });
    categoryHint.appendChild(button);
  });
}

function renderFilteredLots() {
  if (launchMode) return;
  const query = categoryInput.value.trim().toLowerCase();
  const location = locationInput.value.trim().toLowerCase();
  const exactCategory = categories.find((category) => category.name.toLowerCase() === query || category.slug.toLowerCase() === query);
  if (exactCategory) activeCategorySlug = exactCategory.slug;
  const filtered = lots.filter((lot) => {
    const matchesCategory = !activeCategorySlug ? !query || (lot.category_name || "").toLowerCase().includes(query) : lot.category_slug === activeCategorySlug;
    const matchesLocation = !location || `${lot.city || ""} ${lot.state || ""}`.toLowerCase().includes(location);
    return matchesCategory && matchesLocation;
  });
  lotGrid.innerHTML = "";
  filtered.forEach((lot) => lotGrid.appendChild(buildCard(lot)));
  resultNote.textContent = `${filtered.length} published lot${filtered.length === 1 ? "" : "s"} found`;
}

async function loadData() {
  const [categoryRows, lotRows] = await Promise.all([
    window.AuctionApi.apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc"),
    window.AuctionApi.apiFetch("/v_lot_feed?select=id,title,description,image_url,current_bid,starting_bid,bid_count,is_hot,is_featured,ends_at,city,state,seller_name,seller_verified,category_slug,category_name&order=ends_at.asc"),
  ]);
  categories = categoryRows;
  lots = lotRows.filter(isLotOpen);
  setLaunchMode(lots.length === 0);
  updateStats();
  if (launchMode) {
    spotlightGrid.innerHTML = "";
    lotGrid.innerHTML = "";
    resultNote.textContent = "Auctions are launching soon.";
    return;
  }
  renderSpotlight();
  renderFilteredLots();
}

categoryInput.addEventListener("input", () => {
  activeCategorySlug = "";
  showCategoryHint(categoryInput.value);
  renderFilteredLots();
});
locationInput.addEventListener("input", renderFilteredLots);
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderFilteredLots();
});
document.addEventListener("click", (event) => {
  if (!categoryHint.contains(event.target) && event.target !== categoryInput) categoryHint.innerHTML = "";
});

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    await loadData();
  } catch {
    setLaunchMode(true, true);
    resultNote.textContent = "Auction availability is being refreshed. Please check back soon.";
  }
})();

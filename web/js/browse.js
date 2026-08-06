const browseForm = document.getElementById("browse-form");
const searchField = document.getElementById("browse-search");
const categoryField = document.getElementById("browse-category");
const locationField = document.getElementById("browse-location");
const timingField = document.getElementById("browse-timing");
const statusNode = document.getElementById("browse-status");
const countNode = document.getElementById("browse-count");
const gridNode = document.getElementById("browse-grid");
const emptyNode = document.getElementById("browse-empty");
const emptyTitle = document.getElementById("browse-empty-title");
const emptyCopy = document.getElementById("browse-empty-copy");
const resultsSection = document.getElementById("browse-results-section");

let allBrowseLots = [];
let activeFocus = "";

function isOpen(lot) {
  return new Date(lot.ends_at).getTime() > window.AuctionUi.nowMs();
}

function includesFocus(lot, focus) {
  const source = `${lot.category_name || ""} ${lot.category_slug || ""} ${lot.title || ""} ${lot.description || ""}`.toLowerCase();
  const terms = {
    vehicle: ["vehicle", "car", "auto", "truck", "van", "motorcycle", "parts"],
    machinery: ["machinery", "machine", "equipment", "tools", "plant"],
    repossession: ["repossession", "repo"],
    liquidation: ["liquidation", "surplus", "closeout", "overstock"],
  };
  return (terms[focus] || []).some((term) => source.includes(term));
}

function createLotCard(lot) {
  const card = document.createElement("article");
  card.className = "lot-card";

  const image = document.createElement("img");
  image.className = "lot-image";
  image.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
  image.alt = `${lot.title} lot image`;

  const content = document.createElement("div");
  content.className = "lot-content";
  const category = document.createElement("p");
  category.className = "chip";
  category.textContent = lot.category_name || "General";
  const title = document.createElement("h3");
  title.className = "lot-title";
  const link = document.createElement("a");
  link.className = "lot-title-link";
  link.href = `./lot.html?id=${encodeURIComponent(lot.id)}`;
  link.textContent = lot.title;
  title.appendChild(link);
  const seller = document.createElement("p");
  seller.className = "lot-seller";
  seller.textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " | Verified" : ""}`;
  const row = document.createElement("div");
  row.className = "lot-row";
  const price = document.createElement("strong");
  price.className = "lot-price";
  price.textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  const bids = document.createElement("span");
  bids.className = "lot-bids";
  bids.textContent = `${Number(lot.bid_count || 0)} bids`;
  row.append(price, bids);
  const time = document.createElement("p");
  time.className = "timer";
  time.textContent = window.AuctionUi.timeLeft(lot.ends_at);
  const location = document.createElement("p");
  location.className = "subtle lot-location";
  location.textContent = `${lot.city || "Location to be confirmed"}${lot.state ? `, ${lot.state}` : ""}`;
  const action = document.createElement("a");
  action.className = "btn ghost btn-sm";
  action.href = link.href;
  action.textContent = "View lot details";
  content.append(category, title, seller, row, time, location, action);
  card.append(image, content);
  return card;
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

  if (timing === "upcoming") {
    statusNode.textContent = "Upcoming auction schedules are not published by the current API yet.";
    showEmpty("Upcoming schedules are not available yet.", "DealzTT will list scheduled auctions here once the auction operations workflow is connected. Browse active lots or submit inventory for review in the meantime.");
    return;
  }

  const now = window.AuctionUi.nowMs();
  const filtered = allBrowseLots.filter((lot) => {
    const searchable = `${lot.title || ""} ${lot.description || ""} ${lot.seller_name || ""} ${lot.category_name || ""}`.toLowerCase();
    const place = `${lot.city || ""} ${lot.state || ""}`.toLowerCase();
    const endsSoon = new Date(lot.ends_at).getTime() <= now + 24 * 60 * 60 * 1000;
    return (!activeFocus || includesFocus(lot, activeFocus))
      && (!query || searchable.includes(query))
      && (!category || lot.category_slug === category)
      && (!location || place.includes(location))
      && (timing !== "ending" || endsSoon);
  });

  if (!filtered.length) {
    const copy = allBrowseLots.length
      ? "No active lots match these filters. Try another category, location, or timing view."
      : "DealzTT will show auction cards here as approved inventory is published. You can create a buyer account now or submit a consignment for the launch catalogue.";
    statusNode.textContent = allBrowseLots.length ? "No lots match the current filters." : "No active lots are published yet.";
    showEmpty("There are no active lots matching this view.", copy);
    return;
  }

  emptyNode.hidden = true;
  resultsSection.hidden = false;
  gridNode.innerHTML = "";
  filtered.forEach((lot) => gridNode.appendChild(createLotCard(lot)));
  countNode.textContent = `${filtered.length} active lot${filtered.length === 1 ? "" : "s"}`;
  statusNode.textContent = "Showing published auction inventory.";
}

function populateCategories(categories) {
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.slug;
    option.textContent = category.name;
    categoryField.appendChild(option);
  });
}

function activateFocus(focus) {
  searchField.value = "";
  categoryField.value = "";
  locationField.value = "";
  timingField.value = "all";
  activeFocus = activeFocus === focus ? "" : focus;
  document.querySelectorAll("[data-focus]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.focus === activeFocus);
  });
  const focusLots = allBrowseLots.filter((lot) => includesFocus(lot, activeFocus));
  if (!activeFocus) {
    renderResults();
    return;
  }
  if (!focusLots.length) {
    statusNode.textContent = `No published ${focus} inventory is available right now.`;
    showEmpty(`No ${focus} lots are published yet.`, "This finder will show published vehicle-focused inventory when it is approved for sale.");
    return;
  }
  renderResults();
}

browseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderResults();
});

document.querySelectorAll("[data-focus]").forEach((button) => {
  button.addEventListener("click", () => activateFocus(button.dataset.focus));
});

(async () => {
  window.AuctionUi.updateAuthPills();
  const categoryParam = new URLSearchParams(window.location.search).get("category");
  try {
    const [categories, lots] = await Promise.all([
      window.AuctionApi.apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc"),
      window.AuctionApi.apiFetch("/v_lot_feed?select=id,title,description,image_url,current_bid,starting_bid,bid_count,is_hot,is_featured,ends_at,city,state,seller_name,seller_verified,category_slug,category_name&order=ends_at.asc"),
    ]);
    populateCategories(categories);
    if (categoryParam && categories.some((category) => category.slug === categoryParam)) {
      categoryField.value = categoryParam;
    }
    allBrowseLots = lots.filter(isOpen);
    renderResults();
  } catch {
    statusNode.textContent = "Published auction inventory could not be loaded right now.";
    showEmpty("Auction availability could not be loaded.", "Please try again shortly. DealzTT does not show preview inventory when the live marketplace cannot be reached.");
  }
})();

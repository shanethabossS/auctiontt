const API_BASE_CANDIDATES = [
  "http://142.93.14.0/postgrest",
  "http://127.0.0.1:33001",
  "http://127.0.0.1:3001"
];

let API_BASE = null;
let allLots = [];
let allCategories = [];

const lotGrid = document.getElementById("lot-grid");
const spotlightGrid = document.getElementById("spotlight");
const template = document.getElementById("lot-card-template");
const categoryFilter = document.getElementById("category-filter");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const locationInput = document.getElementById("location-input");
const resultsCount = document.getElementById("results-count");

async function detectApiBase() {
  for (const base of API_BASE_CANDIDATES) {
    try {
      const res = await fetch(`${base}/`, { method: "GET" });
      if (res.ok) {
        API_BASE = base;
        return;
      }
    } catch (_) {
      // Try the next candidate.
    }
  }
  throw new Error("No PostgREST endpoint reachable. Start the AuctionTT docker stack first.");
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function timeLeft(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Ended";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  return `${hours}h ${minutes}m left`;
}

function populateCategoryFilter(categories) {
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.slug;
    option.textContent = category.name;
    categoryFilter.appendChild(option);
  });
}

function renderLots(lots) {
  lotGrid.innerHTML = "";

  if (!lots.length) {
    resultsCount.textContent = "No lots match these filters.";
    lotGrid.innerHTML = "<p>No results found. Try a different category or location.</p>";
    return;
  }

  resultsCount.textContent = `${lots.length} lots shown`;

  lots.forEach((lot) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".lot-card");

    const thumb = node.querySelector(".thumb");
    thumb.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";

    const hotTag = node.querySelector(".tag.hot");
    if (!lot.is_hot) hotTag.style.display = "none";

    node.querySelector(".lot-meta").textContent = `${lot.category_name || "General"} • ${lot.seller_name}${lot.seller_verified ? " • Verified" : ""}`;
    node.querySelector(".lot-title").textContent = lot.title;
    node.querySelector(".lot-sub").textContent = `${lot.city || ""}${lot.state ? `, ${lot.state}` : ""} • ${lot.shipping_available ? "Ships" : "Pickup"}`;
    node.querySelector(".lot-bid").textContent = money(lot.current_bid || lot.starting_bid);
    node.querySelector(".lot-count").textContent = `${lot.bid_count} bids`;
    node.querySelector(".lot-end").textContent = timeLeft(lot.ends_at);

    const msg = node.querySelector(".form-msg");

    const bidForm = node.querySelector(".bid-form");
    bidForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const bidderName = bidForm.querySelector(".bidder").value.trim();
      const amount = Number(bidForm.querySelector(".amount").value);

      try {
        await fetchJson("/rpc/place_bid", {
          method: "POST",
          body: JSON.stringify({
            p_lot_id: lot.id,
            p_bidder_name: bidderName,
            p_amount: amount,
          }),
        });

        msg.textContent = `Bid placed: ${money(amount)} by ${bidderName}`;
        await loadAndRender();
      } catch (error) {
        msg.textContent = `Bid failed: ${error.message}`;
      }
    });

    const watchForm = node.querySelector(".watch-form");
    watchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = watchForm.querySelector(".watch-email").value.trim();

      try {
        await fetchJson("/watchlists", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            email,
            lot_id: lot.id,
          }),
        });
        msg.textContent = `Added to watchlist for ${email}`;
      } catch (error) {
        msg.textContent = `Watchlist failed: ${error.message}`;
      }
    });

    card.dataset.category = lot.category_slug || "";
    card.dataset.city = (lot.city || "").toLowerCase();
    card.dataset.state = (lot.state || "").toLowerCase();
    card.dataset.title = (lot.title || "").toLowerCase();

    lotGrid.appendChild(node);
  });
}

function renderSpotlight(lots) {
  spotlightGrid.innerHTML = "";
  lots.slice(0, 3).forEach((lot) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".lot-card");
    card.querySelector(".lot-actions").remove();
    card.querySelector(".form-msg").remove();

    node.querySelector(".thumb").src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
    node.querySelector(".lot-meta").textContent = `${lot.category_name || "General"} • ${lot.seller_name}`;
    node.querySelector(".lot-title").textContent = lot.title;
    node.querySelector(".lot-sub").textContent = lot.auction_title;
    node.querySelector(".lot-bid").textContent = money(lot.current_bid || lot.starting_bid);
    node.querySelector(".lot-count").textContent = `${lot.bid_count} bids`;
    node.querySelector(".lot-end").textContent = timeLeft(lot.ends_at);

    if (!lot.is_hot) {
      const tag = node.querySelector(".tag.hot");
      tag.textContent = "FEATURED";
      tag.style.background = "#1a8f7a";
    }

    spotlightGrid.appendChild(node);
  });
}

function applyFilter() {
  const q = searchInput.value.trim().toLowerCase();
  const loc = locationInput.value.trim().toLowerCase();
  const cat = categoryFilter.value;

  const filtered = allLots.filter((lot) => {
    const matchesText = !q || [lot.title, lot.description, lot.seller_name, lot.auction_title].join(" ").toLowerCase().includes(q);
    const matchesCat = !cat || lot.category_slug === cat;
    const matchesLoc = !loc || [lot.city, lot.state].join(" ").toLowerCase().includes(loc);
    return matchesText && matchesCat && matchesLoc;
  });

  renderLots(filtered);
}

async function loadAndRender() {
  const [categories, lots] = await Promise.all([
    fetchJson("/auction_categories?select=slug,name,sort_order&order=sort_order.asc"),
    fetchJson("/v_lot_feed?select=id,auction_id,auction_title,lot_number,title,description,image_url,current_bid,starting_bid,bid_count,is_featured,is_hot,ends_at,city,state,shipping_available,pickup_available,seller_name,seller_verified,category_slug,category_name&order=ends_at.asc"),
  ]);

  allCategories = categories;
  allLots = lots;

  populateCategoryFilter(allCategories);

  const spotlight = allLots
    .filter((lot) => lot.is_hot || lot.is_featured)
    .sort((a, b) => b.bid_count - a.bid_count);

  renderSpotlight(spotlight.length ? spotlight : allLots);
  renderLots(allLots);

  document.getElementById("stat-live").textContent = String(allLots.length);
  document.getElementById("stat-hot").textContent = String(allLots.filter((lot) => lot.is_hot).length);
  document.getElementById("stat-cats").textContent = String(allCategories.length);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilter();
});

(async () => {
  try {
    await detectApiBase();
    await loadAndRender();
  } catch (error) {
    resultsCount.textContent = error.message;
    lotGrid.innerHTML = "<p>API unavailable. Run docker compose in the AUCTIONSITE/infra folder first.</p>";
  }
})();


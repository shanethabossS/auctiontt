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

let categories = [];
let lots = [];
let activeCategorySlug = "";
let timerIntervalId = null;
let refreshIntervalId = null;
let serverTimeIntervalId = null;

function isLotOpen(lot) {
  return new Date(lot.ends_at).getTime() > window.AuctionUi.nowMs();
}

async function syncServerClock() {
  const started = Date.now();
  const response = await fetch("/time/now");
  if (!response.ok) return;
  const payload = await response.json();
  const ended = Date.now();
  const midpoint = started + Math.floor((ended - started) / 2);
  const serverMs = new Date(payload.server_time).getTime();
  window.AuctionUi.setServerTimeOffset(serverMs - midpoint);
}

function buildCard(lot, withActions) {
  const node = lotTemplate.content.cloneNode(true);
  const card = node.querySelector(".lot-card");
  const image = node.querySelector(".lot-image");
  const detailsHref = `./lot.html?id=${encodeURIComponent(lot.id)}`;
  image.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
  image.alt = `${lot.title} lot image`;

  node.querySelector(".lot-category").textContent = lot.category_name || "General";
  const titleNode = node.querySelector(".lot-title");
  titleNode.innerHTML = `<a href="${detailsHref}" data-testid="listing-card-${lot.id}" class="lot-title-link">${lot.title}</a>`;
  node.querySelector(".lot-seller").textContent = `${lot.seller_name}${lot.seller_verified ? " | Verified" : ""}`;
  node.querySelector(".lot-price").textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  node.querySelector(".lot-bids").textContent = `${lot.bid_count} bids`;
  const timerNode = node.querySelector(".lot-time");
  timerNode.dataset.endsAt = lot.ends_at;
  timerNode.textContent = window.AuctionUi.timeLeft(lot.ends_at);

  if (!withActions) {
    node.querySelector(".lot-actions").remove();
  } else {
    const detailLink = document.createElement("a");
    detailLink.href = detailsHref;
    detailLink.className = "btn ghost btn-sm";
    detailLink.textContent = "View Details";
    detailLink.setAttribute("data-testid", `listing-detail-link-${lot.id}`);
    node.querySelector(".lot-actions").prepend(detailLink);

    const msg = node.querySelector(".lot-message");
    const session = window.AuctionApi.getSessionUser();
    const bidderField = node.querySelector(".bidder-name");
    const watchField = node.querySelector(".watch-email");

    if (session?.full_name) bidderField.value = session.full_name;
    bidderField.required = false;
    bidderField.disabled = true;

    if (session?.email) watchField.value = session.email;

    node.querySelector(".bid-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const session = window.AuctionApi.getSessionUser();
      if (!session) {
        msg.textContent = "Sign in to place bids.";
        return;
      }
      const amount = Number(card.querySelector(".bid-amount").value);
      try {
        const bidResponse = await window.AuctionApi.authFetch("/bids/place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lot_id: lot.id,
            amount,
          }),
        });
        if (!bidResponse.ok) {
          throw new Error(await bidResponse.text());
        }
        msg.textContent = `Bid accepted: ${window.AuctionUi.money(amount)}`;
        await loadData();
      } catch (err) {
        msg.textContent = `Bid failed: ${err.message}`;
      }
    });

    node.querySelector(".watch-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const session = window.AuctionApi.getSessionUser();
      if (!session) {
        msg.textContent = "Sign in to use watchlist.";
        return;
      }

      const email = (card.querySelector(".watch-email").value.trim() || session.email || "").toLowerCase();
      try {
        const watchResponse = await window.AuctionApi.authFetch("/watchlists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, lot_id: lot.id }),
        });
        if (!watchResponse.ok) {
          throw new Error(await watchResponse.text());
        }
        msg.textContent = `Watchlist saved for ${email}`;
      } catch (err) {
        msg.textContent = `Watch failed: ${err.message}`;
      }
    });

    node.querySelector(".pay-now").addEventListener("click", async () => {
      const session = window.AuctionApi.getSessionUser();
      if (!session) {
        msg.textContent = "Sign in to start payment.";
        return;
      }

      try {
        const amount = Number(lot.current_bid || lot.starting_bid || 0);
        const payment = await window.AuctionApi.authFetch("/payment/fygaro-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lot_id: lot.id,
            amount: amount > 0 ? amount : 1,
            currency: "TTD",
            client_note: `Deposit for lot ${lot.title}`,
          }),
        });

        if (!payment.ok) {
          const text = await payment.text();
          throw new Error(text || "Payment setup failed");
        }

        const payload = await payment.json();
        window.open(payload.checkout_url, "_blank", "noopener");
        msg.textContent = "Fygaro checkout opened in a new tab.";
      } catch (err) {
        msg.textContent = `Payment failed: ${err.message}`;
      }
    });
  }

  return node;
}

function updateStats() {
  statsLive.textContent = String(lots.length);
  statsHot.textContent = String(lots.filter((l) => l.is_hot).length);
  statsCats.textContent = String(categories.length);
}

function renderSpotlight() {
  const spotlight = lots.filter((l) => l.is_hot || l.is_featured).slice(0, 3);
  spotlightGrid.innerHTML = "";
  (spotlight.length ? spotlight : lots.slice(0, 3)).forEach((lot) => {
    spotlightGrid.appendChild(buildCard(lot, false));
  });
}

function refreshTimerText() {
  const timerNodes = document.querySelectorAll(".lot-time[data-ends-at]");
  timerNodes.forEach((node) => {
    node.textContent = window.AuctionUi.timeLeft(node.dataset.endsAt);
  });
}

function tickTimers() {
  const before = lots.length;
  lots = lots.filter(isLotOpen);

  if (lots.length !== before) {
    updateStats();
    renderSpotlight();
    runFilter();
    return;
  }

  refreshTimerText();
}

function showCategoryHint(input) {
  const q = input.trim().toLowerCase();
  if (!q) {
    categoryHint.innerHTML = "";
    return;
  }

  const matches = categories
    .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
    .slice(0, 8);

  categoryHint.innerHTML = "";
  matches.forEach((match) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hint-option";
    button.textContent = match.name;
    button.onclick = () => {
      categoryInput.value = match.name;
      activeCategorySlug = match.slug;
      categoryHint.innerHTML = "";
      runFilter();
    };
    categoryHint.appendChild(button);
  });
}

function runFilter() {
  const search = categoryInput.value.trim().toLowerCase();
  const location = locationInput.value.trim().toLowerCase();

  if (search && !activeCategorySlug) {
    const exact = categories.find((c) => c.name.toLowerCase() === search || c.slug.toLowerCase() === search);
    if (exact) activeCategorySlug = exact.slug;
  }

  const filtered = lots.filter((lot) => {
    if (!isLotOpen(lot)) return false;
    const catMatch = !activeCategorySlug
      ? !search || (lot.category_name || "").toLowerCase().includes(search)
      : lot.category_slug === activeCategorySlug;
    const locMatch = !location || `${lot.city || ""} ${lot.state || ""}`.toLowerCase().includes(location);
    return catMatch && locMatch;
  });

  lotGrid.innerHTML = "";
  filtered.forEach((lot) => lotGrid.appendChild(buildCard(lot, true)));
  refreshTimerText();
  resultNote.textContent = `${filtered.length} lots found`;
}

async function loadData() {
  const [catRows, lotRows] = await Promise.all([
    window.AuctionApi.apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc"),
    window.AuctionApi.apiFetch("/v_lot_feed?select=id,auction_title,title,image_url,current_bid,starting_bid,bid_count,is_hot,is_featured,ends_at,city,state,seller_name,seller_verified,category_slug,category_name&order=ends_at.asc"),
  ]);

  categories = catRows;
  lots = lotRows.filter(isLotOpen);

  updateStats();
  renderSpotlight();

  runFilter();
}

categoryInput.addEventListener("input", () => {
  activeCategorySlug = "";
  showCategoryHint(categoryInput.value);
  runFilter();
});

locationInput.addEventListener("input", runFilter);

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runFilter();
});

document.addEventListener("click", (event) => {
  if (!categoryHint.contains(event.target) && event.target !== categoryInput) {
    categoryHint.innerHTML = "";
  }
});

function startLiveTimers() {
  if (!timerIntervalId) {
    timerIntervalId = setInterval(tickTimers, 1000);
  }

  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(async () => {
      try {
        await loadData();
      } catch {
        // Keep page usable; next cycle retries automatically.
      }
    }, 60000);
  }

  if (!serverTimeIntervalId) {
    serverTimeIntervalId = setInterval(async () => {
      try {
        await syncServerClock();
      } catch {
        // Keep using last known offset.
      }
    }, 60000);
  }
}

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    await syncServerClock();
    await loadData();
    startLiveTimers();
  } catch (err) {
    resultNote.textContent = err.message;
  }
})();

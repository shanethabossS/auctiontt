/* ===========================================================================
   DealzTT — shared lot card + instant bidding + live timers
   Used by home.js and browse.js so bidding behaves identically everywhere.
   =========================================================================== */

const FALLBACK_IMG = "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";

/* Broadcast so the home activity feed can react to a fresh bid anywhere. */
function announceBid(lot, amount) {
  document.dispatchEvent(new CustomEvent("dealztt:bid", {
    detail: { lot: lot.title, amount, who: window.AuctionUi.currentUserName() },
  }));
}

function buildLotCard(lot, opts = {}) {
  const withBid = opts.withBid !== false;
  const card = document.createElement("article");
  card.className = "lot-card";
  card.dataset.lotId = lot.id;

  if (lot.is_demo) {
    const ribbon = document.createElement("span");
    ribbon.className = "demo-ribbon";
    ribbon.textContent = "Demo";
    card.appendChild(ribbon);
  }

  const mediaLink = document.createElement("a");
  mediaLink.className = "lot-media";
  mediaLink.href = `./lot.html?id=${encodeURIComponent(lot.id)}`;
  mediaLink.setAttribute("aria-label", `View ${lot.title}`);
  const image = document.createElement("img");
  image.className = "lot-image";
  image.loading = "lazy";
  image.src = lot.image_url || FALLBACK_IMG;
  image.alt = `${lot.title} lot image`;
  image.onerror = () => { image.onerror = null; image.src = FALLBACK_IMG; };
  mediaLink.appendChild(image);

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
  seller.className = "subtle lot-seller";
  seller.textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " · Verified" : ""}`;

  const row = document.createElement("div");
  row.className = "lot-row";
  const price = document.createElement("strong");
  price.className = "lot-price";
  price.dataset.price = "1";
  price.textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  const bids = document.createElement("span");
  bids.className = "subtle lot-bids";
  bids.textContent = `${Number(lot.bid_count || 0)} bids`;
  row.append(price, bids);

  const time = document.createElement("p");
  time.className = "timer lot-time";
  time.dataset.ends = lot.ends_at;
  time.textContent = window.AuctionUi.timeLeft(lot.ends_at);

  const location = document.createElement("p");
  location.className = "subtle lot-location";
  location.textContent = `${lot.city || "Location to be confirmed"}${lot.state ? `, ${lot.state}` : ""}`;

  content.append(category, title, seller, row, time, location);

  if (withBid && window.AuctionUi.timeLeft(lot.ends_at) !== "Ended") {
    const block = document.createElement("div");
    block.className = "bid-block";
    const form = document.createElement("form");
    form.className = "bid-inline js-bid-form";
    const floor = Number(lot.current_bid || lot.starting_bid || 0);
    const minNext = floor + window.AuctionApi.minIncrement(floor);
    form.innerHTML = `
      <input type="number" class="js-bid-amount" min="${minNext}" step="1"
             placeholder="${minNext.toLocaleString("en-TT")}+" aria-label="Your bid (TTD)" />
      <button class="btn" type="submit">Bid</button>`;
    const hint = document.createElement("p");
    hint.className = "bid-hint";
    hint.textContent = `Min next bid ${window.AuctionUi.money(minNext)} · sign in required`;
    block.append(form, hint);
    content.appendChild(block);
  }

  card.append(mediaLink, content);
  return card;
}

/* Delegated instant-bid handler for every .js-bid-form on the page. */
document.addEventListener("submit", async (event) => {
  const form = event.target.closest(".js-bid-form");
  if (!form) return;
  event.preventDefault();

  const card = form.closest("[data-lot-id]");
  const lotId = card?.dataset.lotId;
  if (!lotId) return;

  if (!window.AuctionUi.requireSignIn("place a bid")) return;

  const amountInput = form.querySelector(".js-bid-amount");
  const amount = Number(amountInput.value);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;

  try {
    const result = await window.AuctionApi.AuctionData.placeBid(lotId, amount);
    const lot = result.lot;
    const priceNode = card.querySelector('[data-price]');
    const bidsNode = card.querySelector(".lot-bids");
    if (priceNode) {
      priceNode.textContent = window.AuctionUi.money(lot.current_bid);
      priceNode.classList.remove("price-pop");
      void priceNode.offsetWidth;
      priceNode.classList.add("price-pop");
    }
    if (bidsNode) bidsNode.textContent = `${lot.bid_count} bids`;
    if (result.min_next) {
      amountInput.min = result.min_next;
      amountInput.placeholder = `${result.min_next.toLocaleString("en-TT")}+`;
      const hint = card.querySelector(".bid-hint");
      if (hint) hint.textContent = `You're the top bidder · min next ${window.AuctionUi.money(result.min_next)}`;
    }
    amountInput.value = "";
    window.AuctionUi.toast("ok", "Bid placed!", `You lead ${lot.title} at ${window.AuctionUi.money(lot.current_bid)}.`);
    const endsNode = card.querySelector("[data-ends]");
    const clutch = endsNode ? (new Date(endsNode.dataset.ends).getTime() - window.AuctionUi.nowMs() < 120000) : false;
    window.DealzBadges?.record("bid", { amount: lot.current_bid, clutch });
    announceBid(lot, lot.current_bid);
  } catch (err) {
    window.AuctionUi.toast("err", "Bid not placed", err.message || "Please try again.");
  } finally {
    button.disabled = false;
  }
});

/* Live countdown — refresh every visible timer once per second. */
setInterval(() => {
  document.querySelectorAll("[data-ends]").forEach((node) => {
    const txt = window.AuctionUi.timeLeft(node.dataset.ends);
    node.textContent = txt;
    if (txt === "Ended") node.classList.add("chip-red");
  });
}, 1000);

window.AuctionCard = { buildLotCard, FALLBACK_IMG };

const loadingNode = document.getElementById("lot-loading");
const detailNode = document.getElementById("lot-detail");
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
const shareButton = document.getElementById("share-lot");
const reportLink = document.getElementById("report-lot");
const jsonLdNode = document.getElementById("lot-jsonld");

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
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", url);
}

function getLotId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function lotHref(id) {
  return `${window.location.origin}/lot.html?id=${encodeURIComponent(id)}`;
}

async function shareLot(lot) {
  const url = lotHref(lot.id);
  const text = `Check this lot on DealzTT: ${lot.title}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: lot.title, text, url });
      return;
    } catch {
      // fall back to clipboard
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    alert("Lot link copied to clipboard.");
    return;
  }
  window.prompt("Copy lot URL:", url);
}

function renderLot(lot) {
  const url = lotHref(lot.id);
  const description = `${lot.title}${lot.category_name ? ` in ${lot.category_name}` : ""}${lot.city ? ` from ${lot.city}` : ""}. Current bid on DealzTT Trinidad & Tobago auctions.`;
  const isVerifiedSeller = Boolean(lot.seller_verified);
  const bidCount = Number(lot.bid_count || 0);
  const timeText = window.AuctionUi.timeLeft(lot.ends_at);
  const urgencyText = bidCount >= 10 ? "Competitive lot" : "Steady bidding";
  const fullDescription = lot.description?.trim() || "This lot is live in the DealzTT marketplace. Review the current bid, seller details, and location before jumping into bidding.";

  imageNode.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
  categoryNode.textContent = lot.category_name || "General";
  titleNode.textContent = lot.title;
  sellerNode.textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " | Verified" : ""}`;
  priceNode.textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  timeNode.textContent = timeText;
  locationNode.textContent = `${lot.city || ""} ${lot.state || ""}`.trim() || "Location not specified";
  bidsNode.textContent = `${bidCount} bids`;
  descriptionNode.textContent = fullDescription;
  statusBadgeNode.textContent = timeText === "Ended" ? "Auction ended" : "Live bidding";
  statusBadgeNode.className = `chip ${timeText === "Ended" ? "chip-red" : "chip-green"}`;
  regionNode.textContent = `${lot.city || "Trinidad & Tobago"}${lot.state ? `, ${lot.state}` : ""}`;
  urgencyNode.textContent = urgencyText;
  sellerStatusNode.textContent = isVerifiedSeller ? "Verified seller" : "Marketplace seller";
  reportLink.href = `https://talkfreett.com/feedback?site=auctiontt&target=lot:${lot.id}`;
  shareButton.onclick = () => shareLot(lot);

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
      "@context": "https://schema.org",
      "@type": "Product",
      name: lot.title,
      image: imageNode.src,
      description,
      category: lot.category_name || "Auction lot",
      brand: {
        "@type": "Brand",
        name: "DealzTT"
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "TTD",
        price: Number(lot.current_bid || lot.starting_bid || 0),
        availability: "https://schema.org/InStock",
        url
      }
    });
  }
}

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    const id = getLotId();
    if (!id) throw new Error("Missing lot id.");

    const rows = await window.AuctionApi.apiFetch(
      `/v_lot_feed?select=id,title,description,image_url,current_bid,starting_bid,bid_count,ends_at,city,state,seller_name,seller_verified,category_name&id=eq.${id}`
    );
    const lot = Array.isArray(rows) ? rows[0] : null;
    if (!lot) throw new Error("Lot not found.");

    renderLot(lot);
    detailNode.style.display = "block";
    loadingNode.style.display = "none";
  } catch (err) {
    loadingNode.textContent = `Failed to load lot: ${err.message || err}`;
  }
})();

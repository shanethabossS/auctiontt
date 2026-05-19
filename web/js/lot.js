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
const shareButton = document.getElementById("share-lot");
const reportLink = document.getElementById("report-lot");

function getLotId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function lotHref(id) {
  return `${window.location.origin}/lot.html?id=${encodeURIComponent(id)}`;
}

async function shareLot(lot) {
  const url = lotHref(lot.id);
  const text = `Check this lot on AuctionTT: ${lot.title}`;
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
  imageNode.src = lot.image_url || "https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?auto=format&fit=crop&w=1200&q=80";
  categoryNode.textContent = lot.category_name || "General";
  titleNode.textContent = lot.title;
  sellerNode.textContent = `${lot.seller_name || "Seller"}${lot.seller_verified ? " | Verified" : ""}`;
  priceNode.textContent = window.AuctionUi.money(lot.current_bid || lot.starting_bid);
  timeNode.textContent = window.AuctionUi.timeLeft(lot.ends_at);
  locationNode.textContent = `${lot.city || ""} ${lot.state || ""}`.trim() || "Location not specified";
  bidsNode.textContent = `${lot.bid_count || 0} bids`;
  reportLink.href = `https://talkfreett.com/feedback?site=auctiontt&target=lot:${lot.id}`;
  shareButton.onclick = () => shareLot(lot);
}

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    const id = getLotId();
    if (!id) throw new Error("Missing lot id.");

    const rows = await window.AuctionApi.apiFetch(
      `/v_lot_feed?select=id,title,image_url,current_bid,starting_bid,bid_count,ends_at,city,state,seller_name,seller_verified,category_name&id=eq.${encodeURIComponent(id)}`
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

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
const shareButton = document.getElementById("share-lot");
const reportLink = document.getElementById("report-lot");
const jsonLdNode = document.getElementById("lot-jsonld");

function closeReportModal() {
  const overlay = document.getElementById("report-modal-overlay");
  if (overlay) overlay.remove();
}

async function submitLotReport(lot, reason, details, contactEmail, form, statusNode, submitButton) {
  submitButton.disabled = true;
  statusNode.textContent = "Submitting report...";

  try {
    const response = await fetch("https://api.sovdigitalgroup.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site: "dealztt",
        target_type: "lot",
        target_id: String(lot.id),
        reason,
        details,
        contact_email: contactEmail,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Could not submit report.");
    }

    statusNode.textContent = "Report submitted. Thank you.";
    form.reset();
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
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(17,24,39,.72);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9999;";

  const modal = document.createElement("div");
  modal.style.cssText = "width:min(100%,480px);background:#fff;border-radius:20px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35);";

  const title = document.createElement("h3");
  title.textContent = "Report lot";
  title.style.cssText = "margin:0 0 12px;font-size:1.2rem;";

  const form = document.createElement("form");
  form.style.cssText = "display:flex;flex-direction:column;gap:12px;";

  const reason = document.createElement("select");
  reason.required = true;
  reason.setAttribute("aria-label", "Report reason");
  reason.style.cssText = "padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;";
  [
    ["", "Select a reason"],
    ["spam", "Spam"],
    ["scam", "Scam"],
    ["inappropriate", "Inappropriate"],
    ["illegal", "Illegal"],
    ["harassment", "Harassment"],
    ["other", "Other"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (!value) option.disabled = true;
    if (!value) option.selected = true;
    reason.appendChild(option);
  });

  const details = document.createElement("textarea");
  details.rows = 4;
  details.maxLength = 2000;
  details.placeholder = "Additional details (optional)";
  details.setAttribute("aria-label", "Additional report details");
  details.style.cssText = "padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;";

  const email = document.createElement("input");
  email.type = "email";
  email.placeholder = "Your email (optional if signed out)";
  email.setAttribute("aria-label", "Contact email");
  email.style.cssText = "padding:10px 12px;border:1px solid #d1d5db;border-radius:12px;";

  const statusNode = document.createElement("p");
  statusNode.style.cssText = "margin:0;font-size:.9rem;color:#4b5563;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end;";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.cssText = "padding:10px 14px;border:1px solid #d1d5db;border-radius:999px;background:#fff;";
  cancelButton.onclick = closeReportModal;

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Submit Report";
  submitButton.style.cssText = "padding:10px 14px;border:none;border-radius:999px;background:#dc2626;color:#fff;font-weight:600;";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitLotReport(lot, reason.value, details.value.trim(), email.value.trim().toLowerCase(), form, statusNode, submitButton);
  });

  actions.append(cancelButton, submitButton);
  form.append(reason, details, email, statusNode, actions);
  modal.append(title, form);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeReportModal();
  });
  document.body.appendChild(overlay);
}

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

function showLotUnavailable(title, message) {
  loadingNode.style.display = "none";
  detailNode.style.display = "none";
  errorTitleNode.textContent = title;
  errorMessageNode.textContent = message;
  errorNode.hidden = false;
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
  statusBadgeNode.textContent = timeText === "Ended" ? "Auction ended" : "Published lot";
  statusBadgeNode.className = `chip ${timeText === "Ended" ? "chip-red" : "chip-green"}`;
  regionNode.textContent = `${lot.city || "Trinidad & Tobago"}${lot.state ? `, ${lot.state}` : ""}`;
  urgencyNode.textContent = `${bidCount} recorded bid${bidCount === 1 ? "" : "s"}`;
  sellerStatusNode.textContent = isVerifiedSeller ? "Verified seller" : "Marketplace seller";
  reportLink.href = "#";
  reportLink.onclick = (event) => {
    event.preventDefault();
    openReportModal(lot);
  };
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
    if (!id) {
      showLotUnavailable("Choose a published lot to view its details.", "Browse the published DealzTT catalogue to find available lots.");
      return;
    }

    const rows = await window.AuctionApi.apiFetch(
      `/v_lot_feed?select=id,title,description,image_url,current_bid,starting_bid,bid_count,ends_at,city,state,seller_name,seller_verified,category_name&id=eq.${id}`
    );
    const lot = Array.isArray(rows) ? rows[0] : null;
    if (!lot) {
      showLotUnavailable("This lot is no longer available.", "It may have ended or been removed from the published catalogue. Browse current lots instead.");
      return;
    }

    renderLot(lot);
    detailNode.style.display = "block";
    loadingNode.style.display = "none";
  } catch {
    showLotUnavailable("Lot details could not be loaded.", "Please try again shortly or return to the published auction catalogue.");
  }
})();

const list = document.getElementById("category-grid");
const input = document.getElementById("category-filter-input");
const count = document.getElementById("category-count");
let all = [];

const DEMO_CATEGORIES = [
  { slug: "electronics", name: "Electronics", sort_order: 1, icon: "⚡", lot_count: 3 },
  { slug: "home-garden", name: "Home & Garden", sort_order: 2, icon: "🏡", lot_count: 2 },
  { slug: "vehicles", name: "Vehicle Parts", sort_order: 3, icon: "🚗", lot_count: 1 },
  { slug: "collectibles", name: "Collectibles", sort_order: 4, icon: "🗝️", lot_count: 1 },
  { slug: "fashion", name: "Fashion & Accessories", sort_order: 5, icon: "💎", lot_count: 2 },
  { slug: "sports", name: "Sports & Outdoors", sort_order: 6, icon: "⚽", lot_count: 1 },
  { slug: "tools", name: "Tools & Equipment", sort_order: 7, icon: "🔧", lot_count: 1 },
  { slug: "music", name: "Music & Instruments", sort_order: 8, icon: "🎵", lot_count: 1 },
];

function render(rows) {
  list.innerHTML = "";
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "category-card";
    const icon = row.icon || "";
    const lotText = row.lot_count ? `${row.lot_count} active lot${row.lot_count > 1 ? "s" : ""}` : "";
    card.innerHTML = `
      <span class="category-icon">${icon}</span>
      <h3>${row.name}</h3>
      <p class="subtle">${lotText}</p>
      <a class="btn ghost btn-sm" href="./index.html">Browse</a>
    `;
    list.appendChild(card);
  });
  count.textContent = `${rows.length} categories`;
}

input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  const filtered = all.filter((row) => row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q));
  render(filtered);
});

(async () => {
  if (window.AuctionUi) window.AuctionUi.updateAuthPills();
  try {
    all = await window.AuctionApi.apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc");
  } catch {
    all = DEMO_CATEGORIES;
  }
  render(all);
})();

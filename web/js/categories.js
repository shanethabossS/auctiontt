const list = document.getElementById("category-grid");
const input = document.getElementById("category-filter-input");
const suggestions = document.getElementById("category-suggestions");
const count = document.getElementById("category-count");
let all = [];

function render(rows) {
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = '<article class="empty-state"><h2>No categories are available right now.</h2><p>DealzTT does not show preview categories when the live catalogue cannot be loaded.</p></article>';
    return;
  }
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "category-card";
    const title = document.createElement("h3");
    title.textContent = row.name;
    const copy = document.createElement("p");
    copy.className = "subtle";
    copy.textContent = "Browse published lots in this category when they are available.";
    const link = document.createElement("a");
    link.className = "btn ghost btn-sm";
    link.href = `./browse.html?category=${encodeURIComponent(row.slug)}`;
    link.textContent = "Browse";
    card.append(title, copy, link);
    list.appendChild(card);
  });
  count.textContent = `${rows.length} categories`;
}

function renderSuggestions(rows) {
  suggestions.innerHTML = "";
  rows.slice(0, 8).forEach((row) => {
    const option = document.createElement("option");
    option.value = row.name;
    suggestions.appendChild(option);
  });
}

input.addEventListener("input", () => {
  const query = input.value.trim().toLowerCase();
  const filtered = all.filter((row) => row.name.toLowerCase().includes(query) || row.slug.toLowerCase().includes(query));
  renderSuggestions(filtered);
  render(filtered);
});

(async () => {
  window.AuctionUi.updateAuthPills();
  try {
    all = await window.AuctionApi.apiFetch("/auction_categories?select=slug,name,sort_order&order=sort_order.asc");
    renderSuggestions(all);
    render(all);
  } catch {
    count.textContent = "Categories could not be loaded right now.";
    render([]);
  }
})();

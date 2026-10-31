/* List an item for auction. Needs a signed-in member with a submitted ID (the server checks; this page
   only explains). A new lot is held unpaid until the TT$40 listing fee is paid by bank transfer. */
(function () {
  const root = document.getElementById("list-item");
  const mine = document.getElementById("my-lots");
  if (!root) return;
  const api = window.AuctionApi;
  const ui = window.AuctionUi;

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => { if (key === "text") node.textContent = value; else node.setAttribute(key, value); });
    children.forEach((child) => node.append(child));
    return node;
  }
  function message(text, kind) {
    const box = document.getElementById("list-status");
    box.textContent = text;
    box.dataset.kind = kind || "";
    box.hidden = !text;
  }

  function showGate(level) {
    root.replaceChildren();
    if (level === "anon") {
      root.append(el("p", { class: "subtle", text: "Sign in with SOV ID to list an item. You also need your ID submitted in SOV ID before a listing can go live." }),
        el("a", { class: "btn", href: ui.signInHref ? ui.signInHref() : "https://id.sovdigitalgroup.com/" , text: "Sign in with SOV ID" }));
    } else {
      root.append(el("p", { class: "subtle", text: "You are signed in. Submit your ID in SOV ID to open listing and bidding." }),
        el("a", { class: "btn", href: "https://id.sovdigitalgroup.com/dashboard", text: "Verify my ID" }));
    }
  }

  function buildForm() {
    const form = document.getElementById("list-form");
    const select = form.elements.category;
    Object.entries(api.categoryNames).forEach(([slug, name]) => select.append(el("option", { value: slug, text: name })));
    form.hidden = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const price = Number(form.elements.start.value);
      if (!Number.isFinite(price) || price < 1) { message("Enter a starting price of at least TT$1.", "err"); return; }
      const images = form.elements.photos.value.split("\n").map((line) => line.trim()).filter(Boolean);
      button.disabled = true;
      message("Saving your listing…");
      try {
        const created = await api.liveFetch("/lots", {
          method: "POST",
          body: JSON.stringify({
            title: form.elements.title.value, description: form.elements.description.value, category: select.value,
            start_cents: Math.round(price * 100), images, location: form.elements.location.value, mode: form.elements.mode.value,
          }),
        });
        const order = await fetch("/dealztt-api/orders", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotId: created.lot.id }),
        }).then((r) => r.json().then((body) => ({ ok: r.ok, body })));
        if (!order.ok) throw new Error(order.body.error || "Could not start the payment.");
        location.assign(`./pay.html?order=${encodeURIComponent(order.body.order.id)}`);
      } catch (error) {
        if (!ui.handleGate(error.gate)) message(error.message || "Could not save the listing.", "err");
        button.disabled = false;
      }
    });
  }

  async function loadMine() {
    try {
      const data = await api.liveFetch("/me/lots");
      const lots = data.lots || [];
      mine.hidden = !lots.length;
      const list = document.getElementById("my-lots-list");
      list.replaceChildren();
      const labels = { pending_payment: "Waiting for payment", pending_review: "In review", live: "Live", scheduled: "Scheduled", sold: "Sold", unsold: "Ended, no sale", cancelled: "Cancelled", rejected: "Not accepted" };
      lots.forEach((lot) => {
        const row = el("li", {}, el("strong", { text: lot.title }), el("span", { class: "subtle", text: ` · ${labels[lot.status] || lot.status}` }));
        if (lot.status === "pending_payment") row.append(" ", el("a", { href: `./pay.html?lot=${encodeURIComponent(lot.id)}`, text: "Pay the TT$40 listing fee" }));
        if (lot.status === "live" || lot.status === "scheduled") row.append(" ", el("a", { href: `./lot.html?id=${encodeURIComponent(lot.id)}`, text: "View" }));
        if (lot.status === "rejected" && lot.rejectionReason) row.append(el("div", { class: "subtle", text: lot.rejectionReason }));
        list.append(row);
      });
    } catch { /* a signed-out visitor simply has no lots to show */ }
  }

  (async () => {
    ui.updateAuthPills();
    try {
      const me = await fetch("/dealztt-api/me", { credentials: "same-origin" }).then((r) => r.json());
      if (me.level !== "verified") { showGate(me.level === "anon" ? "anon" : "unverified"); return; }
      root.replaceChildren();
      buildForm();
      loadMine();
    } catch {
      root.replaceChildren(el("p", { class: "subtle", text: "The listing form could not load right now. Please try again shortly." }));
    }
  })();
})();

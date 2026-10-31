/* Pay the DealzTT listing fee by bank transfer. /pay.html?lot=<id> opens (or finds) the order for a
   lot; /pay.html?order=<id> shows an existing one. The amount and reference come from the server. */
(function () {
  const root = document.getElementById("pay-root");
  const ui = window.AuctionUi;
  const tt = (cents) => `TT$${(cents / 100).toLocaleString("en-TT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => { if (key === "text") node.textContent = value; else node.setAttribute(key, value); });
    children.forEach((child) => node.append(child));
    return node;
  }
  async function call(path, init) {
    const response = await fetch(`/dealztt-api${path}`, { ...init, credentials: "same-origin", headers: { "Content-Type": "application/json" }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { gate: data.gate, status: response.status });
    return data;
  }
  function note(text) { root.replaceChildren(el("section", { class: "card" }, el("p", { text }))); }

  function render(order) {
    root.replaceChildren();
    root.append(el("p", { class: "eyebrow", text: "Pay by bank transfer" }), el("h1", { text: `Listing fee: ${tt(order.amount_cents)}` }));
    if (order.status === "paid") {
      root.append(el("section", { class: "card" }, el("h2", { text: "Payment received" }), el("p", { text: "Your auction is live for 7 days. Thank you." }), el("a", { class: "btn", href: "./sell.html", text: "Back to my listings" })));
      return;
    }
    if (order.status === "cancelled") { root.append(el("section", { class: "card" }, el("p", { text: "This order was cancelled. No payment is needed." }))); return; }
    const b = order.bank;
    const rows = [["Account name", b.holder], ["Bank", `${b.bank} (${b.branch})`], ["Branch transit", b.transit], ["Account number", b.account], ["Account type", b.accountType], ["Currency", b.currency], ["Payment reference", order.reference]];
    const list = el("dl", { class: "pay-details", style: "display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;margin:12px 0 0" });
    rows.forEach(([key, value]) => list.append(el("dt", { class: "subtle", text: key }), el("dd", { style: "margin:0;font-weight:700;word-break:break-word", text: value })));
    root.append(el("section", { class: "card" },
      el("h2", { text: `Send ${tt(order.amount_cents)} from your Scotiabank (or any bank) online banking` }), list,
      el("p", { style: "margin-top:14px", text: `Put ${order.reference} in the payment reference so we can match it. Your auction goes live for 7 days as soon as we confirm the payment. Prices include VAT.` })));
    const input = el("input", { type: "text", maxlength: "300", placeholder: "e.g. Scotiabank ref 123456, paid 30 Oct", "aria-label": "Bank receipt number or date" });
    const status = el("p", { class: "subtle", role: "status" });
    const form = el("form", { class: "card", style: "margin-top:18px" }, el("label", { text: "Paid already? Tell us your bank receipt number or date" }), input, el("button", { class: "btn", type: "submit", text: "Send receipt details" }), status);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      try { await call(`/orders/${order.id}/receipt`, { method: "POST", body: JSON.stringify({ note: input.value }) }); status.textContent = "Thanks. We have your receipt details."; input.value = ""; }
      catch (error) { status.textContent = error.message; }
    });
    root.append(form);
  }

  (async () => {
    ui.updateAuthPills();
    const params = new URLSearchParams(location.search);
    try {
      const order = params.get("order")
        ? (await call(`/orders/${encodeURIComponent(params.get("order"))}`)).order
        : (await call("/orders", { method: "POST", body: JSON.stringify({ lotId: params.get("lot") }) })).order;
      render(order);
    } catch (error) {
      if (error.status === 401 || error.gate === "signin") { root.replaceChildren(el("section", { class: "card" }, el("p", { text: "Sign in to see your payment details." }), el("a", { class: "btn", href: ui.signInHref ? ui.signInHref() : "https://id.sovdigitalgroup.com/", text: "Sign in with SOV ID" }))); return; }
      if (error.gate === "verify") { root.replaceChildren(el("section", { class: "card" }, el("p", { text: error.message }), el("a", { class: "btn", href: "https://id.sovdigitalgroup.com/dashboard", text: "Verify my ID" }))); return; }
      note(error.message);
    }
  })();
})();

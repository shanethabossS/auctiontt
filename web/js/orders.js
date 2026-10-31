/* Orders for lots you won or sold. The winner pays DealzTT by bank transfer; DealzTT holds the money until
   the winner confirms they have the item, then pays the seller. Amounts and rules come from the server. */
(function () {
  const root = document.getElementById("orders-root");
  const ui = window.AuctionUi;
  const tt = (cents) => `TT$${(cents / 100).toLocaleString("en-TT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const day = (iso) => new Date(iso).toLocaleString("en-TT", { dateStyle: "medium", timeStyle: "short" });

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
  const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body || {}) });

  const LABELS = {
    buyer: { awaiting_payment: "Pay now", payment_overdue: "Payment overdue", paid: "Paid, waiting for the item", completed: "Complete", disputed: "Problem reported", refunded: "Refunded", cancelled: "Cancelled" },
    seller: { awaiting_payment: "Waiting for the winner to pay", payment_overdue: "Winner has not paid", paid: "Paid, hand over the item", completed: "Complete", disputed: "Problem reported by the buyer", refunded: "Refunded to the buyer", cancelled: "Cancelled" },
  };

  function signInPrompt() {
    root.replaceChildren(el("section", { class: "card" }, el("p", { text: "Sign in to see your orders." }),
      el("a", { class: "btn", href: ui.signInHref ? ui.signInHref() : "https://id.sovdigitalgroup.com/", text: "Sign in with SOV ID" })));
  }
  function fail(error) {
    if (error.status === 401 || error.gate === "signin") { signInPrompt(); return; }
    if (error.gate === "verify") { root.replaceChildren(el("section", { class: "card" }, el("p", { text: error.message }), el("a", { class: "btn", href: "https://id.sovdigitalgroup.com/dashboard", text: "Verify my ID" }))); return; }
    root.replaceChildren(el("section", { class: "card" }, el("p", { text: error.message })));
  }

  async function list() {
    const { orders } = await call("/my-sales");
    root.replaceChildren(el("p", { class: "eyebrow", text: "My orders" }), el("h1", { text: "Lots you won or sold" }));
    if (!orders.length) { root.append(el("section", { class: "card" }, el("p", { text: "No orders yet. When you win an auction or one of your lots sells, it appears here." }), el("a", { class: "btn", href: "./browse.html", text: "Browse auctions" }))); return; }
    orders.forEach((o) => {
      const amount = o.role === "buyer" ? `You pay ${tt(o.amount_cents)}` : `You receive ${tt(o.seller_net_cents)}`;
      root.append(el("section", { class: "card", style: "margin-bottom:12px" },
        el("strong", { text: o.title }),
        el("p", { class: "subtle", text: `${o.role === "buyer" ? "You won" : "You sold"} · ${amount} · ${LABELS[o.role][o.status] || o.status}` }),
        el("a", { class: "btn", href: `./orders.html?id=${encodeURIComponent(o.id)}`, text: "Open" })));
    });
  }

  function action(label, order, path, body, confirmText) {
    const status = el("p", { class: "subtle", role: "status" });
    const button = el("button", { class: "btn", type: "button", text: label });
    button.addEventListener("click", async () => {
      if (confirmText && !window.confirm(confirmText)) return;
      button.disabled = true;
      try { await post(`/sales/${order.id}/${path}`, body ? body() : {}); await detail(order.id); }
      catch (error) { status.textContent = error.message; button.disabled = false; }
    });
    return [button, status];
  }

  function noteForm(order, label, field, path, placeholder, submitText) {
    const input = el("input", { type: "text", maxlength: "300", placeholder, "aria-label": label });
    const status = el("p", { class: "subtle", role: "status" });
    const form = el("form", { class: "card", style: "margin-top:18px" }, el("label", { text: label }), input, el("button", { class: "btn", type: "submit", text: submitText }), status);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      try { await post(`/sales/${order.id}/${path}`, { [field]: input.value }); status.textContent = "Saved."; if (path !== "receipt") await detail(order.id); input.value = ""; }
      catch (error) { status.textContent = error.message; }
    });
    return form;
  }

  function bankBlock(order) {
    const b = order.bank;
    const rows = [["Account name", b.holder], ["Bank", `${b.bank} (${b.branch})`], ["Branch transit", b.transit], ["Account number", b.account], ["Account type", b.accountType], ["Currency", b.currency], ["Payment reference", order.reference]];
    const dl = el("dl", { style: "display:grid;grid-template-columns:max-content 1fr;gap:8px 16px;margin:12px 0 0" });
    rows.forEach(([k, v]) => dl.append(el("dt", { class: "subtle", text: k }), el("dd", { style: "margin:0;font-weight:700;word-break:break-word", text: v })));
    return el("section", { class: "card" },
      el("h2", { text: `Send ${tt(order.amount_cents)} from your Scotiabank (or any bank) online banking` }), dl,
      el("p", { style: "margin-top:14px", text: `Put ${order.reference} in the payment reference. DealzTT holds your payment and only pays the seller after you confirm you have the item. Prices include VAT.` }));
  }

  async function detail(id) {
    const { order } = await call(`/sales/${encodeURIComponent(id)}`);
    const buyer = order.role === "buyer";
    root.replaceChildren(el("a", { href: "./orders.html", text: "← All orders" }), el("p", { class: "eyebrow", text: buyer ? "You won" : "You sold" }), el("h1", { text: order.title }),
      el("p", { class: "subtle", text: `${LABELS[order.role][order.status] || order.status} · hammer price ${tt(order.hammer_cents)}${buyer ? ` + buyer fee ${tt(order.buyer_fee_cents)} = ${tt(order.amount_cents)}` : ` − seller fee ${tt(order.seller_fee_cents)} = you receive ${tt(order.seller_net_cents)}`}` }));

    if (buyer) {
      if (order.status === "awaiting_payment" || order.status === "payment_overdue") {
        if (order.status === "payment_overdue") root.append(el("p", { class: "subtle", text: "The 48-hour payment window has passed. If you have already paid, send your receipt details below and we will still match it." }));
        else root.append(el("p", { class: "subtle", text: `Pay by ${day(order.payment_due_at)}.` }));
        root.append(bankBlock(order), noteForm(order, "Paid already? Tell us your bank receipt number or date", "note", "receipt", "e.g. Scotiabank ref 123456, paid 30 Oct", "Send receipt details"));
        if (order.receipt_note) root.append(el("p", { class: "subtle", text: `We have your receipt note: ${order.receipt_note}` }));
      } else if (order.status === "paid") {
        const box = el("section", { class: "card" }, el("h2", { text: "Payment received" }),
          el("p", { text: order.handed_over_at ? `The seller says the item was handed over on ${day(order.handed_over_at)}.` : "The seller has been told to hand the item over. Check it as soon as you have it." }),
          el("p", { class: "subtle", text: "Confirm only when you have the item and it is as described. Confirming pays the seller and cannot be undone." }));
        const [confirmButton, confirmStatus] = action("I have the item — release the payment", order, "confirm-received", null, "Release the payment to the seller? This cannot be undone.");
        box.append(confirmButton, confirmStatus);
        root.append(box, noteForm(order, "Something wrong? Tell us what happened and we will hold the payment", "note", "problem", "e.g. item not as described", "Report a problem"));
      } else if (order.status === "disputed") {
        root.append(el("section", { class: "card" }, el("p", { text: "You reported a problem. DealzTT is holding the payment and will contact you." })));
      } else if (order.status === "completed") {
        root.append(el("section", { class: "card" }, el("p", { text: "All done. The seller has been paid. Thank you." })));
      } else if (order.status === "refunded") {
        root.append(el("section", { class: "card" }, el("p", { text: order.refund_status === "paid" ? "Your refund has been sent to your bank." : "Your refund is approved. DealzTT will send it to your bank." })));
      }
    } else {
      if (order.status === "paid") {
        const box = el("section", { class: "card" }, el("h2", { text: "The winner has paid" }),
          el("p", { text: order.handed_over_at ? `You marked the item handed over on ${day(order.handed_over_at)}. Your payout is released when the buyer confirms.` : "Hand the item to the winner, then tell us here. Your payout is released when they confirm." }));
        if (!order.handed_over_at) { const [b, s] = action("I have handed the item over", order, "handed-over"); box.append(b, s); }
        root.append(box);
      } else if (order.status === "completed") {
        root.append(el("section", { class: "card" }, el("h2", { text: order.payout_status === "paid" ? "Payout sent" : "Payout is being prepared" }),
          el("p", { text: order.payout_status === "paid" ? `${tt(order.seller_net_cents)} was sent to your bank.` : `${tt(order.seller_net_cents)} will be sent to your bank. Make sure your payout details below are right.` })));
      } else if (order.status === "awaiting_payment" || order.status === "payment_overdue") {
        root.append(el("section", { class: "card" }, el("p", { text: order.status === "payment_overdue" ? "The winner has not paid in time. DealzTT will contact you about relisting." : "Waiting for the winner to pay. Do not hand over the item until you see “Paid”." })));
      } else if (order.status === "disputed") {
        root.append(el("section", { class: "card" }, el("p", { text: "The buyer reported a problem. DealzTT is holding the payment and will contact you." })));
      }
      if (["awaiting_payment", "payment_overdue", "paid", "disputed", "completed"].includes(order.status) && order.payout_status !== "paid") {
        root.append(el("p", { class: "subtle", style: "margin-top:18px", text: order.payout_details ? `Payout details on file: ${order.payout_details}` : "No payout details yet." }),
          noteForm(order, "Where should we send your money? Account holder, bank and account number", "details", "payout-details", "e.g. Jane Doe, Republic Bank, 123456789", "Save payout details"));
      }
    }
  }

  (async () => {
    ui.updateAuthPills();
    const id = new URLSearchParams(location.search).get("id");
    try { if (id) await detail(id); else await list(); } catch (error) { fail(error); }
  })();
})();

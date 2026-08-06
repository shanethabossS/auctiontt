const amountNode = document.getElementById("fee-amount");
const categoryNode = document.getElementById("fee-category");
const resultNode = document.getElementById("fee-result");
const formatter = new Intl.NumberFormat("en-TT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value) {
  return `TT$${formatter.format(value)}`;
}

function renderFeeEstimate() {
  const parsedAmount = Number(amountNode.value);
  const amount = Number.isFinite(parsedAmount) ? Math.min(100000000, Math.max(0, parsedAmount)) : 0;
  const rate = categoryNode.value === "high" ? 0.03 : 0.05;
  const fee = Math.round(amount * rate * 100) / 100;
  resultNode.textContent = `${money(amount + fee)} total (${money(fee)} buyer fee)`;
}

amountNode.addEventListener("input", renderFeeEstimate);
categoryNode.addEventListener("change", renderFeeEstimate);
renderFeeEstimate();

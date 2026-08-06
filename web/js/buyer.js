const buyerName = document.getElementById("buyer-name");
const buyerEmail = document.getElementById("buyer-email");
const buyerStatus = document.getElementById("buyer-status");

(() => {
  window.AuctionUi.updateAuthPills();
  const user = window.AuctionApi.getSessionUser();
  if (!user) {
    window.location.href = "./signin.html";
    return;
  }
  buyerName.textContent = `${user.full_name || "Buyer"}'s DealzTT account`;
  buyerEmail.textContent = user.email || "";
  buyerStatus.textContent = "Your account is ready to browse published lots.";
})();

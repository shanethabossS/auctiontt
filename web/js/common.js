let serverOffsetMs = 0;

function money(value) {
  return new Intl.NumberFormat("en-TT", {
    style: "currency",
    currency: "TTD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function nowMs() {
  return Date.now() + serverOffsetMs;
}

function setServerTimeOffset(offsetMs) {
  serverOffsetMs = Number(offsetMs || 0);
}

function timeLeft(iso) {
  const diffMs = new Date(iso).getTime() - nowMs();
  if (diffMs <= 0) return "Ended";
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s left`;
  return `${hours}h ${minutes}m ${seconds}s left`;
}

function updateAuthPills() {
  const ssoUrl = "https://id.sovdigitalgroup.com/";
  const pills = document.querySelectorAll("[data-auth-pill], [data-auth-pill-mobile]");
  pills.forEach((pill) => {
    pill.textContent = "Sign In";
    pill.href = ssoUrl;
  });
}

function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const drawer = document.getElementById("nav-mobile");
  if (!toggle || !drawer) return;
  if (!toggle.hasAttribute("aria-expanded")) toggle.setAttribute("aria-expanded", "false");

  toggle.addEventListener("click", () => {
    const isOpen = drawer.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close drawer when a link inside it is clicked
  drawer.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      drawer.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  updateAuthPills();
});

window.AuctionUi = {
  money,
  nowMs,
  setServerTimeOffset,
  timeLeft,
  updateAuthPills,
  initMobileNav,
};

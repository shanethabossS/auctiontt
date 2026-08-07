let serverOffsetMs = 0;

const SSO_URL = "https://id.sovdigitalgroup.com/";
const DEMO_USER_KEY = "dealztt_demo_user";
const RETURN_KEY = "dealztt_return";

/* Sign-in link that carries the current page as the post-login return target.
   The `next` param is the ecosystem convention; we also stash the URL locally
   so we can bounce back even if the hub only returns to the site root. */
function signInHref() {
  return `${SSO_URL}?next=${encodeURIComponent(location.href)}`;
}
function rememberReturn() {
  try { localStorage.setItem(RETURN_KEY, JSON.stringify({ url: location.href, at: Date.now() })); } catch {}
}
/* After returning from SSO signed-in, jump back to the page the user left. */
function maybeReturnAfterLogin() {
  if (!hasAuthCookie()) return;                 // only for real SSO sign-ins
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(RETURN_KEY) || "null"); } catch {}
  if (!saved || !saved.url) return;
  const fresh = Date.now() - Number(saved.at || 0) < 10 * 60 * 1000;
  localStorage.removeItem(RETURN_KEY);
  if (fresh && saved.url !== location.href) location.replace(saved.url);
}

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

/* ── Relative "time ago" for the activity feed ──────────────────────────── */
function timeAgo(ms) {
  const diff = Math.max(0, nowMs() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Auth ────────────────────────────────────────────────────────────────
   Real signal: the SSO `auth_state` cookie (set non-HttpOnly by the central
   auth gate). Demo signal: a local demo-bidder session so the full bid flow
   is testable before SSO is wired here. */
function hasAuthCookie() {
  return document.cookie.split(";").some((c) => c.trim().startsWith("auth_state="));
}
function demoUser() {
  try { return JSON.parse(localStorage.getItem(DEMO_USER_KEY) || "null"); } catch { return null; }
}
function isSignedIn() {
  return hasAuthCookie() || Boolean(demoUser());
}
function currentUserName() {
  const d = demoUser();
  return d?.name || "You";
}
function startDemoSession(name) {
  const handle = (name && name.trim()) || "demo_bidder";
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify({ name: handle, since: Date.now() }));
}
function signOutDemo() {
  localStorage.removeItem(DEMO_USER_KEY);
}

/* ── Auth-aware nav pill ─────────────────────────────────────────────────── */
function updateAuthPills() {
  const pills = document.querySelectorAll("[data-auth-pill], [data-auth-pill-mobile]");
  const signed = isSignedIn();
  pills.forEach((pill) => {
    if (signed) {
      pill.textContent = demoUser() ? `${currentUserName()} · Sign out` : "My Account";
      pill.href = demoUser() ? "#signout" : SSO_URL;
      if (demoUser()) {
        pill.onclick = (e) => { e.preventDefault(); signOutDemo(); toast("info", "Signed out", "Demo session ended."); setTimeout(() => location.reload(), 500); };
      }
    } else {
      pill.textContent = "Sign In";
      pill.href = signInHref();
      pill.onclick = () => { rememberReturn(); return true; };
    }
  });
}

/* ── Toast notifications ────────────────────────────────────────────────── */
function toastStack() {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}
const TOAST_ICONS = { ok: "✅", info: "🔔", warn: "⚡", err: "⚠️", badge: "🏅" };
function toast(kind, title, msg, ttl = 4200) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="toast-ic">${TOAST_ICONS[kind] || "🔔"}</span>
    <div class="toast-body"><div class="toast-title"></div><div class="toast-msg"></div></div>`;
  el.querySelector(".toast-title").textContent = title;
  el.querySelector(".toast-msg").textContent = msg || "";
  toastStack().appendChild(el);
  const kill = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 320); };
  el.addEventListener("click", kill);
  setTimeout(kill, ttl);
}

/* ── Sign-in gate ───────────────────────────────────────────────────────
   Returns true if allowed to proceed; otherwise shows the gate and returns
   false. Enforces: no bidding / watching / paying unless signed in. */
function requireSignIn(actionLabel = "bid") {
  if (isSignedIn()) return true;
  openSignInGate(actionLabel);
  return false;
}
function closeSignInGate() {
  document.getElementById("gate-overlay")?.remove();
}
function openSignInGate(actionLabel) {
  closeSignInGate();
  const overlay = document.createElement("div");
  overlay.id = "gate-overlay";
  overlay.className = "gate-overlay";
  const demoAvailable = window.DEALZTT_DEMO_MODE;
  overlay.innerHTML = `
    <div class="gate-card" role="dialog" aria-modal="true" aria-label="Sign in required">
      <div class="gate-emoji">🔐</div>
      <h3>Sign in to ${actionLabel}</h3>
      <p>You need a DealzTT account to ${actionLabel}. Bidding, watchlists, and payments are only available to signed-in members.</p>
      <div class="gate-actions">
        <a class="btn" id="gate-sso" href="${signInHref()}">Sign in with SOV ID</a>
        ${demoAvailable ? '<button class="btn ghost" id="gate-demo" type="button">Continue as demo bidder</button>' : ""}
        <button class="btn ghost" id="gate-cancel" type="button">Not now</button>
      </div>
    </div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeSignInGate(); });
  document.body.appendChild(overlay);
  document.getElementById("gate-sso")?.addEventListener("click", rememberReturn);
  document.getElementById("gate-cancel")?.addEventListener("click", closeSignInGate);
  document.getElementById("gate-demo")?.addEventListener("click", () => {
    startDemoSession("demo_bidder");
    closeSignInGate();
    updateAuthPills();
    window.DealzBadges?.record("signin");
    toast("ok", "Demo session started", "You can now place demo bids. This is preview only.");
    document.dispatchEvent(new CustomEvent("dealztt:signedin"));
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

  drawer.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      drawer.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  maybeReturnAfterLogin();
  initMobileNav();
  updateAuthPills();
  if (isSignedIn()) window.DealzBadges?.record("signin");
});

window.AuctionUi = {
  money,
  nowMs,
  setServerTimeOffset,
  timeLeft,
  timeAgo,
  updateAuthPills,
  initMobileNav,
  isSignedIn,
  requireSignIn,
  currentUserName,
  toast,
};

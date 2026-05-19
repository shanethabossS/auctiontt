const API_BASE_CANDIDATES = [
  "/postgrest",
  "https://api.sovdigitalgroup.com/auction",
  "http://127.0.0.1:33001",
  "http://127.0.0.1:3001"
];

const USER_KEY = "auctiontt_user";
const LEGACY_USER_KEY = "auctionsite_user";

let apiBasePromise = null;
let refreshPromise = null;

function getSessionUser() {
  const raw = localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setSessionUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSessionUser() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch("/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then(async (res) => {
      if (!res.ok) {
        clearSessionUser();
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.user) {
        setSessionUser(data.user);
      }
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function detectApiBase() {
  for (const base of API_BASE_CANDIDATES) {
    try {
      const res = await fetch(`${base}/`, { method: "GET" });
      if (res.ok) return base;
    } catch {
      // Keep trying candidates.
    }
  }
  throw new Error("Auction API is unavailable right now.");
}

async function getApiBase() {
  if (!apiBasePromise) {
    apiBasePromise = detectApiBase();
  }
  return apiBasePromise;
}

async function apiFetch(path, options = {}) {
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function authFetch(url, options = {}) {
  const doRequest = () =>
    fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers || {}),
      },
    });

  let response = await doRequest();

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doRequest();
    }
  }

  if (response.status === 401) {
    clearSessionUser();
  }

  return response;
}

window.AuctionApi = {
  getSessionUser,
  setSessionUser,
  clearSessionUser,
  refreshAccessToken,
  authFetch,
  apiFetch,
};

const API_BASE_CANDIDATES = [
  "/postgrest",
  "https://api.sovdigitalgroup.com/auction",
  "http://127.0.0.1:33001",
  "http://127.0.0.1:3001",
];

let apiBasePromise = null;

async function detectApiBase() {
  for (const base of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${base}/`, { method: "GET" });
      if (response.ok) return base;
    } catch {}
  }
  throw new Error("Auction API is unavailable right now.");
}

async function getApiBase() {
  if (!apiBasePromise) apiBasePromise = detectApiBase();
  return apiBasePromise;
}

async function apiFetch(path, options = {}) {
  const base = await getApiBase();
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error("The auction service could not complete this request.");
  }

  if (response.status === 204) return null;
  return response.json();
}

window.AuctionApi = { apiFetch };

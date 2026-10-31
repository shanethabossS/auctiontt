/* Finishes SOV ID sign-in. The hub sends the browser here with a one-time sso_token; the API swaps it
   for an HttpOnly session cookie (set on dealztt.com through the /dealztt-api rewrite). */
(async function () {
  const params = new URLSearchParams(location.search);
  const token = params.get("sso_token");
  const requested = params.get("next") || "/";
  // Only same-site paths: a next starting "//" or "/" plus a backslash would be an open redirect.
  const next = /^\/(?![/\\])/.test(requested) ? requested : "/";
  const title = document.getElementById("cb-title");
  const message = document.getElementById("cb-msg");
  const retry = document.getElementById("cb-retry");
  function fail(text) {
    title.textContent = "Sign-in did not finish";
    message.textContent = text;
    retry.hidden = false;
  }
  if (!token) { fail("The sign-in link was missing its token. Open DealzTT again from SOV ID."); return; }
  try {
    const response = await fetch("/dealztt-api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      fail(data.error === "token invalid, expired, or already used"
        ? "That sign-in link has expired or was already used. Open DealzTT again from SOV ID."
        : "We could not complete sign-in. Please try again.");
      return;
    }
    location.replace(next);
  } catch {
    fail("The sign-in service is unreachable right now. Please try again.");
  }
})();

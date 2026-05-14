const signInForm = document.getElementById("signin-form");
const msg = document.getElementById("auth-message");
const googleButton = document.getElementById("google-login-btn");
const GOOGLE_ROLE_KEY = "auctiontt_google_role";
const CENTRAL_GOOGLE_AUTH_URL = "https://api.sovdigitalgroup.com/api/auth/google";

function setMessage(text, isError = false) {
  msg.textContent = text;
  msg.style.color = isError ? "#b00020" : "#111";
}

function beginGoogleSignIn() {
  const role = "buyer";
  sessionStorage.setItem(GOOGLE_ROLE_KEY, role);

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const authUrl =
    `${CENTRAL_GOOGLE_AUTH_URL}` +
    `?redirectTo=${encodeURIComponent(redirectTo)}` +
    `&redirect_url=${encodeURIComponent(redirectTo)}`;

  window.location.assign(authUrl);
}

async function finalizeGoogleSignIn(token) {
  const preferredRole = (sessionStorage.getItem(GOOGLE_ROLE_KEY) || "buyer").toLowerCase();
  sessionStorage.removeItem(GOOGLE_ROLE_KEY);

  const response = await fetch("/auth/google/central", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      role: preferredRole === "seller" ? "seller" : "buyer",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Google sign-in failed");
  }

  const payload = await response.json();
  if (!payload?.user) {
    throw new Error("Google sign-in did not return user profile");
  }

  return payload.user;
}

async function handleGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");
  const token = params.get("token");

  if (oauthError) {
    setMessage("Google sign-in failed. Please try again.", true);
    return;
  }
  if (!token) return;

  if (googleButton) googleButton.disabled = true;
  setMessage("Finalizing Google sign-in...");

  try {
    const user = await finalizeGoogleSignIn(token);
    window.AuctionApi.setSessionUser({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    });

    window.history.replaceState({}, "", window.location.pathname);
    setMessage("Google sign-in successful.");
    window.location.href = user.role === "seller" ? "./sell.html" : "./index.html";
  } catch (err) {
    setMessage(`Google sign-in failed: ${err.message}`, true);
    if (googleButton) googleButton.disabled = false;
  }
}

if (signInForm) {
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = signInForm.querySelector("[name=email]").value.trim().toLowerCase();
    const password = signInForm.querySelector("[name=password]").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Invalid email or password");
      }

      const signedIn = await response.json();
      const user = signedIn.user || null;
      if (!user) {
        setMessage("Invalid email or password.", true);
        return;
      }

      window.AuctionApi.setSessionUser({ id: user.id, full_name: user.full_name, email: user.email, role: user.role });
      setMessage("Signed in successfully.");
      window.location.href = user.role === "seller" ? "./sell.html" : "./index.html";
    } catch (err) {
      setMessage(`Sign in failed: ${err.message}`, true);
    }
  });
}

if (googleButton) {
  googleButton.addEventListener("click", beginGoogleSignIn);
}

(() => {
  window.AuctionUi.updateAuthPills();
  handleGoogleCallback();
})();

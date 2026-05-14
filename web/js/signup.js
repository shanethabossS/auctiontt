const signUpForm = document.getElementById("signup-form");
const msg = document.getElementById("auth-message");
const googleButton = document.getElementById("google-signup-btn");
const GOOGLE_ROLE_KEY = "auctiontt_google_role";
const CENTRAL_GOOGLE_AUTH_URL = "https://api.sovdigitalgroup.com/api/auth/google";

function setMessage(text, isError = false) {
  msg.textContent = text;
  msg.style.color = isError ? "#f87171" : "#cbd5e1";
}

function beginGoogleSignUp() {
  const role = (signUpForm?.querySelector("[name=role]")?.value || "buyer").toLowerCase();
  sessionStorage.setItem(GOOGLE_ROLE_KEY, role);

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const authUrl =
    `${CENTRAL_GOOGLE_AUTH_URL}` +
    `?redirectTo=${encodeURIComponent(redirectTo)}` +
    `&redirect_url=${encodeURIComponent(redirectTo)}`;

  window.location.assign(authUrl);
}

async function finalizeGoogleSignUp(token) {
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
    throw new Error(text || "Google sign-up failed");
  }

  const payload = await response.json();
  if (!payload?.user) {
    throw new Error("Google sign-up did not return user profile");
  }

  return payload.user;
}

async function handleGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error");
  const token = params.get("token");

  if (oauthError) {
    setMessage("Google sign-up failed. Please try again.", true);
    return;
  }
  if (!token) return;

  if (googleButton) googleButton.disabled = true;
  setMessage("Finalizing Google sign-up...");

  try {
    const user = await finalizeGoogleSignUp(token);
    window.AuctionApi.setSessionUser({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    });

    window.history.replaceState({}, "", window.location.pathname);
    setMessage("Google sign-up successful.");
    window.location.href = user.role === "seller" ? "./sell.html" : "./index.html";
  } catch (err) {
    setMessage(`Google sign-up failed: ${err.message}`, true);
    if (googleButton) googleButton.disabled = false;
  }
}

if (signUpForm) {
  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = signUpForm.querySelector("[name=full_name]").value.trim();
    const email = signUpForm.querySelector("[name=email]").value.trim().toLowerCase();
    const phone = signUpForm.querySelector("[name=phone]").value.trim();
    const password = signUpForm.querySelector("[name=password]").value;
    const confirmPassword = signUpForm.querySelector("[name=confirm_password]").value;
    const role = signUpForm.querySelector("[name=role]").value;

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.", true);
      return;
    }

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          phone: phone || null,
          role,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Sign up failed");
      }

      const created = await response.json();
      const user = created.user || null;
      if (!user) {
        setMessage("Could not create account.", true);
        return;
      }

      window.AuctionApi.setSessionUser({ id: user.id, full_name: user.full_name, email: user.email, role: user.role });
      setMessage("Account created and signed in.");
      window.location.href = role === "seller" ? "./sell.html" : "./index.html";
    } catch (err) {
      setMessage(`Sign up failed: ${err.message}`, true);
    }
  });
}

if (googleButton) {
  googleButton.addEventListener("click", beginGoogleSignUp);
}

(() => {
  window.AuctionUi.updateAuthPills();
  handleGoogleCallback();
})();

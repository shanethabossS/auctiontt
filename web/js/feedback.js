const feedbackForm = document.getElementById("feedback-form");
const feedbackStatus = document.getElementById("feedback-status");

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = feedbackForm.querySelector("button[type=submit]");
  const data = new FormData(feedbackForm);
  const type = String(data.get("type"));
  const name = String(data.get("name")).trim();
  const subject = String(data.get("subject")).trim();
  const details = String(data.get("details")).trim();
  const reference = String(data.get("lot_reference")).trim();
  const email = String(data.get("email")).trim().toLowerCase();
  submitButton.disabled = true;
  feedbackStatus.textContent = "Sending feedback...";
  try {
    const response = await fetch("https://api.sovdigitalgroup.com/api/contact/messages/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        subject: `[${type}] ${subject}`,
        message: `Type: ${type}\n\n${details}${reference ? `\n\nRelated lot reference: ${reference}` : ""}`,
        source_site: "dealztt",
        source_page: window.location.pathname,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || "Feedback could not be sent right now.");
    feedbackForm.reset();
    feedbackStatus.textContent = "Thank you. Your feedback was sent.";
  } catch (error) {
    feedbackStatus.textContent = error.message || "Feedback could not be sent right now.";
  } finally {
    submitButton.disabled = false;
  }
});

window.AuctionUi.updateAuthPills();

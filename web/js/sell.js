const profileForm = document.getElementById("seller-profile-form");
const itemForm = document.getElementById("item-upload-form");
const statusBox = document.getElementById("sell-status");
const profileState = document.getElementById("profile-state");
const categorySelect = document.getElementById("item-category");
const recentList = document.getElementById("recent-submissions");

let user = null;
let sellerProfile = null;

function setStatus(text, isError = false) {
  statusBox.textContent = text;
  statusBox.style.color = isError ? "#ff4f70" : "#f5f5f7";
}

async function fetchSellerProfile(userId) {
  const response = await window.AuctionApi.authFetch("/me/seller-profile");
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.profile || null;
}

async function renderRecentSubmissions() {
  if (!sellerProfile) {
    recentList.innerHTML = "<li>Create seller profile to start uploading.</li>";
    return;
  }

  const response = await window.AuctionApi.authFetch("/me/submissions?limit=8");
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const rows = data.submissions || [];
  if (!rows.length) {
    recentList.innerHTML = "<li>No item submissions yet.</li>";
    return;
  }

  recentList.innerHTML = "";
  rows.forEach((row) => {
    const li = document.createElement("li");
    const created = new Date(row.created_at).toLocaleString();
    li.textContent = `${row.title} | ${row.submission_status.toUpperCase()} | ${created}`;
    recentList.appendChild(li);
  });
}

async function loadCategories() {
  const rows = await window.AuctionApi.apiFetch("/auction_categories?select=id,name,slug&order=name.asc");
  categorySelect.innerHTML = "";
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.name;
    categorySelect.appendChild(option);
  });
}

async function uploadItemImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await window.AuctionApi.authFetch("/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image upload failed: ${response.status} ${text}`);
  }

  return response.json();
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    business_name: profileForm.querySelector("[name=business_name]").value.trim(),
    phone: profileForm.querySelector("[name=phone]").value.trim(),
    city: profileForm.querySelector("[name=city]").value.trim(),
    state: profileForm.querySelector("[name=state]").value.trim(),
    about: profileForm.querySelector("[name=about]").value.trim(),
  };

  try {
    const response = await window.AuctionApi.authFetch("/me/seller-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    sellerProfile = data.profile;

    profileState.textContent = `Seller profile active for ${sellerProfile.business_name}`;
    setStatus("Seller profile saved.");
    await renderRecentSubmissions();
  } catch (err) {
    setStatus(`Profile save failed: ${err.message}`, true);
  }
});

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!sellerProfile) {
    setStatus("Create seller profile before uploading items.", true);
    return;
  }

  try {
    let imageUrl = itemForm.querySelector("[name=image_url]").value.trim();
    let imageVariants = {};

    const imageFile = itemForm.querySelector("[name=image_file]").files[0];
    if (imageFile) {
      setStatus("Uploading and optimizing image...");
      const upload = await uploadItemImage(imageFile);
      imageUrl = upload.image_url;
      imageVariants = upload.image_variants;
    }

    const payload = {
      seller_profile_id: sellerProfile.id,
      category_id: categorySelect.value,
      title: itemForm.querySelector("[name=title]").value.trim(),
      description: itemForm.querySelector("[name=description]").value.trim(),
      reserve_price: Number(itemForm.querySelector("[name=reserve_price]").value || 0),
      starting_bid: Number(itemForm.querySelector("[name=starting_bid]").value || 1),
      quantity: Number(itemForm.querySelector("[name=quantity]").value || 1),
      image_url: imageUrl,
      image_variants: imageVariants,
      city: itemForm.querySelector("[name=city]").value.trim(),
      state: itemForm.querySelector("[name=state]").value.trim(),
      shipping_available: itemForm.querySelector("[name=shipping_available]").checked,
      pickup_available: itemForm.querySelector("[name=pickup_available]").checked,
    };

    const response = await window.AuctionApi.authFetch("/me/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());

    itemForm.reset();
    setStatus("Item submitted. Image optimized and saved.");
    await renderRecentSubmissions();
  } catch (err) {
    setStatus(`Item upload failed: ${err.message}`, true);
  }
});

(async () => {
  try {
    window.AuctionUi.updateAuthPills();
    user = window.AuctionApi.getSessionUser();
    if (!user) {
      window.location.href = "./signin.html";
      return;
    }

    document.getElementById("seller-user").textContent = `${user.full_name} (${user.email})`;

    await loadCategories();
    sellerProfile = await fetchSellerProfile(user.id);

    if (sellerProfile) {
      profileForm.querySelector("[name=business_name]").value = sellerProfile.business_name || "";
      profileForm.querySelector("[name=phone]").value = sellerProfile.phone || "";
      profileForm.querySelector("[name=city]").value = sellerProfile.city || "";
      profileForm.querySelector("[name=state]").value = sellerProfile.state || "";
      profileForm.querySelector("[name=about]").value = sellerProfile.about || "";
      profileState.textContent = `Seller profile active for ${sellerProfile.business_name}`;
    }

    await renderRecentSubmissions();
  } catch (err) {
    setStatus(`Initialization failed: ${err.message}`, true);
  }
})();

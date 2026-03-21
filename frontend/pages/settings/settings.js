// ============================================================
//  ClickSafe — settings.js
//  Save and load user settings from chrome.storage
// ============================================================

const defaults = {
  httpsEnabled: true,
  cookiesEnabled: true,
  linksEnabled: true,
  downloadsEnabled: true,
  modalsEnabled: true,
  whitelist: []
};

// Load saved settings on page open
chrome.storage.local.get(["settings"], function (result) {
  const settings = result.settings || defaults;

  document.getElementById("toggle-https").checked = settings.httpsEnabled;
  document.getElementById("toggle-cookies").checked = settings.cookiesEnabled;
  document.getElementById("toggle-links").checked = settings.linksEnabled;
  document.getElementById("toggle-downloads").checked = settings.downloadsEnabled;
  document.getElementById("toggle-modals").checked = settings.modalsEnabled;

  renderWhitelist(settings.whitelist || []);
});

// Whitelist management
let whitelist = [];

function renderWhitelist(items) {
  whitelist = items;
  const list = document.getElementById("whitelist-list");
  list.innerHTML = "";

  items.forEach((site, index) => {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    li.innerHTML = `
      <span>${site}</span>
      <button class="btn-remove" data-index="${index}">✕</button>
    `;
    list.appendChild(li);
  });

  // Remove buttons
  list.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.dataset.index);
      whitelist.splice(index, 1);
      renderWhitelist(whitelist);
    });
  });
}

// Add to whitelist
document.getElementById("add-whitelist").addEventListener("click", function () {
  const input = document.getElementById("whitelist-input");
  const value = input.value.trim();

  if (!value) return;
  if (whitelist.includes(value)) {
    input.value = "";
    return;
  }

  whitelist.push(value);
  renderWhitelist(whitelist);
  input.value = "";
});

// Save settings
document.getElementById("save-btn").addEventListener("click", function () {
  const settings = {
    httpsEnabled: document.getElementById("toggle-https").checked,
    cookiesEnabled: document.getElementById("toggle-cookies").checked,
    linksEnabled: document.getElementById("toggle-links").checked,
    downloadsEnabled: document.getElementById("toggle-downloads").checked,
    modalsEnabled: document.getElementById("toggle-modals").checked,
    whitelist: whitelist
  };

  chrome.storage.local.set({ settings }, function () {
    // Show success message
    const msg = document.getElementById("success-msg");
    msg.style.display = "block";
    setTimeout(() => { msg.style.display = "none"; }, 3000);

    // Notify background.js to apply new settings
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings });
  });
});

// Reset to defaults
document.getElementById("reset-btn").addEventListener("click", function () {
  chrome.storage.local.set({ settings: defaults }, function () {
    location.reload();
  });
});
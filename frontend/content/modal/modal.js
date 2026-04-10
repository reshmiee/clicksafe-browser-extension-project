// ============================================================
//  ClickSafe — modal/modal.js
//  Loaded inside the warning modal iframe (web_accessible_resource)
//  Listens for a postMessage from content.js with threat details
//  and renders the warning UI.
// ============================================================

window.addEventListener("message", function (event) {
  // Only accept messages from the same extension origin
  if (!event.data || event.data.source !== "clicksafe") return;

  const { type, url, filename, threat } = event.data;

  const icon = document.getElementById("cs-icon");
  const title = document.getElementById("cs-title");
  const threatEl = document.getElementById("cs-threat");
  const target = document.getElementById("cs-target");

  if (icon) icon.textContent = type === "download" ? "🚨" : "⚠️";
  if (title) title.textContent = type === "download" ? "Dangerous Download Blocked!" : "Dangerous Link Detected!";
  if (threatEl) threatEl.textContent = threat || "Unknown";
  if (target) target.textContent = filename || url || "";
});

document.getElementById("cs-go-back")?.addEventListener("click", () => {
  window.parent.postMessage({ source: "clicksafe-modal", action: "dismiss" }, "*");
});

document.getElementById("cs-proceed")?.addEventListener("click", () => {
  window.parent.postMessage({ source: "clicksafe-modal", action: "proceed" }, "*");
});

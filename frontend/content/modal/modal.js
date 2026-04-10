// ============================================================
//  ClickSafe — modal/modal.js
//  Runs inside the warning modal iframe.
//  Listens for postMessage from content.js with threat details
//  and updates the modal UI. Uses IDs from modal.html.
// ============================================================

window.addEventListener("message", function (event) {
  if (!event.data || event.data.source !== "clicksafe") return;

  const { type, url, filename, threat } = event.data;

  const icon   = document.getElementById("clicksafe-modal-icon");
  const title  = document.getElementById("clicksafe-modal-title");
  const threatEl = document.getElementById("clicksafe-modal-threat");
  const urlEl  = document.getElementById("clicksafe-modal-url");

  if (icon)    icon.textContent  = type === "download" ? "🚨" : "⚠️";
  if (title)   title.textContent = type === "download" ? "Dangerous Download Blocked!" : "Dangerous Link Detected!";
  if (threatEl) threatEl.textContent = `Threat: ${threat || "Unknown"}`;
  if (urlEl)   urlEl.textContent  = filename || url || "";
});

document.getElementById("clicksafe-go-back")?.addEventListener("click", () => {
  window.parent.postMessage({ source: "clicksafe-modal", action: "dismiss" }, "*");
});

document.getElementById("clicksafe-proceed")?.addEventListener("click", () => {
  window.parent.postMessage({ source: "clicksafe-modal", action: "proceed" }, "*");
});

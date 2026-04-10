// ============================================================
//  ClickSafe — landing-page/script.js
// ============================================================

const BACKEND_URL = "http://localhost:3000";

// ---- URL Safety Checker ----
const urlInput   = document.getElementById("urlInput");
const checkBtn   = document.getElementById("checkBtn");
const checkBtnText = document.getElementById("checkBtnText");
const spinner    = document.getElementById("spinner");
const scResult   = document.getElementById("scResult");
const resultStatus  = document.getElementById("resultStatus");
const resultDetails = document.getElementById("resultDetails");

async function checkUrl() {
  const url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }

  // Validate format
  try { new URL(url); } catch {
    showResult(false, "⚠ Invalid URL", "Please enter a full URL including https://");
    return;
  }

  // Loading state
  checkBtnText.textContent = "Checking…";
  spinner.classList.remove("hidden");
  checkBtn.disabled = true;
  scResult.classList.add("hidden");

  try {
    const response = await fetch(`${BACKEND_URL}/api/check-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();

    if (data.safe) {
      showResult(true, "✅ Safe", `This URL appears safe. No threats detected.`);
    } else {
      showResult(false, "🚨 Dangerous", `Threat detected: ${data.threat || "Unknown threat"}. Do not visit this site.`);
    }
  } catch (err) {
    // Backend not running — show helpful message
    showResult(null, "⚠ Backend Offline", "The safety check API is not running. Start the backend server to use this feature.");
  } finally {
    checkBtnText.textContent = "Check";
    spinner.classList.add("hidden");
    checkBtn.disabled = false;
  }
}

function showResult(isSafe, status, details) {
  scResult.classList.remove("hidden", "safe", "danger", "warn");
  if (isSafe === true) {
    scResult.classList.add("safe");
    resultStatus.style.color = "#16a34a";
  } else if (isSafe === false) {
    scResult.classList.add("danger");
    resultStatus.style.color = "#dc2626";
  } else {
    scResult.classList.add("safe"); // neutral styling
    resultStatus.style.color = "#b45309";
  }
  resultStatus.textContent = status;
  resultDetails.textContent = details;
}

checkBtn.addEventListener("click", checkUrl);
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") checkUrl(); });

// ---- Smooth navbar scroll effect ----
window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 20) {
    navbar.style.boxShadow = "0 2px 20px rgba(0,0,0,0.1)";
  } else {
    navbar.style.boxShadow = "none";
  }
});

// ---- Mobile menu (basic toggle) ----
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navLinks = document.querySelector(".nav-links");
mobileMenuBtn?.addEventListener("click", () => {
  navLinks.style.display = navLinks.style.display === "flex" ? "none" : "flex";
  navLinks.style.flexDirection = "column";
  navLinks.style.position = "absolute";
  navLinks.style.top = "64px";
  navLinks.style.left = "0";
  navLinks.style.right = "0";
  navLinks.style.background = "white";
  navLinks.style.padding = "16px 24px";
  navLinks.style.borderBottom = "1px solid #e2e8f0";
  navLinks.style.zIndex = "99";
});

// ---- Animate elements on scroll ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(".feature-card, .step-card, .future-card").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(20px)";
  el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  observer.observe(el);
});

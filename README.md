# ClickSafe Browser Extension

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

A unified, real-time browser security extension providing layered protection against HTTP connections, trackers, malicious links, and dangerous downloads.

---

## Problem Statement

In today's digital landscape, users face multiple security threats while browsing the internet. Many websites still use HTTP instead of HTTPS, exposing user data to interception. Websites deploy hidden trackers and cookies that collect user data without clear consent or awareness. Attackers disguise dangerous links to look legitimate, tricking users into clicking phishing sites and malware. Users also unknowingly download trojans, ransomware, and viruses from untrusted sources.

These threats result in serious consequences including financial losses from stolen banking and payment information, identity theft and privacy violations, malware infections and data breaches, and personal data harvesting by third parties.

Current solutions are inadequate because security tools are often separate, requiring multiple extensions. Many solutions lack real-time protection, and complex interfaces discourage regular users from using security tools effectively.

---

## Solution

ClickSafe is a unified, real-time browser security extension that provides layered protection across multiple threat vectors. Users can download the extension from our landing page. The extension combines various safety functionalities with a beautiful and easily navigable interface, making it accessible to everyone.

---

## Key Features

### Auto-HTTPS Redirect
Automatically redirects HTTP requests to HTTPS, protecting data in transit. Visual indicator changes extension icon color based on connection security.

### HTTPS Monitor
Monitors connection security in real-time and detects mixed content on HTTPS pages. Silent background monitoring with detailed logs.

### Cookie Tracker Detector
Identifies and logs tracking cookies from third-party domains. Distinguishes between analytics, advertising, and social media trackers.

### Link Hover Preview
Real-time link safety verification before clicking. Integration with Google Safe Browsing API displays instant warning modals for malicious links.

### Suspicious Download Blocker
Intercepts downloads before they start and scans file URLs against threat databases. Blocks malware, trojans, and ransomware automatically with user override option.

### Security Sidebar
Quick-access panel showing current page security status. Displays real-time statistics including trackers blocked and threats detected.

### Warning Modals
Immediate alerts for dangerous links and downloads. Clear action options with risk explanations in non-intrusive design.

### Settings Page
Customizable feature toggles and whitelist management for trusted sites. Adjustable sensitivity levels with reset to default options.

---

## Tech Stack

**Frontend:** HTML5, Tailwind CSS, JavaScript (ES6+), Browser APIs (Chrome Extension APIs), Chart.js  
**Backend:** Node.js, Express.js, Express Middleware  
**Database:** MySQL, mysql2  
**External API:** Google Safe Browsing API v4  
**Development Tools:** VS Code, Git & GitHub, Postman, Chrome DevTools, Figma, Tailwind CLI  
**Deployment:** Netlify/Vercel (Landing Page), Railway/DigitalOcean (Backend), PlanetScale/AWS RDS (Database)

---

## Project Structure
```
clicksafe-browser-extension-project/
├── frontend/              # Browser extension files
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Background service worker
│   ├── content/           # Content scripts and UI components
│   ├── pages/             # Full-page interfaces (settings)
│   ├── assets/            # Extension icons and graphics
│   └── utils/             # Helper functions
├── backend/               # Node.js API server
│   ├── server.js          # Express server entry point
│   ├── routes/            # API endpoints
│   ├── controllers/       # Business logic
│   ├── services/          # External API integration
│   └── middleware/        # Express middleware
├── database/              # MySQL schema and seed data
│   ├── schema.sql         # Database structure
│   └── seed.sql           # Sample data
├── landing-page/          # Marketing website
│   ├── index.html         # Main landing page
│   └── downloads/         # Extension download files
├── .gitignore
└── README.md
```

---

## Browser Compatibility

**Supported:**
- Google Chrome (v90+)
- Microsoft Edge (v90+)
- Brave Browser (v1.20+)

**Not Supported:**
- Firefox (uses Manifest V2)
- Safari (uses WebExtensions format)

The extension uses Manifest V3, which is the Chrome/Edge standard.

---
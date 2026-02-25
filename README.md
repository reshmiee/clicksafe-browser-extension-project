# ClickSafe Browser Extension 🛡️

A unified, real-time browser security extension providing layered protection against HTTP connections, trackers, malicious links, and dangerous downloads.

## 📋 Table of Contents
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Features](#features)
- [Tech Stack](#tech-stack)

## 🚨 Problem Statement

In today's digital landscape, users face multiple security threats while browsing the internet. Many websites still use HTTP instead of HTTPS, exposing user data to interception. Websites deploy hidden trackers and cookies that collect user data without clear consent or awareness. Attackers disguise dangerous links to look legitimate, tricking users into clicking phishing sites and malware. Users also unknowingly download trojans, ransomware, and viruses from untrusted sources.

These threats result in serious consequences including financial losses from stolen banking and payment information, identity theft and privacy violations, malware infections and data breaches, and personal data harvesting by third parties.

Current solutions are inadequate because security tools are often separate, requiring multiple extensions. Many solutions lack real-time protection, and complex interfaces discourage regular users from using security tools effectively.

## 💡 Solution

ClickSafe is a unified, real-time browser security extension that provides layered protection across multiple threat vectors. Users can download the extension from our landing page. The extension combines various safety functionalities with a beautiful and easily navigable interface, making it accessible to everyone.

## ✨ Features

### 1. **Auto-HTTPS Redirect** 🔒
- Automatically redirects HTTP requests to HTTPS
- Visual indicator: Green icon for secure connections, red for insecure
- Protects data in transit without user intervention

### 2. **HTTPS Monitor** 👁️
- Monitors connection security in real-time
- Detects mixed content (HTTPS pages loading HTTP resources)
- Silent background monitoring with detailed logs

### 3. **Cookie Tracker Detector** 🍪
- Identifies and logs tracking cookies from third-party domains
- Distinguishes between analytics, advertising, and social media trackers
- Provides visibility into data collection practices

### 4. **Link Hover Preview** 🔍
- Real-time link safety verification before clicking
- Integration with Google Safe Browsing API
- Instant warning modals for malicious links
- Options to proceed or go back safely

### 5. **Suspicious Download Blocker** 🚫
- Intercepts downloads before they start
- Scans file URLs against threat databases
- Blocks malware, trojans, and ransomware automatically
- User override option with clear warnings

### 6. **Security Sidebar** 📊
- Quick-access panel showing current page security status
- Real-time statistics (trackers blocked, threats detected)
- One-click access to dashboard and settings

### 7. **Warning Modals** ⚠️
- Immediate alerts for dangerous links and downloads
- Clear action options with risk explanations
- Non-intrusive design that prioritizes user safety

### 8. **Settings Page** ⚙️
- Customizable feature toggles
- Whitelist management for trusted sites
- Adjustable sensitivity levels
- Reset to default options

## 🛠️ Tech Stack

**Frontend:** HTML5, Tailwind CSS, JavaScript, Browser APIs, Chart.js  
**Backend:** Node.js, Express.js  
**Database:** MySQL  
**External API:** Google Safe Browsing API v4

---


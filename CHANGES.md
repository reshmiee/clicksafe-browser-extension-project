# What Changed in v1.1.0

## Feature Overhaul 1 — Tracker Detection

**Before:** Hardcoded list of 11 tracker domains in content.js.
**After:** Checks against the full Disconnect.me blocklist (~70k domains).

How it works:
- `data/trackers.json` is a bundled seed list of ~178 high-priority trackers
- On extension startup, background.js loads the seed list into a Set immediately
- It then attempts to fetch the live Disconnect.me `services.json` from GitHub
- The live list is cached in chrome.storage for 24 hours so it only re-fetches once a day
- content.js no longer has any hardcoded domains — it sends each script/image/iframe
  hostname to background.js via message, and background checks against the Set
- Same-origin resources are skipped (not third-party, not trackers)

To update the bundled seed list manually:
  Download https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json
  Run: node scripts/build-tracker-list.js > frontend/data/trackers.json


## Feature Overhaul 2 — Link Checking (Privacy-First, Local Hash Lookup)

**Before:** Every hovered URL was sent to the backend to check against Google Safe Browsing.
           This meant your server saw every URL the user hovered over — a privacy problem.
**After:** Three-tier approach, URLs only leave the browser when necessary:

  Tier 1 — Whitelist check (instant, local)
    If the domain is in the user's whitelist → safe, done, nothing sent anywhere.

  Tier 2 — Local hash prefix check (fast, private)
    background.js maintains a local store of SHA-256 hash prefixes from the
    Safe Browsing Update API. The hovered URL is hashed locally and checked
    against this store. If no prefix match → safe, done, nothing sent anywhere.
    The prefix store is refreshed every 30 minutes.

  Tier 3 — Backend confirmation (only on prefix match)
    If a local prefix matches, background.js sends the full hash to the backend,
    which calls Google's fullHashes:find endpoint to confirm or deny.
    The full URL is NOT sent in this case — only the hash.
    If no local prefix store exists yet → falls back to full URL check on backend.

Backend changes:
- linkController.js now accepts an optional `hash` + `threatType` body param
- If present, calls safeBrowsingService.confirmHash() instead of checkUrl()
- confirmHash() uses the fullHashes:find endpoint — more precise, fewer false positives


## Files Changed
- frontend/content/content.js       — tracker detection overhauled
- frontend/background.js            — tracker Set + local hash check logic added
- frontend/manifest.json            — version bump, data/trackers.json added to web_accessible_resources
- frontend/data/trackers.json       — NEW: bundled seed tracker list
- backend/services/safeBrowsingService.js — confirmHash() function added
- backend/controllers/linkController.js   — hash confirmation path added

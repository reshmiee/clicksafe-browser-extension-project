# Frontend - Browser Extension

## Structure

```
frontend/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── tailwind.config.js     # Tailwind CSS configuration
├── input.css              # Tailwind source file
├── content/               # Content scripts and UI
│   ├── content.js         # Main content script
│   ├── sidebar/           # Security sidebar
│   ├── modal/             # Warning modals
│   └── styles/            # Compiled CSS
├── pages/                 # Full-page interfaces
│   └── settings/          # Settings page
├── assets/                # Static assets
│   ├── logo/              # Extension icons
│   ├── graphics/          # UI images
│   └── fonts/             # Custom fonts
└── utils/                 # Helper functions
    ├── api.js             # Backend communication
    ├── storage.js         # Chrome storage wrapper
    └── helpers.js         # Utility functions
```

## Setup

1. Install dependencies: `npm install`
2. Build CSS: `npx tailwindcss -i ./input.css -o ./content/styles/output.css --watch`
3. Load extension in Chrome: `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `frontend/` folder

## Files to Create

All files are currently empty placeholders. You'll need to implement:
- Extension logic in JavaScript files
- UI markup in HTML files
- Extension icons in assets/logo/

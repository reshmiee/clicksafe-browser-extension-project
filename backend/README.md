# Backend - Node.js API Server

## Structure

```
backend/
├── server.js              # Express server entry point
├── package.json           # Node.js dependencies
├── .env                   # Environment variables (DO NOT COMMIT)
├── routes/                # API endpoints
│   ├── checkLink.js       # POST /api/check-link
│   └── checkDownload.js   # POST /api/check-download
├── controllers/           # Business logic
│   ├── linkController.js
│   └── downloadController.js
├── services/              # External API calls
│   └── safeBrowsingService.js
├── middleware/            # Express middleware
│   ├── cors.js            # CORS configuration
│   ├── rateLimiter.js     # Rate limiting
│   └── errorHandler.js    # Error handling
└── config/                # Configuration
    └── database.js        # MySQL connection
```

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Start server: `node server.js`

## Environment Variables (.env)

```
GOOGLE_SAFE_BROWSING_API_KEY=your_api_key_here
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=clicksafe_db
DB_PORT=3306
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=chrome-extension://*
```

## Files to Create

All files are currently empty. You'll need to implement the API endpoints and business logic.

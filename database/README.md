# Database - MySQL Schema

## Structure

```
database/
├── schema.sql             # Database structure (CREATE TABLE statements)
└── seed.sql               # Sample data for testing
```

## Setup

1. Create database:
```sql
mysql -u root -p
CREATE DATABASE clicksafe_db;
USE clicksafe_db;
SOURCE schema.sql;
SOURCE seed.sql;  # Optional: Load sample data
```

2. Verify:
```sql
SHOW TABLES;
DESCRIBE checked_urls;
```

## Tables

### checked_urls
Caches URL safety check results to minimize API calls.

Columns:
- `id` - Primary key
- `url` - URL that was checked (up to 2048 characters)
- `is_safe` - Boolean (TRUE if safe, FALSE if dangerous)
- `threat_type` - Type of threat (MALWARE, PHISHING, etc.) or NULL
- `checked_at` - Timestamp of check (for cache expiration)

Cache retention: 24 hours

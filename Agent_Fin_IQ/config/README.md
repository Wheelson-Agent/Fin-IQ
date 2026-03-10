# Config Directory

This folder contains all application configuration files. You can modify these files without touching any source code.

## Files

| File | Purpose | Sensitive? |
|------|---------|-----------|
| `.env` | Database credentials, API keys, webhook URLs, JWT secret | **YES** — never commit |
| `app.config.json` | Tunables: DPI, timeouts, worker count, file paths | No |

## `.env` Keys

| Key | Description |
|-----|-------------|
| `DB_HOST` | PostgreSQL host address |
| `DB_PORT` | PostgreSQL port |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `DB_SSL` | SSL mode (`require` for cloud) |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | Path to Google Cloud service account JSON |
| `GOOGLE_PROJECT_ID` | Google Cloud project ID |
| `GOOGLE_LOCATION` | Document AI processor region |
| `GOOGLE_PROCESSOR_ID` | Document AI processor ID |
| `N8N_VALIDATION_URL` | n8n webhook for invoice validation |
| `N8N_TALLY_POST_URL` | n8n webhook for Tally Prime posting |
| `JWT_SECRET` | Secret key for auth token signing |

## `app.config.json` Keys

| Section | Key | Description |
|---------|-----|-------------|
| `preOcr.dpi` | | PNG rendering resolution (default 300) |
| `preOcr.maxFileSizeMB` | | Maximum upload file size |
| `ocr.concurrentWorkers` | | Parallel Python OCR processes |
| `paths.unprocessed` | | Incoming file drop folder |

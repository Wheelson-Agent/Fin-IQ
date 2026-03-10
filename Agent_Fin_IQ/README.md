# agent_ai_tally

**Intelligent Invoice Automation** — Desktop application for automated invoice processing with AI-powered OCR, Pre-OCR document cleanup, and Tally Prime integration.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Edit config/.env with your database and API credentials

# 3. Initialize database
psql "postgres://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require" -f backend/database/schema.sql

# 4. Install Python OCR dependencies
pip install google-cloud-documentai google-auth requests

# 5. Run the application
npm run electron:dev
```

## Architecture

```
agent_ai_tally/
├── config/           # All keys, passwords, tunables (edit here, not in code)
├── backend/          # Electron main process services
│   ├── auth/         # Role-based authentication (4 roles)
│   ├── database/     # PostgreSQL (5 tables, Aiven cloud + SSL)
│   ├── pre-ocr/      # 7-stage document cleanup pipeline
│   ├── ocr/          # Python ↔ Google Document AI bridge
│   └── sync/         # n8n webhook integration
├── frontend/         # React UI (14 pages, 8+ components)
│   ├── pages/        # One file = one page
│   ├── components/   # Reusable UI widgets
│   └── lib/          # TypeScript types + IPC client
├── electron/         # Desktop window + secure IPC bridge
└── tools/            # External binaries (mutool, pdftoppm)
```

## Processing Flow

```
File Upload → Pre-OCR Cleanup → Python OCR → n8n Validation → Tally Prime Posting
     ↓              ↓                ↓              ↓                  ↓
   PostgreSQL   Quality Score    Document AI    Rule Checking     Voucher Creation
```

## Performance

100 invoices processed in ~80 seconds using 5 parallel Python OCR workers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron |
| Frontend | React + TypeScript |
| Backend | Node.js (Electron main process) |
| Database | PostgreSQL (Aiven cloud, SSL) |
| OCR | Google Document AI (Python) |
| Automation | n8n webhooks |
| ERP | Tally Prime |

## Configuration

All settings in `config/` — no code changes needed for deployments.

| File | What You Edit |
|------|---------------|
| `config/.env` | Database credentials, API keys, webhook URLs |
| `config/app.config.json` | DPI settings, timeouts, worker count |

## Documentation

Every folder contains a `README.md` explaining its purpose, files, and usage.

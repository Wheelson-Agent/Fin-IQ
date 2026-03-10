# Backend

This is the core server-side logic of agent_ai_tally, running inside the Electron main process.

## Architecture

```
backend/
├── main.ts           # Entry point — wires all modules together
├── ipc.ts            # IPC handlers (frontend ↔ backend bridge)
├── auth/             # Role-based authentication
├── database/         # PostgreSQL connection, schema, queries
├── pre-ocr/          # Document cleanup pipeline (7 stages)
├── ocr/              # Python OCR bridge (Google Document AI)
└── sync/             # n8n webhook integration
```

## Data Flow

1. Frontend sends file via IPC → `ipc.ts`
2. `ipc.ts` → `pre-ocr/engine.ts` (cleanup)
3. Pre-OCR done → `ocr/bridge.ts` (spawn Python)
4. OCR result → `database/queries.ts` (save to PostgreSQL)
5. Saved → `sync/n8n.ts` (POST to validation webhook)
6. Approval → `sync/n8n.ts` (POST to Tally Prime webhook)

## Running

The backend is loaded automatically by `electron/main.js`. It does not run independently.

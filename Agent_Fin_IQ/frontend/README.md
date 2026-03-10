# Frontend

The React-based user interface for agent_ai_tally, running inside Electron's renderer process.

## Architecture

```
frontend/
├── main.tsx              # Entry point: React router setup
├── pages/                # One file = one page (named by feature)
│   ├── Dashboard.tsx
│   ├── InvoiceHub.tsx
│   ├── DetailView.tsx
│   ├── APMonitor.tsx
│   ├── AuditTrail.tsx
│   ├── PendingApprovalQueue.tsx
│   ├── FailedQueue.tsx
│   ├── Config.tsx
│   ├── Login.tsx
│   ├── AgentPage.tsx
│   ├── Reports.tsx
│   ├── Vendors.tsx
│   ├── UserProfile.tsx
│   └── NotFound.tsx
├── components/           # Shared, reusable UI widgets
│   ├── StatusBadge.tsx
│   ├── ConfidenceBar.tsx
│   ├── ProcessingPipeline.tsx
│   └── ...
└── lib/                  # Data types and API client
    ├── types.ts          # All TypeScript interfaces
    └── api.ts            # IPC calls to backend (replaces mockData.ts)
```

## Routing

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Executive overview with KPIs |
| `/invoices` | InvoiceHub | Upload, filter, search invoices |
| `/detail/:id` | DetailView | Single invoice verification |
| `/payables` | APMonitor | Vendor aging and risk |
| `/audit` | AuditTrail | System event history |
| `/config` | Config | System configuration |
| `/login` | Login | Authentication page |
| `/agent` | AgentPage | AI agent dashboard |
| `/reports` | Reports | Export and analytics |
| `/vendors` | Vendors | Vendor management |
| `/profile` | UserProfile | User settings |

## Data Flow

```
Frontend (React)
    ↕ IPC via window.api.invoke()
Backend (Electron Main Process)
    ↕ SQL Queries
PostgreSQL Database
```

## JSON Structure (IPC Channels)

| Channel | Input | Output |
|---------|-------|--------|
| `invoices:get-all` | none | `Invoice[]` |
| `invoices:get-by-id` | `{ id }` | `Invoice` |
| `invoices:upload` | `{ filePath, fileName, batchId? }` | `Invoice` |
| `invoices:update-status` | `{ id, status, userName? }` | `Invoice` |
| `invoices:status-counts` | none | `{ status, count }[]` |
| `vendors:get-all` | none | `Vendor[]` |
| `audit:get-logs` | none | `AuditEvent[]` |
| `processing:get-jobs` | `{ invoiceId }` | `ProcessingJob[]` |
| `auth:login` | `{ email, password }` | `{ success, user, token }` |

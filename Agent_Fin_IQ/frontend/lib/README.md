# Lib (Frontend Library)

Shared data types and API client for the frontend.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces (mirrors PostgreSQL columns exactly) |
| `api.ts` | IPC client functions — replaces `mockData.ts` with live database calls |

## Type ↔ Table Mapping

| Interface | PostgreSQL Table | Used By |
|-----------|-----------------|---------|
| `Invoice` | `invoices` | InvoiceHub, DetailView, Dashboard |
| `Vendor` | `vendors` + dynamic JOIN | APMonitor, Vendors |
| `AuditEvent` | `audit_logs` | AuditTrail |
| `ProcessingJob` | `processing_jobs` | ProcessingPipeline |
| `User` | `users` | Login, UserProfile |
| `StatusCount` | `invoices` (GROUP BY) | Dashboard KPIs |

## Usage

```tsx
import { getInvoices } from '../lib/api';
import type { Invoice } from '../lib/types';

const invoices: Invoice[] = await getInvoices();
```

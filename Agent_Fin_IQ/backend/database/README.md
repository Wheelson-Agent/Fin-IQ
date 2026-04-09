# Database Module

This module handles all PostgreSQL database operations for agent_ai_tally.

## Files

| File | Purpose |
|------|---------|
| `connection.ts` | Creates the PostgreSQL connection pool (reads from `config/.env`) |
| `schema.sql` | SQL statements to create all 5 tables and indexes |
| `queries.ts` | All read/write functions used by the application |

## Tables

| # | Table | Rows Represent | Used By |
|---|-------|---------------|---------|
| 1 | `invoices` | Each uploaded document | Doc Hub, Detail View, Dashboard |
| 2 | `vendors` | Vendor master records | Accounts Payable  Monitor, Vendor page |
| 3 | `audit_logs` | Every system action | Audit Trail page |
| 4 | `processing_jobs` | Pipeline stage tracking | Processing Pipeline UI |
| 5 | `users` | Login accounts & roles | Login, User Management |

## Design Decisions

- **Line items** are stored as JSONB inside `invoices.ocr_raw_data`, not in a separate table.
- **Vendor totals** (`total_due`, `invoice_count`) are calculated dynamically via SQL JOINs, not stored.
- **SSL** is required for the Aiven cloud PostgreSQL connection.

## Setup

Run `schema.sql` against your PostgreSQL instance:
```bash
psql "postgres://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require" -f schema.sql
```

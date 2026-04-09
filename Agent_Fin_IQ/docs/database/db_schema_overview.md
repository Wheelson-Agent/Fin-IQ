# Database Schema Overview

This document provides a detailed overview of the `agent_ai_tally` database schema and the relationships between its core entities.

## ER Diagram

```mermaid
erDiagram
    COMPANIES ||--o{ VENDORS : "has"
    COMPANIES ||--o{ LEDGER_MASTER : "manages"
    COMPANIES ||--o{ AP_INVOICES : "receives"
    COMPANIES ||--o{ PURCHASE_ORDERS : "places"
    COMPANIES ||--o{ ITEM_MASTER : "stocks"
    COMPANIES ||--o{ BATCHES : "processes"
    
    VENDORS ||--o{ PURCHASE_ORDERS : "supplies"
    VENDORS ||--o{ AP_INVOICES : "bill_to"
    
    LEDGER_MASTER ||--o{ ITEM_MASTER : "default_for"
    LEDGER_MASTER ||--o{ AP_INVOICE_LINES : "categorizes"
    LEDGER_MASTER ||--o{ PURCHASE_ORDER_LINES : "allocates"
    
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_LINES : "contains"
    PURCHASE_ORDERS ||--o{ AP_INVOICES : "linked_to"
    
    AP_INVOICES ||--o{ AP_INVOICE_LINES : "details"
    AP_INVOICES ||--o{ AP_INVOICE_TAXES : "calculates"
    
    ITEM_MASTER ||--o{ PURCHASE_ORDER_LINES : "ordered"
    ITEM_MASTER ||--o{ AP_INVOICE_LINES : "invoiced"

    COMPANIES {
        uuid id PK
        text name
        text gstin
        text tally_company_name
    }

    VENDORS {
        uuid id PK
        uuid company_id FK
        text name
        text gstin
        text vendor_code
    }

    LEDGER_MASTER {
        uuid id PK
        uuid company_id FK
        text name
        text parent_group
    }

    AP_INVOICES {
        uuid id PK
        uuid company_id FK
        uuid vendor_id FK
        uuid purchase_order_id FK
        uuid ledger_id FK
        text invoice_number
        decimal grand_total
        text processing_status
    }

    AP_INVOICE_LINES {
        uuid id PK
        uuid ap_invoice_id FK
        uuid item_id FK
        uuid gl_account_id FK
        text description
        decimal quantity
        decimal line_amount
    }

    PURCHASE_ORDERS {
        uuid id PK
        text po_number
        uuid vendor_id FK
        uuid company_id FK
    }

    ITEM_MASTER {
        uuid id PK
        uuid company_id FK
        text item_name
        uuid default_ledger_id FK
    }
```

## Core Entities & Relationships

### 1. Companies (`companies`)
The root entity. All data (vendors, invoices, ledgers) is partitioned by `company_id`. It also stores Tally integration settings (URL, company name, port).

### 2. Vendors (`vendors`)
Entities from whom the company purchases goods/services.
- **Relates to Companies**: Each vendor belongs to a specific company.
- **Relates to Invoices/POs**: Vendors are the source of `ap_invoices` and `purchase_orders`.

### 3. Accounts Payable  Invoices (`ap_invoices`)
The central transaction table in the Accounts Payable  Workspace.
- **Relates to Vendors**: Identifies who issued the invoice.
- **Relates to POs**: Optional link to a `purchase_order_id` for 2-way/3-way matching.
- **Relates to Ledgers**: Optional direct link to a `ledger_id` for expense booking.
- **Relates to Lines**: Contains multiple `ap_invoice_lines`.

### 4. Ledger Master (`ledger_master`)
The Chart of Accounts (COA) or Tally Ledgers.
- **Relates to Lines**: Each invoice line or PO line is mapped to a ledger for accounting purposes.

### 5. Purchase Orders (`purchase_orders`)
Authorized orders issued to vendors.
- **Relates to Vendors & Companies**: Linked to both for context.
- **Relates to Lines**: Contains `purchase_order_lines`.

### 6. Item Master (`item_master`)
The inventory or service catalog.
- **Relates to Ledgers**: Often has a `default_ledger_id` to automate accounting during data entry.
- **Relates to Lines**: PO and Invoice lines reference items from this master.

### 7. Support Tables
- **`batches`**: Groups multiple uploaded invoice files for processing.
- **`audit_logs`**: Tracks changes to entities (invoices, vendors).
- **`app_config`**: Stores company-specific settings and preferences.
- **`tally_sync_logs`**: Records the XML requests/responses during integration syncs.

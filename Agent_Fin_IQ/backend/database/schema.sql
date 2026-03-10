-- ============================================================
-- agent_ai_tally — PostgreSQL Database Schema
-- ============================================================
-- This file creates all 11 tables required by the application.
-- Run this once on your PostgreSQL instance to initialize.
--
-- Tables:
--   1. invoices         — Core document tracking (AP)
--   2. vendors          — Vendor / supplier master
--   3. audit_logs       — Every action logged
--   4. processing_jobs  — Pipeline stage tracking
--   5. users            — Role-based authentication
--   6. invoice_items    — Line items per invoice
--   7. companies        — Buyer organization(s)
--   8. app_config       — Key-value settings per company
--   9. ledger_masters   — GL accounts (expense + tax)
--  10. tds_sections     — TDS rates and sections
--  11. batches          — Upload batch tracking
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: invoices
-- Powers: Doc Hub, Detail View, Dashboard
-- Line items stored inside ocr_raw_data (JSONB), not separate table.
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name             TEXT NOT NULL,                      -- Original uploaded file name
    file_path             TEXT,                               -- Path to stored file on disk
    file_location         TEXT,                               -- Logical/Current physical location descriptive path
    batch_id              TEXT,                               -- Batch group identifier
    invoice_no            TEXT,                               -- Extracted invoice number
    vendor_name           TEXT,                               -- Extracted vendor name
    vendor_id             UUID,                               -- FK to vendors table (nullable until mapped)
    date                  DATE,                               -- Invoice date
    due_date              DATE,                               -- Payment due date
    amount                DECIMAL(15,2) DEFAULT 0,            -- Sub-total amount
    gst                   DECIMAL(15,2) DEFAULT 0,            -- GST amount
    total                 DECIMAL(15,2) DEFAULT 0,            -- Grand total (amount + gst)
    po_number             TEXT,                               -- Purchase order reference
    gl_account            TEXT,                               -- General ledger account
    status                TEXT DEFAULT 'Processing',          -- Processing | Pending Approval | Auto-Posted | Failed | Manual Review
    confidence            INT DEFAULT 0,                      -- AI trust score (0–100)
    processing_time       TEXT,                               -- Time taken to process
    validation_time       TEXT,                               -- Time spent in validation
    approval_delay_time  TEXT,                               -- Time spent waiting for approval
    failure_reason        TEXT,                               -- Why it failed
    failure_category      TEXT,                               -- Data Validation | Vendor Mismatch | etc.
    retry_count           INT DEFAULT 0,                      -- Number of retry attempts
    is_mapped             BOOLEAN DEFAULT false,              -- Vendor mapped in Tally?
    is_high_amount        BOOLEAN DEFAULT false,              -- Flagged for manual review?
    pre_ocr_status        TEXT,                               -- OCR_READY | ENHANCE_REQUIRED | FAILED
    pre_ocr_score         INT,                                -- Pre-OCR quality score
    ocr_raw_data          JSONB,                              -- Full JSON from Document AI
    n8n_validation_status TEXT DEFAULT 'pending',             -- pending | validated | rejected
    is_posted_to_tally    BOOLEAN DEFAULT false,              -- Successfully posted to Tally Prime?
    doc_type              TEXT,                               -- Document Type
    posted_to_tally_json  JSONB,                              -- Detailed Tally response
    all_data_invoice      JSONB,                              -- Original full invoice data
    uploader_name        TEXT DEFAULT 'System',              -- Who uploaded the file
    n8n_val_json_data    VARCHAR,                            -- Specialized validation data
    tally_id             TEXT,                               -- Tally master ID
    vendor_gst           VARCHAR,                            -- GSTIN captured on invoice
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE 2: vendors
-- Powers: AP Monitor, Vendor management page
-- NOTE: total_due and invoice_count are NOT stored here.
--        They are calculated dynamically via SQL JOINs:
--        SELECT v.*, COUNT(i.id), SUM(i.total)
--        FROM vendors v LEFT JOIN invoices i ON i.vendor_id = v.id
--        GROUP BY v.id
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,                      -- Vendor display name
    gstin                 TEXT,                               -- GST Identification Number
    under_group           TEXT DEFAULT 'Sundry Creditors',    -- Tally ledger group
    state                 TEXT,                               -- State for GST
    address               TEXT,                               -- Full billing address
    tds_nature            TEXT DEFAULT 'Any',                 -- TDS Nature of Payment
    total_due             DECIMAL(15,2) DEFAULT 0,            -- Cumulative due amount
    invoice_count         INT DEFAULT 0,                      -- Total bills from this vendor
    oldest_due            DATE,                               -- Oldest unpaid invoice date
    aging                 TEXT DEFAULT '0-30',                -- 0-30 | 31-60 | 61-90 | 90+
    status                TEXT DEFAULT 'Current',             -- Current | At Risk | Overdue
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE 6: invoice_items
-- Powers: Line items table in Detail View
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id            UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description           TEXT NOT NULL,
    ledger                TEXT,                               -- Tally expense ledger
    tax                   TEXT,                               -- Tax rate (e.g. 18%)
    quantity              DECIMAL(15,3) DEFAULT 1,
    rate                  DECIMAL(15,2) DEFAULT 0,
    discount              DECIMAL(5,2) DEFAULT 0,
    amount                DECIMAL(15,2) DEFAULT 0,            -- Calculated (qty * rate)
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE 3: audit_logs
-- Powers: Audit Trail page
-- Every action in the system is logged here.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id                    SERIAL PRIMARY KEY,
    invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
    invoice_no            TEXT,                               -- Invoice number (for display)
    vendor_name           TEXT,                               -- Vendor name (for display)
    event_type            TEXT NOT NULL,                      -- Created | Validated | Auto-Posted | Edited | Rejected | Approved
    user_name             TEXT DEFAULT 'System',              -- Who performed the action
    description           TEXT,                               -- Human-readable event description
    before_data           JSONB,                              -- State before change
    after_data            JSONB,                              -- State after change
    timestamp             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 4: processing_jobs
-- Powers: Pipeline status tracking in the UI
-- Each row = one stage of one invoice's processing journey.
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id            UUID REFERENCES invoices(id) ON DELETE CASCADE,
    stage                 TEXT NOT NULL,                      -- Upload | File Validation | Image Extraction | etc.
    status                TEXT DEFAULT 'NOT_STARTED',         -- NOT_STARTED | RUNNING | PASSED | FAILED | SKIPPED
    metrics               JSONB,                              -- Stage-specific metrics (DPI, blur score, etc.)
    error_message         TEXT,                               -- Error details if failed
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ
);

-- ============================================================
-- TABLE 5: users
-- Powers: Login page, Role-Based Access Control
-- Roles: admin, approver, operator, viewer
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 TEXT UNIQUE NOT NULL,               -- Login email
    password_hash         TEXT NOT NULL,                      -- bcrypt hashed password
    display_name          TEXT NOT NULL,                      -- Full name
    role                  TEXT DEFAULT 'viewer',              -- admin | approver | operator | viewer
    is_active             BOOLEAN DEFAULT true,               -- Account enabled?
    last_login            TIMESTAMPTZ,                        -- Last login timestamp
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Default admin user (password: admin123 — change immediately)
-- Hash generated with bcrypt, 10 rounds
-- ============================================================
INSERT INTO users (email, password_hash, display_name, role)
VALUES ('admin@agent-tally.local', '$2b$10$placeholder_hash_change_me', 'System Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- TABLE 7: companies
-- Powers: Config page, Topbar company filter, Tally connection
-- The buyer organization(s) using this system.
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,                      -- Registered company name
    trade_name            TEXT,                               -- Display / brand name
    type                  TEXT DEFAULT 'pvt_ltd',             -- pvt_ltd | ltd | llp | partnership | proprietorship | opc | trust
    gstin                 TEXT,                               -- Company GSTIN (destination of supply)
    pan                   TEXT,                               -- PAN for TDS
    cin                   TEXT,                               -- Corporate Identity Number
    tan                   TEXT,                               -- Tax Deduction Account Number
    address               TEXT,                               -- Registered address
    city                  TEXT,
    state                 TEXT,                               -- State = Destination of Supply
    pincode               TEXT,
    phone                 TEXT,
    email                 TEXT,
    website               TEXT,
    fy_start              TEXT DEFAULT 'april',               -- Financial year start month
    currency              TEXT DEFAULT 'INR',
    books_from            DATE,                               -- Books beginning date
    tally_server_url      TEXT DEFAULT 'http://localhost:9000',
    tally_company_name    TEXT,                               -- Must match Tally exactly
    tally_license_serial  TEXT,
    tally_auto_sync       BOOLEAN DEFAULT true,
    is_active             BOOLEAN DEFAULT false,              -- Currently selected company
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE 8: app_config
-- Powers: Config page settings persistence
-- Key-value settings per company (posting mode, approval criteria, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
    id                    SERIAL PRIMARY KEY,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    config_key            TEXT NOT NULL,                      -- e.g. 'posting_mode', 'approval_criteria'
    config_value          JSONB NOT NULL,                     -- Flexible JSON value
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, config_key)
);


-- ============================================================
-- TABLE 9: ledger_masters
-- Powers: DetailView line item Ledger dropdown
-- Expense accounts and tax ledgers (pre-seeded, optionally synced from Tally)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_masters (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,                      -- Ledger name (e.g. "IT Expenses")
    parent_group          TEXT NOT NULL,                      -- Tally group (e.g. "Indirect Expenses")
    ledger_type           TEXT DEFAULT 'expense',             -- expense | tax_gst | tax_tds | party
    tax_rate              DECIMAL(5,2),                       -- For tax ledgers: percentage (e.g. 9.00)
    tally_guid            TEXT,                               -- Tally's unique ID for sync
    is_active             BOOLEAN DEFAULT true,
    synced_at             TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE 10: tds_sections
-- Powers: DetailView TDS dropdown
-- Standard TDS sections and rates
-- ============================================================
CREATE TABLE IF NOT EXISTS tds_sections (
    id                    SERIAL PRIMARY KEY,
    section               TEXT NOT NULL,                      -- e.g. "194C"
    description           TEXT NOT NULL,                      -- "Payment to Contractors"
    rate_individual       DECIMAL(5,2),                       -- Rate for individuals (%)
    rate_company          DECIMAL(5,2),                       -- Rate for companies (%)
    threshold             DECIMAL(15,2),                      -- Annual threshold limit
    is_active             BOOLEAN DEFAULT true
);


-- ============================================================
-- TABLE 11: batches
-- Powers: InvoiceHub batch filter & batch modal
-- Tracks each group of files uploaded together
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    label                 TEXT NOT NULL,                      -- User-given batch name
    uploaded_by           TEXT DEFAULT 'System',              -- Uploader name
    file_count            INT DEFAULT 0,
    status                TEXT DEFAULT 'Processing',          -- Processing | Completed | Partial
    created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ALTER existing tables: add company_id FK
-- ============================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add missing columns to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pan TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tally_ledger_name TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_synced_from_tally BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS alias TEXT;

-- Vendor bank details (for payment processing)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;

-- E-invoicing columns on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS irn TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ack_no TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ack_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS eway_bill_no TEXT;

-- GST split columns on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS round_off DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_in_words TEXT;

-- Add missing columns to invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hsn_sac TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tds_section TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS order_no TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS part_no TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS possible_gl_names TEXT;


-- ============================================================
-- SEED: Ledger Masters (Expense Accounts)
-- These are standard Indian GL accounts for AP
-- company_id is NULL = global defaults for all companies
-- ============================================================
INSERT INTO ledger_masters (name, parent_group, ledger_type) VALUES
    ('IT Expenses',                'Indirect Expenses', 'expense'),
    ('Professional Fees',          'Indirect Expenses', 'expense'),
    ('Cloud Services',             'Indirect Expenses', 'expense'),
    ('Office Maintenance',         'Indirect Expenses', 'expense'),
    ('Printing & Stationery',      'Indirect Expenses', 'expense'),
    ('Marketing & Advertising',    'Indirect Expenses', 'expense'),
    ('Travelling Expenses',        'Indirect Expenses', 'expense'),
    ('Telephone & Internet',       'Indirect Expenses', 'expense'),
    ('Rent',                       'Indirect Expenses', 'expense'),
    ('Electricity & Power',        'Indirect Expenses', 'expense'),
    ('Insurance',                  'Indirect Expenses', 'expense'),
    ('Courier & Freight',          'Indirect Expenses', 'expense'),
    ('Employee Welfare',           'Indirect Expenses', 'expense'),
    ('Audit Fees',                 'Indirect Expenses', 'expense'),
    ('Subscription & Memberships', 'Indirect Expenses', 'expense')
ON CONFLICT DO NOTHING;

-- SEED: Tax Ledgers (GST Input Credit)
INSERT INTO ledger_masters (name, parent_group, ledger_type, tax_rate) VALUES
    ('CGST Input @9%',   'Duties & Taxes', 'tax_gst', 9.00),
    ('SGST Input @9%',   'Duties & Taxes', 'tax_gst', 9.00),
    ('IGST Input @18%',  'Duties & Taxes', 'tax_gst', 18.00),
    ('CGST Input @2.5%', 'Duties & Taxes', 'tax_gst', 2.50),
    ('SGST Input @2.5%', 'Duties & Taxes', 'tax_gst', 2.50),
    ('IGST Input @5%',   'Duties & Taxes', 'tax_gst', 5.00),
    ('CGST Input @6%',   'Duties & Taxes', 'tax_gst', 6.00),
    ('SGST Input @6%',   'Duties & Taxes', 'tax_gst', 6.00),
    ('IGST Input @12%',  'Duties & Taxes', 'tax_gst', 12.00),
    ('CGST Input @14%',  'Duties & Taxes', 'tax_gst', 14.00),
    ('SGST Input @14%',  'Duties & Taxes', 'tax_gst', 14.00),
    ('IGST Input @28%',  'Duties & Taxes', 'tax_gst', 28.00)
ON CONFLICT DO NOTHING;

-- SEED: TDS Sections
INSERT INTO tds_sections (section, description, rate_individual, rate_company, threshold) VALUES
    ('194C', 'Payment to Contractors',    1.00, 2.00,  30000),
    ('194J', 'Professional / Technical Fees', 10.00, 10.00, 30000),
    ('194I', 'Rent',                      10.00, 10.00, 240000),
    ('194H', 'Commission / Brokerage',     5.00,  5.00,  15000),
    ('194A', 'Interest (other than securities)', 10.00, 10.00, 40000),
    ('194D', 'Insurance Commission',       5.00,  5.00,  15000),
    ('194Q', 'Purchase of Goods',          0.10,  0.10, 5000000)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_batch ON invoices(batch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_masters_company ON ledger_masters(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_masters_type ON ledger_masters(ledger_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_invoice ON audit_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_invoice ON processing_jobs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_batches_company ON batches(company_id);

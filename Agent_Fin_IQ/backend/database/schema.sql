-- ============================================================
-- agent_ai_tally — PostgreSQL Database Schema
-- ============================================================
-- This file creates all tables required by the application in the correct dependency order.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MIGRATIONS / UPDATES FOR EXISTING TABLES (PRIORITY)
-- ============================================================

-- Rename gl_accounts to ledger_master if gl_accounts exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'gl_accounts') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_master') THEN
    ALTER TABLE gl_accounts RENAME TO ledger_master;
    
    -- Rename columns if they don't match the new schema
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_master' AND column_name='account_name') THEN
        ALTER TABLE ledger_master RENAME COLUMN account_name TO name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_master' AND column_name='account_code') THEN
        ALTER TABLE ledger_master RENAME COLUMN account_code TO ledger_code;
    END IF;
  END IF;
END $$;

-- If ledger_master exists but columns are missing, add them (handled by CREATE TABLE IF NOT EXISTS usually, but let's be safe for existing tables)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_master') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_master' AND column_name='parent_group') THEN
        ALTER TABLE ledger_master ADD COLUMN parent_group TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ledger_master' AND column_name='gst_details') THEN
        ALTER TABLE ledger_master ADD COLUMN gst_details JSONB;
    END IF;
  END IF;
END $$;

-- Update ap_invoices to have ledger_id
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ap_invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ap_invoices' AND column_name='ledger_id') THEN
      ALTER TABLE ap_invoices ADD COLUMN ledger_id UUID;
    END IF;
  END IF;
END $$;

-- Update ap_invoice_lines to have item_id and ledger_id
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ap_invoice_lines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ap_invoice_lines' AND column_name='item_id') THEN
      ALTER TABLE ap_invoice_lines ADD COLUMN item_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ap_invoice_lines' AND column_name='ledger_id') THEN
      ALTER TABLE ap_invoice_lines ADD COLUMN ledger_id UUID;
    END IF;
  END IF;
END $$;

-- Update purchase_order_lines to have item_id
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_order_lines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_order_lines' AND column_name='item_id') THEN
      ALTER TABLE purchase_order_lines ADD COLUMN item_id UUID;
    END IF;
  END IF;
END $$;

-- ============================================================
-- TABLE: companies (Base Entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    trade_name            TEXT,
    type                  TEXT DEFAULT 'pvt_ltd',
    gstin                 TEXT,
    tax_id                TEXT,
    pan                   TEXT,
    cin                   TEXT,
    tan                   TEXT,
    address               TEXT,
    city                  TEXT,
    state                 TEXT,
    pincode               TEXT,
    phone                 TEXT,
    email                 TEXT,
    website               TEXT,
    fy_start              TEXT DEFAULT 'april',
    currency              TEXT DEFAULT 'INR',
    base_currency_id      UUID,
    books_from            DATE,
    erp_sync_id           TEXT,
    integration_params    JSONB,
    tally_server_url      TEXT DEFAULT 'http://localhost:9000',
    tally_company_name    TEXT,
    tally_license_serial  TEXT,
    tally_auto_sync       BOOLEAN DEFAULT true,
    is_active             BOOLEAN DEFAULT false,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: app_config
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
    id                    SERIAL PRIMARY KEY,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    config_key            TEXT NOT NULL,
    config_value          JSONB NOT NULL,
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, config_key)
);

-- ============================================================
-- TABLE: batches
-- ============================================================
CREATE TABLE IF NOT EXISTS batches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    label                 TEXT NOT NULL,
    uploaded_by           TEXT DEFAULT 'System',
    file_count            INT DEFAULT 0,
    status                TEXT DEFAULT 'Processing',
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    vendor_code           TEXT,
    name                  TEXT NOT NULL,
    gstin                 TEXT,
    tax_id                TEXT,
    under_group           TEXT DEFAULT 'Sundry Creditors',
    state                 TEXT,
    address               TEXT,
    pan                   TEXT,
    city                  TEXT,
    pincode               TEXT,
    phone                 TEXT,
    email                 TEXT,
    tds_nature            TEXT DEFAULT 'Any',
    payment_term_id       UUID,
    payment_terms         TEXT,
    bank_name             TEXT,
    bank_account_no       TEXT,
    bank_ifsc             TEXT,
    erp_sync_id           TEXT,
    status                TEXT DEFAULT 'Active',
    tally_ledger_name     TEXT,
    is_synced_from_tally  BOOLEAN DEFAULT false,
    alias                 TEXT,
    oldest_due            DATE,
    aging                 TEXT DEFAULT '0-30',
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ledger_master (Formerly gl_accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_master (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    ledger_code           TEXT,
    name                  TEXT NOT NULL,
    account_type          TEXT DEFAULT 'expense',
    erp_sync_id           TEXT,
    parent_group          TEXT,  -- e.g., Indirect Expenses
    gst_details           JSONB, -- GST registration type, etc.
    is_active             BOOLEAN DEFAULT true,
    synced_at             TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Migrate existing data from gl_accounts if it exists
-- INSERT INTO ledger_master (id, company_id, name, account_type, erp_sync_id, parent_group, is_active, created_at)
-- SELECT id, company_id, account_name, account_type, erp_sync_id, parent_group, is_active, created_at FROM gl_accounts;

-- ============================================================
-- TABLE: tax_codes (Replaces tds_sections)
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_codes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    tax_code              TEXT NOT NULL,
    description           TEXT NOT NULL,
    rate_percentage       DECIMAL(5,2),
    tax_authority         TEXT,
    erp_sync_id           TEXT,
    is_active             BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: item_master (New Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS item_master (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    item_name             TEXT NOT NULL,
    item_code             TEXT, -- SKU/Part No
    hsn_sac               TEXT,
    uom                   TEXT DEFAULT 'Nos',
    base_price            DECIMAL(15,2),
    tax_rate              DECIMAL(5,2),
    default_ledger_id     UUID REFERENCES ledger_master(id) ON DELETE SET NULL,
    is_active             BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number             TEXT UNIQUE NOT NULL,
    vendor_id             UUID REFERENCES vendors(id) ON DELETE RESTRICT,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    po_date               DATE NOT NULL,
    total_amount          DECIMAL(15,2) DEFAULT 0,
    status                TEXT DEFAULT 'Open',
    erp_sync_id           TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: purchase_order_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id                 UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id               UUID REFERENCES item_master(id) ON DELETE SET NULL,
    line_number           INT NOT NULL,
    item_description      TEXT NOT NULL,
    quantity              DECIMAL(15,3) DEFAULT 1,
    unit_price            DECIMAL(15,2) DEFAULT 0,
    total_amount          DECIMAL(15,2) DEFAULT 0,
    gl_account_id         UUID REFERENCES ledger_master(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE: goods_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number            TEXT UNIQUE NOT NULL,
    po_id                 UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    vendor_id             UUID REFERENCES vendors(id) ON DELETE RESTRICT,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    receipt_date          DATE NOT NULL,
    status                TEXT DEFAULT 'Received',
    erp_sync_id           TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: goods_receipt_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receipt_lines (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id                UUID REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_line_id            UUID REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
    item_description      TEXT NOT NULL,
    received_quantity     DECIMAL(15,3) DEFAULT 0,
    accepted_quantity     DECIMAL(15,3) DEFAULT 0,
    rejected_quantity     DECIMAL(15,3) DEFAULT 0
);

-- ============================================================
-- TABLE: service_entry_sheets
-- ============================================================
CREATE TABLE IF NOT EXISTS service_entry_sheets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ses_number            TEXT UNIQUE NOT NULL,
    po_id                 UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    vendor_id             UUID REFERENCES vendors(id) ON DELETE RESTRICT,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    service_date          DATE NOT NULL,
    total_amount          DECIMAL(15,2) DEFAULT 0,
    status                TEXT DEFAULT 'Entered',
    erp_sync_id           TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: service_entry_sheet_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS service_entry_sheet_lines (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ses_id                UUID REFERENCES service_entry_sheets(id) ON DELETE CASCADE,
    po_line_id            UUID REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
    service_description   TEXT NOT NULL,
    completed_quantity    DECIMAL(15,3) DEFAULT 0,
    unit_price            DECIMAL(15,2) DEFAULT 0,
    line_amount           DECIMAL(15,2) DEFAULT 0
);

-- ============================================================
-- TABLE: ap_invoices (Replaces invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS ap_invoices (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    vendor_id             UUID REFERENCES vendors(id) ON DELETE SET NULL,
    purchase_order_id     UUID,
    ledger_id             UUID REFERENCES ledger_master(id) ON DELETE SET NULL,
    
    invoice_number        TEXT,
    invoice_date          DATE,
    due_date              DATE,
    sub_total             DECIMAL(15,2) DEFAULT 0,
    tax_total             DECIMAL(15,2) DEFAULT 0,
    grand_total           DECIMAL(15,2) DEFAULT 0,
    currency_id           UUID,
    
    processing_status     TEXT DEFAULT 'Draft',
    ocr_raw_payload       JSONB,
    
    erp_sync_id           TEXT,
    erp_sync_status       TEXT DEFAULT 'Pending',
    erp_sync_logs         JSONB,
    
    file_name             TEXT NOT NULL,
    file_path             TEXT,
    file_location         TEXT,
    batch_id              TEXT,
    vendor_name           TEXT,
    
    po_number             TEXT,
    gl_account            TEXT,
    processing_time       TEXT,
    validation_time       TEXT,
    approval_delay_time   TEXT,
    failure_reason        TEXT,
    failure_category      TEXT,
    retry_count           INT DEFAULT 0,
    is_mapped             BOOLEAN DEFAULT false,
    is_high_amount        BOOLEAN DEFAULT false,
    pre_ocr_status        TEXT,
    pre_ocr_score         INT,
    n8n_validation_status TEXT DEFAULT 'pending',
    is_posted_to_tally    BOOLEAN DEFAULT false,
    doc_type              TEXT,
    posted_to_tally_json  JSONB,
    all_data_invoice      JSONB,
    uploader_name         TEXT DEFAULT 'System',
    n8n_val_json_data     VARCHAR,
    tally_id              TEXT,
    vendor_gst            VARCHAR,
    irn                   TEXT,
    ack_no                TEXT,
    ack_date              DATE,
    eway_bill_no          TEXT,
    
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ap_invoice_lines (Replaces invoice_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS ap_invoice_lines (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_invoice_id         UUID REFERENCES ap_invoices(id) ON DELETE CASCADE,
    item_id               UUID REFERENCES item_master(id) ON DELETE SET NULL,
    line_number           INT,
    description           TEXT NOT NULL,
    quantity              DECIMAL(15,3) DEFAULT 1,
    unit_price            DECIMAL(15,2) DEFAULT 0,
    line_amount           DECIMAL(15,2) DEFAULT 0,
    gl_account_id         UUID REFERENCES ledger_master(id) ON DELETE SET NULL,
    cost_center_id        UUID,
    tax                   TEXT,
    discount              DECIMAL(5,2) DEFAULT 0,
    hsn_sac               TEXT,
    tds_section           TEXT,
    tds_amount            DECIMAL(15,2) DEFAULT 0,
    order_no              TEXT,
    unit                  TEXT,
    part_no               TEXT,
    possible_gl_names     TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: ap_invoice_taxes
-- ============================================================
CREATE TABLE IF NOT EXISTS ap_invoice_taxes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_invoice_id         UUID REFERENCES ap_invoices(id) ON DELETE CASCADE,
    tax_code_id           UUID REFERENCES tax_codes(id) ON DELETE CASCADE,
    tax_amount            DECIMAL(15,2),
    base_amount           DECIMAL(15,2)
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id                    SERIAL PRIMARY KEY,
    entity_name           TEXT,
    entity_id             UUID,
    invoice_id            UUID,
    invoice_no            TEXT,
    vendor_name           TEXT,
    event_type            TEXT NOT NULL,
    action                TEXT,
    changed_by_user_id    UUID,
    user_name             TEXT DEFAULT 'System',
    description           TEXT,
    before_data           JSONB,
    after_data            JSONB,
    old_values            JSONB,
    new_values            JSONB,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    batch_id              TEXT,
    entity_type           TEXT,
    event_code            TEXT,
    status_from           TEXT,
    status_to             TEXT,
    summary               TEXT,
    details               JSONB,
    is_user_visible       BOOLEAN,
    severity              TEXT,
    created_by_user_id    UUID,
    created_by_display_name TEXT,
    timestamp             TIMESTAMPTZ DEFAULT NOW(),
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: processing_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id            UUID REFERENCES ap_invoices(id) ON DELETE CASCADE,
    stage                 TEXT NOT NULL,
    status                TEXT DEFAULT 'NOT_STARTED',
    metrics               JSONB,
    error_message         TEXT,
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ
);

-- ============================================================
-- TABLE: tally_sync_logs (New Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS tally_sync_logs (
    id                    SERIAL PRIMARY KEY,
    company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
    entity_type           TEXT NOT NULL, -- 'invoice', 'ledger', 'item'
    entity_id             UUID NOT NULL,
    request_xml           TEXT,
    response_xml          TEXT,
    status                TEXT, -- 'Success', 'Error'
    error_message         TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: integration_queues
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_queues (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type           TEXT NOT NULL,
    entity_id             UUID NOT NULL,
    target_erp            TEXT NOT NULL,
    payload               JSONB,
    status                TEXT DEFAULT 'Queued',
    retry_count           INT DEFAULT 0,
    error_message         TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: outbound_delivery_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS outbound_delivery_logs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
    delivery_type         TEXT NOT NULL, -- e.g. ap_summary_digest
    channel               TEXT NOT NULL, -- e.g. email, whatsapp, teams
    provider              TEXT,
    recipients            JSONB NOT NULL DEFAULT '[]'::jsonb,
    subject               TEXT,
    status                TEXT NOT NULL,
    provider_message_id   TEXT,
    request_payload       JSONB,
    response_payload      JSONB,
    error_message         TEXT,
    triggered_by_user_id  UUID,
    triggered_by_display_name TEXT,
    sent_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 TEXT UNIQUE NOT NULL,
    password_hash         TEXT NOT NULL,
    display_name          TEXT NOT NULL,
    role                  TEXT DEFAULT 'viewer',
    is_active             BOOLEAN DEFAULT true,
    last_login            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (email, password_hash, display_name, role)
VALUES ('admin@agent-tally.local', '$2b$10$placeholder_hash_change_me', 'System Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO ledger_master (name, parent_group, account_type) VALUES
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

INSERT INTO tax_codes (tax_code, description, rate_percentage, tax_authority) VALUES
    ('CGST9',   'CGST Input @9%',   9.00, 'GST'),
    ('SGST9',   'SGST Input @9%',   9.00, 'GST'),
    ('IGST18',  'IGST Input @18%', 18.00, 'GST'),
    ('194C-Ind', '194C Payment to Contractors (Individual)', 1.00, 'TDS'),
    ('194C-Co',  '194C Payment to Contractors (Company)',    2.00, 'TDS'),
    ('194J',     '194J Professional / Technical Fees',       10.00, 'TDS'),
    ('194I',     '194I Rent',                                10.00, 'TDS')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE: ledger_suggestion_history
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_suggestion_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    line_type       TEXT NOT NULL CHECK (line_type IN ('goods', 'services')),
    item_id         UUID REFERENCES item_master(id) ON DELETE SET NULL,
    gl_account_id   UUID REFERENCES ledger_master(id) ON DELETE SET NULL,
    confirmed_count INT DEFAULT 1,
    last_confirmed  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, description, line_type)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ap_invoices_status ON ap_invoices(processing_status);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_vendor ON ap_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_date ON ap_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_company ON ap_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_master_company ON ledger_master(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_master_type ON ledger_master(account_type);
CREATE INDEX IF NOT EXISTS idx_item_master_company ON item_master(company_id);
CREATE INDEX IF NOT EXISTS idx_tally_sync_logs_company ON tally_sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_tally_sync_logs_entity ON tally_sync_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_invoice ON audit_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_invoice_ts ON audit_logs(invoice_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_timestamp ON audit_logs(company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_timestamp ON audit_logs(batch_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_code_timestamp ON audit_logs(event_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_visible_timestamp ON audit_logs(is_user_visible, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_invoice ON processing_jobs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_integration_queues_entity ON integration_queues(entity_id);
CREATE INDEX IF NOT EXISTS idx_batches_company ON batches(company_id);
CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_company_created ON outbound_delivery_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_channel_created ON outbound_delivery_logs(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_delivery_logs_status_created ON outbound_delivery_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_suggestion_history_company ON ledger_suggestion_history(company_id, line_type);
CREATE INDEX IF NOT EXISTS idx_ledger_suggestion_history_desc ON ledger_suggestion_history(company_id, description);

-- Audit logs: event_type CHECK constraint (drop-and-recreate to stay in sync with new types)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_audit_logs_event_type'
      AND conrelid = 'audit_logs'::regclass
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT chk_audit_logs_event_type;
  END IF;
  ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_logs_event_type
    CHECK (event_type IN (
      'Created', 'Edited', 'Approved', 'Rejected',
      'Auto-Posted', 'Deleted', 'Validated', 'Revalidated', 'Processed'
    ));
END $$;

-- Update companies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='tally_port') THEN
    ALTER TABLE companies ADD COLUMN tally_port INT DEFAULT 9000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='tally_version') THEN
    ALTER TABLE companies ADD COLUMN tally_version TEXT;
  END IF;
END $$;

-- Migrate audit_logs: add columns that were added after the table was first created.
-- Each block is safe to run repeatedly (IF NOT EXISTS guard).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_type') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_name') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity_id') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='event_code') THEN
    ALTER TABLE audit_logs ADD COLUMN event_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='summary') THEN
    ALTER TABLE audit_logs ADD COLUMN summary TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='batch_id') THEN
    ALTER TABLE audit_logs ADD COLUMN batch_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='status_from') THEN
    ALTER TABLE audit_logs ADD COLUMN status_from TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='status_to') THEN
    ALTER TABLE audit_logs ADD COLUMN status_to TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='details') THEN
    ALTER TABLE audit_logs ADD COLUMN details JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='is_user_visible') THEN
    ALTER TABLE audit_logs ADD COLUMN is_user_visible BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='severity') THEN
    ALTER TABLE audit_logs ADD COLUMN severity TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='created_by_user_id') THEN
    ALTER TABLE audit_logs ADD COLUMN created_by_user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='created_by_display_name') THEN
    ALTER TABLE audit_logs ADD COLUMN created_by_display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='company_id') THEN
    ALTER TABLE audit_logs ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='old_values') THEN
    ALTER TABLE audit_logs ADD COLUMN old_values JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='new_values') THEN
    ALTER TABLE audit_logs ADD COLUMN new_values JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='changed_by_user_id') THEN
    ALTER TABLE audit_logs ADD COLUMN changed_by_user_id UUID;
  END IF;
END $$;

-- Backfill company_id on audit_logs rows that were written before auto-resolve was added
UPDATE audit_logs al
SET company_id = inv.company_id
FROM ap_invoices inv
WHERE al.invoice_id = inv.id
  AND al.company_id IS NULL
  AND inv.company_id IS NOT NULL;

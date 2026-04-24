/**
 * ============================================================
 * lib/types.ts — All TypeScript Interfaces
 * ============================================================
 *
 * PURPOSE:
 *   Centralized type definitions for the entire frontend.
 *   Every page and component imports types from here.
 *   These types mirror the PostgreSQL table columns exactly.
 * ============================================================
 */

// ─── INVOICE ──────────────────────────────────────────────

/**
 * Represents a single invoice document in the system.
 * Maps to: invoices table in PostgreSQL
 * Used by: InvoiceHub, DetailView, Dashboard
 */
export interface Invoice {
    id: string;
    file_name: string;
    file_path: string;
    file_location: string | null;
    batch_id: string | null;
    invoice_no: string | null;
    vendor_name: string | null;
    vendor_id: string | null;
    date: string | null;
    due_date: string | null;
    amount: number;
    gst: number;
    total: number;
    po_number: string | null;
    gl_account: string | null;
    status: InvoiceStatus;
    processing_time: string | null;
    failure_reason: string | null;
    failure_category: string | null;
    retry_count: number;
    is_mapped: boolean;
    is_high_amount: boolean;
    pre_ocr_status: string | null;
    pre_ocr_score: number | null;
    ocr_raw_data: Record<string, any> | null;
    n8n_validation_status: string;
    is_posted_to_tally: boolean;
    doc_type: string | null;
    posted_to_tally_json: Record<string, any> | null;
    all_data_invoice: Record<string, any> | null;
    n8n_val_json_data: string | null;
    po_validation_json?: Record<string, any> | string | null;
    // Purchase Price Variation result — populated by the PPV rule when
    // enabled in Control Hub. Shape: { status, threshold_pct, failed_lines[], ... }.
    pricing_validation_json?: Record<string, any> | string | null;
    tally_id: string | null;
    uploader_name: string;
    created_at: string;

    // Added columns
    company_id?: string | null;
    irn?: string | null;
    ack_no?: string | null;
    ack_date?: string | null;
    eway_bill_no?: string | null;
    invoice_number?: string | null;
    cgst?: number;
    sgst?: number;
    round_off?: number;
    total_in_words?: string | null;

    updated_at: string;
    erp_sync_id?: string | null;
    items?: InvoiceItem[];
    vendor_gst?: string;
    validation_time?: string;
    ledger_id?: string | null; // Formal link to ledger_master
}


/**
 * Represents a single line item in an invoice.
 */
export interface InvoiceItem {
    id: string;
    invoice_id: string;
    description: string;
    ledger: string | null;
    tax: string | null;
    quantity: number;
    rate: number;
    discount: number;
    amount: number;

    // Added columns
    hsn_sac?: string | null;
    tds_section?: string | null;
    tds_amount?: number;
    order_no?: string | null;
    unit?: string | null;
    part_no?: string | null;
    possible_gl_names?: string | null;
    item_id?: string | null; // Formal link to item_master

    created_at: string;
}


/**
 * Valid invoice status values.
 */
export type InvoiceStatus =
    | 'Processing'
    | 'Pending Approval'
    | 'Auto-Posted'
    | 'Approved'
    | 'Failed'
    | 'Manual Review'
    | 'Ready to Post'
    | 'Awaiting Input';

// ─── VENDOR ───────────────────────────────────────────────

/**
 * Represents a vendor/supplier.
 * Maps to: vendors table + dynamic calculations from invoices.
 * Used by: APMonitor, Vendors page
 */
export interface Vendor {
    id: string;
    name: string;
    gstin: string | null;
    under_group: string;
    state: string | null;
    address: string | null;
    tds_nature: string | null;
    oldest_due: string | null;
    aging_bucket: string;
    status: 'Current' | 'At Risk' | 'Overdue';
    created_at: string;

    // Added columns
    company_id?: string | null;
    pan?: string | null;
    city?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    payment_terms?: string | null;
    tally_ledger_name?: string | null;
    is_synced_from_tally?: boolean;
    alias?: string | null;
    bank_name?: string | null;
    bank_account_no?: string | null;
    bank_ifsc?: string | null;
    vendor_code?: string | null;
    tax_id?: string | null;

    // Dynamically calculated (not stored in DB)
    invoice_count: number;
    total_due: number;
    oldest_due_calc: string | null;
}

// ─── AUDIT EVENT ──────────────────────────────────────────

/**
 * Represents a logged system action.
 * Maps to: audit_logs table.
 * Used by: AuditTrail page
 */
export interface AuditEvent {
    id: number;
    invoice_id: string | null;
    invoice_no: string | null;
    vendor_name: string | null;
    event_type: 'Created' | 'Validated' | 'Auto-Posted' | 'Edited' | 'Revalidated' | 'Rejected' | 'Approved' | 'Deleted' | 'Processed';
    user_name: string;
    description: string;
    before_data: Record<string, any> | null;
    after_data: Record<string, any> | null;
    timestamp: string;
}

// ─── PROCESSING JOB ──────────────────────────────────────

/**
 * Represents one stage of the processing pipeline.
 * Maps to: processing_jobs table.
 * Used by: ProcessingPipeline component, DetailView timeline
 */
export interface ProcessingJob {
    id: string;
    invoice_id: string;
    stage: string;
    status: 'NOT_STARTED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
    metrics: Record<string, any> | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
}

// ─── USER ─────────────────────────────────────────────────

/**
 * Represents a user account.
 * Maps to: users table (password_hash excluded in frontend).
 * Used by: Login page, UserProfile, admin panel
 */
export interface User {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'approver' | 'operator' | 'viewer';
    is_active: boolean;
    last_login: string | null;
    created_at: string;
}

// ─── STATUS COUNT ─────────────────────────────────────────

/**
 * Invoice count grouped by status.
 * Used by: Dashboard KPI chips
 */
export interface StatusCount {
    status: string;
    count: number;
}

// ─── MASTERS & CONFIG ─────────────────────────────────────

/**
 * Represents a GL account (expense or tax).
 * Maps to: ledger_masters table.
 */
export interface LedgerMaster {
    id: string;
    name: string;
    parent_group: string;
    ledger_type: 'expense' | 'tax_gst' | 'tax_tds' | 'party';
    tax_rate: number | null;
    is_active: boolean;
}

/**
 * Represents a TDS section and its rates.
 * Maps to: tds_sections table.
 */
export interface TdsSection {
    id: number;
    section: string;
    description: string;
    rate_individual: number;
    rate_company: number;
    threshold: number;
}

/**
 * Represents the buyer organization using the software.
 * Maps to: companies table.
 */
export interface Company {
    id: string;
    name: string;
    trade_name: string | null;
    gstin: string | null;
    state: string | null;
    tally_port?: number;
    tally_version?: string;
    is_active: boolean;
}

/**
 * Represents a stock item or service.
 * Maps to: item_master table.
 */
export interface ItemMaster {
    id: string;
    company_id: string;
    item_name: string;
    item_code: string | null;
    hsn_sac: string | null;
    uom: string;
    base_price: number | null;
    tax_rate: number | null;
    default_ledger_id: string | null;
    is_active: boolean;
    created_at: string;
}

/**
 * Log of Tally XML exchange.
 * Maps to: tally_sync_logs table.
 */
export interface TallySyncLog {
    id: number;
    company_id: string;
    entity_type: 'invoice' | 'ledger' | 'item';
    entity_id: string;
    request_xml: string | null;
    response_xml: string | null;
    status: 'Success' | 'Error';
    error_message: string | null;
    created_at: string;
}

// ─── ERP MODULES ──────────────────────────────────────────

export interface PurchaseOrder {
    id: string;
    po_number: string;
    po_date: string;
    vendor_id: string;
    company_id: string;
    grand_total: number;
    currency: string;
    status: string;
    created_at: string;
}

export interface GoodsReceipt {
    id: string;
    grn_number: string;
    receipt_date: string;
    po_id: string | null;
    company_id: string;
    status: string;
    created_at: string;
}

export interface ServiceEntrySheet {
    id: string;
    ses_number: string;
    service_date: string;
    po_id: string | null;
    company_id: string;
    status: string;
    created_at: string;
}

// ─── DASHBOARD ──────────────────────────────────────────────

export interface DashboardMetrics {
    totalInvoices: number;
    totalAmount: number;
    pendingApproval: number;
    statusCounts: StatusCount[];
    netThisMonth: {
        amount: number;
        count: number;
        trendPct: number;
    };
}

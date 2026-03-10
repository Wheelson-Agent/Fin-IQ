/**
 * ============================================================
 * database/queries.ts — All Database Read/Write Operations
 * ============================================================
 *
 * PURPOSE:
 *   Centralized database operations for all tables.
 *   Every function is documented with its purpose, parameters,
 *   and return type. Frontend never writes SQL directly.
 *
 * TABLES COVERED:
 *   - invoices
 *   - vendors
 *   - audit_logs
 *   - processing_jobs
 *   - users
 * ============================================================
 */

import { query } from './connection';

// ─────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all invoices, ordered by most recent first.
 * Used by: Doc Hub, Dashboard KPI calculations.
 *
 * @returns Array of invoice rows
 */
export async function getAllInvoices() {
    const result = await query(`
    SELECT * FROM invoices 
    ORDER BY created_at DESC
  `);
    return result.rows;
}

/**
 * Fetch a single invoice by its UUID.
 * Used by: Detail View page.
 *
 * @param id - Invoice UUID
 * @returns Single invoice row or null
 */
export async function getInvoiceById(id: string) {
    const result = await query('SELECT * FROM invoices WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/**
 * Insert a new invoice record (initial upload, before OCR).
 * Used by: File upload handler in ipc.ts
 *
 * @param data - Partial invoice data (file_name, batch_id, status)
 * @returns The newly created invoice row
 */
export async function createInvoice(data: {
    file_name: string;
    file_path: string;
    file_location?: string;
    batch_id?: string;
    status?: string;
    uploader_name?: string;
}) {
    const result = await query(
        `INSERT INTO invoices (file_name, file_path, file_location, batch_id, status, uploader_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [data.file_name, data.file_path, data.file_location || data.file_path, data.batch_id || null, data.status || 'Processing', data.uploader_name || 'System']
    );
    return result.rows[0];
}

/**
 * Update an invoice with OCR extraction results.
 * Called after the Python OCR script completes.
 *
 * @param id   - Invoice UUID
 * @param data - Extracted fields from Document AI
 * @returns Updated invoice row
 */
export async function updateInvoiceWithOCR(id: string, data: {
    invoice_no?: string;
    vendor_name?: string;
    date?: string;
    due_date?: string;
    amount?: number;
    gst?: number;
    total?: number;
    po_number?: string;
    gl_account?: string;
    confidence?: number;
    ocr_raw_data?: object;
    status?: string;
    processing_time?: string;
    doc_type?: string;
    posted_to_tally_json?: object;
    all_data_invoice?: object;
    file_location?: string;
    file_path?: string;
    tally_id?: string;
    uploader_name?: string;
    vendor_id?: string;
    is_mapped?: boolean;
    vendor_gst?: string;
    validation_time?: string;
}) {
    const result = await query(

        `UPDATE invoices SET
       invoice_no = COALESCE($2, invoice_no),
       vendor_name = COALESCE($3, vendor_name),
       date = COALESCE($4::date, date),
       due_date = COALESCE($5::date, due_date),
       amount = COALESCE($6, amount),
       gst = COALESCE($7, gst),
       total = COALESCE($8, total),
       po_number = COALESCE($9, po_number),
       gl_account = COALESCE($10, gl_account),
       confidence = COALESCE($11, confidence),
       ocr_raw_data = COALESCE($12::jsonb, ocr_raw_data),
       status = COALESCE($13, status),
       processing_time = COALESCE($14, processing_time),
       doc_type = COALESCE($15, doc_type),
       posted_to_tally_json = COALESCE($16::jsonb, posted_to_tally_json),
       all_data_invoice = COALESCE($17::jsonb, all_data_invoice),
       file_location = COALESCE($18, file_location),
       file_path = COALESCE($19, file_path),
       tally_id = COALESCE($20, tally_id),
       uploader_name = COALESCE($21, uploader_name),
       vendor_id = COALESCE($22::uuid, vendor_id),
       is_mapped = COALESCE($23, is_mapped),
       vendor_gst = COALESCE($24, vendor_gst),
       validation_time = COALESCE($25, validation_time),
       updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
        [
            id,
            data.invoice_no, data.vendor_name, data.date, data.due_date,
            data.amount, data.gst, data.total, data.po_number, data.gl_account,
            data.confidence, data.ocr_raw_data ? JSON.stringify(data.ocr_raw_data) : null,
            data.status, data.processing_time,
            data.doc_type,
            data.posted_to_tally_json ? JSON.stringify(data.posted_to_tally_json) : null,
            data.all_data_invoice ? JSON.stringify(data.all_data_invoice) : null,
            data.file_location,
            data.file_path,
            data.tally_id,
            data.uploader_name,
            data.vendor_id,
            data.is_mapped,
            data.vendor_gst,
            data.validation_time
        ]
    );


    return result.rows[0];
}

/**
 * Update the status of an invoice (approve, reject, post, fail).
 * Used by: DetailView approve/reject buttons, n8n sync callback.
 *
 * @param id     - Invoice UUID
 * @param status - New status string
 * @returns Updated invoice row
 */
export async function updateInvoiceStatus(id: string, status: string) {
    const result = await query(
        `UPDATE invoices SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, status]
    );
    return result.rows[0];
}

/**
 * Update an invoice as failed with a corresponding failure reason and category.
 * Used by: pre-ocr pipeline when an validation or rasterization fails.
 *
 * @param id             - Invoice UUID
 * @param failure_reason - Detailed error string 
 * @param pre_ocr_status - Status code from the pipeline (e.g., FAILED)
 * @returns Updated invoice row
 */
export async function updateInvoiceFailureReason(id: string, failure_reason: string, pre_ocr_status?: string) {
    const result = await query(
        `UPDATE invoices SET status = 'Failed', failure_reason = $2, pre_ocr_status = COALESCE($3, pre_ocr_status), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, failure_reason, pre_ocr_status || null]
    );
    return result.rows[0];
}

/**
 * Mark an invoice as posted to Tally Prime.
 *
 * @param id - Invoice UUID
 * @param responseJson - Detailed response from Tally Prime
 * @param tallyId - Reference ID returned by Tally
 */
export async function markPostedToTally(id: string, responseJson?: object, tallyId?: string) {
    await query(
        `UPDATE invoices SET 
          is_posted_to_tally = true, 
          status = 'Auto-Posted', 
          posted_to_tally_json = COALESCE($2::jsonb, posted_to_tally_json),
          tally_id = COALESCE($3, tally_id),
          updated_at = NOW() 
        WHERE id = $1`,
        [id, responseJson ? JSON.stringify(responseJson) : null, tallyId || null]
    );
}

/**
 * Get invoice counts grouped by status.
 * Used by: Dashboard KPI chips, Doc Hub summary.
 *
 * @returns Object with status counts
 */
export async function getInvoiceStatusCounts() {
    const result = await query(`
    SELECT status, COUNT(*)::int as count
    FROM invoices
    GROUP BY status
  `);
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// MASTERS & COMPANIES
// ─────────────────────────────────────────────────────────────

export async function getLedgerMasters(companyId?: string) {
    let sql = `SELECT * FROM ledger_masters WHERE is_active = true`;
    const params: any[] = [];

    // Optional company filtering, though expense/tax ledgers might be global (NULL)
    if (companyId) {
        sql += ` AND (company_id = $1 OR company_id IS NULL)`;
        params.push(companyId);
    }
    sql += ` ORDER BY ledger_type, name`;

    const { rows } = await query(sql, params);
    return rows;
}

export async function getTdsSections() {
    const { rows } = await query(`SELECT * FROM tds_sections WHERE is_active = true ORDER BY section`);
    return rows;
}

export async function getActiveCompany() {
    const { rows } = await query(`SELECT * FROM companies WHERE is_active = true LIMIT 1`);
    return rows[0] || null;
}


// ─────────────────────────────────────────────────────────────
// VENDORS (with dynamic calculations)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all vendors with dynamically calculated total_due and invoice_count.
 * These values are computed from the invoices table, NOT stored.
 * Used by: AP Monitor, Vendor management page.
 *
 * @returns Array of vendor rows with calculated fields
 */
export async function getAllVendors() {
    const result = await query(`
    SELECT 
      v.*,
      COALESCE(COUNT(i.id), 0)::int AS invoice_count,
      COALESCE(SUM(CASE WHEN i.is_posted_to_tally = false THEN i.total ELSE 0 END), 0) AS total_due,
      MIN(CASE WHEN i.is_posted_to_tally = false THEN i.due_date END) AS oldest_due_calc
    FROM vendors v
    LEFT JOIN invoices i ON i.vendor_id = v.id
    GROUP BY v.id
    ORDER BY v.name ASC
  `);
    return result.rows;
}

/**
 * Fetch a single vendor by ID.
 */
export async function getVendorById(id: string) {
    const result = await query('SELECT * FROM vendors WHERE id = $1', [id]);
    return result.rows[0];
}

/**
 * Create or find a vendor by name.

 * Used when OCR extracts a vendor name that isn't mapped yet.
 *
 * @param name  - Vendor display name
 * @param gstin - GST number (optional)
 * @returns Vendor row (existing or newly created)
 */
export async function upsertVendor(name: string, gstin?: string) {
    const existing = await query('SELECT * FROM vendors WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing.rows.length > 0) return existing.rows[0];

    const result = await query(
        `INSERT INTO vendors (name, gstin) VALUES ($1, $2) RETURNING *`,
        [name, gstin || null]
    );
    return result.rows[0];
}

/**
 * Save a vendor with full master details.
 * Used by: Detail View "Create & Map Vendor" slide-out.
 */
export async function saveVendor(data: {
    id?: string;
    name: string;
    gstin?: string;
    under_group?: string;
    state?: string;
    address?: string;
    tds_nature?: string;
}) {
    if (data.id) {
        const result = await query(
            `UPDATE vendors SET 
        name = $2, gstin = $3, under_group = $4, state = $5, address = $6, tds_nature = $7
        WHERE id = $1 RETURNING *`,
            [data.id, data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature]
        );
        return result.rows[0];
    } else {
        const result = await query(
            `INSERT INTO vendors (name, gstin, under_group, state, address, tds_nature)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature]
        );
        return result.rows[0];
    }
}

// ─────────────────────────────────────────────────────────────
// INVOICE ITEMS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all items for a specific invoice.
 * Used by: Detail View items table.
 */
export async function getInvoiceItems(invoiceId: string) {
    const result = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC', [invoiceId]);
    return result.rows;
}

/**
 * Save multiple items for an invoice. 
 * This performs a "delete and insert" to ensure the list matches exactly.
 */
export async function saveInvoiceItems(invoiceId: string, items: any[]) {
    // 1. Delete existing items
    await query('DELETE FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    // 2. Insert new items
    if (items.length === 0) return [];

    const results = [];
    for (const item of items) {
        const res = await query(
            `INSERT INTO invoice_items 
        (invoice_id, description, ledger, tax, quantity, rate, discount, amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                invoiceId, item.description, item.ledger, item.tax,
                item.quantity || 1, item.rate || 0, item.discount || 0,
                item.amount || (Number(item.quantity || 1) * Number(item.rate || 0))
            ]
        );
        results.push(res.rows[0]);
    }
    return results;
}


// ─────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────

/**
 * Log an audit event for any action in the system.
 * Used by: Every status change, approval, rejection, edit.
 *
 * @param data - Audit event data
 */
export async function createAuditLog(data: {
    invoice_id?: string;
    invoice_no?: string;
    vendor_name?: string;
    event_type: string;
    user_name?: string;
    description: string;
    before_data?: object;
    after_data?: object;
}) {
    await query(
        `INSERT INTO audit_logs (invoice_id, invoice_no, vendor_name, event_type, user_name, description, before_data, after_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
        [
            data.invoice_id || null, data.invoice_no || null, data.vendor_name || null,
            data.event_type, data.user_name || 'System', data.description,
            data.before_data ? JSON.stringify(data.before_data) : null,
            data.after_data ? JSON.stringify(data.after_data) : null,
        ]
    );
}

/**
 * Fetch all audit events, ordered by most recent first.
 * Used by: Audit Trail page.
 *
 * @returns Array of audit event rows
 */
export async function getAuditLogs() {
    const result = await query(`
    SELECT * FROM audit_logs 
    ORDER BY timestamp DESC 
    LIMIT 500
  `);
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// PROCESSING JOBS
// ─────────────────────────────────────────────────────────────

/**
 * Create a processing job record for a pipeline stage.
 *
 * @param invoiceId - Parent invoice UUID
 * @param stage     - Stage name (e.g. "File Validation")
 * @returns Created job row
 */
export async function createProcessingJob(invoiceId: string, stage: string) {
    const result = await query(
        `INSERT INTO processing_jobs (invoice_id, stage, status, started_at)
     VALUES ($1, $2, 'RUNNING', NOW())
     RETURNING *`,
        [invoiceId, stage]
    );
    return result.rows[0];
}

/**
 * Update a processing job with completion status and metrics.
 *
 * @param jobId   - Processing job UUID
 * @param status  - PASSED | FAILED | SKIPPED
 * @param metrics - Stage-specific metrics (JSONB)
 * @param error   - Error message if failed
 */
export async function updateProcessingJob(jobId: string, status: string, metrics?: object, error?: string) {
    await query(
        `UPDATE processing_jobs SET
       status = $2,
       metrics = COALESCE($3::jsonb, metrics),
       error_message = $4,
       completed_at = NOW()
     WHERE id = $1`,
        [jobId, status, metrics ? JSON.stringify(metrics) : null, error || null]
    );
}

/**
 * Get all processing jobs for a specific invoice.
 * Used by: Detail View processing timeline.
 *
 * @param invoiceId - Invoice UUID
 * @returns Array of processing job rows
 */
export async function getProcessingJobs(invoiceId: string) {
    const result = await query(
        `SELECT * FROM processing_jobs WHERE invoice_id = $1 ORDER BY started_at ASC`,
        [invoiceId]
    );
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// USERS (Auth)
// ─────────────────────────────────────────────────────────────

/**
 * Find a user by email address.
 * Used by: Login authentication.
 *
 * @param email - User email
 * @returns User row or null
 */
export async function getUserByEmail(email: string) {
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    return result.rows[0] || null;
}

/**
 * Update the last_login timestamp for a user.
 *
 * @param userId - User UUID
 */
export async function updateLastLogin(userId: string) {
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

/**
 * Get all users (admin function).
 *
 * @returns Array of user rows (password_hash excluded)
 */
export async function getAllUsers() {
    const result = await query(`
    SELECT id, email, display_name, role, is_active, last_login, created_at
    FROM users
    ORDER BY created_at DESC
  `);
    return result.rows;
}

/**
 * Create a new user account.
 *
 * @param data - User registration data
 * @returns Created user row
 */
export async function createUser(data: {
    email: string;
    password_hash: string;
    display_name: string;
    role: string;
}) {
    const result = await query(
        `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, role, is_active, created_at`,
        [data.email, data.password_hash, data.display_name, data.role]
    );
    return result.rows[0];
}

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

import { query, pool } from './connection';
import { sendInvoiceToTally } from '../sync/tally_posting';

/**
 * Standardizes inconsistent OCR field names to their canonical database column names.
 */
function getCanonicalKey(key: string): string {
    const normalized = key.toLowerCase().replace(/ /g, '_');
    if (normalized === 'invoice_no' || normalized === 'inv_no' || normalized === 'bill_no') return 'invoice_number';
    if (normalized === 'date' || normalized === 'inv_date' || normalized === 'bill_date' || normalized === 'invoice_date') return 'invoice_date';
    if (normalized === 'amount' || normalized === 'taxable_value' || normalized === 'taxable_amount' || normalized === 'sub_total') return 'sub_total';
    if (normalized === 'gst' || normalized === 'tax' || normalized === 'tax_amount' || normalized === 'tax_total') return 'tax_total';
    if (normalized === 'total' || normalized === 'grand_total' || normalized === 'total_amount' || normalized === 'total_invoice_amount') return 'grand_total';
    if (normalized === 'status' || normalized === 'processing_status') return 'processing_status';
    if (normalized === 'remarks' || normalized === 'fail_reason' || normalized === 'failure_reason') return 'failure_reason';
    if (normalized === 'supplier_gst' || normalized === 'gstin' || normalized === 'vendor_gst') return 'vendor_gst';
    if (normalized === 'supplier_name' || normalized === 'vendor_name') return 'vendor_name';
    if (normalized === 'supplier_address' || normalized === 'address') return 'supplier_address';
    if (normalized === 'supplier_pan' || normalized === 'pan') return 'supplier_pan';
    if (normalized === 'round_off') return 'round_off';
    if (normalized === 'cgst' || normalized === 'cgst_amount') return 'cgst';
    if (normalized === 'sgst' || normalized === 'sgst_amount') return 'sgst';
    if (normalized === 'igst' || normalized === 'igst_amount') return 'igst';
    if (normalized === 'cgst_pct' || normalized === 'cgst_%' || normalized === 'cgst_percentage') return 'cgst_pct';
    if (normalized === 'sgst_pct' || normalized === 'sgst_%' || normalized === 'sgst_percentage') return 'sgst_pct';
    if (normalized === 'igst_pct' || normalized === 'igst_%' || normalized === 'igst_percentage') return 'igst_pct';
    if (normalized === 'buyer_name' || normalized === 'buyer') return 'buyer_name';
    if (normalized === 'buyer_gst' || normalized === 'customer_gst') return 'buyer_gst';
    if (normalized === 'round_off') return 'round_off';
    return normalized;
}

/**
 * Smartly updates a JSONB payload by prioritizing existing keys that map to the same field.
 */
function smartUpdatePayload(payload: any, targetKey: string, value: any) {
    if (!payload) return;
    const normalizedTarget = getCanonicalKey(targetKey);
    const existingKeys = Object.keys(payload);
    
    // Find the first key that normalizes to our target canonical key
    const foundKey = existingKeys.find(k => getCanonicalKey(k) === normalizedTarget);

    if (foundKey) {
        payload[foundKey] = value;
    } else {
        payload[targetKey] = value;
    }
}


// ─────────────────────────────────────────────────────────────
// AP INVOICES
// ─────────────────────────────────────────────────────────────

/**
 * Helper to determine the processing_status of an invoice based on validation flags and mapping state.
 * This encapsulates the business logic for tab movement.
 */
export async function evaluateInvoiceStatus(
    validationData: any, 
    vendorId: string | null, 
    invoiceNumber: string | null,
    lineItems: any[] = [],
    n8nStatus?: string,
    companyId?: string,
    grandTotal?: number
): Promise<string> {
    const getVal = (key: string) => {
        if (!validationData) return false;
        const val = validationData[key] ?? validationData[key.toLowerCase().replace(/ /g, '_')];
        return val === true || String(val).toLowerCase() === 'true';
    };

    // 1. Structural / Technical Validations
    const buyerPassed = getVal('buyer_verification');
    const gstPassed = getVal('gst_validation_status');
    const dataPassed = getVal('invoice_ocr_data_validation') || getVal('invoice_ocr_data_valdiation');
    const duplicatePassed = getVal('duplicate_check');
    const stockItemsMatch = getVal('line_item_match_status');

    // 2. Master Data / Input Validations
    const vendorPassed = getVal('vendor_verification') && !!vendorId;
    
    // Ledger validation: every line must have a ledger_id
    const ledgerPassed = lineItems.length > 0 && lineItems.every(li => li.ledger_id || li.gl_account_id);

    // 3. Status Decision
    // We treat buyer, gst, duplicate, and basic extraction as 'Major' technical checks.
    // Master data issues (Vendor, Ledger/Stock Items, Invoice No) route to 'Awaiting Input'.
    const majorChecksPassed = buyerPassed && gstPassed && dataPassed && duplicatePassed;
    const hasInvoiceNo = !!(invoiceNumber && invoiceNumber !== 'Unknown' && invoiceNumber !== 'N/A');

    if (n8nStatus === 'Failed') return 'Handoff';

    if (majorChecksPassed) {
        if (vendorPassed && ledgerPassed && hasInvoiceNo && stockItemsMatch) {
            let finalStatus = 'Ready to Post';
            
            // --- POSTING RULES EVALUATION ---
            if (companyId) {
                try {
                    const rules = await getAppConfig('posting_rules', companyId);
                    if (rules && rules.postingMode === 'auto') {
                        const limit = rules.criteria?.enableValueLimit ? (rules.criteria.valueLimit || 0) : Infinity;
                        const total = Number(grandTotal || 0);

                        if (total <= limit) {
                            console.log(`[DB] Auto-Posting: Total ${total} <= Limit ${limit}. Triggering 'Auto-Posted'.`);
                            finalStatus = 'Auto-Posted';
                        }
                    }
                } catch (ruleErr) {
                    console.error('[DB] Error evaluating posting rules:', ruleErr);
                }
            }
            
            return finalStatus;
        } else {
            // Structurally valid but missing master data or invoice number -> Awaiting Input
            return 'Awaiting Input';
        }
    } else {
        // Broadly failed or duplicate found -> Handoff
        return 'Handoff';
    }
}

/**
 * Fetch all invoices, ordered by most recent first.
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of invoice rows
 */
export async function getAllInvoices(companyId?: string) {
    let sql = `
        SELECT *, 
               COALESCE(invoice_number, 'Unknown Invoice') as invoice_no, 
               invoice_date as date, 
               created_at as uploaded_date,
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total,
               CASE 
                 WHEN LOWER(doc_type) LIKE '%goods%' THEN 'Invoice (Goods)'
                 WHEN LOWER(doc_type) LIKE '%service%' THEN 'Invoice (Service)'
                 ELSE 'Invoice (Service)'
               END as doc_type_label,
               (SELECT COUNT(*) FROM ap_invoice_lines WHERE ap_invoice_id = ap_invoices.id)::int as items_count
        FROM ap_invoices
    `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
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
    const result = await query(`
        SELECT *, 
               COALESCE(invoice_number, 'Unknown Invoice') as invoice_no, 
               invoice_date as date, 
               created_at as uploaded_date,
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total,
               CASE 
                 WHEN LOWER(doc_type) LIKE '%goods%' THEN 'Invoice (Goods)'
                 WHEN LOWER(doc_type) LIKE '%service%' THEN 'Invoice (Service)'
                 ELSE 'Invoice (Service)'
               END as doc_type_label
        FROM ap_invoices 
        WHERE id = $1
    `, [id]);
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
        `INSERT INTO ap_invoices (file_name, file_path, file_location, batch_id, processing_status, uploader_name)
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
export async function updateInvoiceWithOCR(id: string, data: any) {
    // 1. Fetch current invoice to get existing ocr_raw_payload
    const current = await getInvoiceById(id);
    if (!current) throw new Error('Invoice not found');

    let rawPayload = current.ocr_raw_payload || {};
    if (typeof rawPayload === 'string') {
        try { rawPayload = JSON.parse(rawPayload); } catch (e) { rawPayload = {}; }
    }

    // 2. Identify allowed columns to separate from raw payload
    const allowedCols = [
        "invoice_number", "vendor_name", "invoice_date", "due_date",
        "sub_total", "tax_total", "grand_total", "po_number", "gl_account",
        "processing_status", "processing_time", "doc_type", "posted_to_tally_json",
        "all_data_invoice", "file_location", "file_path", "tally_id",
        "uploader_name", "vendor_id", "is_mapped", "vendor_gst", "validation_time",
        "irn", "ack_no", "ack_date", "eway_bill_no", "failure_reason",
        "supplier_pan", "supplier_address", "round_off",
        "cgst", "sgst", "igst", "cgst_pct", "sgst_pct", "igst_pct"
    ];

    // 4. Update primary columns and merge others into rawPayload
    const updateValues: Record<string, any> = {};
    const ocrData = data.ocr_raw_data || data; // Accept both nested and flat structures

    Object.keys(ocrData).forEach(key => {
        const dbKey = getCanonicalKey(key);

        if (allowedCols.includes(dbKey) && !['file_path', 'file_location'].includes(dbKey)) {
            // Only update if the value is not already set by a canonical key (to prevent stale aliases from overwriting)
            if (!updateValues[dbKey] || key === dbKey) {
                updateValues[dbKey] = ocrData[key];
            }
        } 
        
        // Use smart update to prevent key duplication in the JSON payload during OCR sync
        smartUpdatePayload(rawPayload, key, ocrData[key]);
    });

    // 5. Fetch line items and re-evaluate status if n8n_val_json_data or mapping fields changed
    let n8nVal = updateValues.n8n_val_json_data || current.n8n_val_json_data;
    if (typeof n8nVal === 'string') {
        try { n8nVal = JSON.parse(n8nVal); } catch (e) { n8nVal = {}; }
    }
    if (!n8nVal) n8nVal = {};

    const vId = updateValues.vendor_id || current.vendor_id;
    const invNo = updateValues.invoice_number || current.invoice_number;
    const items = await getInvoiceItems(id);
    const compId = updateValues.company_id || current.company_id;
    const gTotal = updateValues.grand_total || current.grand_total;

    // Always re-calculate status on save to ensure correct tab movement
    const finalStatus = await evaluateInvoiceStatus(n8nVal, vId, invNo, items, current.n8n_validation_status, compId, gTotal);
    updateValues.processing_status = finalStatus;

    // Special handling for date strings to ensure PostgreSQL compatibility
    const dateFields = ["invoice_date", "due_date", "ack_date"];
    
    const setClauses = Object.keys(updateValues).map((k, i) => {
        if (dateFields.includes(k)) {
            const val = updateValues[k];
            return `${k} = CASE 
                WHEN $${i + 2}::text ~ '^\\d{8}$' THEN to_date($${i + 2}::text, 'DDMMYYYY')
                WHEN $${i + 2}::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $${i + 2}::text::date
                WHEN $${i + 2}::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date($${i + 2}::text, 'DD-MM-YYYY')
                WHEN $${i + 2}::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date($${i + 2}::text, 'DD/MM/YYYY')
                ELSE ${k}
            END`;
        }
        return `${k} = COALESCE($${i + 2}, ${k})`;
    });

    // Add ocr_raw_payload update
    const payloadIndex = setClauses.length + 2;
    setClauses.push(`ocr_raw_payload = $${payloadIndex}::jsonb`);
    setClauses.push(`updated_at = NOW()`);

    const sql = `UPDATE ap_invoices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const params = [id, ...Object.values(updateValues), JSON.stringify(rawPayload)];

    const result = await query(sql, params);
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
        `UPDATE ap_invoices SET processing_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
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
        `UPDATE ap_invoices SET processing_status = 'Failed', failure_reason = $2, pre_ocr_status = COALESCE($3, pre_ocr_status), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, failure_reason, pre_ocr_status || null]
    );
    return result.rows[0];
}

/**
 * Update the failure_reason (Remarks) of an invoice.
 * @param id - Invoice UUID
 * @param remarks - New remarks string
 */
export async function updateInvoiceRemarks(id: string, remarks: string) {
    const result = await query(
        `UPDATE ap_invoices SET failure_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, remarks]
    );
    return result.rows[0];
}

/**
 * Mark an invoice as posted to Tally Prime.
 *
 * @param id - Invoice UUID
 * @param responseJson - Detailed response from Tally Prime
 * @param tallyId - Reference ID returned by Tally
 * @param erpSyncStatus - 'processed' or 'failed'
 */
export async function markPostedToTally(id: string, responseJson?: object, tallyId?: string, erpSyncStatus: string = 'processed') {
    await query(
        `UPDATE ap_invoices SET 
          is_posted_to_tally = true, 
          processing_status = 'Auto-Posted', 
          erp_sync_status = $4,
          erp_sync_id = COALESCE($3, erp_sync_id),
          posted_to_tally_json = COALESCE($2::jsonb, posted_to_tally_json),
          tally_id = COALESCE($3, tally_id),
          updated_at = NOW() 
        WHERE id = $1`,
        [id, responseJson ? JSON.stringify(responseJson) : null, tallyId || null, erpSyncStatus]
    );
}

/**
 * Delete an invoice record and its associated lines.
 * 
 * @param id - Invoice UUID
 */
export async function deleteInvoice(id: string) {
    await query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
    await query('DELETE FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [id]);
    await query('DELETE FROM ap_invoices WHERE id = $1', [id]);
    return true;
}

/**
 * Get invoice counts grouped by status (for Dashboard KPIs).
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of status counts
 */
export async function getInvoiceStatusCounts(companyId?: string) {
    let sql = `
    SELECT processing_status as status, COUNT(*)::int as count
    FROM ap_invoices
  `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }

    sql += ' GROUP BY processing_status';
    const result = await query(sql, params);
    return result.rows;
}

// ─────────────────────────────────────────────────────────────
// MASTERS & COMPANIES
// ─────────────────────────────────────────────────────────────

export async function getLedgerMasters(companyId?: string) {
    // We use DISTINCT ON (name) to ensure each ledger name appears only once.
    // By ordering by name then (company_id IS NOT NULL) DESC, we prioritize 
    // the company-specific record over the global NULL one for the same name.
    let sql = `
        SELECT DISTINCT ON (name) 
            id, name, parent_group, account_type as ledger_type, erp_sync_id as tally_guid, is_active 
        FROM ledger_master 
        WHERE is_active = true
    `;
    const params: any[] = [];

    if (companyId) {
        sql += ` AND (company_id = $1 OR company_id IS NULL)`;
        params.push(companyId);
    }
    
    // DISTINCT ON requires the first ORDER BY column to match the DISTINCT ON column
    sql += ` ORDER BY name, (company_id IS NOT NULL) DESC`;

    const { rows } = await query(sql, params);
    return rows;
}

export async function createLedgerMaster(data: {
    name: string;
    parent_group: string;
    account_type: string;
    company_id?: string | null;
}) {
    const name = (data.name || '').trim();
    const parentGroup = (data.parent_group || '').trim();
    const accountType = (data.account_type || '').trim();

    if (!name) throw new Error('Ledger name is required');
    if (!parentGroup) throw new Error('Parent group is required');
    if (!accountType) throw new Error('Account type is required');

    // De-dupe by (company_id, lower(name)) to avoid accidental duplicates.
    const existing = await query(
        `SELECT id, name, parent_group, account_type as ledger_type, is_active
         FROM ledger_master
         WHERE is_active = true
           AND LOWER(name) = LOWER($1)
           AND (company_id = $2 OR (company_id IS NULL AND $2 IS NULL))
         LIMIT 1`,
        [name, data.company_id ?? null]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const inserted = await query(
        `INSERT INTO ledger_master (company_id, name, parent_group, account_type, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, name, parent_group, account_type as ledger_type, is_active`,
        [data.company_id ?? null, name, parentGroup, accountType]
    );
    return inserted.rows[0];
}

export async function getTdsSections() {
    // temporary mapping for old frontend
    const { rows } = await query(`SELECT tax_code as section, description, rate_percentage as rate_individual, rate_percentage as rate_company, is_active FROM tax_codes WHERE tax_authority = 'TDS' AND is_active = true ORDER BY tax_code`);
    return rows;
}

export async function getActiveCompany() {
    const { rows } = await query(`SELECT * FROM companies WHERE is_active = true LIMIT 1`);
    return rows[0] || null;
}

/**
 * Fetch all companies for the global filter.
 * 
 * @returns Array of company rows
 */
export async function getAllCompanies() {
    const { rows } = await query(`SELECT id, name, gstin, is_active FROM companies ORDER BY name ASC`);
    return rows;
}

/**
 * Fetch all synced companies, adhering to the REST endpoint shape.
 * 
 * @returns Object with companies (array), count, and last_synced_at
 */
export async function getSyncedCompanies() {
    try {
        const { rows } = await query(`
            SELECT *
            FROM companies 
            ORDER BY created_at DESC
        `);
        
        // Find the latest created_at from the returned rows (since they are ordered DESC, it's the first row)
        let lastSyncedAt = null;
        if (rows.length > 0 && rows[0].created_at) {
            lastSyncedAt = rows[0].created_at;
        }

        return {
            companies: rows,
            count: rows.length,
            last_synced_at: lastSyncedAt
        };
    } catch (err: any) {
        console.error('[QUERIES] getSyncedCompanies failed:', err.message);
        throw err;
    }
}


// ─────────────────────────────────────────────────────────────
// VENDORS (with dynamic calculations)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all vendors with dynamically calculated total_due and invoice_count.
 * Supports optional company filtering.
 *
 * @param companyId - Optional UUID or 'ALL'
 * @returns Array of vendor rows with calculated fields
 */
export async function getAllVendors(companyId?: string) {
    let sql = `
    SELECT 
      v.*,
      COALESCE(COUNT(i.id), 0)::int AS invoice_count,
      COALESCE(SUM(CASE WHEN i.is_posted_to_tally = false THEN i.grand_total ELSE 0 END), 0) AS total_due,
      MIN(CASE WHEN i.is_posted_to_tally = false THEN i.due_date END) AS oldest_due_calc
    FROM vendors v
    LEFT JOIN ap_invoices i ON i.vendor_id = v.id
  `;
    const params: any[] = [];

    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE v.company_id = $1';
        params.push(companyId);
    }

    sql += `
    GROUP BY v.id
    ORDER BY v.name ASC
  `;
    const result = await query(sql, params);
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
    vendor_code?: string;
    tax_id?: string;
    pan?: string;
    city?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
}) {
    if (data.id) {
        const result = await query(
            `UPDATE vendors SET 
        name = $2, gstin = $3, under_group = $4, state = $5, address = $6, tds_nature = $7,
        vendor_code = $8, tax_id = $9, pan = $10, city = $11, pincode = $12, phone = $13,
        email = $14, bank_name = $15, bank_account_no = $16, bank_ifsc = $17
        WHERE id = $1 RETURNING *`,
            [
                data.id, data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature,
                data.vendor_code, data.tax_id, data.pan, data.city, data.pincode, data.phone,
                data.email, data.bank_name, data.bank_account_no, data.bank_ifsc
            ]
        );
        return result.rows[0];
    } else {
        const result = await query(
            `INSERT INTO vendors (
                name, gstin, under_group, state, address, tds_nature,
                vendor_code, tax_id, pan, city, pincode, phone, email,
                bank_name, bank_account_no, bank_ifsc
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
            [
                data.name, data.gstin, data.under_group, data.state, data.address, data.tds_nature,
                data.vendor_code, data.tax_id, data.pan, data.city, data.pincode, data.phone, data.email,
                data.bank_name, data.bank_account_no, data.bank_ifsc
            ]
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
    const result = await query(`
        SELECT *, 
               item_id as item, 
               unit_price as rate, 
               line_amount as amount, 
               COALESCE(ledger_id, gl_account_id) as ledger 
        FROM ap_invoice_lines 
        WHERE ap_invoice_id = $1 
        ORDER BY created_at ASC
    `, [invoiceId]);
    return result.rows;
}

/**
 * Save multiple items for an invoice. 
 * This performs a "delete and insert" to ensure the list matches exactly.
 */
export async function saveInvoiceItems(invoiceId: string, items: any[]) {
    // 1. Delete existing items
    await query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);

    // 2. Insert new items
    if (items.length === 0) return [];

    const results = [];
    for (const item of items) {
        const res = await query(
            `INSERT INTO ap_invoice_lines 
        (ap_invoice_id, item_id, description, gl_account_id, tax, quantity, unit_price, discount, line_amount, hsn_sac)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
                invoiceId, item.item || null, item.description, item.ledger || null, item.tax,
                item.quantity || 1, item.rate || 0, item.discount || 0,
                item.amount || (Number(item.quantity || 1) * Number(item.rate || 0)),
                item.hsn_sac || null
            ]
        );
        results.push(res.rows[0]);
    }
    return results;
}

/**
 * Save all invoice data (header + line items) in a single atomic transaction.
 * Also logs a single audit entry for the entire operation.
 */
export async function saveAllInvoiceData(id: string, data: any, items: any[], userName: string = 'System') {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch current for comparison and base payload
        const currentRes = await client.query('SELECT * FROM ap_invoices WHERE id = $1', [id]);
        const current = currentRes.rows[0];
        if (!current) throw new Error('Invoice not found');

        let rawPayload = current.ocr_raw_payload || {};
        if (typeof rawPayload === 'string') {
            try { rawPayload = JSON.parse(rawPayload); } catch (e) { rawPayload = {}; }
        }

        const allowedCols = [
            "invoice_number", "vendor_name", "invoice_date", "due_date",
            "sub_total", "tax_total", "grand_total", "po_number", "gl_account",
            "processing_status", "processing_time", "doc_type", "posted_to_tally_json",
            "all_data_invoice", "file_location", "file_path", "tally_id",
            "uploader_name", "vendor_id", "is_mapped", "vendor_gst", "validation_time",
            "irn", "ack_no", "ack_date", "eway_bill_no", "failure_reason",
            "supplier_pan", "supplier_address", "round_off",
            "cgst", "sgst", "igst", "cgst_pct", "sgst_pct", "igst_pct",
            "buyer_name", "buyer_gst"
        ];

        const updateValues: Record<string, any> = {};
        const ocrData = data.ocr_raw_data || data;

        Object.keys(ocrData).forEach(key => {
            const dbKey = getCanonicalKey(key);

            if (allowedCols.includes(dbKey) && !['file_path', 'file_location'].includes(dbKey)) {
                updateValues[dbKey] = ocrData[key];
            }
            
            // Use smart update to prevent key duplication in the JSON payload
            smartUpdatePayload(rawPayload, key, ocrData[key]);
        });

        const dateFields = ["invoice_date", "due_date", "ack_date"];
        const setClauses = Object.keys(updateValues).map((k, i) => {
            if (dateFields.includes(k)) {
                return `${k} = CASE 
                    WHEN $${i + 2}::text ~ '^\\d{8}$' THEN to_date($${i + 2}::text, 'DDMMYYYY')
                    WHEN $${i + 2}::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $${i + 2}::text::date
                    WHEN $${i + 2}::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date($${i + 2}::text, 'DD-MM-YYYY')
                    WHEN $${i + 2}::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date($${i + 2}::text, 'DD/MM/YYYY')
                    ELSE ${k}
                END`;
            }
            return `${k} = COALESCE($${i + 2}, ${k})`;
        });

        const payloadIndex = setClauses.length + 2;
        setClauses.push(`ocr_raw_payload = $${payloadIndex}::jsonb`);
        setClauses.push(`updated_at = NOW()`);

        const updateSql = `UPDATE ap_invoices SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
        const updateParams = [id, ...Object.values(updateValues), JSON.stringify(rawPayload)];
        const invoiceRes = await client.query(updateSql, updateParams);
        const updatedInvoice = invoiceRes.rows[0];

        // 2. Update Line Items
        await client.query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO ap_invoice_lines 
                    (ap_invoice_id, item_id, description, gl_account_id, tax, quantity, unit_price, discount, line_amount, hsn_sac)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        id, item.item || null, item.description, item.ledger || null, item.tax,
                        item.quantity || 1, item.rate || 0, item.discount || 0,
                        item.amount || (Number(item.quantity || 1) * Number(item.rate || 0)),
                        item.hsn_sac || null
                    ]
                );
            }
        }

        // 3. Log Audit Entry
        await client.query(
            `INSERT INTO audit_logs (invoice_id, invoice_no, vendor_name, event_type, user_name, description, before_data, after_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
            [
                id, updatedInvoice.invoice_number, updatedInvoice.vendor_name,
                'Edited', userName,
                `Manual edit: updated header and ${items.length} line items`,
                JSON.stringify({ status: current.processing_status }),
                JSON.stringify({ status: updatedInvoice.processing_status })
            ]
        );

        await client.query('COMMIT');
        return updatedInvoice;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] saveAllInvoiceData failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────
// N8N INGESTION
// ─────────────────────────────────────────────────────────────

/**
 * Ingest the entire JSON payload from the n8n validation webhook.
 * Replaces direct n8n DB insertion to prevent UUID mismatches.
 * Now dynamically maps incoming fields to actual Database columns.
 */
export async function ingestN8nData(invoiceId: string, n8nData: any) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Handle structure mismatch (n8n might send an Array or a single Object)
        let payload: any;
        if (Array.isArray(n8nData)) {
            payload = n8nData[0];
        } else {
            payload = n8nData;
        }

        if (!payload) {
            throw new Error("Empty payload received from n8n");
        }

        const invData = payload.ap_invoices && Array.isArray(payload.ap_invoices) ? payload.ap_invoices[0] : (payload.ap_invoices || payload);

        // --- CANONICAL SOURCE-TO-TARGET RULE ---
        // Explicitly preserve the full ocr_raw_payload from the n8n response array if it exists.
        // This ensures no keys, nested objects, or arrays (like line_items) are lost.
        const canonicalRawPayload = payload.ap_invoices?.[0]?.ocr_raw_payload;
        if (canonicalRawPayload && typeof canonicalRawPayload === 'object') {
            invData.ocr_raw_payload = canonicalRawPayload;
        } else {
            console.warn(`[DB] ingestN8nData: Canonical ocr_raw_payload missing in payload.ap_invoices[0]. File: ${invData.file_name || 'unknown'}`);
        }

        // 1. Vendor Upsert (Auto-creation of vendors if missing)
        let vendorId = invData.vendor_id;
        if (!vendorId && invData.vendor_name) {
            const vRes = await client.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1) OR LOWER(gstin) = LOWER($2)', [invData.vendor_name, invData.vendor_gst]);
            if (vRes.rows.length > 0) {
                vendorId = vRes.rows[0].id;
            } else {
                const newV = await client.query(
                    'INSERT INTO vendors (name, gstin, company_id) VALUES ($1, $2, $3) RETURNING id',
                    [invData.vendor_name, invData.vendor_gst, invData.company_id || null]
                );
                vendorId = newV.rows[0].id;
            }
        }

        // Determine Final Status based on validation checks
        // Robustly extract validation flags from either a JSON string or top-level fields
        let n8nVal = (typeof invData.n8n_val_json_data === 'string' ? JSON.parse(invData.n8n_val_json_data) : invData.n8n_val_json_data) || {};
        
        // If n8nVal is empty but top-level fields exist, collect them
        const valKeys = [
            'buyer_verification', 'gst_validation_status', 'invoice_ocr_data_validation', 
            'vendor_verification', 'duplicate_check', 'line_item_match_status',
            'Company Verified', 'GST Validated', 'Data Validated', 'Vendor Verified', 'Document Duplicate Check', 'Stock Items Matched'
        ];
        
        valKeys.forEach(k => {
            if (invData[k] !== undefined && n8nVal[k] === undefined) {
                n8nVal[k] = invData[k];
            }
        });

        // Sync back to invData so it gets saved to the n8n_val_json_data column
        invData.n8n_val_json_data = JSON.stringify(n8nVal);

        const getVal = (key: string) => {
            if (!n8nVal) return false;
            const val = n8nVal[key] ?? n8nVal[key.toLowerCase().replace(/ /g, '_')];
            return val === true || String(val).toLowerCase() === 'true';
        };

        // --- RACE-CONDITION-PROOF DUPLICATE CHECK ---
        // n8n's duplicate check uses a stale DB snapshot taken before parallel invoices write.
        // Two invoices with the same number can both pass n8n's check simultaneously.
        // This re-checks inside the open transaction against live DB state, overriding n8n's result.
        const rtInvoiceNo = invData.invoice_number || invData.invoice_no || invData.invoiceNo;
        const rtVendorGst = invData.vendor_gst;
        if (rtInvoiceNo && rtVendorGst) {
            const dupResult = await client.query(
                `SELECT id FROM ap_invoices
                 WHERE LOWER(invoice_number) = LOWER($1)
                   AND LOWER(vendor_gst) = LOWER($2)
                   AND id != $3`,
                [rtInvoiceNo, rtVendorGst, invoiceId]
            );
            if (dupResult.rows.length > 0) {
                console.warn(`[DB] ingestN8nData: Real-time duplicate detected for invoice "${rtInvoiceNo}" (${rtVendorGst}). Overriding n8n result. Conflicting id: ${dupResult.rows[0].id}`);
                n8nVal['duplicate_check'] = false;
                invData.n8n_val_json_data = JSON.stringify(n8nVal);
            }
        }
        // --- END RACE-CONDITION CHECK ---

        const checks = [
            getVal('buyer_verification'),
            getVal('gst_validation_status'),
            getVal('invoice_ocr_data_validation'),
            getVal('vendor_verification'),
            getVal('line_item_match_status')
        ];
        
        console.log(`[DB] ingestN8nData Final Payload Source:`, invData.file_name);

        // Pre-scan line items from payload for status evaluation
        const tempLineItems = (payload.ap_invoice_lines || []).map((line: any) => {
            const candidates = [line.mapped_ledger, line.gl_account_id, line.ledger, line.possible_gl_names, line.description].filter(v => v);
            // This is a naive check; real resolution happens below, but for status we just need to know if one exists.
            return { ledger_id: candidates.length > 0 ? 'exists' : null };
        });

        const finalStatus = await evaluateInvoiceStatus(
            n8nVal, 
            vendorId, 
            invData.invoice_number || invData.invoice_no || invData.invoiceNo,
            tempLineItems,
            invData.n8n_validation_status,
            invData.company_id,
            invData.grand_total
        );

        console.log(`[DB] ingestN8nData Final Status for ${invoiceId}: ${finalStatus}`);

        // --- DYNAMIC DATABASE SCHEMAS --- 
        const allowedApInvoicesCols = [
            "ocr_raw_payload", "company_id", "vendor_id", "purchase_order_id", "invoice_date", "due_date",
            "sub_total", "tax_total", "grand_total", "currency_id", "erp_sync_logs", "retry_count",
            "is_mapped", "is_high_amount", "pre_ocr_score", "is_posted_to_tally", "posted_to_tally_json",
            "all_data_invoice", "ack_date", "ledger_id", "processing_time", "validation_time",
            "approval_delay_time", "failure_reason", "failure_category", "uploader_name", "n8n_val_json_data",
            "invoice_number", "tally_id", "pre_ocr_status", "vendor_gst", "n8n_validation_status", "irn",
            "doc_type", "processing_status", "ack_no", "erp_sync_id", "erp_sync_status", "eway_bill_no",
            "file_name", "file_path", "file_location", "batch_id", "vendor_name", "po_number", "gl_account"
        ];

        const allowedLinesCols = [
            "ledger_id", "ap_invoice_id", "line_number", "line_amount", "gl_account_id", "cost_center_id",
            "discount", "tds_amount", "item_id", "quantity", "unit_price", "description", "hsn_sac",
            "tds_section", "possible_gl_names", "order_no", "unit", "tax", "part_no"
        ];

        const allowedTaxCols = [
            "ap_invoice_id", "tax_code_id", "tax_amount", "base_amount"
        ];

        // 2. Invoice Main Fields (ap_invoices)
        if (invData) {
            invData.vendor_id = vendorId;
            invData.processing_status = finalStatus;
            invData.validation_time = new Date().toISOString();

            if (invData.invoice_no !== undefined && invData.invoice_number === undefined) invData.invoice_number = invData.invoice_no;
            if (invData.invoiceNo !== undefined && invData.invoice_number === undefined) invData.invoice_number = invData.invoiceNo;

            const invKeys = Object.keys(invData).filter(k => 
                allowedApInvoicesCols.includes(k) && 
                !['file_path', 'file_location'].includes(k) &&
                invData[k] !== undefined && 
                invData[k] !== null && 
                invData[k] !== ""
            );
            if (invKeys.length > 0) {
                const setClause = invKeys.map((k, i) => `${k} = $${i + 2}`).join(', ');
                const invParams = invKeys.map(k => {
                    // Explicitly stringify the full payload object for JSONB persistence
                    if (k === 'ocr_raw_payload' && typeof invData[k] === 'object') {
                        return JSON.stringify(invData[k]);
                    }
                    return invData[k];
                });
                const updateSql = `UPDATE ap_invoices SET ${setClause}, updated_at = NOW() WHERE id = $1`;
                await client.query(updateSql, [invoiceId, ...invParams]);

                // If finalStatus was changed to 'Auto-Posted', trigger the actual webhook
                if (finalStatus === 'Auto-Posted') {
                    // We call this AFTER the DB update so the row has latest data (ocr_raw_payload etc)
                    // though we technically have it in memory as well.
                    setTimeout(async () => {
                        try {
                            console.log(`[DB] Executing Auto-Post for ${invoiceId}`);
                            const postResult = await sendInvoiceToTally(invoiceId, invData.ocr_raw_payload);
                            const tallyIdStr = postResult.response?.tally_id || postResult.response?.masterid || postResult.response?.master_id || null;
                            
                            // Use the exported markPostedToTally to finalise
                            await markPostedToTally(invoiceId, postResult.response, tallyIdStr, postResult.status);
                        } catch (postErr) {
                            console.error(`[DB] Auto-Post background task failed for ${invoiceId}:`, postErr);
                        }
                    }, 100); // Small delay to ensure transaction commit if pool was used
                }
            }
        }

        // 3. Line Items Mapping
        if (payload.ap_invoice_lines) {
            await client.query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);

            for (const line of payload.ap_invoice_lines) {
                const ledgerCandidates = [
                    line.mapped_ledger,
                    line.gl_account_id,
                    line.ledger,
                    line.possible_gl_names,
                    line.description,
                    line.part_no
                ].filter(v => v && typeof v === 'string');

                let resolvedLedgerId = null;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                for (const candidate of ledgerCandidates) {
                    if (uuidRegex.test(candidate)) {
                        resolvedLedgerId = candidate;
                        break;
                    }
                    const ledgerRes = await client.query('SELECT id FROM ledger_master WHERE LOWER(name) = LOWER($1)', [candidate.trim()]);
                    if (ledgerRes.rows.length > 0) {
                        resolvedLedgerId = ledgerRes.rows[0].id;
                        break;
                    }
                    const fuzzyRes = await client.query('SELECT id FROM ledger_master WHERE LOWER(name) LIKE LOWER($1) LIMIT 1', [`%${candidate.trim()}%`]);
                    if (fuzzyRes.rows.length > 0) {
                        resolvedLedgerId = fuzzyRes.rows[0].id;
                        break;
                    }
                }

                if (line.qty !== undefined && line.quantity === undefined) line.quantity = line.qty;
                if (line.total_amount !== undefined && line.line_amount === undefined) line.line_amount = line.total_amount;

                line.ap_invoice_id = invoiceId;
                line.gl_account_id = resolvedLedgerId;
                line.ledger_id = resolvedLedgerId;
                line.description = line.description || line.part_no || line.mapped_ledger || 'Uncategorized Line';

                const lineKeys = Object.keys(line).filter(k => allowedLinesCols.includes(k) && line[k] !== undefined);
                if (lineKeys.length > 0) {
                    const lineParams = lineKeys.map(k => line[k]);
                    const placeholders = lineKeys.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO ap_invoice_lines (${lineKeys.join(', ')}) VALUES (${placeholders})`;
                    await client.query(insertSql, lineParams);
                }
            }
        }

        // 4. Ingest Taxes
        if (payload.ap_invoice_taxes && payload.ap_invoice_taxes.length > 0) {
            await client.query('DELETE FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [invoiceId]);

            for (const tax of payload.ap_invoice_taxes) {
                let taxCodeId = null;
                const codeAlias: Record<string, string[]> = {
                    'CGST': ['CGST9', 'CGST Input @9%'],
                    'SGST': ['SGST9', 'SGST Input @9%'],
                    'IGST': ['IGST18', 'IGST Input @18%']
                };

                const taxCandidates = [tax.tax_code_id, tax.tax_code, tax.description].filter(v => v);
                const aliases = taxCandidates.flatMap(c => codeAlias[c.toString().toUpperCase().trim()] || []);
                const allCandidates = [...taxCandidates, ...aliases];

                for (const candidate of allCandidates) {
                    const cStr = candidate.toString().trim();
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (uuidRegex.test(cStr)) {
                        taxCodeId = cStr;
                        break;
                    }
                    const taxRes = await client.query('SELECT id FROM tax_codes WHERE LOWER(tax_code) = LOWER($1) OR LOWER(description) = LOWER($1)', [cStr]);
                    if (taxRes.rows.length > 0) {
                        taxCodeId = taxRes.rows[0].id;
                        break;
                    }
                }

                tax.ap_invoice_id = invoiceId;
                tax.tax_code_id = taxCodeId;

                const taxKeys = Object.keys(tax).filter(k => allowedTaxCols.includes(k) && tax[k] !== undefined);
                if (taxKeys.length > 0) {
                    const taxParams = taxKeys.map(k => tax[k]);
                    const placeholders = taxKeys.map((_, i) => `$${i + 1}`).join(', ');
                    const insertSql = `INSERT INTO ap_invoice_taxes (${taxKeys.join(', ')}) VALUES (${placeholders})`;
                    await client.query(insertSql, taxParams);
                }
            }
        }

        await client.query('COMMIT');
        return { success: true, id: invoiceId };
    } catch (error: any) {
        await client.query('ROLLBACK');
        // 23505 = PostgreSQL unique constraint violation
        // Happens when two invoices with the same number/GST hit the DB at the exact same millisecond
        // and both pass the application-level re-check before either commits.
        // Treat this as a duplicate — flag the invoice as Handoff instead of crashing.
        if (error.code === '23505') {
            console.warn(`[DB] ingestN8nData: Unique constraint caught exact-millisecond duplicate for invoice ${invoiceId}. Flagging as Handoff.`);
            try {
                await pool.query(
                    `UPDATE ap_invoices SET processing_status = 'Handoff', n8n_validation_status = 'Duplicate' WHERE id = $1`,
                    [invoiceId]
                );
            } catch (updateErr) {
                console.error(`[DB] ingestN8nData: Failed to flag duplicate invoice ${invoiceId}:`, updateErr);
            }
            return { success: true, id: invoiceId, duplicate: true };
        }
        console.error(`[DB] ingestN8nData Error for ${invoiceId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}



// ─────────────────────────────────────────────────────────────
// ITEM MASTER
// ─────────────────────────────────────────────────────────────

export async function getAllItems(companyId?: string) {
    let sql = 'SELECT * FROM item_master';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }
    sql += ' ORDER BY item_name ASC';
    const { rows } = await query(sql, params);
    return rows;
}

export async function getItemById(id: string) {
    const { rows } = await query('SELECT * FROM item_master WHERE id = $1', [id]);
    return rows[0] || null;
}

export async function saveItem(data: any) {
    if (data.id) {
        const result = await query(
            `UPDATE item_master SET 
            item_name = $2, item_code = $3, hsn_sac = $4, uom = $5, base_price = $6, tax_rate = $7, default_ledger_id = $8, is_active = $9
            WHERE id = $1 RETURNING *`,
            [data.id, data.item_name, data.item_code, data.hsn_sac, data.uom, data.base_price, data.tax_rate, data.default_ledger_id, data.is_active]
        );
        return result.rows[0];
    } else {
        const result = await query(
            `INSERT INTO item_master (company_id, item_name, item_code, hsn_sac, uom, base_price, tax_rate, default_ledger_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [data.company_id, data.item_name, data.item_code, data.hsn_sac, data.uom, data.base_price, data.tax_rate, data.default_ledger_id]
        );
        return result.rows[0];
    }
}

// ─────────────────────────────────────────────────────────────
// TALLY SYNC LOGS
// ─────────────────────────────────────────────────────────────

export async function createTallySyncLog(data: {
    company_id: string;
    entity_type: string;
    entity_id: string;
    request_xml?: string;
    response_xml?: string;
    status: string;
    error_message?: string;
}) {
    await query(
        `INSERT INTO tally_sync_logs (company_id, entity_type, entity_id, request_xml, response_xml, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [data.company_id, data.entity_type, data.entity_id, data.request_xml, data.response_xml, data.status, data.error_message]
    );
}

export async function getTallySyncLogs(entityId?: string) {
    let sql = 'SELECT * FROM tally_sync_logs';
    const params: any[] = [];
    if (entityId) {
        sql += ' WHERE entity_id = $1';
        params.push(entityId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const { rows } = await query(sql, params);
    return rows;
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
// ─────────────────────────────────────────────────────────────
// PURCHASE ORDERS (PO)
// ─────────────────────────────────────────────────────────────

export async function getAllPurchaseOrders(companyId?: string) {
    let sql = 'SELECT * FROM purchase_orders';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }
    sql += ' ORDER BY po_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

export async function getPurchaseOrderById(id: string) {
    const { rows } = await query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// GOODS RECEIPTS (GRN)
// ─────────────────────────────────────────────────────────────

export async function getAllGoodsReceipts(companyId?: string) {
    let sql = 'SELECT * FROM goods_receipts';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }
    sql += ' ORDER BY receipt_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// SERVICE ENTRY SHEETS (SES)
// ─────────────────────────────────────────────────────────────

export async function getAllServiceEntrySheets(companyId?: string) {
    let sql = 'SELECT * FROM service_entry_sheets';
    const params: any[] = [];
    if (companyId && companyId !== 'ALL') {
        sql += ' WHERE company_id = $1';
        params.push(companyId);
    }
    sql += ' ORDER BY service_date DESC';
    const { rows } = await query(sql, params);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD & ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * Get aggregated metrics for the dashboard.
 * @param companyId - Filter by company
 */
export async function getDashboardMetrics(companyId?: string) {
    const whereClause = companyId && companyId !== 'ALL' ? 'WHERE company_id = $1' : '';
    const params = companyId && companyId !== 'ALL' ? [companyId] : [];

    const totalInvoices = await query(`SELECT COUNT(*)::int as count FROM ap_invoices ${whereClause}`, params);
    const totalAmount = await query(`SELECT SUM(grand_total)::numeric as total FROM ap_invoices ${whereClause}`, params);
    const pendingApproval = await query(`SELECT COUNT(*)::int as count FROM ap_invoices ${whereClause} ${whereClause ? 'AND' : 'WHERE'} processing_status = 'Pending Approval'`, params);

    // Status counts for pie charts
    const statusCounts = await getInvoiceStatusCounts(companyId);

    return {
        totalInvoices: totalInvoices.rows[0].count,
        totalAmount: Number(totalAmount.rows[0].total || 0),
        pendingApproval: pendingApproval.rows[0].count,
        statusCounts
    };
}

// ─────────────────────────────────────────────────────────────
// APP CONFIGURATION
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a configuration value by key and company.
 */
export async function getAppConfig(key: string, companyId?: string) {
    let sql = `SELECT config_value FROM app_config WHERE config_key = $1`;
    const params: any[] = [key];

    if (companyId) {
        sql += ` AND (company_id = $2 OR company_id IS NULL)`;
        params.push(companyId);
    } else {
        sql += ` AND company_id IS NULL`;
    }

    sql += ` ORDER BY company_id DESC LIMIT 1`; // Company-specific overrides global

    const { rows } = await query(sql, params);
    return rows[0]?.config_value || null;
}

/**
 * Save a configuration value.
 */
export async function setAppConfig(key: string, value: any, companyId?: string) {
    const valueJson = JSON.stringify(value);
    
    // UPSERT pattern
    const existing = await query(
        `SELECT id FROM app_config WHERE config_key = $1 AND (company_id = $2 OR (company_id IS NULL AND $2 IS NULL))`,
        [key, companyId || null]
    );

    if (existing.rows.length > 0) {
        await query(
            `UPDATE app_config SET config_value = $2, updated_at = NOW() WHERE id = $1`,
            [existing.rows[0].id, valueJson]
        );
    } else {
        await query(
            `INSERT INTO app_config (config_key, config_value, company_id) VALUES ($1, $2, $3)`,
            [key, valueJson, companyId || null]
        );
    }
}

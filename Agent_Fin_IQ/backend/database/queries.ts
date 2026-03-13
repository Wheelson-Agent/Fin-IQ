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
// AP INVOICES
// ─────────────────────────────────────────────────────────────

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
               invoice_number as invoice_no, 
               invoice_date as date, 
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total
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
               invoice_number as invoice_no, 
               invoice_date as date, 
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total
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

        `UPDATE ap_invoices SET
       invoice_number = COALESCE($2, invoice_number),
       vendor_name = COALESCE($3, vendor_name),
       invoice_date = COALESCE($4::date, invoice_date),
       due_date = COALESCE($5::date, due_date),
       sub_total = COALESCE($6, sub_total),
       tax_total = COALESCE($7, tax_total),
       grand_total = COALESCE($8, grand_total),
       po_number = COALESCE($9, po_number),
       gl_account = COALESCE($10, gl_account),
       ocr_raw_payload = COALESCE($11::jsonb, ocr_raw_payload),
       processing_status = COALESCE($12, processing_status),
       processing_time = COALESCE($13, processing_time),
       doc_type = COALESCE($14, doc_type),
       posted_to_tally_json = COALESCE($15::jsonb, posted_to_tally_json),
       all_data_invoice = COALESCE($16::jsonb, all_data_invoice),
       file_location = COALESCE($17, file_location),
       file_path = COALESCE($18, file_path),
       tally_id = COALESCE($19, tally_id),
       uploader_name = COALESCE($20, uploader_name),
       vendor_id = COALESCE($21::uuid, vendor_id),
       is_mapped = COALESCE($22, is_mapped),
       vendor_gst = COALESCE($23, vendor_gst),
       validation_time = COALESCE($24, validation_time),
       updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
        [
            id,
            data.invoice_no, data.vendor_name, data.date, data.due_date,
            data.amount, data.gst, data.total, data.po_number, data.gl_account,
            data.ocr_raw_data ? JSON.stringify(data.ocr_raw_data) : null,
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
 * Mark an invoice as posted to Tally Prime.
 *
 * @param id - Invoice UUID
 * @param responseJson - Detailed response from Tally Prime
 * @param tallyId - Reference ID returned by Tally
 */
export async function markPostedToTally(id: string, responseJson?: object, tallyId?: string) {
    await query(
        `UPDATE ap_invoices SET 
          is_posted_to_tally = true, 
          processing_status = 'Auto-Posted', 
          posted_to_tally_json = COALESCE($2::jsonb, posted_to_tally_json),
          tally_id = COALESCE($3, tally_id),
          updated_at = NOW() 
        WHERE id = $1`,
        [id, responseJson ? JSON.stringify(responseJson) : null, tallyId || null]
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
    let sql = `SELECT id, name, parent_group, account_type as ledger_type, erp_sync_id as tally_guid, is_active FROM ledger_master WHERE is_active = true`;
    const params: any[] = [];

    // Optional company filtering, though expense/tax ledgers might be global (NULL)
    if (companyId) {
        sql += ` AND (company_id = $1 OR company_id IS NULL)`;
        params.push(companyId);
    }
    sql += ` ORDER BY account_type, name`;

    const { rows } = await query(sql, params);
    return rows;
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
        (ap_invoice_id, item_id, description, gl_account_id, tax, quantity, unit_price, discount, line_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                invoiceId, item.item || null, item.description, item.ledger || null, item.tax,
                item.quantity || 1, item.rate || 0, item.discount || 0,
                item.amount || (Number(item.quantity || 1) * Number(item.rate || 0))
            ]
        );
        results.push(res.rows[0]);
    }
    return results;
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
    // 0. Handle structure mismatch (n8n might send an Array or a single Object)
    let payload: any;
    if (Array.isArray(n8nData)) {
        payload = n8nData[0];
    } else {
        payload = n8nData;
    }

    if (!payload || !payload.ap_invoices || payload.ap_invoices.length === 0) {
        console.warn('[DB] ingestN8nData: Missing ap_invoices in payload', payload);
        throw new Error('Invalid n8n data payload: missing ap_invoices');
    }

    const invData = payload.ap_invoices[0];
    console.log(`[DB] Ingesting Invoice: ${invoiceId} - Number: ${invData.invoice_number || invData.invoiceNo}`);
    const rawValData = invData.n8n_val_json_data || {};
    const valString = typeof rawValData === 'string' ? rawValData : JSON.stringify(rawValData);

    // Key aliases for invoice (handling various naming conventions from different n8n flows)
    if (invData.invoice_no !== undefined && invData.invoice_number === undefined) invData.invoice_number = invData.invoice_no;
    if (invData.invoiceNo !== undefined && invData.invoice_number === undefined) invData.invoice_number = invData.invoiceNo;
    if (invData.date !== undefined && invData.invoice_date === undefined) invData.invoice_date = invData.date;
    if (invData.invoiceDate !== undefined && invData.invoice_date === undefined) invData.invoice_date = invData.invoiceDate;
    if (invData.amount !== undefined && invData.sub_total === undefined) invData.sub_total = invData.amount;
    if (invData.subTotal !== undefined && invData.sub_total === undefined) invData.sub_total = invData.subTotal;
    if (invData.gst !== undefined && invData.tax_total === undefined) invData.tax_total = invData.gst;
    if (invData.taxTotal !== undefined && invData.tax_total === undefined) invData.tax_total = invData.taxTotal;
    if (invData.total !== undefined && invData.grand_total === undefined) invData.grand_total = invData.total;
    if (invData.grandTotal !== undefined && invData.grand_total === undefined) invData.grand_total = invData.grandTotal;

    // 1. Upsert Vendor if missing
    let vendorId = invData.vendor_id || null;
    if (invData.vendor_name) {
        const existingVendor = await query('SELECT * FROM vendors WHERE LOWER(name) = LOWER($1)', [invData.vendor_name]);
        if (existingVendor.rows.length > 0) {
            vendorId = existingVendor.rows[0].id;
        } else {
            const newVendor = await query(
                `INSERT INTO vendors (name, gstin) VALUES ($1, $2) RETURNING id`,
                [invData.vendor_name, invData.vendor_gst || null]
            );
            vendorId = newVendor.rows[0].id;
        }
    }

    // Determine status
    let finalStatus = 'Ready';
    if (invData.n8n_validation_status === 'Failed' || !vendorId || !invData.invoice_number) {
        finalStatus = 'Awaiting Input';
    } else if (invData.processing_status && invData.processing_status !== 'Processing') {
        finalStatus = invData.processing_status;
    }

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
    
    // Default Overrides
    invData.vendor_id = vendorId;
    invData.n8n_val_json_data = valString;
    invData.n8n_validation_status = invData.n8n_validation_status || 'Pending';
    invData.processing_status = finalStatus;
    invData.validation_time = new Date().toISOString();
    invData.doc_type = invData.doc_type || 'goods';

    // 2. Dynamic Update Invoice Row
    const invoiceKeys = Object.keys(invData).filter(k => allowedApInvoicesCols.includes(k) && invData[k] !== undefined);
    if (invoiceKeys.length > 0) {
        let updateSql = `UPDATE ap_invoices SET `;
        const updateParams = [invoiceId];
        const setClauses = invoiceKeys.map((key, idx) => {
            updateParams.push(invData[key]);
            return `${key} = $${idx + 2}`;
        });
        updateSql += setClauses.join(', ') + ` WHERE id = $1`;
        await query(updateSql, updateParams);
    }

    // 3. Line Items Mapping
    if (payload.ap_invoice_lines) {
        await query('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);

        for (const line of payload.ap_invoice_lines) {
            // LEDGER RESOLUTION LOGIC
            // Look in order: mapped_ledger -> gl_account_id -> ledger -> possible_gl_names
            const ledgerCandidates = [
                line.mapped_ledger,
                line.gl_account_id,
                line.ledger,
                line.possible_gl_names
            ].filter(v => v && typeof v === 'string');

            let resolvedLedgerId = null;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            for (const candidate of ledgerCandidates) {
                // If it's already a valid UUID, use it
                if (uuidRegex.test(candidate)) {
                    resolvedLedgerId = candidate;
                    break;
                }
                // Try to find by name in ledger_master
                const ledgerRes = await query('SELECT id FROM ledger_master WHERE LOWER(name) = LOWER($1)', [candidate]);
                if (ledgerRes.rows.length > 0) {
                    resolvedLedgerId = ledgerRes.rows[0].id;
                    break;
                }
            }

            // Field Aliases for lines
            if (line.qty !== undefined && line.quantity === undefined) line.quantity = line.qty;
            if (line.quantity_pcs !== undefined && line.quantity === undefined) line.quantity = line.quantity_pcs;
            if (line.rate_per_pcs !== undefined && line.unit_price === undefined) line.unit_price = line.rate_per_pcs;
            if (line.unitPrice !== undefined && line.unit_price === undefined) line.unit_price = line.unitPrice;
            if (line.total_amount !== undefined && line.line_amount === undefined) line.line_amount = line.total_amount;
            if (line.lineAmount !== undefined && line.line_amount === undefined) line.line_amount = line.lineAmount;

            line.ap_invoice_id = invoiceId;
            
            // Critical Fix: Ensure gl_account_id and ledger_id are ONLY UUIDs or null
            line.gl_account_id = resolvedLedgerId;
            line.ledger_id = resolvedLedgerId;

            // Strict UUID cleaning for any potential UUID column
            const uuidCols = ["gl_account_id", "ledger_id", "ap_invoice_id", "item_id", "cost_center_id"];
            const uuidRegexLooser = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            
            for (const col of uuidCols) {
                if (line[col] && typeof line[col] === 'string') {
                    if (!uuidRegexLooser.test(line[col])) {
                        console.warn(`[DB] Rejecting invalid UUID for column ${col}: "${line[col]}"`);
                        line[col] = null;
                    }
                }
            }

            const lineKeys = Object.keys(line).filter(k => allowedLinesCols.includes(k) && line[k] !== undefined);
            if(lineKeys.length === 0) continue;

            const lineParams = lineKeys.map(k => line[k]);
            const paramPlaceholders = lineKeys.map((_, idx) => `$${idx + 1}`).join(', ');
            
            const insertLineSql = `INSERT INTO ap_invoice_lines (${lineKeys.join(', ')}) VALUES (${paramPlaceholders})`;
            console.log(`[DB] Inserting Line: ${line.line_number || '?'}`);
            await query(insertLineSql, lineParams);
        }
    } else {
        console.warn(`[DB] No lines found in payload for invoice: ${invoiceId}`);
    }

    // 4. Ingest Taxes
    if (payload.ap_invoice_taxes) {
        await query('DELETE FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [invoiceId]);

        for (const tax of payload.ap_invoice_taxes) {
            let taxCodeId = null;
            const taxCandidates = [tax.tax_code_id, tax.tax_code, tax.description].filter(v => v);

            for (const candidate of taxCandidates) {
                if (candidate.length > 20 && candidate.includes('-')) {
                    taxCodeId = candidate;
                    break;
                }
                const taxRes = await query('SELECT id FROM tax_codes WHERE LOWER(tax_code) = LOWER($1) OR LOWER(description) = LOWER($1)', [candidate]);
                if (taxRes.rows.length > 0) {
                    taxCodeId = taxRes.rows[0].id;
                    break;
                }
            }

            tax.ap_invoice_id = invoiceId;
            tax.tax_code_id = taxCodeId;

            const taxKeys = Object.keys(tax).filter(k => allowedTaxCols.includes(k) && tax[k] !== undefined);
            if(taxKeys.length === 0) continue;
            
            const taxParams = taxKeys.map(k => tax[k]);
            const paramPlaceholders = taxKeys.map((_, idx) => `$${idx + 1}`).join(', ');

            const insertTaxSql = `INSERT INTO ap_invoice_taxes (${taxKeys.join(', ')}) VALUES (${paramPlaceholders})`;
            await query(insertTaxSql, taxParams);
        }
    }

    return { success: true, id: invoiceId };
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

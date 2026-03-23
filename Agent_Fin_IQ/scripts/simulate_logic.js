import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

// Mimic evaluateInvoiceStatus logic from backend/database/queries.ts
async function simulateEvaluate(validationData, vendorId, invoiceNumber, lineItems, n8nStatus, companyId, grandTotal) {
    const getVal = (key) => {
        const val = validationData[key] ?? validationData[key.toLowerCase().replace(/ /g, '_')];
        return val === true || String(val).toLowerCase() === 'true';
    };

    const buyerPassed = getVal('buyer_verification');
    const gstPassed = getVal('gst_validation_status');
    const dataPassed = getVal('invoice_ocr_data_valdiation');
    const duplicatePassed = getVal('duplicate_check');
    const stockItemsMatch = getVal('line_item_match_status');
    const vendorPassed = getVal('vendor_verification') && !!vendorId;
    const ledgerPassed = lineItems.length > 0 && lineItems.every(li => li.ledger_id || li.gl_account_id);

    const majorChecksPassed = buyerPassed && gstPassed && dataPassed && duplicatePassed && stockItemsMatch;
    const hasInvoiceNo = !!(invoiceNumber && invoiceNumber !== 'Unknown' && invoiceNumber !== 'N/A');

    if (n8nStatus === 'Failed') return 'Handoff';

    if (majorChecksPassed) {
        if (vendorPassed && ledgerPassed && hasInvoiceNo) {
            return 'Ready to Post';
        } else {
            return 'Awaiting Input';
        }
    } else {
        return 'Handoff';
    }
}

async function check() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        const id = 'c2e99442-26a7-48a2-b799-743cd1b43b8e';
        const result = await pool.query(`
            SELECT id, invoice_number, n8n_validation_status, n8n_val_json_data, 
                   vendor_id, company_id, grand_total, ocr_raw_payload
            FROM ap_invoices 
            WHERE id = $1
        `, [id]);
        
        if (result.rows.length === 0) { console.log('Not found'); return; }
        const r = result.rows[0];

        const lineItemsRes = await pool.query('SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);

        let n8nVal = typeof r.n8n_val_json_data === 'string' ? JSON.parse(r.n8n_val_json_data) : (r.n8n_val_json_data || {});
        
        const finalStatus = await simulateEvaluate(
            n8nVal, 
            r.vendor_id, 
            r.invoice_number, 
            lineItemsRes.rows,
            r.n8n_validation_status,
            r.company_id,
            r.grand_total
        );

        console.log(`SIMULATED STATUS for ${r.invoice_number}: ${finalStatus}`);
        console.log(`Current DB status: Processing`);
        console.log(`n8nVal keys: ${Object.keys(n8nVal)}`);
        console.log(`duplicate_check: ${n8nVal.duplicate_check}`);

    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

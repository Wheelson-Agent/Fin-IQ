import { query, closePool } from '../../backend/database/connection';

async function check() {
    try {
        const invId = 'eac6be11-3046-47d2-94c2-3fc7868eda32';
        const inv = await query('SELECT * FROM ap_invoices WHERE id = $1', [invId]);
        console.log('--- INVOICE ---');
        console.log(JSON.stringify(inv.rows[0], null, 2));

        const lines = await query('SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invId]);
        console.log('--- LINES ---');
        console.log(JSON.stringify(lines.rows, null, 2));
        
        if (inv.rows[0]) {
            console.log('\nStatus:', inv.rows[0].processing_status);
            console.log('Vendor ID:', inv.rows[0].vendor_id);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await closePool();
    }
}

check();

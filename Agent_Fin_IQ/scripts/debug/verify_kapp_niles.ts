
import { query } from '../../backend/database/connection';
async function run() {
    const invoiceId = '085e71c2-ff6e-4bc0-801d-2ec9c186498e';
    try {
        console.log('---VERIFY_START---');
        const inv = await query('SELECT * FROM ap_invoices WHERE id = $1', [invoiceId]);
        console.log('INV|' + JSON.stringify(inv.rows[0]));

        const lines = await query('SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1', [invoiceId]);
        console.log('LINES|' + JSON.stringify(lines.rows));

        const taxes = await query('SELECT t.*, tc.tax_code FROM ap_invoice_taxes t JOIN tax_codes tc ON t.tax_code_id = tc.id WHERE t.ap_invoice_id = $1', [invoiceId]);
        console.log('TAXES|' + JSON.stringify(taxes.rows));

        console.log('---VERIFY_END---');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

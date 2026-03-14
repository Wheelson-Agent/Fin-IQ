
import { query } from './backend/database/connection';
async function run() {
    const id = '878ced8a-664e-4794-a29a-b0ef6467ba1a';
    try {
        console.log('--- DATA FOR INVOICE 878ced8a-664e-4794-a29a-b0ef6467ba1a ---');
        
        const inv = await query("SELECT * FROM ap_invoices WHERE id = $1", [id]);
        console.log('INVOICE:', JSON.stringify(inv.rows[0], null, 2));

        const lines = await query("SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1", [id]);
        console.log('LINES:', JSON.stringify(lines.rows, null, 2));

        const taxes = await query("SELECT * FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [id]);
        console.log('TAXES:', JSON.stringify(taxes.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

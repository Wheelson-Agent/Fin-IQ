
import { query } from '../../backend/database/connection';
async function run() {
    const id = '878ced8a-664e-4794-a29a-b0ef6467ba1a';
    try {
        const inv = await query("SELECT * FROM ap_invoices WHERE id = $1", [id]);
        const lines = await query("SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1", [id]);
        const taxes = await query("SELECT * FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [id]);

        console.log('---DB_START---');
        console.log('INVOICE|' + JSON.stringify(inv.rows[0]));
        console.log('LINES|' + JSON.stringify(lines.rows));
        console.log('TAXES|' + JSON.stringify(taxes.rows));
        console.log('---DB_END---');

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

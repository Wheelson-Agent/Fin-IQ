
import { query } from '../../backend/database/connection';
async function run() {
    const id = '0a526c9c-6fff-41ec-a392-eee2141b2efd';
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

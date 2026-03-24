
import { query } from '../../backend/database/connection';

async function run() {
    const id = 'f6d20dfc-3869-4f3b-a86e-84999e8e4529';
    try {
        console.log('--- INVOICE ---');
        const inv = await query('SELECT * FROM ap_invoices WHERE id = $1', [id]);
        console.log(JSON.stringify(inv.rows[0], null, 2));
        
        console.log('\n--- LINE ITEMS ---');
        const items = await query('SELECT * FROM ap_invoice_lines WHERE invoice_id = $1', [id]);
        console.log(JSON.stringify(items.rows, null, 2));
        
        console.log('\n--- TAXES ---');
        const taxes = await query('SELECT * FROM ap_invoice_taxes WHERE invoice_id = $1', [id]);
        console.log(JSON.stringify(taxes.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

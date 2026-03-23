
import { query } from '../../backend/database/connection';

async function check(id: string, label: string) {
    console.log(`\n=== CHECKING ${label}: ${id} ===`);
    const inv = await query("SELECT id, invoice_number, processing_status FROM ap_invoices WHERE id = $1", [id]);
    console.log('Invoice:', inv.rows[0]);

    const lines = await query("SELECT COUNT(*)::int as count FROM ap_invoice_lines WHERE ap_invoice_id = $1", [id]);
    console.log('Line Count:', lines.rows[0].count);

    const taxes = await query("SELECT COUNT(*)::int as count FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [id]);
    console.log('Tax Count:', taxes.rows[0].count);

    if (lines.rows[0].count > 0) {
        const lineSample = await query("SELECT description, gl_account_id, ledger_id FROM ap_invoice_lines WHERE ap_invoice_id = $1 LIMIT 1", [id]);
        console.log('Line Sample:', lineSample.rows[0]);
    }
}

async function run() {
    await check('c45fbc35-844b-431b-b563-267b33dff542', 'Response 1 (Null Description)');
    await check('ba215ccf-57d8-4225-9c6e-b313af43b487', 'Response 2 (With Description)');
    process.exit(0);
}
run();

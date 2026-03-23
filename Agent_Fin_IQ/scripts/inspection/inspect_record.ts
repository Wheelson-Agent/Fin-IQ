
import { query } from '../../backend/database/connection';
const invoiceId = process.argv[2];

if (!invoiceId) {
    console.error('Usage: npx tsx inspect_record.ts <invoiceId>');
    process.exit(1);
}

async function run() {
    try {
        console.log(`--- INSPECTING RECORD: ${invoiceId} ---`);
        const inv = await query("SELECT * FROM ap_invoices WHERE id = $1", [invoiceId]);
        console.log('\n--- INVOICE ---');
        console.log(JSON.stringify(inv.rows[0], null, 2));

        const lines = await query("SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1", [invoiceId]);
        console.log('\n--- LINES ---');
        console.log(JSON.stringify(lines.rows, null, 2));

        const taxes = await query("SELECT * FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [invoiceId]);
        console.log('\n--- TAXES ---');
        console.log(JSON.stringify(taxes.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

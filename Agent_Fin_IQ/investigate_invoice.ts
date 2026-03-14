
import { query } from './backend/database/connection';
import fs from 'fs';

async function run() {
    const invoiceId = '05c774f0-69b5-4a99-b849-49db515c61eb';
    const output: any = {};
    try {
        console.log(`--- INVESTIGATING INVOICE ID: ${invoiceId} ---`);
        const res = await query('SELECT * FROM ap_invoices WHERE id = $1', [invoiceId]);
        
        if (res.rows.length === 0) {
            output.error = 'Invoice not found';
            fs.writeFileSync('investigation_results.json', JSON.stringify(output, null, 2));
            process.exit(0);
        }

        const inv = res.rows[0];
        output.target_invoice = inv;
        
        console.log('\n--- CHECKING FOR DUPLICATES ---');
        const dups = await query(
            'SELECT id, file_name, invoice_number, vendor_id, vendor_name, created_at, processing_status FROM ap_invoices WHERE invoice_number = $1 AND vendor_id = $2 AND id != $3',
            [inv.invoice_number, inv.vendor_id, invoiceId]
        );
        
        output.duplicates = dups.rows;
        fs.writeFileSync('investigation_results.json', JSON.stringify(output, null, 2));
        console.log('Results saved to investigation_results.json');

    } catch (e: any) {
        console.error(e);
        output.error = e.message;
        fs.writeFileSync('investigation_results.json', JSON.stringify(output, null, 2));
    }
    process.exit(0);
}

run();

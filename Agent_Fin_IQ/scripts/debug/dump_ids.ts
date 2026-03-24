
import { query } from '../../backend/database/connection';
import fs from 'fs';
async function run() {
    try {
        const res = await query("SELECT id, file_name FROM ap_invoices LIMIT 100");
        const lines = res.rows.map(r => `${r.id} | ${r.file_name}`).join('\n');
        fs.writeFileSync('all_invoice_ids.txt', lines);
        console.log('Saved to all_invoice_ids.txt');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

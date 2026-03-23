
import { query } from '../../backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT id, file_name, invoice_number, invoice_date, grand_total, processing_status FROM ap_invoices WHERE file_name = 'GST amount not capctured.jpg' LIMIT 1");
        console.log('--- FOUND RECORD ---');
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

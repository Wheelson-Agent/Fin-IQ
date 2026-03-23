
import { query } from '../../backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT id, file_name, created_at FROM ap_invoices WHERE file_name = 'GST amount not capctured.jpg'");
        console.log('--- MATCHING RECORDS ---');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();


import { query } from './backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT id, file_name FROM ap_invoices WHERE file_name ILIKE '%GST amount not capctured%'");
        console.log('--- FOUND ---');
        res.rows.forEach(r => console.log(`${r.id} | ${r.file_name}`));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

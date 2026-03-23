
import { query } from '../../backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT file_name FROM ap_invoices LIMIT 500");
        console.log('--- ALL FILES ---');
        res.rows.forEach(r => console.log(r.file_name));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

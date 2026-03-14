
import { query } from './backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT * FROM ap_invoices WHERE file_name = 'GST amount not capctured.jpg' LIMIT 1");
        console.log('--- RAW RECORD ---');
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

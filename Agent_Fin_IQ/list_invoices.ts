
import { query } from './backend/database/connection';
async function list() {
    try {
        const res = await query("SELECT id, file_name, status, vendor_name FROM invoices ORDER BY created_at DESC LIMIT 5");
        console.log('--- RECENT INVOICES ---');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
list();

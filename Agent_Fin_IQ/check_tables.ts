
import { query } from './backend/database/connection';
async function check() {
    try {
        const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('--- TABLES ---');
        console.log(res.rows.map(r => r.table_name).join(', '));

        const res2 = await query("SELECT COUNT(*) FROM invoices");
        console.log('Invoices count:', res2.rows[0].count);

        const res3 = await query("SELECT COUNT(*) FROM invoice_items");
        console.log('Invoice items count:', res3.rows[0].count);
    } catch (e) {
        console.error('Error checking DB:', e);
    }
    process.exit(0);
}
check();


import { query } from '../../backend/database/connection';
async function list() {
    try {
        const res = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('--- TABLES ---');
        res.rows.forEach(r => console.log(r.tablename));

        const res2 = await query("SELECT id, invoice_number, file_name, processing_status FROM ap_invoices LIMIT 5");
        console.log('\n--- AP_INVOICES SAMPLE ---');
        res2.rows.forEach(r => console.log(r));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
list();

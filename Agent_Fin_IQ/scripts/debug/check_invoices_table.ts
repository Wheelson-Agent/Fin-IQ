
import { query } from '../../backend/database/connection';
async function exists() {
    try {
        const res = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'invoices'");
        console.log('--- INVOICES EXISTS? ---');
        console.log(res.rows.length > 0 ? 'YES' : 'NO');
        
        if (res.rows.length > 0) {
            const res2 = await query("SELECT id FROM invoices LIMIT 1");
            console.log('Sample ID from invoices:', res2.rows[0]?.id);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
exists();

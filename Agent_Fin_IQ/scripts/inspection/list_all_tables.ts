
import { query } from '../../backend/database/connection';
async function list() {
    try {
        const res = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");
        console.log('--- TABLES ---');
        res.rows.forEach(r => console.log(r.tablename));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
list();


import { query } from './backend/database/connection';
import fs from 'fs';
async function check() {
    try {
        const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoices'");
        const columns = res.rows.map(r => `${r.column_name} (${r.data_type})`);
        fs.writeFileSync('columns.json', JSON.stringify(columns, null, 2));
    } catch (e) {
        fs.writeFileSync('columns.json', JSON.stringify({ error: e.message }, null, 2));
    }
    process.exit(0);
}
check();

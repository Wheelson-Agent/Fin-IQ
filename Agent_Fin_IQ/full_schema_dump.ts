import { query } from './backend/database/connection';
import fs from 'fs';

async function run() {
    try {
        const tables = ['ap_invoices', 'ap_invoice_lines', 'ap_invoice_taxes'];
        const fullSchema = {};
        for (const t of tables) {
            const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [t]);
            fullSchema[t] = res.rows.map(r => r.column_name);
        }
        fs.writeFileSync('FULL_SCHEMA_DUMP.json', JSON.stringify(fullSchema, null, 2));
        console.log('SCHEMA DUMPED TO FULL_SCHEMA_DUMP.json');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

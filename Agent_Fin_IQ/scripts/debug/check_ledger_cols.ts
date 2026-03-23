
import { query } from '../../backend/database/connection';
async function cols() {
    try {
        const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ledger_master' ORDER BY ordinal_position");
        console.log('--- LEDGER_MASTER COLUMNS ---');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
cols();

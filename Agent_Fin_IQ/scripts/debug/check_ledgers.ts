
import { query } from '../../backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT COUNT(*) FROM ledger_master");
        console.log('--- LEDGER MASTER COUNT ---');
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

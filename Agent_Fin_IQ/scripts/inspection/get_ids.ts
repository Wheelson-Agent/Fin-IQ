import { query } from '../../backend/database/connection';
async function run() {
    const res = await query('SELECT id, company_id FROM ap_invoices WHERE company_id IS NOT NULL LIMIT 1');
    console.log(JSON.stringify(res.rows[0]));
    process.exit(0);
}
run();

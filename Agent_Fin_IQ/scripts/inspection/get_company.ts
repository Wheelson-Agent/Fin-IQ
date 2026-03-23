import { query } from '../../backend/database/connection';
async function run() {
    const res = await query('SELECT id FROM companies LIMIT 1');
    if (res.rows.length > 0) {
        console.log(res.rows[0].id);
    } else {
        console.log('NO_COMPANY_FOUND');
    }
    process.exit(0);
}
run();

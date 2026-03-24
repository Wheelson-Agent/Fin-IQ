import { query } from '../../backend/database/connection';
async function run() {
  const res = await query('SELECT id, file_name FROM ap_invoices LIMIT 1');
  console.log(res.rows[0]);
  process.exit(0);
}
run();

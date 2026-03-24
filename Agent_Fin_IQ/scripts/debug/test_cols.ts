import { query } from '../../backend/database/connection';
async function run() {
  const tables = ['ap_invoices', 'ap_invoice_lines', 'ap_invoice_taxes'];
  for (const t of tables) {
    const res = await query(SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '');
    console.log(---  ---);
    for (const r of res.rows) {
      console.log(${r.column_name}: );
    }
  }
  process.exit(0);
}
run();

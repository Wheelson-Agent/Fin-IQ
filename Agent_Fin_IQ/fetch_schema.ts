import { query } from './backend/database/connection';
const fs = require('fs');
async function run() {
  const result = {};
  for (const t of ['ap_invoices', 'ap_invoice_lines', 'ap_invoice_taxes']) {
    const res = await query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ', [t]);
    result[t] = res.rows.map(r => r.column_name);
  }
  fs.writeFileSync('db_schema_actual.json', JSON.stringify(result, null, 2));
  process.exit(0);
}
run();

import { query } from '../../backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ap_invoice_taxes' ORDER BY ordinal_position");
        console.log('--- AP_INVOICE_TAXES COLUMNS ---');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

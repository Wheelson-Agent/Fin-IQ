
import { query } from '../../backend/database/connection';
async function check() {
    try {
        const res = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoices' ORDER BY ordinal_position");
        console.log('--- INVOICES TABLE COLUMNS ---');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

        const res2 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors' ORDER BY ordinal_position");
        console.log('\n--- VENDORS TABLE COLUMNS ---');
        res2.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

        const res3 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoice_items' ORDER BY ordinal_position");
        console.log('\n--- INVOICE_ITEMS TABLE COLUMNS ---');
        res3.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();

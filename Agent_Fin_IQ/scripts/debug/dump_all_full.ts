
import { query } from '../../backend/database/connection';
import fs from 'fs';
async function run() {
    try {
        const res = await query("SELECT * FROM ap_invoices");
        fs.writeFileSync('/tmp/full_invoices_dump.json', JSON.stringify(res.rows, null, 2));
        console.log('Dumped ' + res.rows.length + ' records to /tmp/full_invoices_dump.json');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

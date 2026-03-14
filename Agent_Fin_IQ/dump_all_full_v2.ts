
import { query } from './backend/database/connection';
import fs from 'fs';
async function run() {
    try {
        const res = await query("SELECT * FROM ap_invoices");
        fs.writeFileSync('./dump_full.json', JSON.stringify(res.rows, null, 2));
        console.log('Dumped ' + res.rows.length + ' records to ./dump_full.json');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();

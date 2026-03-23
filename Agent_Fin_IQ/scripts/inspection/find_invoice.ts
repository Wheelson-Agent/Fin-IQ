
import { query } from '../../backend/database/connection';
async function find() {
    try {
        const id = '4f23700f-d829-4cb4-93b0-d4f15924d74c';
        const res = await query("SELECT * FROM ap_invoices WHERE id = $1", [id]);
        if (res.rows.length > 0) {
            console.log('--- FOUND ---');
            console.log(res.rows[0]);
        } else {
            console.log('--- NOT FOUND ---');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
find();

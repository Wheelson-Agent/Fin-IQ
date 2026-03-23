
import { query } from '../../backend/database/connection';
async function inspect() {
    try {
        const id = '4f23700f-d829-4cb4-93b0-d4f15924d74c';
        const res = await query("SELECT * FROM ap_invoices WHERE id = $1", [id]);
        console.log('--- RAW COLUMNS ---');
        console.log(res.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
inspect();

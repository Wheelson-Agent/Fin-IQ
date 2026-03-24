
import { query } from '../../backend/database/connection';
async function list() {
    try {
        const res = await query(`
            SELECT i.id, i.file_name, COUNT(l.id) as item_count 
            FROM ap_invoices i 
            JOIN ap_invoice_lines l ON i.id = l.ap_invoice_id 
            GROUP BY i.id, i.file_name 
            LIMIT 5
        `);
        console.log('--- INVOICES WITH ITEMS ---');
        res.rows.forEach(r => console.log(r));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
list();

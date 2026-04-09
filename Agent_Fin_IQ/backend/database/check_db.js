
import { pool } from './connection.js';

async function check() {
    try {
        console.log("--- COMPANIES ---");
        const companies = await pool.query('SELECT id, name, gstin FROM companies');
        console.table(companies.rows);

        console.log("\n--- LATEST INVOICES (NULL COMPANY) ---");
        const invs = await pool.query('SELECT id, file_name, company_id, vendor_name, vendor_gst, created_at FROM ap_invoices WHERE company_id IS NULL ORDER BY created_at DESC LIMIT 5');
        console.table(invs.rows);

        await pool.end();
    } catch (e) {
        console.error(e);
    }
}
check();

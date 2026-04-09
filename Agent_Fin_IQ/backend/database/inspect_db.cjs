
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../config/.env') });

async function check() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log("--- COMPANIES ---");
        const companies = await pool.query('SELECT id, name, gstin FROM companies');
        console.log(JSON.stringify(companies.rows, null, 2));

        console.log("\n--- INVOICES FAILED ---");
        const invs = await pool.query('SELECT id, file_name, company_id, vendor_name FROM ap_invoices ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(invs.rows, null, 2));

        await pool.end();
    } catch (e) {
        console.error(e);
    }
}
check();

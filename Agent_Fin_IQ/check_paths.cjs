const { Pool } = require('pg');
require('dotenv').config({ path: 'config/.env' });
const pool = new Pool({
    user: process.env.DB_USER, host: process.env.DB_HOST,
    database: process.env.DB_NAME, password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT, ssl: { rejectUnauthorized: false }
});

async function findCorrupted() {
    try {
        const res = await pool.query("SELECT id, file_name, file_path FROM invoices WHERE file_path LIKE '%2.jpg' OR file_path LIKE '%pg' LIMIT 10");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) { console.error(e); } finally { pool.end(); }
}
findCorrupted();

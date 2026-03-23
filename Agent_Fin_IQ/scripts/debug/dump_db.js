import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: './config/.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        const res = await pool.query("SELECT id, status, pre_ocr_status, failure_reason, file_path FROM invoices ORDER BY id DESC LIMIT 5");
        fs.writeFileSync('db_output.json', JSON.stringify(res.rows, null, 2));
        console.log("Wrote Output");
    } catch (err) {
        fs.writeFileSync('db_output.json', JSON.stringify({ error: err.message }, null, 2));
    } finally {
        process.exit(0);
    }
}
run();

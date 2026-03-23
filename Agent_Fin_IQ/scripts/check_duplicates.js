import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

async function check() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        const result = await pool.query(`
            SELECT id, invoice_number, processing_status, created_at 
            FROM ap_invoices 
            WHERE invoice_number = 'LA0447/24-25'
        `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

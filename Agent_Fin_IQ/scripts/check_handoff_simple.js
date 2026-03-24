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
        user: process.env.DB_USER, host: process.env.DB_HOST,
        database: process.env.DB_NAME, password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        const res = await pool.query("SELECT id, invoice_number, n8n_val_json_data FROM ap_invoices LIMIT 100");
        res.rows.forEach(row => {
            const n8n = typeof row.n8n_val_json_data === 'string' ? JSON.parse(row.n8n_val_json_data) : (row.n8n_val_json_data || {});
            const typo = n8n['invoice_ocr_data_valdiation'] === true || String(n8n['invoice_ocr_data_valdiation']).toLowerCase() === 'true';
            const correct = n8n['invoice_ocr_data_validation'] === true || String(n8n['invoice_ocr_data_validation']).toLowerCase() === 'true';
            
            if (typo && !correct) {
                console.log(`DISCREPANCY: ${row.invoice_number} | ID: ${row.id}`);
            }
        });
    } catch (err) { console.error(err.message); } finally { await pool.end(); }
}
check();

import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

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
            SELECT id, invoice_number, processing_status, n8n_validation_status, n8n_val_json_data 
            FROM ap_invoices 
            WHERE processing_status = 'Processing'
        `);
        console.log(`Found ${result.rows.length} processing invoices`);
        result.rows.forEach(r => {
            console.log(`ID: ${r.id} | No: ${r.invoice_number} | n8n: ${r.n8n_validation_status}`);
            console.log(`Val Data: ${JSON.stringify(r.n8n_val_json_data, null, 2)}`);
            console.log('---');
        });
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

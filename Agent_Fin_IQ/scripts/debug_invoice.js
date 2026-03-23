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
        database: 'agent_tally',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        const id = 'd976f779-5c08-4c9c-abd5-cce0006c3df4';
        const result = await pool.query(`
            SELECT id, invoice_number, processing_status, n8n_validation_status, 
                   n8n_val_json_data, ocr_raw_payload, vendor_id, company_id, grand_total
            FROM ap_invoices 
            WHERE id = $1
        `, [id]);
        
        if (result.rows.length > 0) {
            fs.writeFileSync('scripts/debug_inv.json', JSON.stringify(result.rows[0], null, 2), 'utf8');
            console.log('Saved debug data to scripts/debug_inv.json');
        } else {
            console.log('Invoice not found');
        }

    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

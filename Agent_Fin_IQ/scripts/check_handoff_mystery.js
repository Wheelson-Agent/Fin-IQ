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
        const res = await pool.query(`
            SELECT id, invoice_number, processing_status, n8n_val_json_data, ocr_raw_payload 
            FROM ap_invoices 
            LIMIT 50
        `);

        console.log(`Checking ${res.rows.length} invoices to see which lead to 'handoff'...`);
        res.rows.forEach(row => {
            const n8n = typeof row.n8n_val_json_data === 'string' ? JSON.parse(row.n8n_val_json_data) : (row.n8n_val_json_data || {});
            
            const getVal = (key) => {
                const val = n8n[key];
                return val === true || String(val).toLowerCase() === 'true';
            };

            const bVerif = getVal('buyer_verification');
            const gValid = getVal('gst_validation_status');
            const dValidCorrect = getVal('invoice_ocr_data_validation');
            const dValidTypo = getVal('invoice_ocr_data_valdiation');
            const isDupPassed = getVal('duplicate_check');
            const vVerif = getVal('vendor_verification');
            
            // Simulation of APWorkspace logic
            const isHandoffUI = !bVerif || !gValid || !dValidCorrect || !isDupPassed;

            if (isHandoffUI) {
                console.log(`\nInvoice: ${row.invoice_number} | ID: ${row.id} | DB Status: ${row.processing_status}`);
                console.log(`  Validations: B=${bVerif}, G=${gValid}, D(Correct)=${dValidCorrect}, D(Typo)=${dValidTypo}, Dup=${isDupPassed}, V=${vVerif}`);
                if (dValidTypo === true && dValidCorrect === false) {
                    console.log(`  >>> DISCREPANCY DETECTED: Correct key is false/missing but Typo key is TRUE.`);
                }
            }
        });

    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

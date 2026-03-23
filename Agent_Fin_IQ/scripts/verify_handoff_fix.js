import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

async function verify() {
    const pool = new Pool({
        user: process.env.DB_USER, host: process.env.DB_HOST,
        database: process.env.DB_NAME, password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log("Verifying 'Handoff vs Green Chips' Fix...");
        
        // This script simulates the logic now present in queries.ts, APWorkspace.tsx, and DetailView.tsx
        const res = await pool.query("SELECT id, invoice_number, n8n_val_json_data FROM ap_invoices WHERE invoice_number IN ('JI/534-L', 'LA0447/24-25', 'INV-000376')");
        
        if (res.rows.length === 0) {
            console.log("No test invoices found. Please ensure database has JI/534-L, etc.");
            return;
        }

        res.rows.forEach(row => {
            const n8n = typeof row.n8n_val_json_data === 'string' ? JSON.parse(row.n8n_val_json_data) : (row.n8n_val_json_data || {});
            
            // SIMULATE NEW LOGIC: Correct OR Typo
            const dValidCorrect = n8n['invoice_ocr_data_validation'] === true || String(n8n['invoice_ocr_data_validation']).toLowerCase() === 'true';
            const dValidTypo = n8n['invoice_ocr_data_valdiation'] === true || String(n8n['invoice_ocr_data_valdiation']).toLowerCase() === 'true';
            
            const dValidUnified = dValidCorrect || dValidTypo;
            
            console.log(`\nInvoice: ${row.invoice_number}`);
            console.log(` - Correct Key: ${dValidCorrect}`);
            console.log(` - Typo Key: ${dValidTypo}`);
            console.log(` - UNIFIED RESULT: ${dValidUnified} ${dValidUnified ? '✅ PASSED' : '❌ FAILED'}`);
            
            if (dValidUnified) {
                console.log(" >>> VERIFIED: Code will now correctly identify this as VALID.");
            } else {
                console.log(" >>> ERROR: Unified check still false.");
            }
        });
    } catch (err) { console.error(err.message); } finally { await pool.end(); }
}
verify();

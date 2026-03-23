import { query, closePool } from './Agent_Fin_IQ/backend/database/connection';
import fs from 'fs';

async function run() {
    try {
        const result = await query(
            'SELECT id, invoice_number, vendor_name, vendor_gst, n8n_val_json_data, created_at FROM ap_invoices ORDER BY created_at DESC',
            []
        );
        
        fs.writeFileSync('all_invoices.json', JSON.stringify(result.rows, null, 2));
        console.log('Successfully wrote all invoices to all_invoices.json');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await closePool();
    }
}

run();

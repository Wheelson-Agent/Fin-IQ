
import { query } from './backend/database/connection';

async function run() {
    const targetId = '05c774f0-69b5-4a99-b849-49db515c61eb';
    const duplicateId = 'c93e254a-30a8-41c8-a43a-24163d98a1c5';

    try {
        console.log(`--- REMOVING DUPLICATE INVOICE: ${duplicateId} ---`);
        // We should also delete related items and taxes if any, 
        // but schema.sql says "ON DELETE CASCADE" for ap_invoice_lines and ap_invoice_taxes
        const delRes = await query('DELETE FROM ap_invoices WHERE id = $1', [duplicateId]);
        console.log(`Deleted rows: ${delRes.rowCount}`);

        console.log(`\n--- UPDATING TARGET INVOICE: ${targetId} ---`);
        
        // Fetch current data to make sure we don't overwrite other things accidentally
        const res = await query('SELECT n8n_val_json_data, ocr_raw_payload FROM ap_invoices WHERE id = $1', [targetId]);
        if (res.rows.length === 0) {
            console.error('Target invoice not found!');
            process.exit(1);
        }

        let n8nVal = res.rows[0].n8n_val_json_data;
        let ocrRaw = res.rows[0].ocr_raw_payload;

        // Update n8n_val_json_data (it's stored as a string in the DB based on previous view_file output)
        if (typeof n8nVal === 'string') {
            try {
                const parsed = JSON.parse(n8nVal);
                parsed.duplicate_check = false;
                n8nVal = JSON.stringify(parsed);
            } catch (e) {
                console.warn('Failed to parse n8n_val_json_data as JSON string, treating as object if possible');
            }
        } else if (n8nVal && typeof n8nVal === 'object') {
            n8nVal.duplicate_check = false;
        }

        // Update ocr_raw_payload (it's a JSONB field)
        if (ocrRaw && typeof ocrRaw === 'object') {
            ocrRaw.Duplicate_status = false;
        }

        const updateRes = await query(
            'UPDATE ap_invoices SET n8n_val_json_data = $1, ocr_raw_payload = $2, processing_status = $3 WHERE id = $4',
            [n8nVal, ocrRaw, 'Pending Approval', targetId]
        );
        console.log(`Updated rows: ${updateRes.rowCount}`);
        console.log('Cleanup and update complete.');

    } catch (e) {
        console.error('Error during cleanup:', e);
    }
    process.exit(0);
}

run();

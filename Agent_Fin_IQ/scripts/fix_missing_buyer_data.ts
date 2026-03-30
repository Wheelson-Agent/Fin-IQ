import { pool } from '../backend/database/connection';

async function syncBuyerData() {
    console.log('[SYNC] Starting retroactive buyer data sync...');
    try {
        const res = await pool.query(`
            SELECT id, ocr_raw_payload, n8n_val_json_data 
            FROM ap_invoices 
            WHERE (buyer_name IS NULL OR buyer_gst IS NULL OR round_off = '0' OR round_off IS NULL)
              AND ocr_raw_payload IS NOT NULL
        `);

        console.log(`[SYNC] Found ${res.rows.length} records to process.`);

        for (const row of res.rows) {
            let raw = row.ocr_raw_payload;
            if (typeof raw === 'string') raw = JSON.parse(raw);
            
            let n8n = row.n8n_val_json_data;
            if (typeof n8n === 'string') n8n = JSON.parse(n8n);

            const buyerName = raw?.['Buyer Name'] || raw?.['buyer_name'] || n8n?.['buyer_name'] || '';
            const buyerGst = raw?.['Buyer GST'] || raw?.['buyer_gst'] || n8n?.['buyer_gst'] || '';
            
            // Handle round off (prefer raw OCR value)
            let roundOff = raw?.['Round Off'] || raw?.['round_off'] || n8n?.['round_off'] || '0';
            
            // Clean round off string (remove parenthesis sign but keep numeral)
            if (typeof roundOff === 'string') {
              if (roundOff.includes('(-)') || roundOff.includes('-')) {
                const match = roundOff.match(/[\d.]+/);
                if (match) roundOff = '-' + match[0];
              } else {
                const match = roundOff.match(/[\d.]+/);
                if (match) roundOff = match[0];
              }
            }

            if (buyerName || buyerGst || (roundOff !== '0' && roundOff !== '')) {
                await pool.query(
                    'UPDATE ap_invoices SET buyer_name = $1, buyer_gst = $2, round_off = $3 WHERE id = $4',
                    [buyerName || null, buyerGst || null, roundOff || '0', row.id]
                );
                console.log(`[SYNC] Updated ID ${row.id}: ${buyerName} (${buyerGst})`);
            }
        }
        console.log('[SYNC] Completed successfully.');
    } catch (err) {
        console.error('[SYNC] Error during sync:', err);
    } finally {
        await pool.end();
    }
}

syncBuyerData();

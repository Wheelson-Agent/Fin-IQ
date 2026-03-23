
import { query, pool } from '../../backend/database/connection';

async function clearData() {
    console.log('--- STARTING FRESH: CLEARING ALL TRANSACTIONAL DATA ---');
    
    const tablesToClear = [
        'ap_invoice_taxes',
        'ap_invoice_lines',
        'ap_invoices',
        'service_entry_sheet_lines',
        'service_entry_sheets',
        'goods_receipt_lines',
        'goods_receipts',
        'purchase_order_lines',
        'purchase_orders',
        'batches',
        'audit_logs',
        'processing_jobs',
        'tally_sync_logs',
        'integration_queues',
        'vendors'
    ];

    try {
        console.log(`Clearing ${tablesToClear.length} tables...`);
        // We use CASCADE to ensure child-parent dependencies are handled correctly
        const truncateSql = `TRUNCATE TABLE ${tablesToClear.join(', ')} CASCADE`;
        await query(truncateSql);
        
        console.log('✅ All transactional data cleared successfully.');
        console.log('Masters (Ledgers, Tax Codes, Companies, Users) remain intact.');
    } catch (err) {
        console.error('❌ Failed to clear database:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

clearData();


import { query } from './backend/database/connection';

async function clearData() {
    console.log('--- CLEARING DATA ---');
    try {
        // Order matters due to FK constraints
        const tables = [
            'ap_invoice_taxes',
            'ap_invoice_lines',
            'ap_invoices',
            'audit_logs',
            'batches',
            'processing_jobs',
            'tally_sync_logs',
            'integration_queues',
            'goods_receipt_lines',
            'goods_receipts',
            'service_entry_sheet_lines',
            'service_entry_sheets',
            'purchase_order_lines',
            'purchase_orders'
        ];

        for (const table of tables) {
            console.log(`Truncating ${table}...`);
            await query(`TRUNCATE TABLE ${table} CASCADE`);
        }

        console.log('SUCCESS: All transactional data cleared.');
    } catch (e) {
        console.error('ERROR clearing data:', e);
    }
    process.exit(0);
}

clearData();

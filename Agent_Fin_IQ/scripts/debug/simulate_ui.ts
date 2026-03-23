
import { query } from '../../backend/database/connection';
import * as fs from 'fs';

async function simulateFrontend() {
    const sql = `
        SELECT *, 
               invoice_number as invoice_no, 
               invoice_date as date, 
               processing_status as status,
               sub_total as amount,
               tax_total as gst,
               grand_total as total
        FROM ap_invoices
        ORDER BY created_at DESC
    `;
    const res = await query(sql);
    const invoices = res.rows;
    
    const simulatedNow = new Date('2026-03-13T12:00:00Z');
    const dateFilter = 'This Month';

    const mapped = invoices.map((inv: any) => {
        let status = 'received';
        const bStatus = (inv.processing_status || '').toLowerCase();
        
        if (bStatus === 'processing') status = 'processing';
        else if (bStatus === 'pending approval') status = 'received';
        else if (bStatus === 'ready' || bStatus === 'verified') status = 'ready';
        else if (bStatus === 'failed' || bStatus === 'ocr_failed') status = 'handoff';
        else if (bStatus === 'auto-posted' || bStatus === 'posted') status = 'posted';
        else if (bStatus === 'awaiting input') status = 'input';

        return {
            id: inv.id,
            invoiceNo: inv.invoice_no || inv.invoice_number || inv.file_name || 'Unknown',
            date: inv.date ? new Date(inv.date).toISOString() : (inv.created_at ? new Date(inv.created_at).toISOString() : 'Unknown'),
            supplier: inv.vendor_name || 'Unknown',
            status: status,
            bStatus: bStatus
        };
    });

    const filtered = mapped.filter(record => {
        if (!record.date || record.date === 'Unknown') return true;
        const d = new Date(record.date);
        if (dateFilter === 'Today') {
            return d.toDateString() === simulatedNow.toDateString();
        } else if (dateFilter === 'This Week') {
            const weekAgo = new Date(simulatedNow.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= weekAgo;
        } else if (dateFilter === 'This Month') {
            return d.getMonth() === simulatedNow.getMonth() && d.getFullYear() === simulatedNow.getFullYear();
        }
        return true;
    });

    const output = {
        total_in_db: invoices.length,
        date_filter: dateFilter,
        simulated_now: simulatedNow.toISOString(),
        filtered_count: filtered.length,
        counts: {
            received: filtered.filter(r => r.status === 'received' || r.status === 'processing').length,
            ready: filtered.filter(r => r.status === 'ready').length,
            input: filtered.filter(r => r.status === 'input').length,
            handoff: filtered.filter(r => r.status === 'handoff').length,
            posted: filtered.filter(r => r.status === 'posted').length,
        },
        records: filtered
    };

    fs.writeFileSync('simulation_results.json', JSON.stringify(output, null, 2));
    console.log('Results written to simulation_results.json');
    process.exit(0);
}

simulateFrontend();

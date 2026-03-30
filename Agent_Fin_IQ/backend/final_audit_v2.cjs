const { Client } = require('pg');
const client = new Client({
    user: 'avnadmin',
    host: 'wheelson-postgres-hyperready-aiven-wheelson.h.aivencloud.com',
    database: 'agent_tally',
    password: 'AVNS_NSEzMfT8oDd-BdyggXx',
    port: 10174,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const invRes = await client.query('SELECT vendor_gst, updated_at, ocr_raw_payload FROM ap_invoices WHERE id = $1', ['8a050732-e77d-4e1b-8dbf-d6e82f47c109']);
        const logsRes = await client.query('SELECT event_type, user_name, description, timestamp, before_data, after_data FROM audit_logs WHERE invoice_id = $1 ORDER BY timestamp DESC', ['8a050732-e77d-4e1b-8dbf-d6e82f47c109']);
        
        console.log('--- FINAL REPORT V2: 8a050732-e77d-4e1b-8dbf-d6e82f47c109 ---');
        if (invRes.rows.length > 0) {
            const row = invRes.rows[0];
            console.log('Database Column (vendor_gst):', row.vendor_gst);
            console.log('Last Updated At:', row.updated_at);
            
            const raw = typeof row.ocr_raw_payload === 'string' ? JSON.parse(row.ocr_raw_payload) : row.ocr_raw_payload;
            console.log('JSON Keys Found:', Object.keys(raw).filter(k => k.toLowerCase().includes('gst') || k.toLowerCase().includes('vendor')));
            console.log('Full Raw Payload Keys:', Object.keys(raw).join(', '));
        } else {
            console.log('Invoice not found');
        }
        
        console.log('\n--- AUDIT HISTORY (Expanded) ---');
        logsRes.rows.forEach(log => {
            console.log(`${log.timestamp} | ${log.event_type} | ${log.user_name} | ${log.description}`);
            console.log(`   Before: ${log.before_data ? JSON.stringify(log.before_data) : 'N/A'}`);
            console.log(`   After:  ${log.after_data ? JSON.stringify(log.after_data) : 'N/A'}`);
        });
        
    } catch (err) {
        console.error('Audit Error:', err);
    } finally {
        await client.end();
    }
}

run();

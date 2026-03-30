import * as queries from './database/queries.js';

async function test() {
    const id = '8a050732-e77d-4e1b-8dbf-d6e82f47c109';
    const data = {
        vendor_gst: '33AAAFV0085H1Z0', // The corrected value
        invoice_no: 'TEST-123'
    };
    const items = [];
    
    try {
        console.log('Testing saveAllInvoiceData for ID:', id);
        const result = await queries.saveAllInvoiceData(id, data, items, 'TestUser');
        console.log('Save Succeeded! Result vendor_gst:', result.vendor_gst);
    } catch (err) {
        console.error('Save FAILED with error:', err);
    } finally {
        process.exit();
    }
}

test();

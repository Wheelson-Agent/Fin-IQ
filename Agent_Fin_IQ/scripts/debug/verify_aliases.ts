
import { getInvoiceById, getInvoiceItems } from '../../backend/database/queries';
async function test() {
    try {
        const id = '4f23700f-d829-4cb4-93b0-d4f15924d74c';
        
        console.log('--- TESTING getInvoiceById ---');
        const inv = await getInvoiceById(id);
        console.log('ID:', inv.id);
        console.log('Invoice No (aliased):', inv.invoice_no);
        console.log('Date (aliased):', inv.date);
        console.log('Status (aliased):', inv.status);
        console.log('Amount (aliased):', inv.amount);
        console.log('GST (aliased):', inv.gst);
        console.log('Total (aliased):', inv.total);
        console.log('File Path:', inv.file_path);
        
        console.log('\n--- TESTING getInvoiceItems ---');
        const items = await getInvoiceItems(id);
        if (items.length > 0) {
            const first = items[0];
            console.log('Item Ledger (aliased):', first.ledger);
            console.log('Item Rate (aliased):', first.rate);
            console.log('Item Amount (aliased):', first.amount);
            console.log('Item Qty:', first.quantity);
        } else {
            console.log('No items found');
        }
    } catch (e) {
        console.error('--- ERROR ---');
        console.error(e);
    }
    process.exit(0);
}
test();

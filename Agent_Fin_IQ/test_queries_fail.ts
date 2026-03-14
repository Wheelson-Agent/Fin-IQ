
import { getInvoiceItems, getLedgerMasters } from './backend/database/queries';
async function test() {
    try {
        const id = '4f23700f-d829-4cb4-93b0-d4f15924d74c';
        
        console.log('--- TESTING getInvoiceItems ---');
        const items = await getInvoiceItems(id);
        console.log(`Found ${items.length} items`);
        
        console.log('\n--- TESTING getLedgerMasters ---');
        const ledgers = await getLedgerMasters();
        console.log(`Found ${ledgers.length} ledgers`);
        
    } catch (e) {
        console.error('--- ERROR ---');
        console.error(e);
    }
    process.exit(0);
}
test();


import { getInvoiceItems } from '../../backend/database/queries';
async function run() {
    try {
        const id = '878ced8a-664e-4794-a29a-b0ef6467ba1a';
        const items = await getInvoiceItems(id);
        console.log('--- TEST getInvoiceItems ---');
        console.log(items);
    } catch (e) {
        console.error('ERROR:', e);
    }
    process.exit(0);
}
run();

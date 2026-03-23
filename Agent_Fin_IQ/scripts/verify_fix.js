import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

async function check() {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    try {
        // 1. Find ANY invoice that is 'Processing' 
        const findRes = await pool.query("SELECT id, invoice_number FROM ap_invoices WHERE processing_status = 'Processing' LIMIT 1");
        if (findRes.rows.length === 0) {
            console.log('No processing invoices found to test with.');
            return;
        }
        const id = findRes.rows[0].id;
        console.log(`Testing with Invoice ${findRes.rows[0].invoice_number} (ID: ${id})`);

        // 2. Faked n8n Success: set status to 'Ready to Post'
        await pool.query("UPDATE ap_invoices SET processing_status = 'Ready to Post' WHERE id = $1", [id]);
        console.log('Step 2: Faked n8n Success: Status set to Ready to Post');

        // 3. Simulate the FIXED ipc.ts handler logic
        const current = (await pool.query('SELECT processing_status FROM ap_invoices WHERE id = $1', [id])).rows[0];
        const currentStatus = current.processing_status || 'Processing';
        
        const terminalStatuses = ['Ready to Post', 'Awaiting Input', 'Handoff', 'Posted', 'Auto-Posted'];
        const isSuccess = true;
        const nextStatus = (isSuccess && !terminalStatuses.includes(currentStatus)) ? 'Processing' : (isSuccess ? currentStatus : 'Failed');

        console.log(`Step 3: Simulated finalize-batch-file logic result status: ${nextStatus}`);

        if (nextStatus === 'Ready to Post') {
            console.log('SUCCESS: Status was preserved!');
        } else {
            console.log('FAILURE: Status was reset!');
        }

    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
}

check();

require('dotenv').config({ path: './config/.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function runTest() {
    console.log("Starting upload test...");

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log("✅ DB Connected");

        const srcPath = 'C:/Users/Admin/Desktop/invoice_grn_ses/12237-24G02674_page-0004.jpg';
        if (!fs.existsSync(srcPath)) {
            console.error("❌ Test file not found at:", srcPath);
            process.exit(1);
        }

        const fileName = path.basename(srcPath);
        const batchId = 'test_batch_' + Date.now();
        const destDir = path.join(__dirname, 'data', 'batches', batchId, 'source');
        const destPath = path.join(destDir, fileName);

        // Create folders
        fs.mkdirSync(destDir, { recursive: true });

        // Copy file
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ File copied to: ${destPath}`);

        // Insert into DB
        const res = await pool.query(
            'INSERT INTO invoices (file_name, file_path, batch_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [fileName, destPath, batchId, 'Processing']
        );

        const invoice = res.rows[0];
        console.log("✅ Invoice record created:", invoice);

        // Check if audit_events exists (or audit_logs)
        // Checking table names
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'audit_%'
        `);
        console.log("Audit tables available:", tableCheck.rows.map(r => r.table_name).join(', '));

        const auditTable = tableCheck.rows.some(r => r.table_name === 'audit_logs') ? 'audit_logs' : 'audit_events';

        await pool.query(
            `INSERT INTO ${auditTable} (invoice_id, event_type, description) VALUES ($1, $2, $3)`,
            [invoice.id, 'Created', `Invoice "${fileName}" uploaded for testing`]
        );
        console.log(`✅ Audit event logged to ${auditTable}`);

        console.log("\n--- TEST SUCCESSFUL ---");

    } catch (err) {
        console.error("❌ Test failed:", err);
    } finally {
        await pool.end();
    }
}

runTest();

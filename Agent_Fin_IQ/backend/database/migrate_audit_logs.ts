/**
 * Explicit migration for the audit_logs table to support company isolation.
 * Adds missing columns: company_id, old_values, new_values, changed_by_user_id.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../config/.env') });

const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('[Migrate] Connected to database');

        // Check if audit_logs exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'audit_logs'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.error('[Migrate] ❌ Error: audit_logs table does not exist.');
            return;
        }

        // Add missing columns
        const alters = [
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL`,
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB`,
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB`,
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_by_user_id UUID`
        ];

        for (const sql of alters) {
            console.log(`[Migrate] Running: ${sql}`);
            await client.query(sql);
        }

        // Backfill company_id from ap_invoices
        console.log('[Migrate] Backfilling company_id from ap_invoices...');
        const backfill = await client.query(`
            UPDATE audit_logs al
            SET company_id = inv.company_id
            FROM ap_invoices inv
            WHERE al.invoice_id = inv.id
              AND al.company_id IS NULL
              AND inv.company_id IS NOT NULL;
        `);
        console.log(`[Migrate] ✅ Backfilled ${backfill.rowCount} audit records.`);

        // Add index for company_id
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id)`);

        console.log('[Migrate] 🎉 Migration complete!');
    } catch (err) {
        console.error('[Migrate] ❌ Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();

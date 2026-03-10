/**
 * backend/utils/migrate-db.ts — Database Migration Script
 * 
 * Run with: npx tsx backend/utils/migrate-db.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const { Pool } = pg;

// ESM Compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project config
const envPath = path.resolve(__dirname, '../../config/.env');
if (!fs.existsSync(envPath)) {
    console.error(`[MIGRATE] ❌ .env not found at ${envPath}`);
    process.exit(1);
}
dotenv.config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    console.log('[MIGRATE] Starting database migration...');
    try {
        await pool.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS doc_type TEXT,
            ADD COLUMN IF NOT EXISTS posted_to_tally_json JSONB,
            ADD COLUMN IF NOT EXISTS all_data_invoice JSONB,
            ADD COLUMN IF NOT EXISTS tally_id TEXT,
            ADD COLUMN IF NOT EXISTS uploader_name TEXT DEFAULT 'System';
            
            ALTER TABLE vendors
            ADD COLUMN IF NOT EXISTS address TEXT,
            ADD COLUMN IF NOT EXISTS tds_nature TEXT DEFAULT 'Any';

            CREATE TABLE IF NOT EXISTS invoice_items (
                id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id            UUID REFERENCES invoices(id) ON DELETE CASCADE,
                description           TEXT NOT NULL,
                ledger                TEXT,
                tax                   TEXT,
                quantity              DECIMAL(15,3) DEFAULT 1,
                rate                  DECIMAL(15,2) DEFAULT 0,
                discount              DECIMAL(5,2) DEFAULT 0,
                amount                DECIMAL(15,2) DEFAULT 0,
                created_at            TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('[MIGRATE] ✅ Successfully updated schema with Doc Hub Detail View fields.');

    } catch (err) {
        console.error('[MIGRATE] ❌ Migration failed:', err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();

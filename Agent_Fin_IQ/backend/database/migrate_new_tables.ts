/**
 * Run the new table migrations against the database.
 * Usage: node --loader ts-node/esm backend/database/migrate_new_tables.ts
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

        // 1. companies
        await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        trade_name TEXT,
        type TEXT DEFAULT 'pvt_ltd',
        gstin TEXT,
        pan TEXT,
        cin TEXT,
        tan TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        fy_start TEXT DEFAULT 'april',
        currency TEXT DEFAULT 'INR',
        books_from DATE,
        tally_server_url TEXT DEFAULT 'http://localhost:9000',
        tally_company_name TEXT,
        tally_license_serial TEXT,
        tally_auto_sync BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('[Migrate] ✅ companies table created');

        // 2. app_config
        await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        id SERIAL PRIMARY KEY,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        config_key TEXT NOT NULL,
        config_value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, config_key)
      );
    `);
        console.log('[Migrate] ✅ app_config table created');

        // 3. ledger_masters
        await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_masters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        parent_group TEXT NOT NULL,
        ledger_type TEXT DEFAULT 'expense',
        tax_rate DECIMAL(5,2),
        tally_guid TEXT,
        is_active BOOLEAN DEFAULT true,
        synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('[Migrate] ✅ ledger_masters table created');

        // 4. tds_sections
        await client.query(`
      CREATE TABLE IF NOT EXISTS tds_sections (
        id SERIAL PRIMARY KEY,
        section TEXT NOT NULL,
        description TEXT NOT NULL,
        rate_individual DECIMAL(5,2),
        rate_company DECIMAL(5,2),
        threshold DECIMAL(15,2),
        is_active BOOLEAN DEFAULT true
      );
    `);
        console.log('[Migrate] ✅ tds_sections table created');

        // 5. batches
        await client.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        label TEXT NOT NULL,
        uploaded_by TEXT DEFAULT 'System',
        file_count INT DEFAULT 0,
        status TEXT DEFAULT 'Processing',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('[Migrate] ✅ batches table created');

        // 6. ALTER existing tables
        const alters = [
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pan TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pincode TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tally_ledger_name TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_synced_from_tally BOOLEAN DEFAULT false`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS alias TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_name TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_account_no TEXT`,
            `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_ifsc TEXT`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS irn TEXT`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ack_no TEXT`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ack_date DATE`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS eway_bill_no TEXT`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst DECIMAL(15,2) DEFAULT 0`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst DECIMAL(15,2) DEFAULT 0`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS round_off DECIMAL(15,2) DEFAULT 0`,
            `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_in_words TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS hsn_sac TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tds_section TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(15,2) DEFAULT 0`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS order_no TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS part_no TEXT`,
            `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS possible_gl_names TEXT`,
        ];
        for (const sql of alters) {
            await client.query(sql);
        }
        console.log('[Migrate] ✅ ALTER statements applied');

        // 7. Seed ledger_masters (expense)
        const expenseLedgers = [
            'IT Expenses', 'Professional Fees', 'Cloud Services', 'Office Maintenance',
            'Printing & Stationery', 'Marketing & Advertising', 'Travelling Expenses',
            'Telephone & Internet', 'Rent', 'Electricity & Power', 'Insurance',
            'Courier & Freight', 'Employee Welfare', 'Audit Fees', 'Subscription & Memberships'
        ];
        for (const name of expenseLedgers) {
            await client.query(
                `INSERT INTO ledger_masters (name, parent_group, ledger_type) VALUES ($1, 'Indirect Expenses', 'expense') ON CONFLICT DO NOTHING`,
                [name]
            );
        }
        console.log('[Migrate] ✅ 15 expense ledgers seeded');

        // 8. Seed ledger_masters (tax)
        const taxLedgers = [
            { name: 'CGST Input @9%', rate: 9.00 },
            { name: 'SGST Input @9%', rate: 9.00 },
            { name: 'IGST Input @18%', rate: 18.00 },
            { name: 'CGST Input @2.5%', rate: 2.50 },
            { name: 'SGST Input @2.5%', rate: 2.50 },
            { name: 'IGST Input @5%', rate: 5.00 },
            { name: 'CGST Input @6%', rate: 6.00 },
            { name: 'SGST Input @6%', rate: 6.00 },
            { name: 'IGST Input @12%', rate: 12.00 },
            { name: 'CGST Input @14%', rate: 14.00 },
            { name: 'SGST Input @14%', rate: 14.00 },
            { name: 'IGST Input @28%', rate: 28.00 },
        ];
        for (const t of taxLedgers) {
            await client.query(
                `INSERT INTO ledger_masters (name, parent_group, ledger_type, tax_rate) VALUES ($1, 'Duties & Taxes', 'tax_gst', $2) ON CONFLICT DO NOTHING`,
                [t.name, t.rate]
            );
        }
        console.log('[Migrate] ✅ 12 tax ledgers seeded');

        // 9. Seed TDS sections
        const tdsSections = [
            { section: '194C', desc: 'Payment to Contractors', ri: 1.00, rc: 2.00, th: 30000 },
            { section: '194J', desc: 'Professional / Technical Fees', ri: 10.00, rc: 10.00, th: 30000 },
            { section: '194I', desc: 'Rent', ri: 10.00, rc: 10.00, th: 240000 },
            { section: '194H', desc: 'Commission / Brokerage', ri: 5.00, rc: 5.00, th: 15000 },
            { section: '194A', desc: 'Interest (other than securities)', ri: 10.00, rc: 10.00, th: 40000 },
            { section: '194D', desc: 'Insurance Commission', ri: 5.00, rc: 5.00, th: 15000 },
            { section: '194Q', desc: 'Purchase of Goods', ri: 0.10, rc: 0.10, th: 5000000 },
        ];
        for (const t of tdsSections) {
            await client.query(
                `INSERT INTO tds_sections (section, description, rate_individual, rate_company, threshold)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                [t.section, t.desc, t.ri, t.rc, t.th]
            );
        }
        console.log('[Migrate] ✅ 7 TDS sections seeded');

        // 10. Indexes
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id)`,
            `CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id)`,
            `CREATE INDEX IF NOT EXISTS idx_ledger_masters_company ON ledger_masters(company_id)`,
            `CREATE INDEX IF NOT EXISTS idx_ledger_masters_type ON ledger_masters(ledger_type)`,
            `CREATE INDEX IF NOT EXISTS idx_batches_company ON batches(company_id)`,
        ];
        for (const sql of indexes) {
            await client.query(sql);
        }
        console.log('[Migrate] ✅ New indexes created');

        console.log('\n[Migrate] 🎉 Migration complete! All 11 tables ready.');
    } catch (err) {
        console.error('[Migrate] ❌ Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();

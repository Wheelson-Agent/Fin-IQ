/**
 * Create agent_tally database and tables on Aiven PostgreSQL.
 * Run: node scripts/create_db.cjs
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

const DB_NAME = 'agent_tally';

async function run() {
    console.log('Creating database & tables on Aiven...\n');

    const adminPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    // Try to create agent_tally database
    let targetDb = DB_NAME;
    try {
        const check = await adminPool.query("SELECT 1 FROM pg_database WHERE datname=$1", [DB_NAME]);
        if (check.rows.length === 0) {
            await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
            console.log(`✅ Database "${DB_NAME}" created`);
        } else {
            console.log(`ℹ️  Database "${DB_NAME}" already exists`);
        }
    } catch (err) {
        console.log(`⚠️  Cannot create database (${err.message}), using ${process.env.DB_NAME}`);
        targetDb = process.env.DB_NAME;
    }
    await adminPool.end();

    // Connect to target database
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: targetDb,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false },
    });

    const schema = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS vendors (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            gstin TEXT,
            under_group TEXT DEFAULT 'Sundry Creditors',
            state TEXT,
            total_due NUMERIC DEFAULT 0,
            invoice_count INTEGER DEFAULT 0,
            oldest_due DATE,
            aging TEXT CHECK (aging IN ('0-30','31-60','61-90','90+')),
            status TEXT CHECK (status IN ('Current','At Risk','Overdue')) DEFAULT 'Current',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            file_name TEXT NOT NULL,
            file_path TEXT,
            batch_id TEXT,
            vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
            vendor_name TEXT,
            invoice_no TEXT,
            date DATE,
            due_date DATE,
            amount NUMERIC DEFAULT 0,
            gst NUMERIC DEFAULT 0,
            total NUMERIC DEFAULT 0,
            po_number TEXT,
            gl_account TEXT,
            status TEXT CHECK (status IN (
                'Auto-Posted','Approved','Pending Approval',
                'Failed','Manual Review','Processing'
            )) DEFAULT 'Processing',
            confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) DEFAULT 0,
            processing_time TEXT,
            validation_time TEXT,
            approval_delay_time TEXT,
            failure_reason TEXT,
            failure_category TEXT,
            retry_count INTEGER DEFAULT 0,
            is_mapped BOOLEAN DEFAULT false,
            is_high_amount BOOLEAN DEFAULT false,
            pre_ocr_status TEXT,
            pre_ocr_score INTEGER,
            ocr_raw_data JSONB,
            n8n_validation_status TEXT DEFAULT 'pending',
            is_posted_to_tally BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_events (
            id SERIAL PRIMARY KEY,
            invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
            invoice_no TEXT,
            vendor_name TEXT,
            event_type TEXT NOT NULL,
            user_name TEXT NOT NULL DEFAULT 'agent_fc',
            description TEXT,
            before_data JSONB,
            after_data JSONB,
            timestamp TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS processing_jobs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
            stage TEXT NOT NULL,
            status TEXT CHECK (status IN (
                'NOT_STARTED','RUNNING','PASSED','FAILED','SKIPPED'
            )) DEFAULT 'NOT_STARTED',
            metrics JSONB,
            error_message TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT CHECK (role IN ('admin','approver','operator','viewer')) DEFAULT 'operator',
            is_active BOOLEAN DEFAULT true,
            last_login TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        INSERT INTO users (email, password_hash, display_name, role)
        VALUES ('admin@agent-tally.local', 'dev-hash', 'Admin', 'admin')
        ON CONFLICT (email) DO NOTHING;
    `;

    try {
        await pool.query(schema);
        console.log('\n✅ All tables created:');
        const tables = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
        );
        tables.rows.forEach(r => console.log('   ✓ ' + r.table_name));
        console.log('\n📍 Database: ' + targetDb);
        console.log('📍 Host: ' + process.env.DB_HOST);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }

    await pool.end();
    console.log('\nDone!');
}

run().catch(console.error);

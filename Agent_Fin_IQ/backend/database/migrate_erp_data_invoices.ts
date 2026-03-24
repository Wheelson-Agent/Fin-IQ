/**
 * ============================================================
 * migrate_erp_data_invoices.ts — Database Migration Script
 * ============================================================
 *
 * PURPOSE:
 *   Creates the `erp_data_invoices` table to store raw data from
 *   any ERP system. This is a generic store that supports
 *   field-level querying and full raw payload storage.
 *
 * PATTERNS:
 *   - UUID primary keys (gen_random_uuid())
 *   - NUMERIC(15,2) for monetary values
 *   - TIMESTAMPTZ for all timestamps
 *   - Single transaction execution
 *
 * USAGE:
 *   npx ts-node backend/database/migrate_erp_data_invoices.ts
 * ============================================================
 */import { pool } from './connection';

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('\n--- Starting ERP Data Invoices Migration ---');

        // 1. Ensure UUID extension exists
        await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
        console.log('✓ UUID extension (pgcrypto) verified.');

        // 2. Start Transaction
        await client.query('BEGIN;');

        console.log('Creating table and defining structure...');

        const migrationSql = `
            -- ── TABLE DEFINITION ──────────────────────────────────
            CREATE TABLE IF NOT EXISTS public.erp_data_invoices (
                -- USER SPECIFIED COLUMNS (12 + 1)
                id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id            UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
                purchase_order_id     UUID          REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
                invoice_number        TEXT,
                company_name          TEXT,
                seller_name           TEXT,
                invoice_date          DATE,
                tax_total             NUMERIC(15, 2),
                total_amount          NUMERIC(15, 2),
                voucher_number        TEXT,
                voucher_type          TEXT,
                erp_raw_data          TEXT,
                erp_raw_data_json     JSONB,

                -- ENGINEER RECOMMENDED ADDITIONS (11)
                erp_source            TEXT          NOT NULL DEFAULT 'unknown',
                ap_invoice_id         UUID          REFERENCES public.ap_invoices(id) ON DELETE SET NULL,
                seller_gstin          TEXT,
                company_gstin         TEXT,
                subtotal_amount       NUMERIC(15, 2),
                currency              TEXT          DEFAULT 'INR',
                erp_document_id       TEXT,
                sync_status           TEXT          NOT NULL DEFAULT 'pending',
                sync_error            TEXT,
                synced_at             TIMESTAMPTZ,
                is_processed          BOOLEAN       NOT NULL DEFAULT FALSE,

                -- AUDIT TIMESTAMPS (2)
                created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            );

            -- ── INDEXES (10 CUSTOM) ────────────────────────────────
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_company_id ON public.erp_data_invoices(company_id);
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_erp_source ON public.erp_data_invoices(erp_source);
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_sync_status ON public.erp_data_invoices(sync_status);
            
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_invoice_number ON public.erp_data_invoices(invoice_number) WHERE invoice_number IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_voucher_number ON public.erp_data_invoices(voucher_number) WHERE voucher_number IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_erp_document_id ON public.erp_data_invoices(erp_document_id) WHERE erp_document_id IS NOT NULL;
            
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_ap_invoice_id ON public.erp_data_invoices(ap_invoice_id) WHERE ap_invoice_id IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_purchase_order_id ON public.erp_data_invoices(purchase_order_id) WHERE purchase_order_id IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_is_processed ON public.erp_data_invoices(is_processed) WHERE is_processed = FALSE;

            CREATE INDEX IF NOT EXISTS idx_erp_data_invoices_company_source_status ON public.erp_data_invoices(company_id, erp_source, sync_status);

            -- ── AUTO-UPDATE TRIGGER ────────────────────────────────
            CREATE OR REPLACE FUNCTION public.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_erp_data_invoices_updated_at ON public.erp_data_invoices;

            CREATE TRIGGER trg_erp_data_invoices_updated_at
              BEFORE UPDATE ON public.erp_data_invoices
              FOR EACH ROW
              EXECUTE FUNCTION public.update_updated_at_column();

            -- ── COMMENTS ───────────────────────────────────────────
            COMMENT ON TABLE public.erp_data_invoices IS 'Generic store for raw ERP invoice and voucher data.';
            COMMENT ON COLUMN public.erp_data_invoices.erp_source IS 'Which ERP system sent this record: tally | sap | eppinger | zoho | custom';
            COMMENT ON COLUMN public.erp_data_invoices.erp_raw_data IS 'Original raw text/XML payload from ERP. Immutable after insert.';
            COMMENT ON COLUMN public.erp_data_invoices.erp_raw_data_json IS 'JSON-parsed version of erp_raw_data. Structure varies by erp_source.';
            COMMENT ON COLUMN public.erp_data_invoices.erp_document_id IS 'ERP internal unique ID for deduplication on re-sync operations.';
            COMMENT ON COLUMN public.erp_data_invoices.sync_status IS 'Sync lifecycle: pending → synced | failed | skipped | duplicate';
            COMMENT ON COLUMN public.erp_data_invoices.ap_invoice_id IS 'FK to ap_invoices. NULL until raw record is matched.';
            COMMENT ON COLUMN public.erp_data_invoices.is_processed IS 'FALSE = raw record not yet matched to an ap_invoice.';
        `;

        await client.query(migrationSql);
        await client.query('COMMIT;');

        console.log('✓ Migration executed successfully and committed.');

        // 3. Verification Queries
        console.log('\n--- Running Verification Queries ---');

        // V1: Table existence
        const v1 = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'erp_data_invoices';
        `);
        console.log(v1.rows.length === 1 ? 'V1: ✓ Table erp_data_invoices exists.' : 'V1: ✗ Table not found.');

        // V2: Column count and types
        const v2 = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'erp_data_invoices'
            ORDER BY ordinal_position;
        `);
        console.log(v2.rows.length === 26 ? `V2: ✓ Found 26 columns.` : `V2: ✗ Found ${v2.rows.length} columns (expected 26).`);

        // V3: Indexes (Expect 11: PK + 10 custom)
        const v3 = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE schemaname = 'public' AND tablename = 'erp_data_invoices';
        `);
        console.log(v3.rows.length === 11 ? `V3: ✓ Found 11 indexes.` : `V3: ✗ Found ${v3.rows.length} indexes (expected 11).`);

        // V4: Foreign Keys
        const v4 = await client.query(`
            SELECT kcu.column_name, ccu.table_name AS fk_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'erp_data_invoices';
        `);
        console.log(v4.rows.length === 3 ? `V4: ✓ Found 3 Foreign Keys.` : `V4: ✗ Found ${v4.rows.length} Foreign Keys (expected 3).`);

        // V5: Trigger
        const v5 = await client.query(`
            SELECT trigger_name FROM information_schema.triggers 
            WHERE event_object_table = 'erp_data_invoices' AND trigger_name = 'trg_erp_data_invoices_updated_at';
        `);
        console.log(v5.rows.length === 1 ? 'V5: ✓ Trigger is active.' : 'V5: ✗ Trigger not found.');

        // V6: Row count
        const v6 = await client.query('SELECT COUNT(*) FROM public.erp_data_invoices;');
        console.log(v6.rows[0].count === '0' ? 'V6: ✓ Row count is 0.' : `V6: ✗ Unexpected row count: ${v6.rows[0].count}`);

        console.log('\n--- Migration Verification Complete ---\n');

    } catch (error) {
        await client.query('ROLLBACK;');
        console.error('\n!!! Migration Failed (Rolled Back) !!!');
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();

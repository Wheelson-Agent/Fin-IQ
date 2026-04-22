/**
 * backfill_doc_type.ts
 *
 * Backfills ap_invoices.doc_type using the source of truth:
 *   ocr_raw_payload -> line_items[0].ledger
 *
 *   "services"  (case-insensitive) → doc_type = 'services'
 *   anything else                  → doc_type = 'goods'
 *
 * Only rows that have a non-null line_items[0].ledger are updated.
 * Rows with no ocr_raw_payload or no line items are skipped (logged).
 *
 * Run from Agent_Fin_IQ/:
 *   npx ts-node scripts/db/backfill_doc_type.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') });

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: { rejectUnauthorized: false },
});

async function run() {
    console.log('--- BACKFILL doc_type FROM ocr_raw_payload.line_items[0].ledger ---\n');

    const res = await pool.query(
        `SELECT id, doc_type, ocr_raw_payload FROM ap_invoices WHERE ocr_raw_payload IS NOT NULL`
    );

    if (res.rows.length === 0) {
        console.log('No rows with ocr_raw_payload found. Nothing to do.');
        await pool.end();
        return;
    }

    console.log(`Found ${res.rows.length} invoices with ocr_raw_payload. Processing...\n`);

    let updated = 0;
    let skipped = 0;
    let unchanged = 0;

    for (const row of res.rows) {
        let payload = row.ocr_raw_payload;

        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { payload = null; }
        }

        const lineItems = Array.isArray(payload?.line_items) ? payload.line_items : [];
        const firstItem = lineItems[0];

        if (!firstItem) {
            console.warn(`  SKIP  ${row.id} — no line_items in ocr_raw_payload`);
            skipped++;
            continue;
        }

        const firstLedger = String(firstItem.ledger ?? '').trim().toLowerCase();
        if (!firstLedger) {
            console.warn(`  SKIP  ${row.id} — line_items[0].ledger is empty`);
            skipped++;
            continue;
        }

        const derivedDocType = firstLedger === 'services' ? 'services' : 'goods';

        if (row.doc_type === derivedDocType) {
            unchanged++;
            continue;
        }

        await pool.query(
            `UPDATE ap_invoices SET doc_type = $1, updated_at = NOW() WHERE id = $2`,
            [derivedDocType, row.id]
        );

        console.log(`  UPDATE ${row.id}  "${row.doc_type ?? 'NULL'}" → "${derivedDocType}"  (ledger="${firstItem.ledger}")`);
        updated++;
    }

    console.log(`\n--- DONE ---`);
    console.log(`  Updated  : ${updated}`);
    console.log(`  Unchanged: ${unchanged}`);
    console.log(`  Skipped  : ${skipped}`);

    await pool.end();
    process.exit(0);
}

run().catch((err) => {
    console.error('Backfill failed:', err);
    pool.end();
    process.exit(1);
});

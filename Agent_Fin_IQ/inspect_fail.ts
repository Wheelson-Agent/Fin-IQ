
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') });

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: { rejectUnauthorized: false }
});

async function inspect(ids: string[]) {
    const client = await pool.connect();
    const results = [];
    try {
        for (const id of ids) {
            const res = await client.query('SELECT id, file_name, invoice_number, vendor_id, processing_status, failure_reason, n8n_validation_status, n8n_val_json_data FROM ap_invoices WHERE id = $1', [id]);
            if (res.rows.length === 0) {
                results.push({ id, found: false });
                continue;
            }
            results.push({ id, found: true, ...res.rows[0] });
        }
        fs.writeFileSync('inspect_results.json', JSON.stringify(results, null, 2));
        console.log('Results saved to inspect_results.json');
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
    console.log('Provide IDs as arguments');
} else {
    inspect(ids);
}


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
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        const res = await pool.query("UPDATE ap_invoices SET processing_status = 'Ready to Post' WHERE processing_status = 'Ready' OR (n8n_validation_status = 'True' AND processing_status != 'Posted' AND processing_status != 'Auto-Posted')");
        console.log('Updated', res.rowCount, 'rows to Ready to Post');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

migrate();

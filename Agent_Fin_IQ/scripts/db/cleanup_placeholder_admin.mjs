/**
 * One-shot cleanup: removes any leftover PENDING_BOOTSTRAP placeholder
 * rows from the users table. Safe to re-run. Lists remaining admins
 * so you can verify your real account is still there.
 *
 * Run with:  node scripts/db/cleanup_placeholder_admin.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../config/.env') });

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

try {
    const del = await pool.query(
        `DELETE FROM users WHERE password_hash = 'PENDING_BOOTSTRAP' RETURNING email`
    );
    console.log(`Deleted ${del.rowCount} placeholder row(s):`, del.rows.map(r => r.email));

    const remaining = await pool.query(
        `SELECT email, role, LENGTH(password_hash) AS hash_len FROM users ORDER BY role`
    );
    console.log('Remaining users:');
    for (const r of remaining.rows) console.log(`  - ${r.email}  role=${r.role}  hashLen=${r.hash_len}`);
} finally {
    await pool.end();
}

const { Pool } = require('pg');
require('dotenv').config({ path: './config/.env' });
const pool = new Pool();
pool.query('SELECT status, pre_ocr_status, failure_reason FROM invoices ORDER BY id DESC LIMIT 1')
    .then(res => {
        console.log("DB RESULT:", res.rows[0]);
        process.exit(0);
    })
    .catch(err => {
        console.error("DB ERROR:", err);
        process.exit(1);
    });

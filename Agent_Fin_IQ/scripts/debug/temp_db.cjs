const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: './config/.env' });

const pool = new Pool();
pool.query('SELECT n8n_validation_status, all_data_invoice, ocr_raw_data FROM invoices ORDER BY created_at DESC LIMIT 1')
    .then(res => {
        console.log(JSON.stringify(res.rows[0], null, 2));
        pool.end();
    }).catch(err => {
        console.error(err);
        pool.end();
    });

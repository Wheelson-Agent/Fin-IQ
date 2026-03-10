const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'agent_tally',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false },
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
    .then(r => {
        console.log('Tables in agent_tally database:');
        r.rows.forEach(x => console.log('  ✓ ' + x.table_name));
        console.log('\nTotal: ' + r.rows.length + ' tables');
        pool.end();
    })
    .catch(e => {
        console.log('Error:', e.message);
        pool.end();
    });

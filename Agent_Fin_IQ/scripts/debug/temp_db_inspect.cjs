const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = 'config/.env';
const env = fs.readFileSync(envPath, 'utf8');
const config = {};
env.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
        config[key.trim()] = vals.join('=').trim().replace(/"/g, '');
    }
});

const client = new Client({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices'`);
    console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
    const sample = await client.query(`SELECT * FROM invoices WHERE n8n_validation_status IS NOT NULL LIMIT 1`);
    console.log('Sample Data:', JSON.stringify(sample.rows[0], null, 2));
    await client.end();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});

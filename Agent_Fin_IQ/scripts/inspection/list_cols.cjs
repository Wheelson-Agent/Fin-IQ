const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('config/.env', 'utf8');
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
    console.log(cols.rows.map(r => r.column_name));
    await client.end();
}

run().catch(console.error);

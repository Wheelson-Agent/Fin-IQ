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
    const result = await client.query(`SELECT id, n8n_val_json_data FROM invoices WHERE n8n_val_json_data IS NOT NULL ORDER BY created_at DESC LIMIT 5`);
    fs.writeFileSync('val_data.json', JSON.stringify(result.rows, null, 2));
    await client.end();
}

run().catch(console.error);
